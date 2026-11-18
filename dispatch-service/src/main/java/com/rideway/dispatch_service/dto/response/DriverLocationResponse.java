package com.rideway.dispatch_service.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DriverLocationResponse {

    private UUID driverId;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private Instant recordedAt;
}