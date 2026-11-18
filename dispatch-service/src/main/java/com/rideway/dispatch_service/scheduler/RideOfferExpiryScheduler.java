package com.rideway.dispatch_service.scheduler;

import com.rideway.dispatch_service.client.RideServiceClient;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.entity.RideOffer;
import com.rideway.dispatch_service.enums.RideOfferStatus;
import com.rideway.dispatch_service.repository.DispatchAttemptRepository;
import com.rideway.dispatch_service.repository.RideOfferRepository;
import com.rideway.dispatch_service.service.RideDispatchService;
import com.rideway.dispatch_service.service.RideOfferExpiryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class RideOfferExpiryScheduler {

    private final RideOfferRepository rideOfferRepository;
    private final DispatchAttemptRepository dispatchAttemptRepository;
    private final RideOfferExpiryService expiryService;
    private final RideDispatchService rideDispatchService;
    private final RideServiceClient rideServiceClient;

    @Value("${app.dispatch.timeout-scan-ms:5000}")
    private long timeoutScanMs;

    @Scheduled(fixedDelayString = "${app.dispatch.timeout-scan-ms:5000}")
    public void expirePendingOffers() {
        List<RideOffer> expiredOffers = rideOfferRepository.findByStatusAndExpiresAtBefore(RideOfferStatus.PENDING, Instant.now());
        for (RideOffer offer : expiredOffers) {
            try {
                expiryService.expireOffer(offer.getId());
            } catch (Exception exception) {
                log.error("Failed to expire offer {}", offer.getId(), exception);
            }
        }
    }

    @Scheduled(fixedDelay = 4000)
    public void scanAndDispatchPendingRides() {
        try {
            List<RideDetailsResponse> waitingRides = rideServiceClient.getAvailableRides();
            if (waitingRides != null && !waitingRides.isEmpty()) {
                for (RideDetailsResponse ride : waitingRides) {
                    if (ride != null && ride.rideId() != null) {
                        if (!rideOfferRepository.existsByRideIdAndStatus(ride.rideId(), RideOfferStatus.PENDING)) {
                            rideDispatchService.dispatchRide(ride.rideId());
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.trace("Scheduled available rides scanner: {}", ex.getMessage());
        }
    }

    @Scheduled(fixedRate = 21600000)
    public void cleanupOldDispatchAttempts() {
        try {
            Instant cutoff = Instant.now().minus(Duration.ofHours(24));
            dispatchAttemptRepository.deleteByCreatedAtBefore(cutoff);
            log.info("Cleaned up dispatch attempts older than 24 hours");
        } catch (Exception ex) {
            log.warn("Old dispatch attempt cleanup notice: {}", ex.getMessage());
        }
    }
}
