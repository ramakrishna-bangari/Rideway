package com.rideway.dispatch_service.entity;

import com.rideway.dispatch_service.enums.RideOfferStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ride_offers", indexes = {@Index(name = "idx_offer_ride_status", columnList = "ride_id, status"), @Index(name = "idx_offer_driver_status", columnList = "driver_id, status"), @Index(name = "idx_offer_expiry", columnList = "status, expires_at")})
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class RideOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "ride_id", nullable = false)
    private UUID rideId;

    @Column(name = "driver_id", nullable = false)
    private UUID driverId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RideOfferStatus status = RideOfferStatus.PENDING;

    @Column(name = "offered_at", nullable = false)
    private Instant offeredAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();

        if (offeredAt == null) {
            offeredAt = now;
        }

        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}