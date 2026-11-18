package com.rideway.identity.controller;

import com.rideway.identity.dto.response.DriverResponse;
import com.rideway.identity.service.DriverService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/identity/internal/drivers")
@RequiredArgsConstructor
public class InternalDriverController {

    private final DriverService driverService;

    @Value("${app.security.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalToken;

    private boolean isTokenValid(String token) {
        if (token == null || token.isBlank() || internalToken == null || internalToken.isBlank()) return false;
        return MessageDigest.isEqual(internalToken.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/{driverId}")
    public ResponseEntity<?> getDriverInternal(@PathVariable UUID driverId, @RequestHeader(value = "X-Internal-Service-Token", required = false) String token) {

        if (!isTokenValid(token)) {
            throw new AccessDeniedException("Invalid internal service token");
        }

        DriverResponse driver = driverService.getProfile(driverId);
        Map<String, Object> data = new HashMap<>();
        data.put("driverId", driver.getId());
        data.put("fullName", driver.getFullName());
        data.put("email", driver.getEmail());
        data.put("phone", driver.getPhone() != null ? driver.getPhone() : "");
        data.put("licenseNumber", driver.getLicenseNumber() != null ? driver.getLicenseNumber() : "");
        data.put("profilePictureUrl", driver.getProfilePictureUrl() != null ? driver.getProfilePictureUrl() : "");
        data.put("verificationStatus", driver.getVerificationStatus().name());
        data.put("active", driver.isActive());
        data.put("vehicleType", driver.getVehicleType() != null ? driver.getVehicleType() : "AUTO");
        data.put("vehicleNumber", driver.getVehicleNumber() != null ? driver.getVehicleNumber() : "");
        return ResponseEntity.ok(data);
    }
}