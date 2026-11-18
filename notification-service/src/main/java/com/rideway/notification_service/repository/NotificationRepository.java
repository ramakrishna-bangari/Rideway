package com.rideway.notification_service.repository;

import com.rideway.notification_service.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    boolean existsByEventIdAndRecipientId(
            String eventId,
            UUID recipientId
    );

    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(
            UUID recipientId,
            Pageable pageable
    );

    long countByRecipientIdAndReadFalse(UUID recipientId);

    Optional<Notification> findByIdAndRecipientId(
            UUID notificationId,
            UUID recipientId
    );

    @Modifying
    @Transactional
    void deleteByCreatedAtBefore(Instant cutoff);

    @Modifying
    @Transactional
    void deleteByRecipientId(UUID recipientId);

    @Modifying
    @Transactional
    void deleteByEventTypeIn(Collection<String> eventTypes);
}
