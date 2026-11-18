package com.rideway.identity.dto.request;

import com.rideway.identity.enums.DriverVerificationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class DriverDecisionRequest {

    @NotNull(message = "Verification status is required")
    private DriverVerificationStatus verificationStatus;
}
