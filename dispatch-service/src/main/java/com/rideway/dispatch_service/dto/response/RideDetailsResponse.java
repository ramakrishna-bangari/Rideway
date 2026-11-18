package com.rideway.dispatch_service.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RideDetailsResponse(

        @JsonProperty("id")
        UUID rideId,

        UUID riderId,

        UUID driverId,

        LocationDto pickupLocation,

        LocationDto destination,

        BigDecimal distanceKm,

        BigDecimal price,

        String status,

        String vehicleType,

        String riderName,

        String riderPhone

) {

    public BigDecimal pickupLatitude() {
        return pickupLocation != null
                ? pickupLocation.getLatitude()
                : null;
    }

    public BigDecimal pickupLongitude() {
        return pickupLocation != null
                ? pickupLocation.getLongitude()
                : null;
    }
}
