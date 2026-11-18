package com.rideway.ride.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class CreateRideRequest {

    @NotNull(message = "Rider ID is required")
    private UUID riderId;

    private String riderName;

    private String riderPhone;

    @NotNull(message = "Pickup location is required")
    @Valid
    private LocationDto pickupLocation;

    @NotNull(message = "Destination is required")
    @Valid
    private LocationDto destination;

    private String vehicleType;

    private String paymentMethod;

    private java.math.BigDecimal boostAmount;

    private java.math.BigDecimal estimatedDistanceKm;

    private java.math.BigDecimal estimatedDurationMinutes;
}
