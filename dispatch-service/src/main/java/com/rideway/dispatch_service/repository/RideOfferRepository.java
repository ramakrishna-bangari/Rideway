package com.rideway.dispatch_service.repository;

import com.rideway.dispatch_service.entity.RideOffer;
import com.rideway.dispatch_service.enums.RideOfferStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RideOfferRepository
        extends JpaRepository<RideOffer, UUID> {

    List<RideOffer> findByDriverIdAndStatusAndExpiresAtAfter(
            UUID driverId,
            RideOfferStatus status,
            Instant now
    );

    List<RideOffer> findByDriverIdAndStatus(
            UUID driverId,
            RideOfferStatus status
    );

    List<RideOffer> findByRideIdAndStatus(
            UUID rideId,
            RideOfferStatus status
    );

    boolean existsByRideIdAndStatus(
            UUID rideId,
            RideOfferStatus status
    );

    List<RideOffer> findByStatusAndExpiresAtBefore(
            RideOfferStatus status,
            Instant now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM RideOffer o WHERE o.id = :offerId")
    Optional<RideOffer> findByIdForUpdate(
            @Param("offerId") UUID offerId
    );
}
