package com.rideway.payment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class CashCollectionRequest {

    @NotNull(message = "Ride ID is required")
    private UUID rideId;

    private UUID driverId;

    private UUID riderId;

    @NotNull(message = "Collected amount is required")
    @DecimalMin(value = "0.0", message = "Amount collected cannot be negative")
    private BigDecimal amountCollected;
}
