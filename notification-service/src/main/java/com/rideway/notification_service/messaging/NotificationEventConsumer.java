package com.rideway.notification_service.messaging;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.rideway.notification_service.dto.event.NotificationEvent;
import com.rideway.notification_service.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class NotificationEventConsumer {

    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;

    public NotificationEventConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @KafkaListener(topics = "${app.kafka.topics.notification-events:notification-events}", groupId = "${spring.kafka.consumer.group-id:notification-service-group}")
    public void consumeNotificationEvent(Object rawMessage) {
        if (rawMessage == null) return;

        try {
            NotificationEvent event;
            if (rawMessage instanceof NotificationEvent ne) {
                event = ne;
            } else {
                String msg = rawMessage.toString();
                if (msg.startsWith("\"") && msg.endsWith("\"")) {
                    try {
                        msg = objectMapper.readValue(msg, String.class);
                    } catch (Exception ignored) {}
                }
                event = objectMapper.readValue(msg, NotificationEvent.class);
            }

            log.info("Received notification event: eventType={}, rideId={}, recipients={}",
                    event.getEventType(), event.getRideId(), event.getRecipientIds());

            notificationService.processNotificationEvent(event);

        } catch (Exception exception) {
            log.error("Failed to process notification event: {}", rawMessage, exception);
        }
    }
}
