package com.rideway.identity.dto.response;

import com.rideway.identity.entity.Driver;
import com.rideway.identity.enums.DriverVerificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriverResponse {

    private UUID id;
    private String fullName;
    private String email;
    private String phone;
    private String licenseNumber;
    private DriverVerificationStatus verificationStatus;
    private boolean active;
    private Instant createdAt;
    private String profilePictureUrl;
    private String vehicleType;
    private String vehicleNumber;

    public DriverResponse(UUID id, String fullName, String email, String phone, String licenseNumber, DriverVerificationStatus verificationStatus, boolean active, Instant createdAt) {
        this(id, fullName, email, phone, licenseNumber, verificationStatus, active, createdAt, null, null, null);
    }

    public DriverResponse(UUID id, String fullName, String email, String phone, String licenseNumber, DriverVerificationStatus verificationStatus, boolean active, Instant createdAt, String profilePictureUrl) {
        this(id, fullName, email, phone, licenseNumber, verificationStatus, active, createdAt, profilePictureUrl, null, null);
    }

    public static DriverResponse from(Driver driver) {
        if (driver == null) return null;
        return DriverResponse.builder()
                .id(driver.getId())
                .fullName(driver.getFullName())
                .email(driver.getEmail())
                .phone(driver.getPhone())
                .licenseNumber(driver.getLicenseNumber())
                .verificationStatus(driver.getVerificationStatus())
                .active(driver.isActive())
                .createdAt(driver.getCreatedAt())
                .profilePictureUrl(driver.getProfilePictureUrl())
                .vehicleType(driver.getVehicleType())
                .vehicleNumber(driver.getVehicleNumber())
                .build();
    }
}
