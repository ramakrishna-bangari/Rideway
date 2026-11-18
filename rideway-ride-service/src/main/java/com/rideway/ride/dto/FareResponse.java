package com.rideway.ride.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FareResponse {

    private BigDecimal distanceKm;
    private BigDecimal durationMinutes;
    private BigDecimal price;
    private String vehicleType;
    private Map<String, BigDecimal> vehicleFares;
    private Map<String, BigDecimal> maxDistances;
    private List<List<Double>> routeCoordinates;

    public FareResponse(BigDecimal distanceKm, BigDecimal durationMinutes, BigDecimal price, List<List<Double>> routeCoordinates) {
        this(distanceKm, durationMinutes, price, "AUTO", null, null, routeCoordinates);
    }
}
