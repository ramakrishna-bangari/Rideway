package com.rideway.notification_service.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEvent {

    private UUID eventId;

    private String eventType;

    private List<UUID> recipientIds;

    private UUID rideId;

    private String title;

    private String message;

    private Instant occurredAt;
}