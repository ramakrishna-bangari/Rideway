package com.rideway.dispatch_service.dto.request;

import com.rideway.dispatch_service.enums.DriverAvailabilityStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateAvailabilityRequest {

    @NotNull(message = "Availability status is required")
    private DriverAvailabilityStatus status;

    private String vehicleType;
}