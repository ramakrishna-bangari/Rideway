package com.rideway.identity.controller;

import com.rideway.identity.dto.request.UpdateProfileRequest;
import com.rideway.identity.service.RiderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/riders")
@RequiredArgsConstructor
public class RiderController {

    private final RiderService riderService;

    @GetMapping("/{id}")
    public ResponseEntity<?> getProfile(@PathVariable UUID id) {
        return ResponseEntity.ok(riderService.getProfile(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProfile(@PathVariable UUID id, @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(riderService.updateProfile(id, request));
    }

    @DeleteMapping("/{id}/profile-picture")
    public ResponseEntity<?> deleteProfilePicture(@PathVariable UUID id) {
        return ResponseEntity.ok(riderService.deleteProfilePicture(id));
    }
}
