package com.rideway.ride.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rideway.ride.dto.event.RideDomainEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Component
@RequiredArgsConstructor
@Slf4j
public class RideEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    @Value("${app.kafka.topics.ride-events:ride-events}")
    private String rideEventsTopic;

    @Value("${app.kafka.topics.notification-events:notification-events}")
    private String notificationEventsTopic;

    @Value("${app.services.dispatch.base-url:${DISPATCH_SERVICE_URL:http://dispatch-service}}")
    private String dispatchServiceBaseUrl;

    @Value("${app.services.notification.base-url:${NOTIFICATION_SERVICE_URL:http://notification-service}}")
    private String notificationServiceBaseUrl;

    public CompletableFuture<?> publishRideEvent(String eventType, UUID rideId) {
        return publish(eventType, rideId);
    }

    public CompletableFuture<?> publishRideRequestedNotification(UUID rideId, UUID riderId) {
        if (rideId == null || riderId == null) {
            return CompletableFuture.completedFuture(null);
        }

        return CompletableFuture.runAsync(() -> {
            try {
                var payloadMap = Map.of(
                        "eventId", UUID.randomUUID().toString(),
                        "eventType", "RIDE_REQUESTED",
                        "rideId", rideId.toString(),
                        "recipientIds", List.of(riderId.toString()),
                        "title", "Ride Requested",
                        "message", "Your ride request has been placed. We are searching for nearby drivers.",
                        "occurredAt", Instant.now().toString()
                );
                String json = objectMapper.writeValueAsString(payloadMap);

                if (notificationServiceBaseUrl != null && !notificationServiceBaseUrl.isBlank()) {
                    try {
                        String notifBase = notificationServiceBaseUrl.replaceAll("/+$", "");
                        HttpRequest req = HttpRequest.newBuilder()
                                .uri(URI.create(notifBase + "/api/notifications/internal/events"))
                                .header("Content-Type", "application/json")
                                .timeout(Duration.ofSeconds(3))
                                .POST(HttpRequest.BodyPublishers.ofString(json))
                                .build();

                        httpClient.sendAsync(req, HttpResponse.BodyHandlers.discarding());
                    } catch (Exception ignored) {}
                }

                try {
                    kafkaTemplate.send(notificationEventsTopic, rideId.toString(), json);
                } catch (Exception ex) {
                    log.warn("Kafka notification-events notice: {}", ex.getMessage());
                }
            } catch (Exception ex) {
                log.warn("Notification dispatch notice: {}", ex.getMessage());
            }
        });
    }

    public CompletableFuture<?> publishRideRequested(UUID rideId) {
        return publish("RIDE_REQUESTED", rideId);
    }

    public CompletableFuture<?> publishRideCancelled(UUID rideId) {
        return publish("RIDE_CANCELLED", rideId);
    }

    private CompletableFuture<?> publish(String eventType, UUID rideId) {
        RideDomainEvent event = RideDomainEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .rideId(rideId)
                .occurredAt(Instant.now())
                .build();

        return CompletableFuture.runAsync(() -> {
            try {
                String jsonPayload = objectMapper.writeValueAsString(event);
                kafkaTemplate.send(rideEventsTopic, rideId.toString(), jsonPayload)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.warn("Kafka event notice for ride {}: {}", rideId, ex.getMessage());
                            }
                        });
            } catch (Exception ex) {
                log.warn("Kafka broker unreachable for ride {}: {}", rideId, ex.getMessage());
            }

            if ("RIDE_REQUESTED".equalsIgnoreCase(eventType)) {
                if (dispatchServiceBaseUrl != null && !dispatchServiceBaseUrl.isBlank()) {
                    try {
                        String targetBase = dispatchServiceBaseUrl.replaceAll("/+$", "");
                        HttpRequest req = HttpRequest.newBuilder()
                                .uri(URI.create(targetBase + "/api/dispatch/internal/ride-requested/" + rideId))
                                .header("Content-Type", "application/json")
                                .timeout(Duration.ofSeconds(2))
                                .POST(HttpRequest.BodyPublishers.noBody())
                                .build();

                        httpClient.sendAsync(req, HttpResponse.BodyHandlers.discarding());
                    } catch (Exception ex) {
                        log.trace("Direct dispatch notice for base {}: {}", dispatchServiceBaseUrl, ex.getMessage());
                    }
                }
            }
        });
    }
}
