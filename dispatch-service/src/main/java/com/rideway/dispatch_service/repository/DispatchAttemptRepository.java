package com.rideway.dispatch_service.repository;

import com.rideway.dispatch_service.entity.DispatchAttempt;
import com.rideway.dispatch_service.enums.DispatchAttemptOutcome;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface DispatchAttemptRepository
        extends JpaRepository<DispatchAttempt, UUID> {

    List<DispatchAttempt> findByRideIdOrderByAttemptNumberAsc(
            UUID rideId
    );

    int countByRideId(UUID rideId);

    int countByRideIdAndOutcome(
            UUID rideId,
            DispatchAttemptOutcome outcome
    );

    @Query("""
        SELECT COALESCE(MAX(a.attemptNumber), 0)
        FROM DispatchAttempt a
        WHERE a.rideId = :rideId
        """)
    int findMaxAttemptNumberByRideId(
            @Param("rideId") UUID rideId
    );

    @Query("""
        SELECT DISTINCT a.driverId
        FROM DispatchAttempt a
        WHERE a.rideId = :rideId
          AND a.outcome IN :outcomes
          AND a.driverId IS NOT NULL
        """)
    Set<UUID> findDriverIdsByRideIdAndOutcomes(
            @Param("rideId") UUID rideId,
            @Param("outcomes")
            Collection<DispatchAttemptOutcome> outcomes
    );

    @Modifying
    @Transactional
    void deleteByCreatedAtBefore(Instant cutoff);

    @Modifying
    @Transactional
    void deleteByRideId(UUID rideId);
}
