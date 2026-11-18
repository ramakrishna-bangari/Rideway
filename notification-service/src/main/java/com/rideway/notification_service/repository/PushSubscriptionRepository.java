package com.rideway.notification_service.repository;

import com.rideway.notification_service.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    List<PushSubscription> findByUserId(UUID userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    Optional<PushSubscription> findByUserIdAndEndpoint(UUID userId, String endpoint);

    void deleteByUserIdAndEndpoint(UUID userId, String endpoint);
}
