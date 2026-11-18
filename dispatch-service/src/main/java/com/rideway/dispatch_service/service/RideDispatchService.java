package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.client.IdentityServiceClient;
import com.rideway.dispatch_service.client.RideServiceClient;
import com.rideway.dispatch_service.dto.event.DriverAvailableEvent;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.entity.DriverAvailability;
import com.rideway.dispatch_service.entity.RideOffer;
import com.rideway.dispatch_service.enums.DispatchAttemptOutcome;
import com.rideway.dispatch_service.enums.DriverAvailabilityStatus;
import com.rideway.dispatch_service.enums.RideOfferStatus;
import com.rideway.dispatch_service.repository.DispatchAttemptRepository;
import com.rideway.dispatch_service.repository.DriverAvailabilityRepository;
import com.rideway.dispatch_service.repository.RideOfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RideDispatchService {

    private final RideServiceClient rideServiceClient;
    private final IdentityServiceClient identityServiceClient;
    private final DriverGeoLocationService driverGeoLocationService;
    private final DriverAvailabilityService driverAvailabilityService;
    private final DriverAvailabilityRepository availabilityRepository;
    private final RideOfferRepository rideOfferRepository;
    private final DispatchAttemptRepository dispatchAttemptRepository;
    private final DispatchAttemptService dispatchAttemptService;
    private final NotificationEventService notificationEventService;

    @Value("${app.dispatch.search-radius-km:50}")
    private double searchRadiusKm;

    @Value("${OFFER_TIMEOUT_SECONDS:${app.dispatch.offer-expiry-seconds:${app.dispatch.offer-timeout-seconds:60}}}")
    private long offerExpirySeconds = 60;

    @Value("${app.dispatch.max-driver-attempts:5}")
    private int maxDriverAttempts;

    @Value("${app.dispatch.location-freshness-seconds:300}")
    private long locationFreshnessSeconds;

    @Value("${app.services.ride.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalServiceToken;

    public void dispatchRide(UUID rideId) {
        if (rideId == null) {
            throw new IllegalArgumentException("Ride ID cannot be null");
        }

        log.info("Starting dispatch for ride {}", rideId);

        RideDetailsResponse ride;
        try {
            ride = rideServiceClient.getRideDetails(rideId, internalServiceToken);
        } catch (Exception ex) {
            log.error("Failed to fetch ride details for ride {}: {}", rideId, ex.getMessage());
            return;
        }

        if (ride == null || !"REQUESTED".equalsIgnoreCase(ride.status())) {
            return;
        }

        if (ride.driverId() != null) {
            return;
        }

        int offersSent = dispatchAttemptService.getTotalOffersSent(rideId);
        if (offersSent >= maxDriverAttempts) {
            log.info("Max offers ({}) reached for ride {}", maxDriverAttempts, rideId);
            return;
        }

        Set<UUID> attemptedDrivers = new HashSet<>(dispatchAttemptService.getPreviouslyOfferedDrivers(rideId));
        List<DriverGeoLocationService.NearbyDriverLocation> nearbyDrivers = new ArrayList<>();

        if (ride.pickupLatitude() != null && ride.pickupLongitude() != null) {
            try {
                nearbyDrivers = driverGeoLocationService.findNearbyDrivers(
                        ride.pickupLatitude().doubleValue(),
                        ride.pickupLongitude().doubleValue(),
                        searchRadiusKm
                );

                if (nearbyDrivers.isEmpty() && searchRadiusKm < 15.0) {
                    double expandedRadius = 25.0;
                    nearbyDrivers = driverGeoLocationService.findNearbyDrivers(
                            ride.pickupLatitude().doubleValue(),
                            ride.pickupLongitude().doubleValue(),
                            expandedRadius
                    );
                }
            } catch (Exception ex) {
                log.warn("Redis GEO lookup notice: {}", ex.getMessage());
            }
        }

        if (nearbyDrivers == null || nearbyDrivers.isEmpty()) {
            try {
                List<DriverAvailability> onlineDrivers = availabilityRepository.findAllByStatus(DriverAvailabilityStatus.AVAILABLE);

                if (onlineDrivers.isEmpty()) {
                    List<DriverAvailability> busyDrivers = availabilityRepository.findAll().stream()
                            .filter(d -> d.getStatus() == DriverAvailabilityStatus.RESERVED || d.getStatus() == DriverAvailabilityStatus.BUSY)
                            .toList();
                    for (DriverAvailability busy : busyDrivers) {
                        UUID activeRideId = busy.getActiveRideId();
                        boolean stillActive = false;
                        if (activeRideId != null && !activeRideId.equals(rideId)) {
                            try {
                                RideDetailsResponse pastRide = rideServiceClient.getRideDetails(activeRideId, internalServiceToken);
                                if (pastRide != null && ("ACCEPTED".equalsIgnoreCase(pastRide.status()) || "STARTED".equalsIgnoreCase(pastRide.status()))) {
                                    stillActive = true;
                                }
                            } catch (Exception ignored) {}
                        }
                        if (!stillActive) {
                            busy.setStatus(DriverAvailabilityStatus.AVAILABLE);
                            busy.setActiveRideId(null);
                            availabilityRepository.save(busy);
                        }
                    }
                    onlineDrivers = availabilityRepository.findAllByStatus(DriverAvailabilityStatus.AVAILABLE);
                }

                if (!onlineDrivers.isEmpty()) {
                    nearbyDrivers = onlineDrivers.stream()
                            .map(d -> new DriverGeoLocationService.NearbyDriverLocation(d.getDriverId().toString(), 0.0))
                            .toList();
                }
            } catch (Exception dbEx) {
                log.warn("DB availability check error: {}", dbEx.getMessage());
            }
        }

        if (nearbyDrivers == null || nearbyDrivers.isEmpty()) {
            log.info("No nearby drivers found for ride {}", rideId);
            return;
        }

        for (DriverGeoLocationService.NearbyDriverLocation nearby : nearbyDrivers) {
            if (offersSent >= maxDriverAttempts) {
                break;
            }

            UUID driverId;
            try {
                driverId = UUID.fromString(nearby.driverId());
            } catch (IllegalArgumentException exception) {
                continue;
            }

            if (!attemptedDrivers.add(driverId)) {
                continue;
            }

            int attemptNumber = dispatchAttemptService.getNextAttemptNumber(rideId);
            DriverAvailability availability = availabilityRepository.findByDriverId(driverId).orElse(null);

            if (availability == null || availability.getStatus() != DriverAvailabilityStatus.AVAILABLE) {
                continue;
            }

            if (!isDriverVehicleTypeMatching(availability, ride.vehicleType())) {
                continue;
            }

            if (!identityServiceClient.isDriverEligible(driverId)) {
                continue;
            }

            boolean reserved = driverAvailabilityService.reserveDriver(driverId, rideId);
            if (!reserved) {
                continue;
            }

            try {
                createOffer(rideId, driverId, attemptNumber);
                dispatchAttemptService.recordAttempt(rideId, driverId, attemptNumber, DispatchAttemptOutcome.OFFERED, "Offer sent to driver");
                notificationEventService.notifyDriverOfNewOffer(rideId, driverId);
                offersSent++;

                log.info("Ride {} offered to driver {} (distance: {} km)", rideId, driverId, nearby.distanceKm());
                return;
            } catch (Exception exception) {
                driverAvailabilityService.releaseReservation(driverId, rideId);
                dispatchAttemptService.recordAttempt(rideId, driverId, attemptNumber, DispatchAttemptOutcome.ASSIGNMENT_FAILED, exception.getMessage());
                log.error("Could not create offer for driver {}: {}", driverId, exception.getMessage());
            }
        }
    }

    private void createOffer(UUID rideId, UUID driverId, int attemptNumber) {
        Instant now = Instant.now();
        RideOffer offer = RideOffer.builder()
                .rideId(rideId)
                .driverId(driverId)
                .status(RideOfferStatus.PENDING)
                .offeredAt(now)
                .expiresAt(now.plusSeconds(offerExpirySeconds))
                .attemptNumber(attemptNumber)
                .build();

        rideOfferRepository.save(offer);
    }

    private boolean isDriverVehicleTypeMatching(DriverAvailability availability, String requestedVehicleType) {
        if (requestedVehicleType == null || requestedVehicleType.isBlank()) {
            return true;
        }
        if (availability == null || availability.getVehicleType() == null || availability.getVehicleType().isBlank()) {
            return true;
        }
        String req = requestedVehicleType.trim().toUpperCase();
        String drv = availability.getVehicleType().trim().toUpperCase();

        if (req.equals("BIKE")) {
            return drv.equals("BIKE");
        }
        if (req.equals("AUTO")) {
            return drv.equals("AUTO");
        }
        if (req.equals("CAB") || req.equals("CAR")) {
            return drv.equals("CAB") || drv.equals("CAR");
        }
        return req.equalsIgnoreCase(drv);
    }

    @Transactional
    public void cancelDispatch(UUID rideId) {
        cancelDispatch(rideId, "RIDER");
    }

    @Transactional
    public void cancelDispatch(UUID rideId, String cancelledBy) {
        if (rideId == null) {
            throw new IllegalArgumentException("Ride ID cannot be null");
        }

        List<RideOffer> pendingOffers = rideOfferRepository.findByRideIdAndStatus(rideId, RideOfferStatus.PENDING);
        for (RideOffer offer : pendingOffers) {
            offer.setStatus(RideOfferStatus.CANCELLED);
            offer.setRespondedAt(Instant.now());
            driverAvailabilityService.releaseReservation(offer.getDriverId(), rideId);
            notificationEventService.notifyDriverOfferCancelled(rideId, offer.getDriverId());
        }
        rideOfferRepository.saveAll(pendingOffers);

        List<RideOffer> acceptedOffers = rideOfferRepository.findByRideIdAndStatus(rideId, RideOfferStatus.ACCEPTED);
        for (RideOffer offer : acceptedOffers) {
            offer.setStatus(RideOfferStatus.CANCELLED);
            offer.setRespondedAt(Instant.now());
            notificationEventService.notifyDriverOfferCancelled(rideId, offer.getDriverId());
        }
        if (!acceptedOffers.isEmpty()) {
            rideOfferRepository.saveAll(acceptedOffers);
        }

        availabilityRepository.findByActiveRideId(rideId).ifPresent(da -> {
            da.setStatus(DriverAvailabilityStatus.AVAILABLE);
            da.setActiveRideId(null);
            availabilityRepository.save(da);
        });

        try {
            RideDetailsResponse ride = rideServiceClient.getRideDetails(rideId, internalServiceToken);
            if (ride != null && ride.riderId() != null) {
                notificationEventService.notifyRideCancelled(rideId, ride.riderId(), ride.driverId(), cancelledBy != null ? cancelledBy : "RIDER");
            }
        } catch (Exception ex) {
            log.trace("Notice fetching ride details for cancel: {}", ex.getMessage());
        }
    }

    @EventListener
    public void onDriverAvailable(DriverAvailableEvent event) {
        if (event == null || event.driverId() == null) return;
        try {
            List<RideDetailsResponse> waitingRides = rideServiceClient.getAvailableRides();
            if (waitingRides != null && !waitingRides.isEmpty()) {
                for (RideDetailsResponse ride : waitingRides) {
                    if (ride != null && ride.rideId() != null) {
                        dispatchRide(ride.rideId());
                    }
                }
            }
        } catch (Exception ex) {
            log.trace("Driver available reactive match notice: {}", ex.getMessage());
        }
    }

    public void handleFareBoosted(UUID rideId) {
        if (rideId == null) return;
        try {
            RideDetailsResponse ride = rideServiceClient.getRideDetails(rideId, internalServiceToken);
            if (ride == null || !"REQUESTED".equalsIgnoreCase(ride.status())) {
                return;
            }

            List<RideOffer> pendingOffers = rideOfferRepository.findByRideIdAndStatus(rideId, RideOfferStatus.PENDING);
            if (pendingOffers != null && !pendingOffers.isEmpty()) {
                for (RideOffer offer : pendingOffers) {
                    try {
                        notificationEventService.notifyDriverOfNewOffer(rideId, offer.getDriverId());
                    } catch (Exception ex) {
                        log.warn("Failed to notify driver of updated fare: {}", ex.getMessage());
                    }
                }
            } else {
                try {
                    dispatchAttemptRepository.deleteByRideId(rideId);
                } catch (Exception ex) {
                    log.warn("Notice clearing dispatch attempts: {}", ex.getMessage());
                }
                dispatchRide(rideId);
            }
        } catch (Exception ex) {
            log.error("Error handling fare boosted for ride {}: {}", rideId, ex.getMessage());
        }
    }
}
