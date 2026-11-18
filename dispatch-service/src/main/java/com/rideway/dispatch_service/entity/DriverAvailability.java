package com.rideway.dispatch_service.entity;

import com.rideway.dispatch_service.enums.DriverAvailabilityStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "driver_availability", indexes = {
        @Index(name = "idx_driver_availability_status", columnList = "status"),
        @Index(name = "idx_driver_availability_ride", columnList = "active_ride_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class DriverAvailability {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "driver_id", nullable = false, unique = true)
    private UUID driverId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private DriverAvailabilityStatus status = DriverAvailabilityStatus.OFFLINE;

    @Column(name = "active_ride_id")
    private UUID activeRideId;

    @Column(name = "vehicle_type", length = 30)
    private String vehicleType;

    @Column(name = "last_location_at")
    private Instant lastLocationAt;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
