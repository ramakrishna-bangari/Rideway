package com.rideway.dispatch_service.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RideOfferActionRequest {

    @NotNull(message = "Offer acceptance decision is required")
    private Boolean accepted;
}