package com.rideway.dispatch_service.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.rideway.dispatch_service.enums.RideStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class RideOfferResponse {

    @JsonProperty("id")
    private UUID rideId;

    private UUID riderId;
    private UUID driverId;

    private LocationDto pickupLocation;
    private LocationDto destination;

    private BigDecimal distanceKm;
    private BigDecimal price;

    private RideStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime acceptedAt;

    private List<List<Double>> routeCoordinates;

    private BigDecimal routeDistanceKm;
    private BigDecimal routeDurationMinutes;
}
