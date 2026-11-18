package com.rideway.ride.controller;

import com.rideway.ride.dto.AssignDriverRequest;
import com.rideway.ride.dto.CreateRideRequest;
import com.rideway.ride.dto.FareIncreaseRequest;
import com.rideway.ride.dto.RideResponse;
import com.rideway.ride.service.RideService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rides")
@RequiredArgsConstructor
public class RideController {

    private final RideService rideService;

    @Value("${app.security.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalServiceToken;

    @PostMapping
    public ResponseEntity<RideResponse> createRide(@Valid @RequestBody CreateRideRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(rideService.createRide(request));
    }

    @GetMapping("/{rideId}")
    public RideResponse getRide(@PathVariable UUID rideId, @AuthenticationPrincipal Jwt jwt) {
        RideResponse response = rideService.getRide(rideId);
        if (jwt != null) {
            String role = jwt.getClaimAsString("role");
            String userId = jwt.getClaimAsString("userId");
            if (userId == null) userId = jwt.getSubject();

            if ("DRIVER".equalsIgnoreCase(role) || (userId != null && response.getRiderId() != null && !userId.equalsIgnoreCase(response.getRiderId().toString()))) {
                response.setStartOtp(null);
            }
        }
        return response;
    }

    @PostMapping("/{rideId}/payment-status")
    public ResponseEntity<RideResponse> updatePaymentStatus(@PathVariable UUID rideId, @RequestBody Map<String, Object> body) {
        String paymentStatus = body != null && body.get("paymentStatus") != null ? body.get("paymentStatus").toString() : null;
        String paymentMethod = body != null && body.get("paymentMethod") != null ? body.get("paymentMethod").toString() : null;
        RideResponse updated = rideService.updatePaymentStatus(rideId, paymentStatus, paymentMethod);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{rideId}/verify-otp")
    public ResponseEntity<?> verifyStartOtp(@PathVariable UUID rideId, @RequestBody(required = false) Map<String, String> body) {
        String otp = body != null ? body.get("otp") : null;
        boolean valid = rideService.verifyStartOtp(rideId, otp);
        if (!valid) {
            return ResponseEntity.badRequest().body(Map.of(
                    "valid", false,
                    "message", "Invalid Start PIN. Please enter the 4-digit code shown on passenger screen."
            ));
        }
        return ResponseEntity.ok(Map.of(
                "valid", true,
                "message", "Start PIN verified successfully! Ready to start ride."
        ));
    }

    @GetMapping("/rider/{riderId}/history")
    public List<RideResponse> getRiderHistory(@PathVariable UUID riderId) {
        return rideService.getRiderHistory(riderId);
    }

    @GetMapping("/driver/{driverId}/history")
    public List<RideResponse> getDriverHistory(@PathVariable UUID driverId) {
        return rideService.getDriverHistory(driverId);
    }

    @GetMapping("/available")
    public List<RideResponse> getAvailableRides() {
        return rideService.getAvailableRides();
    }

    @GetMapping("/all")
    public List<RideResponse> getAllRides() {
        return rideService.getAllRides();
    }

    @PatchMapping("/{rideId}/price-increase")
    public RideResponse increasePrice(@PathVariable UUID rideId, @Valid @RequestBody FareIncreaseRequest request) {
        return rideService.increasePrice(rideId, request);
    }

    @GetMapping("/internal/{rideId}")
    public ResponseEntity<RideResponse> getRideInternal(@PathVariable UUID rideId,
                                                        @RequestHeader(value = "X-Internal-Service-Token", required = false) String suppliedToken) {
        verifyInternalServiceToken(suppliedToken);
        return ResponseEntity.ok(rideService.getRide(rideId));
    }

    @PostMapping("/internal/{rideId}/assignment")
    public ResponseEntity<RideResponse> assignDriver(@PathVariable UUID rideId,
                                                     @Valid @RequestBody AssignDriverRequest request,
                                                     @RequestHeader("X-Internal-Service-Token") String suppliedToken) {
        verifyInternalServiceToken(suppliedToken);
        return ResponseEntity.ok(rideService.assignDriver(rideId, request));
    }

    @RequestMapping(value = "/{rideId}/start", method = {RequestMethod.PATCH, RequestMethod.POST, RequestMethod.PUT})
    public RideResponse startRide(@PathVariable UUID rideId,
                                  @RequestParam(value = "otp", required = false) String otp,
                                  @RequestBody(required = false) Map<String, Object> body) {
        String effectiveOtp = otp;
        if ((effectiveOtp == null || effectiveOtp.isBlank()) && body != null && body.containsKey("otp")) {
            effectiveOtp = String.valueOf(body.get("otp"));
        }
        return rideService.startRide(rideId, effectiveOtp);
    }

    @RequestMapping(value = "/{rideId}/complete", method = {RequestMethod.PATCH, RequestMethod.POST, RequestMethod.PUT})
    public RideResponse completeRide(@PathVariable UUID rideId) {
        return rideService.completeRide(rideId);
    }

    @RequestMapping(value = "/{rideId}/cancel", method = {RequestMethod.PATCH, RequestMethod.PUT, RequestMethod.POST})
    public RideResponse cancelRide(@PathVariable UUID rideId) {
        return rideService.cancelRide(rideId);
    }

    private void verifyInternalServiceToken(String suppliedToken) {
        if (suppliedToken == null || suppliedToken.isBlank() || internalServiceToken == null || internalServiceToken.isBlank()) {
            throw new AccessDeniedException("Invalid internal service credentials");
        }

        boolean valid = MessageDigest.isEqual(
                internalServiceToken.getBytes(StandardCharsets.UTF_8),
                suppliedToken.getBytes(StandardCharsets.UTF_8)
        );

        if (!valid) {
            throw new AccessDeniedException("Invalid internal service credentials");
        }
    }
}
