package com.rideway.identity.dto.response;

import com.rideway.identity.entity.Rider;
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
public class AccountResponse {

    private UUID id;
    private String fullName;
    private String email;
    private String phone;
    private String role;
    private String profilePictureUrl;
    private boolean active;
    private Instant createdAt;

    public static AccountResponse from(Rider rider) {
        if (rider == null) return null;
        return AccountResponse.builder()
                .id(rider.getId())
                .fullName(rider.getFullName())
                .email(rider.getEmail())
                .phone(rider.getPhone())
                .role("RIDER")
                .profilePictureUrl(rider.getProfilePictureUrl())
                .active(rider.isActive())
                .createdAt(rider.getCreatedAt())
                .build();
    }
}
