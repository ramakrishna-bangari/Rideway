
package com.rideway.notification_service.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        UUID rideId,
        String eventType,
        String title,
        String message,
        boolean read,
        Instant createdAt,
        Instant readAt
) {
}
