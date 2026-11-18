package com.rideway.dispatch_service.controller;

import com.rideway.dispatch_service.dto.request.UpdateAvailabilityRequest;
import com.rideway.dispatch_service.dto.response.DriverAvailabilityResponse;
import com.rideway.dispatch_service.service.DriverAvailabilityService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/dispatch/drivers/availability")
@RequiredArgsConstructor
@Slf4j
public class DriverAvailabilityController {

    private final DriverAvailabilityService availabilityService;

    @PutMapping
    public ResponseEntity<DriverAvailabilityResponse> updateAvailability(@RequestBody UpdateAvailabilityRequest request,
                                                                         @AuthenticationPrincipal Jwt jwt,
                                                                         HttpServletRequest httpRequest) {
        if (request == null || request.getStatus() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Availability status is required");
        }
        UUID driverId = getAuthenticatedDriverId(jwt, httpRequest);
        DriverAvailabilityResponse response = availabilityService.updateAvailability(driverId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<DriverAvailabilityResponse> getAvailability(@AuthenticationPrincipal Jwt jwt,
                                                                      HttpServletRequest httpRequest) {
        UUID driverId = getAuthenticatedDriverId(jwt, httpRequest);
        return ResponseEntity.ok(availabilityService.getAvailability(driverId));
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
            log.warn("Invalid driver UUID in request: {}", userId);
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
