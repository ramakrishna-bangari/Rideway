package com.rideway.identity.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UpdateProfileRequest {

    @Size(min = 2, max = 100)
    private String fullName;

    @Pattern(regexp = "^$|^[+0-9]{10,15}$")
    private String phone;

    private String profilePictureUrl;

    @Getter
    private boolean profilePictureUrlSet = false;

    @JsonProperty("profilePictureUrl")
    public void setProfilePictureUrl(String profilePictureUrl) {
        this.profilePictureUrl = profilePictureUrl;
        this.profilePictureUrlSet = true;
    }

    private String licenseNumber;

    private String vehicleType;

    private String vehicleNumber;
}
