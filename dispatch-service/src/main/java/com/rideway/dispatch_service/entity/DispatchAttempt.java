package com.rideway.dispatch_service.entity;

import com.rideway.dispatch_service.enums.DispatchAttemptOutcome;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "dispatch_attempts",
        indexes = {
                @Index(name = "idx_attempt_ride", columnList = "ride_id"),
                @Index(name = "idx_attempt_driver", columnList = "driver_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class DispatchAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "ride_id", nullable = false)
    private UUID rideId;

    @Column(name = "driver_id")
    private UUID driverId;

    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private DispatchAttemptOutcome outcome;

    @Column(length = 500)
    private String remarks;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}