package com.rideway.identity.controller;

import com.rideway.identity.dto.request.UpdateProfileRequest;
import com.rideway.identity.enums.DriverVerificationStatus;
import com.rideway.identity.service.DriverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/drivers")
@RequiredArgsConstructor
public class DriverController {

    private final DriverService driverService;

    @GetMapping("/{id}")
    public ResponseEntity<?> getProfile(@PathVariable UUID id) {
        return ResponseEntity.ok(driverService.getProfile(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProfile(@PathVariable UUID id, @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(driverService.updateProfile(id, request));
    }

    @DeleteMapping("/{id}/profile-picture")
    public ResponseEntity<?> deleteProfilePicture(@PathVariable UUID id) {
        return ResponseEntity.ok(driverService.deleteProfilePicture(id));
    }

    @GetMapping("/verification-status/{status}")
    public ResponseEntity<?> getDriversByVerificationStatus(@PathVariable DriverVerificationStatus status) {
        return ResponseEntity.ok(driverService.findByVerificationStatus(status));
    }
}
