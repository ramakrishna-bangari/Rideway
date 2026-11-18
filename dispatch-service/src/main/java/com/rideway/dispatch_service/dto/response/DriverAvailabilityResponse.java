package com.rideway.dispatch_service.dto.response;

import com.rideway.dispatch_service.enums.DriverAvailabilityStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DriverAvailabilityResponse {

    private UUID driverId;
    private DriverAvailabilityStatus status;
    private UUID activeRideId;
    private String vehicleType;
    private Instant lastLocationAt;
    private Instant updatedAt;
}