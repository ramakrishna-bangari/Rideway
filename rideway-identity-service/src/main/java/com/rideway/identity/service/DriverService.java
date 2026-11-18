package com.rideway.identity.service;

import com.rideway.identity.dto.request.DriverRegistrationRequest;
import com.rideway.identity.dto.request.UpdateProfileRequest;
import com.rideway.identity.dto.response.DriverResponse;
import com.rideway.identity.entity.Driver;
import com.rideway.identity.enums.DriverVerificationStatus;
import com.rideway.identity.repository.DriverRepository;
import com.rideway.identity.repository.RiderRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final RiderRepository riderRepository;
    private final PasswordEncoder passwordEncoder;
    private final CloudinaryService cloudinaryService;

    public DriverService(DriverRepository driverRepository, RiderRepository riderRepository, PasswordEncoder passwordEncoder, CloudinaryService cloudinaryService) {
        this.driverRepository = driverRepository;
        this.riderRepository = riderRepository;
        this.passwordEncoder = passwordEncoder;
        this.cloudinaryService = cloudinaryService;
    }

    @Transactional
    public DriverResponse register(DriverRegistrationRequest request) {
        String email = request.getEmail().trim();
        String license = request.getLicenseNumber().trim();
        String cleanPhone = (request.getPhone() != null && !request.getPhone().isBlank()) ? request.getPhone().trim() : null;

        var existingOpt = driverRepository.findByEmailIgnoreCase(email);
        if (existingOpt.isPresent()) {
            Driver existing = existingOpt.get();
            if (!existing.isActive()) {
                existing.setFullName(request.getFullName().trim());
                existing.setPhone(cleanPhone);
                existing.setLicenseNumber(license);
                existing.setPasswordHash(passwordEncoder.encode(request.getPassword()));
                existing.setActive(true);
                existing.setVerificationStatus(DriverVerificationStatus.PENDING);
                return toResponse(driverRepository.save(existing));
            }
            throw new IllegalArgumentException("An account with this email already exists");
        }
        var activeRider = riderRepository.findByEmailIgnoreCase(email);
        if (activeRider.isPresent() && activeRider.get().isActive()) {
            throw new IllegalArgumentException("An account with this email already exists as a rider");
        }

        if (cleanPhone != null) {
            var byPhone = driverRepository.findByPhone(cleanPhone);
            if (byPhone.isPresent() && byPhone.get().isActive()) {
                throw new IllegalArgumentException("Phone number already registered");
            }
        }

        if (license != null && !license.isBlank()) {
            var byLicense = driverRepository.findByLicenseNumberIgnoreCase(license);
            if (byLicense.isPresent() && byLicense.get().isActive()) {
                throw new IllegalArgumentException("This license number is already registered");
            }
        }

        Driver driver = new Driver();
        driver.setFullName(request.getFullName().trim());
        driver.setEmail(email);
        driver.setPhone(cleanPhone);
        if (request.getProfilePictureUrl() != null && !request.getProfilePictureUrl().isBlank()) {
            String newUrl = request.getProfilePictureUrl().trim();
            String oldUrl = driver.getProfilePictureUrl();
            if (oldUrl != null && !oldUrl.isBlank() && !oldUrl.equalsIgnoreCase(newUrl)) {
                cloudinaryService.deleteImage(oldUrl);
            }
            driver.setProfilePictureUrl(newUrl);
        }
        if (request.getLicenseNumber() != null && !request.getLicenseNumber().isBlank()) {
            driver.setLicenseNumber(request.getLicenseNumber().trim());
        }
        driver.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        driver.setLicenseNumber(license);
        driver.setVerificationStatus(DriverVerificationStatus.PENDING);
        driver.setActive(true);

        return toResponse(driverRepository.save(driver));
    }

    @Transactional(readOnly = true)
    public DriverResponse getProfile(UUID driverId) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found"));

        return toResponse(driver);
    }

    @Transactional
    public DriverResponse updateProfile(UUID driverId, UpdateProfileRequest request) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found"));

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            driver.setFullName(request.getFullName().trim());
        }
        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            String cleanPhone = request.getPhone().trim().replaceAll("[^0-9]", "");
            if (!cleanPhone.isEmpty()) {
                var driverByPhone = driverRepository.findByPhone(cleanPhone);
                if (driverByPhone.isPresent() && !driverByPhone.get().getId().equals(driverId) && driverByPhone.get().isActive()) {
                    throw new IllegalArgumentException("This mobile number is already registered with another account");
                }
                var riderByPhone = riderRepository.findByPhone(cleanPhone);
                if (riderByPhone.isPresent() && riderByPhone.get().isActive()) {
                    throw new IllegalArgumentException("This mobile number is already registered with another account");
                }
                driver.setPhone(cleanPhone);
            }
        }
        if (request.isProfilePictureUrlSet()) {
            String newUrl = request.getProfilePictureUrl();
            String oldUrl = driver.getProfilePictureUrl();
            if (newUrl == null || newUrl.isBlank() || "null".equalsIgnoreCase(newUrl.trim())) {

                if (oldUrl != null && !oldUrl.isBlank()) {
                    cloudinaryService.deleteImage(oldUrl);
                }
                driver.setProfilePictureUrl(null);
            } else {
                String trimmed = newUrl.trim();
                if (oldUrl != null && !oldUrl.isBlank() && !oldUrl.equalsIgnoreCase(trimmed)) {
                    cloudinaryService.deleteImage(oldUrl);
                }
                driver.setProfilePictureUrl(trimmed);
            }
        }
        if (request.getLicenseNumber() != null && !request.getLicenseNumber().isBlank()) {
            driver.setLicenseNumber(request.getLicenseNumber().trim());
        }
        if (request.getVehicleType() != null && !request.getVehicleType().isBlank()) {
            driver.setVehicleType(request.getVehicleType().trim().toUpperCase());
        }
        if (request.getVehicleNumber() != null && !request.getVehicleNumber().isBlank()) {
            driver.setVehicleNumber(request.getVehicleNumber().trim());
        }

        return toResponse(driverRepository.save(driver));
    }

    @Transactional
    public DriverResponse deleteProfilePicture(UUID driverId) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found"));

        String oldUrl = driver.getProfilePictureUrl();
        if (oldUrl != null && !oldUrl.isBlank()) {
            cloudinaryService.deleteImage(oldUrl);
        }
        driver.setProfilePictureUrl(null);
        return toResponse(driverRepository.save(driver));
    }

    @Transactional(readOnly = true)
    public List<DriverResponse> findByVerificationStatus(DriverVerificationStatus status) {
        return driverRepository.findAllByVerificationStatus(status).stream().map(this::toResponse).toList();
    }

    @Transactional
    public DriverResponse updateVerificationStatus(UUID driverId, DriverVerificationStatus status) {
        if (status == null || status == DriverVerificationStatus.PENDING) {
            throw new IllegalArgumentException("Choose APPROVED or REJECTED");
        }

        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found"));

        driver.setVerificationStatus(status);
        return toResponse(driverRepository.save(driver));
    }

    private DriverResponse toResponse(Driver driver) {
        return DriverResponse.from(driver);
    }
}
