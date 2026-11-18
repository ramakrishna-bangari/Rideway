package com.rideway.notification_service.controller;

import com.rideway.notification_service.dto.NotificationResponse;
import com.rideway.notification_service.dto.PushSubscriptionRequest;
import com.rideway.notification_service.dto.event.NotificationEvent;
import com.rideway.notification_service.entity.PushSubscription;
import com.rideway.notification_service.repository.PushSubscriptionRepository;
import com.rideway.notification_service.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final PushSubscriptionRepository pushSubscriptionRepository;

    @Value("${app.notifications.vapid.public-key:}")
    private String vapidPublicKey;

    @PostMapping("/internal/events")
    public ResponseEntity<Void> receiveInternalEvent(@RequestBody NotificationEvent event) {
        notificationService.processNotificationEvent(event);
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<Page<NotificationResponse>> getNotifications(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination parameters");
        }
        UUID recipientId = getUserId(jwt, request);
        if (recipientId == null) {
            return ResponseEntity.ok(Page.empty());
        }
        return ResponseEntity.ok(notificationService.getNotifications(recipientId, PageRequest.of(page, size, Sort.by("createdAt").descending())));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        UUID recipientId = getUserId(jwt, request);
        if (recipientId == null) {
            return ResponseEntity.ok(Map.of("unreadCount", 0L));
        }
        return ResponseEntity.ok(Map.of("unreadCount", notificationService.getUnreadCount(recipientId)));
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<NotificationResponse> markAsRead(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID notificationId,
            HttpServletRequest request) {
        UUID recipientId = getUserId(jwt, request);
        if (recipientId == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(notificationService.markAsRead(notificationId, recipientId));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Integer>> markAllAsRead(@AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        UUID recipientId = getUserId(jwt, request);
        if (recipientId == null) {
            return ResponseEntity.ok(Map.of("markedAsRead", 0));
        }
        return ResponseEntity.ok(Map.of("markedAsRead", notificationService.markAllAsRead(recipientId)));
    }

    @DeleteMapping("/clear-all")
    public ResponseEntity<Map<String, Integer>> clearAllNotifications(@AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        UUID recipientId = getUserId(jwt, request);
        if (recipientId == null) {
            return ResponseEntity.ok(Map.of("clearedCount", 0));
        }
        return ResponseEntity.ok(Map.of("clearedCount", notificationService.clearAllNotifications(recipientId)));
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Void> deleteSingleNotification(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID notificationId,
            HttpServletRequest request) {
        UUID recipientId = getUserId(jwt, request);
        if (recipientId != null) {
            notificationService.deleteNotification(notificationId, recipientId);
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        return ResponseEntity.ok(Map.of("publicKey", vapidPublicKey));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribeToPush(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PushSubscriptionRequest request,
            HttpServletRequest httpRequest) {
        UUID userId = getUserId(jwt, httpRequest);
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        pushSubscriptionRepository.findByEndpoint(request.endpoint()).ifPresentOrElse(
                existing -> {
                    existing.setUserId(userId);
                    existing.setP256dh(request.keys().p256dh());
                    existing.setAuthKey(request.keys().auth());
                    pushSubscriptionRepository.save(existing);
                },
                () -> pushSubscriptionRepository.save(new PushSubscription(
                        userId,
                        request.endpoint(),
                        request.keys().p256dh(),
                        request.keys().auth()
                ))
        );

        return ResponseEntity.ok(Map.of("success", true, "message", "Web push registered"));
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribeFromPush(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest httpRequest) {
        UUID userId = getUserId(jwt, httpRequest);
        if (userId != null && body != null && body.containsKey("endpoint")) {
            pushSubscriptionRepository.findByUserIdAndEndpoint(userId, body.get("endpoint"))
                    .ifPresent(pushSubscriptionRepository::delete);
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Web push unsubscribed"));
    }

    private UUID getUserId(Jwt jwt, HttpServletRequest request) {
        String userId = null;

        if (jwt != null) {
            userId = jwt.getClaimAsString("userId");
            if (userId == null || userId.isBlank()) {
                userId = jwt.getClaimAsString("id");
            }
            if (userId == null || userId.isBlank()) {
                userId = jwt.getClaimAsString("sub");
            }
            if (userId != null && !isValidUuid(userId)) {
                userId = null;
            }
        }

        if (userId == null && request != null) {
            String headerId = request.getHeader("X-User-Id");
            if (headerId == null || headerId.isBlank()) {
                headerId = request.getHeader("X-Driver-Id");
            }
            if (headerId != null && isValidUuid(headerId)) {
                userId = headerId;
            }
        }

        if (userId == null && jwt != null) {
            String sub = jwt.getSubject();
            if (sub != null && isValidUuid(sub)) {
                userId = sub;
            }
        }

        if (userId != null && !userId.isBlank()) {
            try {
                return UUID.fromString(userId.trim());
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private boolean isValidUuid(String val) {
        if (val == null || val.isBlank()) return false;
        try {
            UUID.fromString(val.trim());
            return true;
        } catch (Exception ex) {
            return false;
        }
    }
}
