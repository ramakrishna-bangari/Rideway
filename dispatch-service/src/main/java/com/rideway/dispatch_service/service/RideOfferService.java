package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.client.IdentityServiceClient;
import com.rideway.dispatch_service.client.RideServiceClient;
import com.rideway.dispatch_service.dto.request.AssignDriverRequest;
import com.rideway.dispatch_service.dto.response.IdentityDriverResponse;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.entity.RideOffer;
import com.rideway.dispatch_service.enums.DispatchAttemptOutcome;
import com.rideway.dispatch_service.enums.RideOfferStatus;
import com.rideway.dispatch_service.repository.RideOfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RideOfferService {

    private final RideOfferRepository rideOfferRepository;
    private final DriverAvailabilityService availabilityService;
    private final DispatchAttemptService attemptService;
    private final IdentityServiceClient identityServiceClient;
    private final RideServiceClient rideServiceClient;
    private final NotificationEventService notificationEventService;
    private final DispatchRetryService dispatchRetryService;

    @Value("${app.services.ride.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalServiceToken;

    @Transactional(readOnly = true)
    public RideOffer getPendingOfferForDriver(UUID driverId) {
        Instant now = Instant.now();
        List<RideOffer> offers = rideOfferRepository.findByDriverIdAndStatus(driverId, RideOfferStatus.PENDING);
        return offers.stream()
                .filter(o -> o.getExpiresAt() == null || o.getExpiresAt().isAfter(now))
                .findFirst()
                .orElse(null);
    }

    @Transactional
    public void acceptOffer(UUID offerId, UUID authenticatedDriverId) {
        acceptOffer(offerId, authenticatedDriverId, null);
    }

    @Transactional
    public void acceptOffer(UUID offerId, UUID authenticatedDriverId, Map<String, Object> body) {
        RideOffer offer = rideOfferRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new IllegalArgumentException("Offer not found"));

        validateOffer(offer, authenticatedDriverId);

        if (!offer.getExpiresAt().isAfter(Instant.now())) {
            throw new IllegalStateException("Ride offer has expired. Please wait for offer expiry processing.");
        }

        UUID rideId = offer.getRideId();
        UUID driverId = offer.getDriverId();

        RideDetailsResponse ride = rideServiceClient.getRideDetails(rideId, internalServiceToken);
        if (ride == null || (!"REQUESTED".equalsIgnoreCase(ride.status()) && !"ACCEPTED".equalsIgnoreCase(ride.status()))) {
            throw new IllegalStateException("Ride is no longer available for assignment");
        }

        String driverName = null;
        String driverPhone = null;
        String driverLicense = null;
        String driverPicture = null;

        if (body != null) {
            if (body.get("driverName") != null && !String.valueOf(body.get("driverName")).isBlank()) {
                driverName = String.valueOf(body.get("driverName")).trim();
            }
            if (body.get("driverPhone") != null && !String.valueOf(body.get("driverPhone")).isBlank()) {
                driverPhone = String.valueOf(body.get("driverPhone")).trim();
            }
            if (body.get("driverVehicleNumber") != null && !String.valueOf(body.get("driverVehicleNumber")).isBlank()) {
                driverLicense = String.valueOf(body.get("driverVehicleNumber")).trim();
            }
            if (body.get("driverProfilePictureUrl") != null && !String.valueOf(body.get("driverProfilePictureUrl")).isBlank()) {
                driverPicture = String.valueOf(body.get("driverProfilePictureUrl")).trim();
            }
        }

        try {
            IdentityDriverResponse driverInfo = identityServiceClient.getDriverDetails(driverId);
            if (driverInfo != null) {
                if (driverName == null || driverName.isBlank()) {
                    driverName = (driverInfo.fullName() != null && !driverInfo.fullName().isBlank()) ? driverInfo.fullName() : driverInfo.email();
                }
                if (driverPhone == null || driverPhone.isBlank()) {
                    driverPhone = driverInfo.phone();
                }
                if (driverLicense == null || driverLicense.isBlank()) {
                    driverLicense = driverInfo.licenseNumber();
                }
                if (driverPicture == null || driverPicture.isBlank()) {
                    driverPicture = driverInfo.profilePictureUrl();
                }
            }
        } catch (Exception ex) {
            log.warn("Could not fetch real driver profile for assignment: {}", ex.getMessage());
        }

        AssignDriverRequest request = AssignDriverRequest.builder()
                .driverId(driverId)
                .driverName(driverName)
                .driverPhone(driverPhone)
                .driverVehicleNumber(driverLicense)
                .driverProfilePictureUrl(driverPicture)
                .build();

        rideServiceClient.assignDriver(rideId, request, internalServiceToken);
        availabilityService.confirmDriverAssignment(driverId, rideId);

        offer.setStatus(RideOfferStatus.ACCEPTED);
        offer.setRespondedAt(Instant.now());
        rideOfferRepository.save(offer);

        attemptService.recordAttempt(rideId, driverId, offer.getAttemptNumber(), DispatchAttemptOutcome.ACCEPTED, "Driver accepted the offer and assignment succeeded");

        List<RideOffer> otherOffers = rideOfferRepository.findByRideIdAndStatus(rideId, RideOfferStatus.PENDING);
        for (RideOffer other : otherOffers) {
            if (other.getId().equals(offerId)) {
                continue;
            }
            other.setStatus(RideOfferStatus.CANCELLED);
            other.setRespondedAt(Instant.now());
            availabilityService.releaseReservation(other.getDriverId(), rideId);
            notificationEventService.notifyDriverOfferCancelled(rideId, other.getDriverId());
        }
        rideOfferRepository.saveAll(otherOffers);

        notificationEventService.notifyDriverAssigned(rideId, ride.riderId(), driverId, driverName, driverLicense);
        log.info("Driver {} successfully assigned to ride {}", driverId, rideId);
    }

    @Transactional
    public void rejectOffer(UUID offerId, UUID authenticatedDriverId) {
        RideOffer offer = rideOfferRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new IllegalArgumentException("Offer not found"));

        validateOffer(offer, authenticatedDriverId);

        UUID rideId = offer.getRideId();
        UUID driverId = offer.getDriverId();

        if (!offer.getExpiresAt().isAfter(Instant.now())) {
            throw new IllegalStateException("Ride offer has expired. Please wait for offer expiry processing.");
        }

        offer.setStatus(RideOfferStatus.REJECTED);
        offer.setRespondedAt(Instant.now());
        rideOfferRepository.save(offer);

        availabilityService.releaseReservation(driverId, rideId);
        attemptService.recordAttempt(rideId, driverId, offer.getAttemptNumber(), DispatchAttemptOutcome.REJECTED, "Driver rejected the ride offer");
        log.info("Driver {} rejected offer for ride {}", driverId, rideId);

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                dispatchRetryService.retryDispatch(rideId);
            }
        });
    }

    private void validateOffer(RideOffer offer, UUID authenticatedDriverId) {
        if (!offer.getDriverId().equals(authenticatedDriverId)) {
            throw new SecurityException("This offer does not belong to the authenticated driver");
        }
        if (offer.getStatus() != RideOfferStatus.PENDING) {
            throw new IllegalStateException("This offer is no longer pending");
        }
    }
}
