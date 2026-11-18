package com.rideway.dispatch_service.client;

import com.rideway.dispatch_service.dto.request.AssignDriverRequest;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.dto.response.RideOfferResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@FeignClient(name = "ride-service", url = "${app.services.ride.base-url:}")
public interface RideServiceFeignClient {

    @GetMapping("/api/rides/internal/{rideId}")
    RideDetailsResponse getRideDetails(
            @PathVariable("rideId") UUID rideId,
            @RequestHeader("X-Internal-Service-Token") String internalServiceToken
    );

    @GetMapping("/api/rides/available")
    List<RideDetailsResponse> getAvailableRides();

    @PostMapping("/api/rides/internal/{rideId}/assignment")
    RideOfferResponse assignDriver(
            @PathVariable("rideId") UUID rideId,
            @RequestBody AssignDriverRequest request,
            @RequestHeader("X-Internal-Service-Token") String internalServiceToken
    );
}
