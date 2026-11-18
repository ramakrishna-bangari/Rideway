package com.rideway.notification_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "push_subscriptions", uniqueConstraints = {@UniqueConstraint(name = "uk_push_subscription_endpoint", columnNames = "endpoint")})
@Getter
@Setter
@NoArgsConstructor
public class PushSubscription {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 2048)
    private String endpoint;

    @Column(name = "p256dh_key", nullable = false, length = 500)
    private String p256dh;

    @Column(name = "auth_key", nullable = false, length = 500)
    private String authKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public PushSubscription(UUID userId, String endpoint, String p256dh, String authKey) {
        this.userId = userId;
        this.endpoint = endpoint;
        this.p256dh = p256dh;
        this.authKey = authKey;
    }

    @PrePersist
    public void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }

        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}