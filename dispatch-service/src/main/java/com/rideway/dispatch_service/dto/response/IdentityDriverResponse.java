package com.rideway.dispatch_service.dto.response;

import java.util.UUID;

public record IdentityDriverResponse(
        UUID driverId,
        String fullName,
        String email,
        String phone,
        String licenseNumber,
        String profilePictureUrl,
        String verificationStatus,
        boolean active,
        String vehicleType,
        String vehicleNumber
) {
    public IdentityDriverResponse(
            UUID driverId,
            String fullName,
            String email,
            String phone,
            String licenseNumber,
            String profilePictureUrl,
            String verificationStatus,
            boolean active
    ) {
        this(driverId, fullName, email, phone, licenseNumber, profilePictureUrl, verificationStatus, active, null, null);
    }
}
