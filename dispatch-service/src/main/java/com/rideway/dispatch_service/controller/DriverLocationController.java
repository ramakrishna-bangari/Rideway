package com.rideway.dispatch_service.controller;

import com.rideway.dispatch_service.dto.request.UpdateDriverLocationRequest;
import com.rideway.dispatch_service.service.DriverGeoLocationService;
import com.rideway.dispatch_service.service.DriverLocationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.geo.Point;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/dispatch")
@RequiredArgsConstructor
@Slf4j
public class DriverLocationController {

    private final DriverLocationService driverLocationService;
    private final DriverGeoLocationService geoLocationService;

    @PutMapping("/location")
    public ResponseEntity<Void> updateDriverLocation(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody(required = false) UpdateDriverLocationRequest request,
            HttpServletRequest httpRequest) {
        UUID driverId = getAuthenticatedDriverId(jwt, httpRequest);

        if (request == null || request.getLatitude() == null || request.getLongitude() == null) {
            return ResponseEntity.badRequest().build();
        }

        driverLocationService.validateAndRecordLocation(driverId, request.getLatitude(), request.getLongitude());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/drivers/{driverId}/location")
    public ResponseEntity<?> getDriverLocation(@PathVariable UUID driverId) {
        Point pt = geoLocationService.getDriverLocation(driverId.toString());
        if (pt != null) {
            return ResponseEntity.ok(Map.of("driverId", driverId, "latitude", pt.getY(), "longitude", pt.getX()));
        }
        return ResponseEntity.noContent().build();
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
