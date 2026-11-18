package com.rideway.dispatch_service.repository;

import com.rideway.dispatch_service.entity.DriverAvailability;
import com.rideway.dispatch_service.enums.DriverAvailabilityStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DriverAvailabilityRepository
        extends JpaRepository<DriverAvailability, UUID> {

    Optional<DriverAvailability> findByDriverId(UUID driverId);

    Optional<DriverAvailability> findByActiveRideId(UUID activeRideId);

    List<DriverAvailability> findAllByStatus(
            DriverAvailabilityStatus status
    );
}
