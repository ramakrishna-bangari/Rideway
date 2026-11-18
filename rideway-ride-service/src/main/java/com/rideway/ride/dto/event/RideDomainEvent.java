package com.rideway.ride.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RideDomainEvent {

    private UUID eventId;

    private String eventType;

    private UUID rideId;

    private Instant occurredAt;
}