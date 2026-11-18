package com.rideway.dispatch_service.controller;

import com.rideway.dispatch_service.client.RideServiceClient;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.entity.RideOffer;
import com.rideway.dispatch_service.service.RideOfferService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/dispatch/offers")
@RequiredArgsConstructor
@Slf4j
public class RideOfferController {

    private final RideOfferService rideOfferService;
    private final RideServiceClient rideServiceClient;

    @Value("${app.services.ride.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalServiceToken;

    @GetMapping("/pending")
    public ResponseEntity<?> getPendingOffer(@AuthenticationPrincipal Jwt jwt, HttpServletRequest httpRequest) {
        UUID driverId = getAuthenticatedDriverId(jwt, httpRequest);

        RideOffer offer = rideOfferService.getPendingOfferForDriver(driverId);
        if (offer == null) {
            return ResponseEntity.noContent().build();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("offerId", offer.getId());
        response.put("rideId", offer.getRideId());
        response.put("status", offer.getStatus().name());
        response.put("offeredAt", offer.getOfferedAt());
        response.put("expiresAt", offer.getExpiresAt());
        if (offer.getExpiresAt() != null) {
            long remaining = java.time.Duration.between(java.time.Instant.now(), offer.getExpiresAt()).getSeconds();
            response.put("remainingSeconds", Math.max(0, remaining));
        } else {
            response.put("remainingSeconds", 60L);
        }
        response.put("attemptNumber", offer.getAttemptNumber());

        try {
            RideDetailsResponse ride = rideServiceClient.getRideDetails(offer.getRideId(), internalServiceToken);
            if (ride != null) {
                response.put("pickupLocation", ride.pickupLocation());
                response.put("destination", ride.destination());
                java.math.BigDecimal roundedPrice = ride.price() != null
                        ? ride.price().setScale(0, java.math.RoundingMode.HALF_UP)
                        : null;
                response.put("price", roundedPrice);
                response.put("fare", roundedPrice);
                response.put("distanceKm", ride.distanceKm());
                response.put("vehicleType", ride.vehicleType());
                if (ride.pickupLocation() != null) {
                    response.put("pickupAddress", ride.pickupLocation().getAddress());
                }
                if (ride.destination() != null) {
                    response.put("destinationAddress", ride.destination().getAddress());
                }
                if (ride.riderName() != null && !ride.riderName().isBlank()) {
                    response.put("riderName", ride.riderName());
                }
                if (ride.riderPhone() != null && !ride.riderPhone().isBlank()) {
                    response.put("riderPhone", ride.riderPhone());
                }
            }
        } catch (Exception ignored) {
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{offerId}/accept")
    public ResponseEntity<String> acceptOffer(
            @PathVariable UUID offerId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {

        UUID driverId = getAuthenticatedDriverId(jwt, httpRequest);

        rideOfferService.acceptOffer(offerId, driverId, body);

        return ResponseEntity.ok(
                "Ride offer accepted successfully"
        );
    }

    @PostMapping("/{offerId}/reject")
    public ResponseEntity<String> rejectOffer(
            @PathVariable UUID offerId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {

        UUID driverId = getAuthenticatedDriverId(jwt, httpRequest);

        rideOfferService.rejectOffer(offerId, driverId);

        return ResponseEntity.ok(
                "Ride offer rejected successfully"
        );
    }

    private UUID getAuthenticatedDriverId(Jwt jwt, HttpServletRequest request) {
        String userId = null;

        if (jwt != null) {
            userId = jwt.getClaimAsString("userId");
            if (userId == null || userId.isBlank()) {
                userId = jwt.getClaimAsString("id");
            }
            if (userId == null || userId.isBlank()) {
                userId = jwt.getClaimAsString("sub");
            }
            if (userId != null && !isValidUuid(userId)) {
                userId = null;
            }
        }

        if (userId == null && request != null) {
            String headerId = request.getHeader("X-User-Id");
            if (headerId == null || headerId.isBlank()) {
                headerId = request.getHeader("X-Driver-Id");
            }
            if (headerId != null && isValidUuid(headerId)) {
                userId = headerId;
            }
        }

        if (userId == null && jwt != null) {
            String sub = jwt.getSubject();
            if (sub != null && isValidUuid(sub)) {
                userId = sub;
            }
        }

        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Driver authentication required");
        }

        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid driver UUID in ride offer request: {}", userId);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid driver identity");
        }
    }

    private boolean isValidUuid(String val) {
        if (val == null || val.isBlank()) return false;
        try {
            UUID.fromString(val.trim());
            return true;
        } catch (Exception ex) {
            return false;
        }
    }
}
