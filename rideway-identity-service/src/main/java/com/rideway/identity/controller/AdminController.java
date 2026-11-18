package com.rideway.identity.controller;

import com.rideway.identity.dto.request.DriverDecisionRequest;
import com.rideway.identity.enums.DriverVerificationStatus;
import com.rideway.identity.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics() {
        return ResponseEntity.ok(adminService.getAnalytics());
    }

    @GetMapping("/riders")
    public ResponseEntity<?> getAllRiders() {
        return ResponseEntity.ok(adminService.getAllRiders());
    }

    @GetMapping("/drivers")
    public ResponseEntity<?> getAllDrivers() {
        return ResponseEntity.ok(adminService.getAllDrivers());
    }

    @GetMapping("/drivers/status/{status}")
    public ResponseEntity<?> getDriversByStatus(@PathVariable DriverVerificationStatus status) {
        return ResponseEntity.ok(adminService.getDriversByStatus(status));
    }

    @PatchMapping("/drivers/{id}/verification")
    public ResponseEntity<?> decideDriverVerification(@PathVariable UUID id, @Valid @RequestBody DriverDecisionRequest request) {
        return ResponseEntity.ok(adminService.decideDriverVerification(id, request.getVerificationStatus()));
    }

    @PatchMapping("/riders/{id}/active")
    public ResponseEntity<?> setRiderActive(@PathVariable UUID id, @RequestParam boolean active) {
        adminService.setRiderActive(id, active);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/drivers/{id}/active")
    public ResponseEntity<?> setDriverActive(@PathVariable UUID id, @RequestParam boolean active) {
        adminService.setDriverActive(id, active);
        return ResponseEntity.ok().build();
    }
}
