package com.rideway.identity.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AuthResponse {

    private final String accountId;
    private final String fullName;
    private final String email;
    private final String role;
    private final String accessToken;
    private final String refreshToken;
    private final long expiresInSeconds;
    private final String phone;
    private final String profilePictureUrl;
    private final String licenseNumber;
    private final String vehicleType;
    private final String vehicleNumber;

    public AuthResponse(String accountId, String fullName, String email, String role, String accessToken, String refreshToken, long expiresInSeconds) {
        this(accountId, fullName, email, role, accessToken, refreshToken, expiresInSeconds, null, null, null, null, null);
    }

    public AuthResponse(String accountId, String fullName, String email, String role, String accessToken, String refreshToken, long expiresInSeconds, String phone, String profilePictureUrl, String licenseNumber) {
        this(accountId, fullName, email, role, accessToken, refreshToken, expiresInSeconds, phone, profilePictureUrl, licenseNumber, null, null);
    }
}
