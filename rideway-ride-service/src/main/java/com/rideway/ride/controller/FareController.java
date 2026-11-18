package com.rideway.ride.controller;

import com.rideway.ride.dto.FareRequest;
import com.rideway.ride.dto.FareResponse;
import com.rideway.ride.exception.InvalidRideOperationException;
import com.rideway.ride.service.FareService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/fares")
@RequiredArgsConstructor
@Slf4j
public class FareController {

    private final FareService fareService;

    @PostMapping
    public ResponseEntity<FareResponse> calculateFare(@Valid @RequestBody FareRequest request) {
        if (request == null || request.getPickupLocation() == null || request.getDestination() == null) {
            throw new InvalidRideOperationException("Pickup and destination locations are required");
        }

        FareResponse response = fareService.calculateFare(
                request.getPickupLocation(),
                request.getDestination(),
                request.getVehicleType()
        );
        return ResponseEntity.ok(response);
    }
}
