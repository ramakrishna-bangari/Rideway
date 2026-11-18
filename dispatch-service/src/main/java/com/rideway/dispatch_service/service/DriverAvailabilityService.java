package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.client.IdentityServiceClient;
import com.rideway.dispatch_service.client.RideServiceClient;
import com.rideway.dispatch_service.dto.event.DriverAvailableEvent;
import com.rideway.dispatch_service.dto.request.UpdateAvailabilityRequest;
import com.rideway.dispatch_service.dto.response.DriverAvailabilityResponse;
import com.rideway.dispatch_service.dto.response.IdentityDriverResponse;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.entity.DriverAvailability;
import com.rideway.dispatch_service.enums.DriverAvailabilityStatus;
import com.rideway.dispatch_service.repository.DriverAvailabilityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DriverAvailabilityService {

    private final DriverAvailabilityRepository availabilityRepository;
    private final RideServiceClient rideServiceClient;
    private final IdentityServiceClient identityServiceClient;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${app.services.ride.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalServiceToken;

    @Transactional
    public DriverAvailabilityResponse updateAvailability(UUID driverId, UpdateAvailabilityRequest request) {
        if (driverId == null || request == null || request.getStatus() == null) {
            throw new IllegalArgumentException("Driver ID and availability status are required");
        }

        DriverAvailabilityStatus requestedStatus = request.getStatus();
        if (requestedStatus != DriverAvailabilityStatus.AVAILABLE && requestedStatus != DriverAvailabilityStatus.OFFLINE) {
            throw new IllegalArgumentException("Drivers can only switch between AVAILABLE and OFFLINE");
        }

        DriverAvailability availability = availabilityRepository.findByDriverId(driverId)
                .orElseGet(() -> DriverAvailability.builder().driverId(driverId).status(DriverAvailabilityStatus.OFFLINE).build());

        if (availability.getStatus() == DriverAvailabilityStatus.BUSY || availability.getStatus() == DriverAvailabilityStatus.RESERVED) {
            UUID activeRideId = availability.getActiveRideId();
            boolean isReallyActive = false;

            if (activeRideId != null) {
                try {
                    RideDetailsResponse ride = rideServiceClient.getRideDetails(activeRideId, internalServiceToken);
                    if (ride != null) {
                        String st = ride.status() != null ? ride.status().toUpperCase() : "";
                        if ("ACCEPTED".equals(st) || "STARTED".equals(st)) {
                            isReallyActive = true;
                        }
                    }
                } catch (Exception ex) {
                    log.debug("Checking active ride status: {}", ex.getMessage());
                }
            }

            if (isReallyActive) {
                throw new IllegalStateException("You cannot change availability while a ride is active or reserved");
            }

            availability.setActiveRideId(null);
        }

        if (request.getVehicleType() != null && !request.getVehicleType().isBlank()) {
            availability.setVehicleType(request.getVehicleType().trim().toUpperCase());
        }

        availability.setStatus(requestedStatus);
        DriverAvailability saved = availabilityRepository.save(availability);

        if (requestedStatus == DriverAvailabilityStatus.AVAILABLE) {
            try {
                eventPublisher.publishEvent(new DriverAvailableEvent(driverId));
            } catch (Exception ex) {
                log.warn("Event publish notice for driver {}: {}", driverId, ex.getMessage());
            }
        }

        return toResponse(saved);
    }

    @Transactional
    public DriverAvailabilityResponse getAvailability(UUID driverId) {
        DriverAvailability availability = availabilityRepository.findByDriverId(driverId)
                .orElseGet(() -> availabilityRepository.save(DriverAvailability.builder().driverId(driverId).status(DriverAvailabilityStatus.OFFLINE).build()));

        if (availability.getStatus() == DriverAvailabilityStatus.BUSY || availability.getStatus() == DriverAvailabilityStatus.RESERVED) {
            UUID activeRideId = availability.getActiveRideId();
            boolean stillActive = false;
            if (activeRideId != null) {
                try {
                    RideDetailsResponse ride = rideServiceClient.getRideDetails(activeRideId, internalServiceToken);
                    if (ride != null) {
                        String st = ride.status() != null ? ride.status().toUpperCase() : "";
                        if ("ACCEPTED".equals(st) || "STARTED".equals(st)) {
                            stillActive = true;
                        }
                    }
                } catch (Exception ex) {
                    log.debug("Checking ride status: {}", ex.getMessage());
                }
            }
            if (!stillActive) {
                availability.setActiveRideId(null);
                availability.setStatus(DriverAvailabilityStatus.AVAILABLE);
                availability = availabilityRepository.save(availability);
            }
        }

        if (identityServiceClient != null) {
            try {
                IdentityDriverResponse idResp = identityServiceClient.getDriverDetails(driverId);
                if (idResp != null && idResp.vehicleType() != null && !idResp.vehicleType().isBlank()) {
                    String trueType = idResp.vehicleType().trim().toUpperCase();
                    if (!trueType.equalsIgnoreCase(availability.getVehicleType())) {
                        availability.setVehicleType(trueType);
                        availability = availabilityRepository.save(availability);
                    }
                }
            } catch (Exception ignored) {}
        }

        return toResponse(availability);
    }

    @Transactional
    public boolean reserveDriver(UUID driverId, UUID rideId) {
        if (driverId == null || rideId == null) {
            throw new IllegalArgumentException("Driver ID and ride ID are required");
        }

        DriverAvailability availability = availabilityRepository.findByDriverId(driverId).orElse(null);
        if (availability == null || availability.getStatus() != DriverAvailabilityStatus.AVAILABLE) {
            return false;
        }

        availability.setStatus(DriverAvailabilityStatus.RESERVED);
        availability.setActiveRideId(rideId);
        availabilityRepository.save(availability);

        log.info("Driver reserved: driverId={}, rideId={}", driverId, rideId);
        return true;
    }

    @Transactional
    public void confirmDriverAssignment(UUID driverId, UUID rideId) {
        DriverAvailability availability = availabilityRepository.findByDriverId(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver availability not found"));

        availability.setStatus(DriverAvailabilityStatus.BUSY);
        availability.setActiveRideId(rideId);
        availabilityRepository.save(availability);

        log.info("Driver assigned: driverId={}, rideId={}", driverId, rideId);
    }

    @Transactional
    public boolean releaseReservation(UUID driverId, UUID rideId) {
        DriverAvailability availability = availabilityRepository.findByDriverId(driverId).orElse(null);
        if (availability == null) {
            return false;
        }

        if (availability.getStatus() == DriverAvailabilityStatus.RESERVED || (rideId != null && rideId.equals(availability.getActiveRideId()))) {
            availability.setStatus(DriverAvailabilityStatus.AVAILABLE);
            availability.setActiveRideId(null);
            availabilityRepository.save(availability);

            log.info("Driver released: driverId={}, rideId={}", driverId, rideId);
            return true;
        }

        return false;
    }

    @Transactional
    public void completeDriverRide(UUID driverId, UUID rideId) {
        if (driverId == null) return;

        availabilityRepository.findByDriverId(driverId).ifPresent(availability -> {
            availability.setStatus(DriverAvailabilityStatus.AVAILABLE);
            availability.setActiveRideId(null);
            availabilityRepository.save(availability);
            log.info("Driver available: driverId={}, rideId={}", driverId, rideId);
        });
    }

    @Transactional
    public void completeRideByRideId(UUID rideId) {
        if (rideId == null) return;

        availabilityRepository.findByActiveRideId(rideId).ifPresent(availability -> {
            availability.setStatus(DriverAvailabilityStatus.AVAILABLE);
            availability.setActiveRideId(null);
            availabilityRepository.save(availability);
            log.info("Ride completed: rideId={}, driverId={}", rideId, availability.getDriverId());
        });
    }

    private DriverAvailabilityResponse toResponse(DriverAvailability availability) {
        return DriverAvailabilityResponse.builder()
                .driverId(availability.getDriverId())
                .status(availability.getStatus())
                .activeRideId(availability.getActiveRideId())
                .vehicleType(availability.getVehicleType())
                .lastLocationAt(availability.getLastLocationAt())
                .updatedAt(availability.getUpdatedAt())
                .build();
    }
}
