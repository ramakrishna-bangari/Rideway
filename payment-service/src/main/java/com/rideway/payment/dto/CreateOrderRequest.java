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
public class CreateOrderRequest {

    @NotNull(message = "Ride ID is required")
    private UUID rideId;

    private UUID riderId;

    private UUID driverId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1.0", message = "Minimum ride amount is ₹1.00")
    private BigDecimal amount;

    private String currency = "INR";
}
