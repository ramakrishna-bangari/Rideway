package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.entity.RideOffer;
import com.rideway.dispatch_service.enums.DispatchAttemptOutcome;
import com.rideway.dispatch_service.enums.RideOfferStatus;
import com.rideway.dispatch_service.repository.RideOfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RideOfferExpiryService {

    private final RideOfferRepository rideOfferRepository;
    private final DriverAvailabilityService availabilityService;
    private final DispatchAttemptService attemptService;
    private final NotificationEventService notificationEventService;
    private final DispatchRetryService retryService;

    @Transactional
    public void expireOffer(UUID offerId) {
        RideOffer offer = rideOfferRepository.findByIdForUpdate(offerId).orElse(null);
        if (offer == null || offer.getStatus() != RideOfferStatus.PENDING || offer.getExpiresAt().isAfter(Instant.now())) {
            return;
        }

        UUID rideId = offer.getRideId();
        UUID driverId = offer.getDriverId();

        offer.setStatus(RideOfferStatus.EXPIRED);
        offer.setRespondedAt(Instant.now());
        rideOfferRepository.save(offer);

        availabilityService.releaseReservation(driverId, rideId);
        attemptService.recordAttempt(rideId, driverId, offer.getAttemptNumber(), DispatchAttemptOutcome.EXPIRED, "Offer expired because the driver did not respond");
        notificationEventService.notifyDriverOfferExpired(rideId, driverId);

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                retryService.retryDispatch(rideId);
            }
        });

        log.info("Offer {} expired. Retry scheduled for ride {}", offerId, rideId);
    }
}
