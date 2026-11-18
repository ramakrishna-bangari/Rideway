package com.rideway.identity.service;

import com.rideway.identity.config.JwtProperties;
import com.rideway.identity.dto.request.LoginRequest;
import com.rideway.identity.dto.request.RefreshTokenRequest;
import com.rideway.identity.dto.response.AdminLoginResponse;
import com.rideway.identity.dto.response.AuthResponse;
import com.rideway.identity.entity.Admin;
import com.rideway.identity.entity.Driver;
import com.rideway.identity.entity.RefreshToken;
import com.rideway.identity.entity.Rider;
import com.rideway.identity.repository.AdminRepository;
import com.rideway.identity.repository.DriverRepository;
import com.rideway.identity.repository.RefreshTokenRepository;
import com.rideway.identity.repository.RiderRepository;
import com.rideway.identity.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final RiderRepository riderRepository;
    private final DriverRepository driverRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final AdminRepository adminRepository;
    private final CloudinaryService cloudinaryService;

    private final SecureRandom secureRandom = new SecureRandom();
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String identifier = request.getEmail().trim();

        var riderOpt = riderRepository.findByEmailIgnoreCase(identifier);
        if (riderOpt.isEmpty()) {
            riderOpt = riderRepository.findByPhone(identifier);
            if (riderOpt.isEmpty() && identifier.startsWith("+91")) {
                riderOpt = riderRepository.findByPhone(identifier.substring(3).trim());
            } else if (riderOpt.isEmpty() && identifier.startsWith("91") && identifier.length() == 12) {
                riderOpt = riderRepository.findByPhone(identifier.substring(2));
            }
        }
        if (riderOpt.isPresent()) {
            Rider rider = riderOpt.get();
            if (passwordEncoder.matches(request.getPassword(), rider.getPasswordHash())) {
                if (!rider.isActive()) {
                    rider.setActive(true);
                    riderRepository.save(rider);
                }
                return createAuthResponse(rider.getId().toString(), rider.getFullName(), rider.getEmail(), "RIDER", rider, null);
            }
        }

        var driverOpt = driverRepository.findByEmailIgnoreCase(identifier);
        if (driverOpt.isEmpty()) {
            driverOpt = driverRepository.findByPhone(identifier);
            if (driverOpt.isEmpty() && identifier.startsWith("+91")) {
                driverOpt = driverRepository.findByPhone(identifier.substring(3).trim());
            } else if (driverOpt.isEmpty() && identifier.startsWith("91") && identifier.length() == 12) {
                driverOpt = driverRepository.findByPhone(identifier.substring(2));
            }
        }
        if (driverOpt.isPresent()) {
            Driver driver = driverOpt.get();
            if (passwordEncoder.matches(request.getPassword(), driver.getPasswordHash())) {
                if (!driver.isActive()) {
                    driver.setActive(true);
                    driverRepository.save(driver);
                }
                return createAuthResponse(driver.getId().toString(), driver.getFullName(), driver.getEmail(), "DRIVER", null, driver);
            }
        }

        var adminOpt = adminRepository.findByEmailIgnoreCase(identifier);
        if (adminOpt.isPresent()) {
            Admin admin = adminOpt.get();
            if (passwordEncoder.matches(request.getPassword(), admin.getPassword())) {
                if (!admin.isActive()) {
                    throw new IllegalArgumentException("Admin account is inactive");
                }
                String accessToken = jwtService.generateAccessToken(admin.getEmail(), "ADMIN", admin.getId().toString());
                return new AuthResponse(admin.getId().toString(), "Admin", admin.getEmail(), "ADMIN", accessToken, null, jwtService.getAccessTokenLifetimeSeconds());
            }
        }

        throw new IllegalArgumentException("Invalid phone/email or password");
    }

    @Transactional
    public AuthResponse loginWithGoogle(Map<String, String> googleProfile) {
        String email = googleProfile.get("email");
        String fullName = googleProfile.getOrDefault("fullName", googleProfile.getOrDefault("name", "Google User"));
        String role = googleProfile.getOrDefault("role", "RIDER").toUpperCase();
        String picture = googleProfile.getOrDefault("picture", googleProfile.getOrDefault("profilePictureUrl", ""));

        if ((email == null || email.isBlank()) && googleProfile.containsKey("credential")) {
            try {
                String credential = googleProfile.get("credential");
                String[] parts = credential.split("\\.");
                if (parts.length >= 2) {
                    byte[] decoded = java.util.Base64.getUrlDecoder().decode(parts[1]);
                    Map<?, ?> claims = objectMapper.readValue(decoded, Map.class);
                    if (claims.get("email") != null) {
                        email = claims.get("email").toString();
                    }
                    if (claims.get("name") != null) {
                        fullName = claims.get("name").toString();
                    }
                    if (claims.get("picture") != null) {
                        picture = claims.get("picture").toString();
                    }
                }
            } catch (Exception ignored) {}
        }

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required for Google login");
        }
        email = email.trim();

        var riderOpt = riderRepository.findByEmailIgnoreCase(email);
        if (riderOpt.isPresent()) {
            Rider rider = riderOpt.get();
            if (picture != null && !picture.isBlank()) {
                rider.setProfilePictureUrl(picture);
                riderRepository.save(rider);
            }
            return createAuthResponse(rider.getId().toString(), rider.getFullName(), rider.getEmail(), "RIDER", rider, null);
        }

        var driverOpt = driverRepository.findByEmailIgnoreCase(email);
        if (driverOpt.isPresent()) {
            Driver driver = driverOpt.get();
            if (picture != null && !picture.isBlank()) {
                driver.setProfilePictureUrl(picture);
                driverRepository.save(driver);
            }
            return createAuthResponse(driver.getId().toString(), driver.getFullName(), driver.getEmail(), "DRIVER", null, driver);
        }

        if ("DRIVER".equals(role)) {
            Driver newDriver = new Driver();
            newDriver.setFullName(fullName);
            newDriver.setEmail(email);
            newDriver.setLicenseNumber("DL-GGL-" + System.currentTimeMillis() % 1000000);
            newDriver.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            newDriver.setProfilePictureUrl(picture);
            Driver saved = driverRepository.save(newDriver);
            return createAuthResponse(saved.getId().toString(), saved.getFullName(), saved.getEmail(), "DRIVER", null, saved);
        } else {
            Rider newRider = new Rider();
            newRider.setFullName(fullName);
            newRider.setEmail(email);
            newRider.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            newRider.setProfilePictureUrl(picture);
            Rider saved = riderRepository.save(newRider);
            return createAuthResponse(saved.getId().toString(), saved.getFullName(), saved.getEmail(), "RIDER", saved, null);
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCurrentUser(String email, String role) {
        Map<String, Object> map = new HashMap<>();
        if ("DRIVER".equalsIgnoreCase(role)) {
            Driver driver = driverRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new IllegalArgumentException("Driver not found"));
            map.put("id", driver.getId());
            map.put("fullName", driver.getFullName());
            map.put("email", driver.getEmail());
            map.put("phone", driver.getPhone() != null ? driver.getPhone() : "");
            map.put("role", "DRIVER");
            map.put("licenseNumber", driver.getLicenseNumber() != null ? driver.getLicenseNumber() : "");
            map.put("profilePictureUrl", driver.getProfilePictureUrl() != null && !driver.getProfilePictureUrl().isBlank() ? driver.getProfilePictureUrl() : null);
            map.put("active", driver.isActive());
        } else if ("ADMIN".equalsIgnoreCase(role)) {
            Admin admin = adminRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new IllegalArgumentException("Admin not found"));
            map.put("id", admin.getId());
            map.put("fullName", "Administrator");
            map.put("email", admin.getEmail());
            map.put("role", "ADMIN");
            map.put("active", admin.isActive());
        } else {
            Rider rider = riderRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new IllegalArgumentException("Rider not found"));
            map.put("id", rider.getId());
            map.put("fullName", rider.getFullName());
            map.put("email", rider.getEmail());
            map.put("phone", rider.getPhone() != null ? rider.getPhone() : "");
            map.put("role", "RIDER");
            map.put("profilePictureUrl", rider.getProfilePictureUrl() != null && !rider.getProfilePictureUrl().isBlank() ? rider.getProfilePictureUrl() : null);
            map.put("active", rider.isActive());
        }
        return map;
    }

    @Transactional
    public void deleteProfilePicture(String email, String role) {
        if ("DRIVER".equalsIgnoreCase(role)) {
            Driver driver = driverRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new IllegalArgumentException("Driver not found"));
            String oldUrl = driver.getProfilePictureUrl();
            if (oldUrl != null && !oldUrl.isBlank()) {
                cloudinaryService.deleteImage(oldUrl);
            }
            driver.setProfilePictureUrl(null);
            driverRepository.save(driver);
        } else {
            Rider rider = riderRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new IllegalArgumentException("Rider not found"));
            String oldUrl = rider.getProfilePictureUrl();
            if (oldUrl != null && !oldUrl.isBlank()) {
                cloudinaryService.deleteImage(oldUrl);
            }
            rider.setProfilePictureUrl(null);
            riderRepository.save(rider);
        }
    }

    @Transactional
    public AuthResponse loginRider(LoginRequest request) {
        Rider rider = riderRepository.findByEmailIgnoreCase(request.getEmail().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), rider.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        if (!rider.isActive()) {
            rider.setActive(true);
            riderRepository.save(rider);
        }

        return createAuthResponse(rider.getId().toString(), rider.getFullName(), rider.getEmail(), "RIDER", rider, null);
    }

    @Transactional
    public AuthResponse loginDriver(LoginRequest request) {
        Driver driver = driverRepository.findByEmailIgnoreCase(request.getEmail().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), driver.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        if (!driver.isActive()) {
            driver.setActive(true);
            driverRepository.save(driver);
        }

        return createAuthResponse(driver.getId().toString(), driver.getFullName(), driver.getEmail(), "DRIVER", null, driver);
    }

    public AdminLoginResponse loginAdmin(LoginRequest request) {
        Admin admin = adminRepository
                .findByEmailIgnoreCase(request.getEmail().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), admin.getPassword())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        if (!admin.isActive()) {
            throw new IllegalArgumentException("Admin account is inactive");
        }

        String accessToken = jwtService.generateAccessToken(
                admin.getEmail(),
                "ADMIN",
                admin.getId().toString()
        );

        return new AdminLoginResponse(
                admin.getEmail(),
                admin.getRole(),
                accessToken,
                jwtService.getAccessTokenLifetimeSeconds()
        );
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String rawToken = request.getRefreshToken();

        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Refresh token is required");
        }

        RefreshToken oldToken = refreshTokenRepository.findByTokenHash(hashToken(rawToken))
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (!oldToken.isValidAt(Instant.now())) {
            throw new IllegalArgumentException("Refresh token expired or revoked");
        }

        Rider rider = oldToken.getRider();
        Driver driver = oldToken.getDriver();

        if (rider != null && driver == null) {
            if (!rider.isActive()) {
                throw new IllegalArgumentException("Account is inactive");
            }
            oldToken.revoke();
            return createAuthResponse(rider.getId().toString(), rider.getFullName(), rider.getEmail(), "RIDER", rider, null);
        }

        if (driver != null && rider == null) {
            if (!driver.isActive()) {
                throw new IllegalArgumentException("Account is inactive");
            }
            oldToken.revoke();
            return createAuthResponse(driver.getId().toString(), driver.getFullName(), driver.getEmail(), "DRIVER", null, driver);
        }

        throw new IllegalArgumentException("Invalid refresh token owner");
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }

        refreshTokenRepository.findByTokenHash(hashToken(rawToken)).ifPresent(token -> {
            if (token.isValidAt(Instant.now())) {
                token.revoke();
            }
        });
    }

    private AuthResponse createAuthResponse(String accountId, String fullName, String email, String role, Rider rider, Driver driver) {
        String accessToken = jwtService.generateAccessToken(email, role, accountId);
        String refreshToken = createRefreshToken(rider, driver);
        String phone = rider != null ? rider.getPhone() : (driver != null ? driver.getPhone() : null);
        String profilePictureUrl = rider != null ? rider.getProfilePictureUrl() : (driver != null ? driver.getProfilePictureUrl() : null);
        String licenseNumber = driver != null ? driver.getLicenseNumber() : null;
        String vehicleType = driver != null ? driver.getVehicleType() : null;
        String vehicleNumber = driver != null ? driver.getVehicleNumber() : null;

        return new AuthResponse(accountId, fullName, email, role, accessToken, refreshToken, jwtService.getAccessTokenLifetimeSeconds(), phone, profilePictureUrl, licenseNumber, vehicleType, vehicleNumber);
    }

    private String createRefreshToken(Rider rider, Driver driver) {
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);

        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        RefreshToken token = new RefreshToken();
        token.setTokenHash(hashToken(rawToken));

        if (rider != null) {
            token.assignToRider(rider);
        } else if (driver != null) {
            token.assignToDriver(driver);
        } else {
            throw new IllegalArgumentException("A rider or driver must own the refresh token");
        }

        token.setExpiresAt(Instant.now().plusSeconds(jwtProperties.getRefreshTokenDays() * 24L * 60L * 60L));
        refreshTokenRepository.save(token);

        return rawToken;
    }

    @Transactional
    public void deleteAccount(String identifier, String role, String password) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("User identifier is required");
        }
        String cleanId = identifier.trim();

        if ("DRIVER".equalsIgnoreCase(role)) {
            Driver driver = null;
            if (cleanId.contains("@")) {
                driver = driverRepository.findByEmailIgnoreCase(cleanId).orElse(null);
            }
            if (driver == null) {
                try {
                    driver = driverRepository.findById(UUID.fromString(cleanId)).orElse(null);
                } catch (Exception ignored) {}
            }
            if (driver != null) {
                if (password != null && !password.isBlank() && driver.getPasswordHash() != null) {
                    if (!passwordEncoder.matches(password, driver.getPasswordHash())) {
                        throw new IllegalArgumentException("Incorrect password confirmation");
                    }
                }
                checkNoActiveRides(driver.getId(), true);
                if (driver.getProfilePictureUrl() != null && !driver.getProfilePictureUrl().isBlank()) {
                    cloudinaryService.deleteImage(driver.getProfilePictureUrl());
                }
                try {
                    refreshTokenRepository.deleteByDriver(driver);
                } catch (Exception ignored) {}
                driverRepository.delete(driver);
            }
        } else if ("RIDER".equalsIgnoreCase(role)) {
            Rider rider = null;
            if (cleanId.contains("@")) {
                rider = riderRepository.findByEmailIgnoreCase(cleanId).orElse(null);
            }
            if (rider == null) {
                try {
                    rider = riderRepository.findById(UUID.fromString(cleanId)).orElse(null);
                } catch (Exception ignored) {}
            }
            if (rider != null) {
                if (password != null && !password.isBlank() && rider.getPasswordHash() != null) {
                    if (!passwordEncoder.matches(password, rider.getPasswordHash())) {
                        throw new IllegalArgumentException("Incorrect password confirmation");
                    }
                }
                checkNoActiveRides(rider.getId(), false);
                if (rider.getProfilePictureUrl() != null && !rider.getProfilePictureUrl().isBlank()) {
                    cloudinaryService.deleteImage(rider.getProfilePictureUrl());
                }
                try {
                    refreshTokenRepository.deleteByRider(rider);
                } catch (Exception ignored) {}
                riderRepository.delete(rider);
            }
        } else if ("ADMIN".equalsIgnoreCase(role)) {
            long totalAdmins = adminRepository.count();
            if (totalAdmins <= 1) {
                throw new IllegalStateException("Cannot delete the last active administrator account.");
            }
            Admin admin = adminRepository.findByEmailIgnoreCase(cleanId)
                    .orElseThrow(() -> new IllegalArgumentException("Admin account not found"));
            if (password != null && !password.isBlank() && admin.getPassword() != null) {
                if (!passwordEncoder.matches(password, admin.getPassword())) {
                    throw new IllegalArgumentException("Incorrect password confirmation");
                }
            }
            adminRepository.delete(admin);
        }
    }

    private void checkNoActiveRides(UUID userId, boolean isDriver) {
        if (userId == null) return;
        try {
            org.springframework.web.client.RestTemplate rt = new org.springframework.web.client.RestTemplate();
            String path = isDriver ? "/api/rides/driver/" + userId + "/history" : "/api/rides/rider/" + userId + "/history";
            String rideServiceHost = System.getenv("RIDE_SERVICE_URL");
            if (rideServiceHost == null || rideServiceHost.isBlank()) {
                rideServiceHost = "http://ride-service:8082";
            }
            String url = rideServiceHost.replaceAll("/+$", "") + path;
            var response = rt.getForEntity(url, java.util.List.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                for (Object item : response.getBody()) {
                    if (item instanceof Map<?, ?> rideMap) {
                        Object status = rideMap.get("status");
                        if (status != null) {
                            String s = status.toString().toUpperCase();
                            if ("REQUESTED".equals(s) || "ACCEPTED".equals(s) || "STARTED".equals(s)) {
                                throw new IllegalStateException("Cannot delete account with an active ride in progress. Please complete or cancel your trip first.");
                            }
                        }
                    }
                }
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception ex) {

            org.slf4j.LoggerFactory.getLogger(AuthService.class).warn("Ride service check skipped during deletion: {}", ex.getMessage());
        }
    }

    private String hashToken(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
