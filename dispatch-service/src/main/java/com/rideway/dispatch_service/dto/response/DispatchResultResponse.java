package com.rideway.dispatch_service.dto.response;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchResultResponse {

    private UUID rideId;
    private boolean successful;
    private String message;
    private UUID assignedDriverId;
}