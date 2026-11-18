package com.rideway.dispatch_service.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEvent {

    private UUID eventId;

    private String eventType;

    private UUID rideId;

    private List<UUID> recipientIds;

    private String title;

    private String message;

    private Instant occurredAt;
}