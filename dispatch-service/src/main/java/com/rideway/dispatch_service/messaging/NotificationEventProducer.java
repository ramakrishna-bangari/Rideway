package com.rideway.dispatch_service.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.rideway.dispatch_service.dto.event.NotificationEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Autowired(required = false)
    private DiscoveryClient discoveryClient;

    @Value("${app.kafka.topics.notification-events:notification-events}")
    private String notificationEventsTopic;

    @Value("${app.services.notification.base-url:${NOTIFICATION_SERVICE_URL:http://notification-service}}")
    private String notificationServiceBaseUrl;

    private List<String> getCandidateNotificationUrls() {
        List<String> urls = new ArrayList<>();

        if (discoveryClient != null) {
            try {
                List<ServiceInstance> instances = discoveryClient.getInstances("notification-service");
                if (instances != null) {
                    for (ServiceInstance inst : instances) {
                        if (inst.getUri() != null) {
                            String uriStr = inst.getUri().toString().replaceAll("/+$", "");
                            if (!urls.contains(uriStr)) {
                                urls.add(uriStr);
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        if (notificationServiceBaseUrl != null && !notificationServiceBaseUrl.isBlank()) {
            String custom = notificationServiceBaseUrl.trim().replaceAll("/+$", "");
            if (!urls.contains(custom)) {
                urls.add(custom);
            }
        }

        return urls;
    }

    public void publishNotification(String eventType, UUID rideId, List<UUID> recipientIds, String title, String message) {
        validateNotification(eventType, rideId, recipientIds, title, message);

        NotificationEvent event = NotificationEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .rideId(rideId)
                .recipientIds(List.copyOf(recipientIds))
                .title(title)
                .message(message)
                .occurredAt(Instant.now())
                .build();

        log.info("Publishing notification event: eventType={}, rideId={}, recipients={}", eventType, rideId, recipientIds.size());

        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(event);
        } catch (Exception ex) {
            log.error("Failed to serialize notification event: {}", event, ex);
            return;
        }

        CompletableFuture.runAsync(() -> {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();

            for (String base : getCandidateNotificationUrls()) {
                try {
                    String targetUrl = base + "/api/notifications/internal/events";
                    HttpRequest req = HttpRequest.newBuilder()
                            .uri(URI.create(targetUrl))
                            .header("Content-Type", "application/json")
                            .timeout(Duration.ofSeconds(3))
                            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                            .build();

                    HttpResponse<Void> resp = client.send(req, HttpResponse.BodyHandlers.discarding());
                    if (resp.statusCode() == 200) {
                        log.info("Dispatched internal notification event via HTTP to: {}", targetUrl);
                        break;
                    }
                } catch (Exception ex) {
                    log.trace("Candidate notification URL {} failed: {}", base, ex.getMessage());
                }
            }
        });

        CompletableFuture.runAsync(() -> {
            try {
                CompletableFuture<?> future = kafkaTemplate.send(notificationEventsTopic, rideId.toString(), jsonPayload);
                future.whenComplete((result, exception) -> {
                    if (exception != null) {
                        log.warn("Failed to publish notification event to Kafka: eventType={}, rideId={}", eventType, rideId);
                    } else {
                        log.info("Notification event published to Kafka: eventId={}, eventType={}, rideId={}", event.getEventId(), event.getEventType(), event.getRideId());
                    }
                });
            } catch (Exception ex) {
                log.warn("Kafka publish attempt notice: {}", ex.getMessage());
            }
        });
    }

    private void validateNotification(String eventType, UUID rideId, List<UUID> recipientIds, String title, String message) {
        if (eventType == null || eventType.isBlank()) {
            throw new IllegalArgumentException("Event type is required");
        }
        if (rideId == null) {
            throw new IllegalArgumentException("Ride ID is required");
        }
        if (recipientIds == null || recipientIds.isEmpty()) {
            throw new IllegalArgumentException("At least one recipient ID is required");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("Message is required");
        }
    }
}
