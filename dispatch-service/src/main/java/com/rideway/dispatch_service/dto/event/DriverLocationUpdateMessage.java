package com.rideway.dispatch_service.dto.event;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
public class DriverLocationUpdateMessage {

    private UUID rideId;
    private UUID driverId;

    private double latitude;
    private double longitude;

    private Instant recordedAt;
}