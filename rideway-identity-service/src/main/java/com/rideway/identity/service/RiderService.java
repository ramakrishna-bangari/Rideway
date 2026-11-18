package com.rideway.identity.service;

import com.rideway.identity.dto.request.RiderRegistrationRequest;
import com.rideway.identity.dto.request.UpdateProfileRequest;
import com.rideway.identity.dto.response.AccountResponse;
import com.rideway.identity.entity.Rider;
import com.rideway.identity.repository.DriverRepository;
import com.rideway.identity.repository.RiderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RiderService {

    private final RiderRepository riderRepository;
    private final DriverRepository driverRepository;
    private final PasswordEncoder passwordEncoder;
    private final CloudinaryService cloudinaryService;

    @Transactional
    public AccountResponse register(RiderRegistrationRequest request) {
        return registerRider(request);
    }

    @Transactional
    public AccountResponse registerRider(RiderRegistrationRequest request) {
        String email = request.getEmail().trim();
        String cleanPhone = (request.getPhone() != null && !request.getPhone().isBlank()) ? request.getPhone().trim() : null;

        var existingOpt = riderRepository.findByEmailIgnoreCase(email);
        if (existingOpt.isPresent()) {
            Rider existing = existingOpt.get();
            if (!existing.isActive()) {

                existing.setFullName(request.getFullName().trim());
                existing.setPhone(cleanPhone);
                existing.setPasswordHash(passwordEncoder.encode(request.getPassword()));
                existing.setActive(true);
                return toResponse(riderRepository.save(existing));
            }
            throw new IllegalArgumentException("Email already exists");
        }

        var activeDriver = driverRepository.findByEmailIgnoreCase(email);
        if (activeDriver.isPresent() && activeDriver.get().isActive()) {
            throw new IllegalArgumentException("An account with this email already exists as a driver");
        }

        if (cleanPhone != null) {
            var byPhone = riderRepository.findByPhone(cleanPhone);
            if (byPhone.isPresent() && byPhone.get().isActive()) {
                throw new IllegalArgumentException("Phone number already registered");
            }
        }

        Rider rider = new Rider();
        rider.setFullName(request.getFullName().trim());
        rider.setEmail(request.getEmail().trim().toLowerCase());
        rider.setPhone(cleanPhone);
        if (request.getProfilePictureUrl() != null && !request.getProfilePictureUrl().isBlank()) {
            rider.setProfilePictureUrl(request.getProfilePictureUrl().trim());
        }
        rider.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        rider.setActive(true);

        Rider saved = riderRepository.save(rider);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public AccountResponse getProfile(UUID riderId) {
        Rider rider = riderRepository.findById(riderId).orElseThrow(() -> new IllegalArgumentException("Rider not found"));

        return toResponse(rider);
    }

    @Transactional
    public AccountResponse updateProfile(UUID riderId, UpdateProfileRequest request) {
        Rider rider = riderRepository.findById(riderId).orElseThrow(() -> new IllegalArgumentException("Rider not found"));

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            rider.setFullName(request.getFullName().trim());
        }
        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            String cleanPhone = request.getPhone().trim().replaceAll("[^0-9]", "");
            if (!cleanPhone.isEmpty()) {
                var riderByPhone = riderRepository.findByPhone(cleanPhone);
                if (riderByPhone.isPresent() && !riderByPhone.get().getId().equals(riderId) && riderByPhone.get().isActive()) {
                    throw new IllegalArgumentException("This mobile number is already registered with another account");
                }
                var driverByPhone = driverRepository.findByPhone(cleanPhone);
                if (driverByPhone.isPresent() && driverByPhone.get().isActive()) {
                    throw new IllegalArgumentException("This mobile number is already registered with another account");
                }
                rider.setPhone(cleanPhone);
            }
        }
        if (request.isProfilePictureUrlSet()) {
            String newUrl = request.getProfilePictureUrl();
            String oldUrl = rider.getProfilePictureUrl();
            if (newUrl == null || newUrl.isBlank() || "null".equalsIgnoreCase(newUrl.trim())) {

                if (oldUrl != null && !oldUrl.isBlank()) {
                    cloudinaryService.deleteImage(oldUrl);
                }
                rider.setProfilePictureUrl(null);
            } else {
                String trimmed = newUrl.trim();
                if (oldUrl != null && !oldUrl.isBlank() && !oldUrl.equalsIgnoreCase(trimmed)) {
                    cloudinaryService.deleteImage(oldUrl);
                }
                rider.setProfilePictureUrl(trimmed);
            }
        }

        return toResponse(riderRepository.save(rider));
    }

    @Transactional
    public AccountResponse deleteProfilePicture(UUID riderId) {
        Rider rider = riderRepository.findById(riderId).orElseThrow(() -> new IllegalArgumentException("Rider not found"));

        String oldUrl = rider.getProfilePictureUrl();
        if (oldUrl != null && !oldUrl.isBlank()) {
            cloudinaryService.deleteImage(oldUrl);
        }
        rider.setProfilePictureUrl(null);
        return toResponse(riderRepository.save(rider));
    }

    @Transactional
    public AccountResponse updateProfilePicture(UUID riderId, String profilePictureUrl) {
        Rider rider = riderRepository.findById(riderId).orElseThrow(() -> new IllegalArgumentException("Rider not found"));

        String oldUrl = rider.getProfilePictureUrl();
        if (oldUrl != null && !oldUrl.isBlank() && !oldUrl.equalsIgnoreCase(profilePictureUrl)) {
            cloudinaryService.deleteImage(oldUrl);
        }
        rider.setProfilePictureUrl(profilePictureUrl == null || profilePictureUrl.isBlank() ? null : profilePictureUrl.trim());
        return toResponse(riderRepository.save(rider));
    }

    private AccountResponse toResponse(Rider rider) {
        return new AccountResponse(rider.getId(), rider.getFullName(), rider.getEmail(), rider.getPhone(), "RIDER", rider.getProfilePictureUrl(), rider.isActive(), rider.getCreatedAt());
    }
}
