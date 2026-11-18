package com.rideway.identity.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RegistrationConfirmRequest {

    @NotBlank
    private String transactionId;

    @NotBlank
    @Pattern(regexp = "^[0-9]{4,8}$")
    private String otp;
}
