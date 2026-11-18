package com.rideway.ride.service;

import com.rideway.ride.dto.FareResponse;
import com.rideway.ride.dto.LocationDto;
import com.rideway.ride.dto.RouteResult;
import com.rideway.ride.exception.InvalidRideOperationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Slf4j
public class FareService {

    private final RoutingService routingService;

    @Value("${rideway.rate.bike.base:20.0}")
    private BigDecimal bikeBaseFare = BigDecimal.valueOf(20.0);

    @Value("${rideway.rate.bike.included-km:2.0}")
    private BigDecimal bikeIncludedKm = BigDecimal.valueOf(2.0);

    @Value("${rideway.rate.bike.rate-per-km:9.0}")
    private BigDecimal bikeRatePerKm = BigDecimal.valueOf(9.0);

    @Value("${rideway.limit.bike.max-distance-km:30.0}")
    private BigDecimal bikeMaxDistanceKm = BigDecimal.valueOf(30.0);

    @Value("${rideway.rate.auto.base:25.0}")
    private BigDecimal autoBaseFare = BigDecimal.valueOf(25.0);

    @Value("${rideway.rate.auto.included-km:1.6}")
    private BigDecimal autoIncludedKm = BigDecimal.valueOf(1.6);

    @Value("${rideway.rate.auto.rate-per-km:12.0}")
    private BigDecimal autoRatePerKm = BigDecimal.valueOf(12.0);

    @Value("${rideway.limit.auto.max-distance-km:40.0}")
    private BigDecimal autoMaxDistanceKm = BigDecimal.valueOf(40.0);

    @Value("${rideway.rate.cab.base:50.0}")
    private BigDecimal cabBaseFare = BigDecimal.valueOf(50.0);

    @Value("${rideway.rate.cab.included-km:2.0}")
    private BigDecimal cabIncludedKm = BigDecimal.valueOf(2.0);

    @Value("${rideway.rate.cab.rate-per-km:14.0}")
    private BigDecimal cabRatePerKm = BigDecimal.valueOf(14.0);

    @Value("${rideway.limit.cab.max-distance-km:60.0}")
    private BigDecimal cabMaxDistanceKm = BigDecimal.valueOf(60.0);

    public FareService(RoutingService routingService) {
        this.routingService = routingService;
    }

    public static String normalizeVehicleType(String vehicleType) {
        if (vehicleType == null || vehicleType.isBlank()) {
            return "AUTO";
        }
        String clean = vehicleType.trim().toUpperCase();
        if (clean.equals("BIKE")) {
            return "BIKE";
        }
        if (clean.equals("CAB") || clean.equals("CAR")) {
            return "CAB";
        }
        return "AUTO";
    }

    public BigDecimal getMaxDistanceKm(String vehicleType) {
        String category = normalizeVehicleType(vehicleType);
        return switch (category) {
            case "BIKE" -> bikeMaxDistanceKm;
            case "CAB" -> cabMaxDistanceKm;
            default -> autoMaxDistanceKm;
        };
    }

    public void validateTripDistance(BigDecimal distanceKm, String vehicleType) {
        if (distanceKm == null || distanceKm.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRideOperationException("Invalid route distance for ride calculation");
        }
        String category = normalizeVehicleType(vehicleType);
        BigDecimal maxLimit = getMaxDistanceKm(category);

        if (distanceKm.compareTo(maxLimit) > 0) {
            throw new InvalidRideOperationException(getDistanceExceededMessage(category));
        }
    }

    public String getDistanceExceededMessage(String vehicleType) {
        String category = normalizeVehicleType(vehicleType);
        return switch (category) {
            case "BIKE" -> "This trip is beyond the current Bike service range.";
            case "CAB" -> "This trip is beyond the current Cab service range.";
            default -> "This trip is beyond the current Auto service range.";
        };
    }

    public BigDecimal calculateVehicleFare(BigDecimal distanceKm, String vehicleType) {
        if (distanceKm == null || distanceKm.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRideOperationException("Route distance must be greater than zero");
        }

        String category = normalizeVehicleType(vehicleType);

        BigDecimal baseFare;
        BigDecimal includedKm;
        BigDecimal ratePerKm;

        switch (category) {
            case "BIKE" -> {
                baseFare = bikeBaseFare;
                includedKm = bikeIncludedKm;
                ratePerKm = bikeRatePerKm;
            }
            case "CAB" -> {
                baseFare = cabBaseFare;
                includedKm = cabIncludedKm;
                ratePerKm = cabRatePerKm;
            }
            default -> {
                baseFare = autoBaseFare;
                includedKm = autoIncludedKm;
                ratePerKm = autoRatePerKm;
            }
        }

        BigDecimal extraKm = distanceKm.subtract(includedKm);
        if (extraKm.compareTo(BigDecimal.ZERO) < 0) {
            extraKm = BigDecimal.ZERO;
        }

        BigDecimal total = baseFare.add(extraKm.multiply(ratePerKm));
        return total.setScale(0, RoundingMode.HALF_UP);
    }

    public FareResponse calculateFare(LocationDto pickup, LocationDto destination) {
        return calculateFare(pickup, destination, "AUTO");
    }

    public FareResponse calculateFare(LocationDto pickup, LocationDto destination, String vehicleType) {
        if (pickup == null || destination == null) {
            throw new InvalidRideOperationException("Pickup and destination locations are required");
        }

        RouteResult route = routingService.getRoute(pickup, destination);
        if (route == null || route.getDistanceKm() == null) {
            throw new InvalidRideOperationException("Unable to calculate road route between pickup and destination. Please check the addresses.");
        }

        BigDecimal distanceKm = route.getDistanceKm();
        BigDecimal durationMinutes = route.getDurationMinutes();
        String selectedCategory = normalizeVehicleType(vehicleType);

        Map<String, BigDecimal> vehicleFares = new LinkedHashMap<>();
        Map<String, BigDecimal> maxDistances = new LinkedHashMap<>();

        vehicleFares.put("BIKE", calculateVehicleFare(distanceKm, "BIKE"));
        maxDistances.put("BIKE", bikeMaxDistanceKm);

        vehicleFares.put("AUTO", calculateVehicleFare(distanceKm, "AUTO"));
        maxDistances.put("AUTO", autoMaxDistanceKm);

        vehicleFares.put("CAB", calculateVehicleFare(distanceKm, "CAB"));
        maxDistances.put("CAB", cabMaxDistanceKm);

        BigDecimal selectedPrice = vehicleFares.get(selectedCategory);

        return new FareResponse(
                distanceKm,
                durationMinutes,
                selectedPrice,
                selectedCategory,
                vehicleFares,
                maxDistances,
                route.getRouteCoordinates()
        );
    }
}
