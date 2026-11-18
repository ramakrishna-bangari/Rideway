package com.rideway.ride.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class FareRequest {

    @NotNull(message = "Pickup location is required")
    @Valid
    private LocationDto pickupLocation;

    @NotNull(message = "Destination is required")
    @Valid
    private LocationDto destination;

    private String vehicleType;
}
