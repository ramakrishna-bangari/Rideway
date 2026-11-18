package com.rideway.ride.repository;

import com.rideway.ride.entity.Ride;
import com.rideway.ride.entity.RideStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RideRepository extends JpaRepository<Ride, UUID> {

    List<Ride> findByRiderIdOrderByCreatedAtDesc(UUID riderId);

    List<Ride> findByDriverIdOrderByCreatedAtDesc(UUID driverId);

    List<Ride> findByStatusOrderByCreatedAtAsc(RideStatus status);

    List<Ride> findByStatusAndCreatedAtBefore(RideStatus status, java.time.LocalDateTime cutoff);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r
            FROM Ride r
            WHERE r.id = :rideId
            """)
    Optional<Ride> findByIdForUpdate(@Param("rideId") UUID rideId);
}