package com.rideway.ride.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AssignDriverRequest(
        @NotNull UUID driverId,
        String driverPhone,
        String driverName,
        String driverVehicleNumber,
        String driverProfilePictureUrl
) {
    public AssignDriverRequest(UUID driverId) {
        this(driverId, null, null, null, null);
    }

}
