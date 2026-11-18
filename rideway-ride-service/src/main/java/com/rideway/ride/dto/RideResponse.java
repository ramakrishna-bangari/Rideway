package com.rideway.ride.dto;

import com.rideway.ride.entity.Ride;
import com.rideway.ride.entity.RideStatus;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class RideResponse {

    private UUID id;
    private UUID riderId;
    private String riderName;
    private String riderPhone;
    private UUID driverId;

    private String driverPhone;
    private String driverName;
    private String driverVehicleNumber;
    private String driverProfilePictureUrl;
    private String startOtp;

    private LocationDto pickupLocation;
    private LocationDto destination;

    private BigDecimal distanceKm;
    private String vehicleType;
    private BigDecimal price;

    private String paymentMethod;
    private String paymentStatus;

    private RideStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;

    private List<List<Double>> routeCoordinates;

    private BigDecimal routeDistanceKm;
    private BigDecimal routeDurationMinutes;

    public static RideResponse from(Ride ride) {

        RideResponse response = new RideResponse();

        response.setId(ride.getId());
        response.setRiderId(ride.getRiderId());
        response.setRiderName(ride.getRiderName());
        response.setRiderPhone(ride.getRiderPhone());
        response.setDriverId(ride.getDriverId());
        response.setDriverPhone(ride.getDriverPhone());
        response.setDriverName(ride.getDriverName());
        response.setDriverVehicleNumber(ride.getDriverVehicleNumber());
        response.setDriverProfilePictureUrl(ride.getDriverProfilePictureUrl());

        if (ride.getStatus() == com.rideway.ride.entity.RideStatus.ACCEPTED || ride.getStatus() == com.rideway.ride.entity.RideStatus.STARTED) {
            response.setStartOtp(ride.getStartOtp());
        } else {
            response.setStartOtp(null);
        }

        response.setPickupLocation(new LocationDto(ride.getPickupLatitude(), ride.getPickupLongitude(), ride.getPickupAddress()));
        response.setDestination(new LocationDto(ride.getDestinationLatitude(), ride.getDestinationLongitude(), ride.getDestinationAddress()));

        response.setDistanceKm(ride.getDistanceKm());
        response.setVehicleType(ride.getVehicleType() != null ? ride.getVehicleType() : "AUTO");
        response.setPrice(ride.getPrice());
        response.setPaymentMethod(ride.getPaymentMethod() != null ? ride.getPaymentMethod() : "CASH");
        response.setPaymentStatus(ride.getPaymentStatus() != null ? ride.getPaymentStatus() : "PENDING");
        response.setStatus(ride.getStatus());

        response.setCreatedAt(ride.getCreatedAt());
        response.setAcceptedAt(ride.getAcceptedAt());
        response.setStartedAt(ride.getStartedAt());
        response.setCompletedAt(ride.getCompletedAt());
        response.setCancelledAt(ride.getCancelledAt());

        return response;
    }
}
