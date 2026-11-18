package com.rideway.dispatch_service.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignDriverRequest {

    @NotNull(message = "Driver ID is required")
    private UUID driverId;

    private String driverPhone;

    private String driverName;

    private String driverVehicleNumber;

    private String driverProfilePictureUrl;
}
