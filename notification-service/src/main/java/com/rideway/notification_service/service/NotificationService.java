package com.rideway.notification_service.service;

import com.rideway.notification_service.dto.NotificationResponse;
import com.rideway.notification_service.dto.event.NotificationEvent;
import com.rideway.notification_service.entity.Notification;
import com.rideway.notification_service.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private static final Set<String> TRANSIENT_EVENTS = Set.of(
            "RIDE_REQUESTED", "NEW_RIDE_OFFER", "RIDE_OFFER_AVAILABLE", "FARE_UPDATED",
            "RIDE_BOOSTED", "OFFER_EXPIRED", "RIDE_OFFER_EXPIRED", "OFFER_CANCELLED",
            "OFFER_DECLINED", "DISPATCH_ATTEMPT_FAILED", "DISPATCH_RETRY"
    );

    private final NotificationRepository repository;
    private final NotificationDeliveryService deliveryService;

    @Transactional
    public void processNotificationEvent(NotificationEvent event) {
        validateEvent(event);

        String eventId = event.getEventId().toString();
        String eventType = event.getEventType().trim().toUpperCase();
        boolean isTransient = TRANSIENT_EVENTS.contains(eventType);

        Map<UUID, List<NotificationResponse>> notificationsToDeliver = new LinkedHashMap<>();

        for (UUID recipientId : event.getRecipientIds()) {
            if (isTransient) {
                NotificationResponse transientResp = new NotificationResponse(
                        UUID.randomUUID(), event.getRideId(), event.getEventType(), event.getTitle(),
                        event.getMessage(), false, event.getOccurredAt() != null ? event.getOccurredAt() : Instant.now(), null
                );
                notificationsToDeliver.computeIfAbsent(recipientId, ignored -> new ArrayList<>()).add(transientResp);
                continue;
            }

            if (repository.existsByEventIdAndRecipientId(eventId, recipientId)) {
                continue;
            }

            Notification notification = Notification.builder()
                    .eventId(eventId)
                    .recipientId(recipientId)
                    .rideId(event.getRideId())
                    .eventType(event.getEventType())
                    .title(event.getTitle())
                    .message(event.getMessage())
                    .read(false)
                    .createdAt(event.getOccurredAt() != null ? event.getOccurredAt() : Instant.now())
                    .build();

            Notification saved = repository.save(notification);
            notificationsToDeliver.computeIfAbsent(recipientId, ignored -> new ArrayList<>()).add(toResponse(saved));
        }

        if (!notificationsToDeliver.isEmpty()) {
            if (TransactionSynchronizationManager.isActualTransactionActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        notificationsToDeliver.forEach((recipientId, responses) -> {
                            for (NotificationResponse response : responses) {
                                deliveryService.deliver(recipientId, response);
                            }
                        });
                    }
                });
            } else {
                notificationsToDeliver.forEach((recipientId, responses) -> {
                    for (NotificationResponse response : responses) {
                        deliveryService.deliver(recipientId, response);
                    }
                });
            }
        }
    }

    public Page<NotificationResponse> getNotifications(UUID recipientId, Pageable pageable) {
        if (recipientId == null) {
            return Page.empty(pageable);
        }
        return repository.findByRecipientIdOrderByCreatedAtDesc(recipientId, pageable).map(this::toResponse);
    }

    public long getUnreadCount(UUID recipientId) {
        if (recipientId == null) {
            return 0L;
        }
        return repository.countByRecipientIdAndReadFalse(recipientId);
    }

    @Transactional
    public NotificationResponse markAsRead(UUID notificationId, UUID recipientId) {
        Notification notification = getOwnedNotification(notificationId, recipientId);
        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(Instant.now());
            repository.save(notification);
        }
        return toResponse(notification);
    }

    @Transactional
    public int markAllAsRead(UUID recipientId) {
        if (recipientId == null) return 0;
        List<Notification> notifications = repository.findByRecipientIdOrderByCreatedAtDesc(recipientId, Pageable.unpaged()).getContent();
        int updated = 0;
        for (Notification notification : notifications) {
            if (!notification.isRead()) {
                notification.setRead(true);
                notification.setReadAt(Instant.now());
                updated++;
            }
        }
        repository.saveAll(notifications);
        return updated;
    }

    @Transactional
    public int clearAllNotifications(UUID recipientId) {
        if (recipientId == null) return 0;
        repository.deleteByRecipientId(recipientId);
        return 1;
    }

    @Transactional
    public void deleteNotification(UUID notificationId, UUID recipientId) {
        Notification notification = getOwnedNotification(notificationId, recipientId);
        repository.delete(notification);
    }

    @jakarta.annotation.PostConstruct
    @Transactional
    public void purgeTransientNotificationsOnStartup() {
        try {
            repository.deleteByEventTypeIn(List.of(
                    "RIDE_REQUESTED", "NEW_RIDE_OFFER", "RIDE_OFFER_AVAILABLE", "FARE_UPDATED",
                    "RIDE_BOOSTED", "OFFER_EXPIRED", "RIDE_OFFER_EXPIRED", "OFFER_CANCELLED", "OFFER_DECLINED"
            ));
            log.info("Purged historical transient search/offer notifications from database");
        } catch (Exception ex) {
            log.warn("Notice during startup notification purge: {}", ex.getMessage());
        }
    }

    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void cleanupOldNotifications() {
        try {
            Instant sevenDaysAgo = Instant.now().minus(7, ChronoUnit.DAYS);
            repository.deleteByCreatedAtBefore(sevenDaysAgo);
            repository.deleteByEventTypeIn(List.of(
                    "RIDE_REQUESTED", "NEW_RIDE_OFFER", "RIDE_OFFER_AVAILABLE", "FARE_UPDATED",
                    "RIDE_BOOSTED", "OFFER_EXPIRED", "RIDE_OFFER_EXPIRED"
            ));
            log.info("Completed automated cleanup of notifications older than 7 days and transient events");
        } catch (Exception ex) {
            log.warn("Scheduled notification cleanup note: {}", ex.getMessage());
        }
    }

    private Notification getOwnedNotification(UUID notificationId, UUID recipientId) {
        return repository.findByIdAndRecipientId(notificationId, recipientId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(), notification.getRideId(), notification.getEventType(),
                notification.getTitle(), notification.getMessage(), notification.isRead(),
                notification.getCreatedAt(), notification.getReadAt()
        );
    }

    private void validateEvent(NotificationEvent event) {
        if (event == null || event.getEventId() == null || event.getRecipientIds() == null || event.getRecipientIds().isEmpty()
                || event.getEventType() == null || event.getEventType().isBlank()
                || event.getTitle() == null || event.getTitle().isBlank()
                || event.getMessage() == null || event.getMessage().isBlank()) {
            throw new IllegalArgumentException("Invalid notification event");
        }

        if (event.getRecipientIds().stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Notification recipient ID cannot be null");
        }
    }
}
