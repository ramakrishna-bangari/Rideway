package com.rideway.dispatch_service.dto.event;

import java.util.UUID;

public record DriverAvailableEvent(UUID driverId) {
}
