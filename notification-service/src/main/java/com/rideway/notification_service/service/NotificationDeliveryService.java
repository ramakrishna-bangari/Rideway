package com.rideway.notification_service.service;

import com.rideway.notification_service.dto.NotificationResponse;
import com.rideway.notification_service.entity.PushSubscription;
import com.rideway.notification_service.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDeliveryService {

    private final SimpMessagingTemplate messagingTemplate;
    private final PushSubscriptionRepository pushSubscriptionRepository;

    public void deliver(UUID recipientId, NotificationResponse notification) {
        messagingTemplate.convertAndSendToUser(recipientId.toString(), "/queue/notifications", notification);

        try {
            List<PushSubscription> subscriptions = pushSubscriptionRepository.findByUserId(recipientId);
            if (!subscriptions.isEmpty()) {
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(3))
                        .build();

                for (PushSubscription sub : subscriptions) {
                    if (sub.getEndpoint() != null && !sub.getEndpoint().isBlank()) {
                        try {
                            HttpRequest request = HttpRequest.newBuilder()
                                    .uri(URI.create(sub.getEndpoint()))
                                    .header("TTL", "60")
                                    .header("Urgency", "high")
                                    .POST(HttpRequest.BodyPublishers.noBody())
                                    .timeout(Duration.ofSeconds(5))
                                    .build();

                            client.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                                    .whenComplete((resp, err) -> {
                                        if (err != null) {
                                            log.warn("Web Push endpoint delivery notice for user {}: {}", recipientId, err.getMessage());
                                        } else if (resp != null && (resp.statusCode() == 404 || resp.statusCode() == 410)) {
                                            log.info("Purging expired Web Push subscription for user {}: {}", recipientId, sub.getEndpoint());
                                            try {
                                                pushSubscriptionRepository.delete(sub);
                                            } catch (Exception ignored) {
                                            }
                                        } else {
                                            log.info("Dispatched Web Push notification '{}' to browser endpoint for user {} (status: {})",
                                                    notification.title(), recipientId, resp != null ? resp.statusCode() : "async");
                                        }
                                    });
                        } catch (Exception pushEx) {
                            log.warn("Failed to construct push request to {}: {}", sub.getEndpoint(), pushEx.getMessage());
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Web Push dispatch notice for user {}: {}", recipientId, ex.getMessage());
        }
    }
}
