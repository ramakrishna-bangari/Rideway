package com.rideway.identity.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AdminLoginResponse {

    private final String email;
    private final String role;
    private final String accessToken;
    private final long expiresInSeconds;
}