package com.rideway.identity.service;

import com.rideway.identity.dto.request.LoginRequest;
import com.rideway.identity.dto.request.RegistrationOtpRequest;
import com.rideway.identity.dto.response.AuthResponse;
import com.rideway.identity.entity.Driver;
import com.rideway.identity.entity.Rider;
import com.rideway.identity.enums.DriverVerificationStatus;
import com.rideway.identity.enums.OtpPurpose;
import com.rideway.identity.repository.DriverRepository;
import com.rideway.identity.repository.RefreshTokenRepository;
import com.rideway.identity.repository.RiderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final TwoFactorService twoFactorService;
    private final RiderRepository riderRepository;
    private final DriverRepository driverRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    private final Map<String, PendingRegistration> pendingRegistrations = new ConcurrentHashMap<>();
    private final Map<String, ForgotPasswordSession> forgotPasswordSessions = new ConcurrentHashMap<>();
    private final Map<String, ChangePasswordSession> changePasswordSessions = new ConcurrentHashMap<>();
    private final Map<String, ChangePhoneSession> changePhoneSessions = new ConcurrentHashMap<>();
    private final Map<String, SimpleOtpSession> simpleOtpSessions = new ConcurrentHashMap<>();

    public record ChangePhoneSession(
            String changePhoneToken,
            UUID userId,
            String role,
            String newPhone,
            Instant createdAt,
            Instant expiresAt,
            int attempts
    ) {}

    public record PendingRegistration(
            String transactionId,
            OtpPurpose purpose,
            String fullName,
            String email,
            String phone,
            String password,
            String profilePictureUrl,
            String licenseNumber,
            String vehicleType,
            String vehicleNumber,
            Instant createdAt,
            Instant expiresAt,
            int attempts,
            int resends,
            Instant lastSentAt
    ) {}

    public record ForgotPasswordSession(
            String resetToken,
            String phone,
            UUID userId,
            String role,
            boolean verified,
            Instant createdAt,
            Instant expiresAt,
            int attempts,
            Instant lastSentAt
    ) {}

    public record ChangePasswordSession(
            String changeToken,
            UUID userId,
            String role,
            String phone,
            boolean currentPasswordVerified,
            Instant createdAt,
            Instant expiresAt,
            int attempts,
            Instant lastSentAt
    ) {}

    public record SimpleOtpSession(
            String phone,
            Instant createdAt,
            Instant expiresAt,
            int attempts,
            Instant lastSentAt
    ) {}

    public Map<String, Object> requestRegistrationOtp(RegistrationOtpRequest request) {
        cleanupExpiredTransactions();

        if (request.getRole() == null || (!"RIDER".equalsIgnoreCase(request.getRole()) && !"DRIVER".equalsIgnoreCase(request.getRole()))) {
            throw new IllegalArgumentException("Role must be either RIDER or DRIVER");
        }

        String cleanEmail = request.getEmail().trim().toLowerCase();
        String formattedPhone = (request.getPhone() != null && !request.getPhone().isBlank())
                ? twoFactorService.formatIndianMobileNumber(request.getPhone())
                : null;
        String tenDigitPhone = formattedPhone != null
                ? (formattedPhone.startsWith("91") ? formattedPhone.substring(2) : formattedPhone)
                : null;

        var activeRider = riderRepository.findByEmailIgnoreCase(cleanEmail);
        if (activeRider.isPresent() && activeRider.get().isActive()) {
            throw new IllegalArgumentException("An account with this email already exists");
        }
        var activeDriver = driverRepository.findByEmailIgnoreCase(cleanEmail);
        if (activeDriver.isPresent() && activeDriver.get().isActive()) {
            throw new IllegalArgumentException("An account with this email already exists");
        }

        if (tenDigitPhone != null) {
            boolean phoneInUse = riderRepository.findAll().stream()
                    .anyMatch(r -> r.isActive() && r.getPhone() != null && r.getPhone().replaceAll("[^0-9]", "").endsWith(tenDigitPhone))
                    || driverRepository.findAll().stream()
                    .anyMatch(d -> d.isActive() && d.getPhone() != null && d.getPhone().replaceAll("[^0-9]", "").endsWith(tenDigitPhone));

            if (phoneInUse) {
                throw new IllegalArgumentException("This mobile number is already registered to an active account");
            }
        }

        String license = null;
        if ("DRIVER".equalsIgnoreCase(request.getRole())) {
            if (request.getLicenseNumber() == null || request.getLicenseNumber().trim().length() < 3) {
                throw new IllegalArgumentException("Valid driving license number is required for Driver registration");
            }
            license = request.getLicenseNumber().trim();
            var byLicense = driverRepository.findByLicenseNumberIgnoreCase(license);
            if (byLicense.isPresent() && byLicense.get().isActive()) {
                throw new IllegalArgumentException("This driving license number is already registered to an active driver");
            }
        }

        if (request.getPassword() == null || request.getPassword().length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }

        for (PendingRegistration existing : pendingRegistrations.values()) {
            if (existing.phone().equals(formattedPhone) && Instant.now().isBefore(existing.expiresAt())) {
                long secondsSinceLast = Duration.between(existing.lastSentAt(), Instant.now()).getSeconds();
                if (secondsSinceLast < 30) {
                    long wait = 30 - secondsSinceLast;
                    throw new IllegalArgumentException("Please wait " + wait + " seconds before requesting another OTP.");
                }
            }
        }

        twoFactorService.sendOtp(formattedPhone);

        String transactionId = "reg_" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(300);

        OtpPurpose purpose = "DRIVER".equalsIgnoreCase(request.getRole())
                ? OtpPurpose.DRIVER_REGISTRATION
                : OtpPurpose.RIDER_REGISTRATION;

        PendingRegistration pending = new PendingRegistration(
                transactionId,
                purpose,
                request.getFullName().trim(),
                cleanEmail,
                formattedPhone,
                request.getPassword(),
                request.getProfilePictureUrl(),
                license,
                request.getVehicleType(),
                request.getVehicleNumber(),
                now,
                expiresAt,
                0,
                0,
                now
        );

        pendingRegistrations.put(transactionId, pending);

        log.info("Registration OTP initiated for {} with mobile ending in ...{}",
                request.getRole(), tenDigitPhone.length() >= 4 ? tenDigitPhone.substring(tenDigitPhone.length() - 4) : "****");

        return Map.of(
                "success", true,
                "transactionId", transactionId,
                "phone", maskPhone(tenDigitPhone),
                "expiresInSeconds", 300,
                "message", "Verification OTP sent to your mobile number via SMS."
        );
    }

    public Map<String, Object> resendRegistrationOtp(String transactionId) {
        PendingRegistration pending = pendingRegistrations.get(transactionId);
        if (pending == null || Instant.now().isAfter(pending.expiresAt())) {
            if (pending != null) pendingRegistrations.remove(transactionId);
            throw new IllegalArgumentException("Registration session has expired. Please restart registration.");
        }

        long secondsSinceLast = Duration.between(pending.lastSentAt(), Instant.now()).getSeconds();
        if (secondsSinceLast < 30) {
            long wait = 30 - secondsSinceLast;
            throw new IllegalArgumentException("Please wait " + wait + " seconds before requesting another OTP.");
        }

        if (pending.resends() >= 3) {
            throw new IllegalArgumentException("Maximum OTP resend limit reached. Please verify with the code already sent or restart.");
        }

        twoFactorService.sendOtp(pending.phone());

        Instant now = Instant.now();
        PendingRegistration updated = new PendingRegistration(
                pending.transactionId(),
                pending.purpose(),
                pending.fullName(),
                pending.email(),
                pending.phone(),
                pending.password(),
                pending.profilePictureUrl(),
                pending.licenseNumber(),
                pending.vehicleType(),
                pending.vehicleNumber(),
                pending.createdAt(),
                now.plusSeconds(300),
                pending.attempts(),
                pending.resends() + 1,
                now
        );

        pendingRegistrations.put(transactionId, updated);

        return Map.of(
                "success", true,
                "message", "New OTP code sent to your mobile number.",
                "expiresInSeconds", 300
        );
    }

    @Transactional
    public AuthResponse confirmRegistration(String transactionId, String otp) {
        if (otp == null || otp.trim().isBlank()) {
            throw new IllegalArgumentException("Please enter the verification OTP code.");
        }

        PendingRegistration pending = pendingRegistrations.get(transactionId);
        if (pending == null || Instant.now().isAfter(pending.expiresAt())) {
            if (pending != null) pendingRegistrations.remove(transactionId);
            throw new IllegalArgumentException("Registration session has expired. Please restart registration.");
        }

        if (pending.attempts() >= 3) {
            pendingRegistrations.remove(transactionId);
            throw new IllegalArgumentException("Maximum verification attempts exceeded. Please restart registration.");
        }

        try {
            twoFactorService.verifyOtp(pending.phone(), otp.trim());
        } catch (Exception ex) {
            int remaining = 3 - (pending.attempts() + 1);
            if (remaining <= 0) {
                pendingRegistrations.remove(transactionId);
                throw new IllegalArgumentException("Incorrect OTP code. Maximum attempts exceeded. Please restart registration.");
            }
            PendingRegistration updated = new PendingRegistration(
                    pending.transactionId(),
                    pending.purpose(),
                    pending.fullName(),
                    pending.email(),
                    pending.phone(),
                    pending.password(),
                    pending.profilePictureUrl(),
                    pending.licenseNumber(),
                    pending.vehicleType(),
                    pending.vehicleNumber(),
                    pending.createdAt(),
                    pending.expiresAt(),
                    pending.attempts() + 1,
                    pending.resends(),
                    pending.lastSentAt()
            );
            pendingRegistrations.put(transactionId, updated);
            throw new IllegalArgumentException("Incorrect OTP code. (" + remaining + " attempts remaining)");
        }

        pendingRegistrations.remove(transactionId);

        if (pending.purpose() == OtpPurpose.RIDER_REGISTRATION) {

            var existingOpt = riderRepository.findByEmailIgnoreCase(pending.email());
            Rider rider;
            if (existingOpt.isPresent()) {
                rider = existingOpt.get();
                rider.setFullName(pending.fullName());
                rider.setPhone(pending.phone());
                rider.setPasswordHash(passwordEncoder.encode(pending.password()));
                rider.setActive(true);
            } else {
                rider = new Rider();
                rider.setFullName(pending.fullName());
                rider.setEmail(pending.email());
                rider.setPhone(pending.phone());
                rider.setPasswordHash(passwordEncoder.encode(pending.password()));
                if (pending.profilePictureUrl() != null && !pending.profilePictureUrl().isBlank()) {
                    rider.setProfilePictureUrl(pending.profilePictureUrl().trim());
                }
                rider.setActive(true);
            }
            riderRepository.save(rider);
            log.info("Rider registered successfully with verified mobile: {}", rider.getEmail());

            return authService.loginRider(new LoginRequest(rider.getEmail(), pending.password()));
        } else {

            var existingOpt = driverRepository.findByEmailIgnoreCase(pending.email());
            Driver driver;
            if (existingOpt.isPresent()) {
                driver = existingOpt.get();
                driver.setFullName(pending.fullName());
                driver.setPhone(pending.phone());
                driver.setLicenseNumber(pending.licenseNumber());
                driver.setPasswordHash(passwordEncoder.encode(pending.password()));
                driver.setActive(true);
                driver.setVerificationStatus(DriverVerificationStatus.PENDING);
            } else {
                driver = new Driver();
                driver.setFullName(pending.fullName());
                driver.setEmail(pending.email());
                driver.setPhone(pending.phone());
                driver.setLicenseNumber(pending.licenseNumber());
                driver.setPasswordHash(passwordEncoder.encode(pending.password()));
                if (pending.profilePictureUrl() != null && !pending.profilePictureUrl().isBlank()) {
                    driver.setProfilePictureUrl(pending.profilePictureUrl().trim());
                }
                driver.setActive(true);
                driver.setVerificationStatus(DriverVerificationStatus.PENDING);
            }
            driverRepository.save(driver);
            log.info("Driver registered successfully with verified mobile: {}", driver.getEmail());

            return authService.loginDriver(new LoginRequest(driver.getEmail(), pending.password()));
        }
    }

    public Map<String, Object> requestForgotPasswordOtp(String rawPhone) {
        cleanupExpiredTransactions();

        if (rawPhone == null || rawPhone.isBlank()) {
            throw new IllegalArgumentException("Mobile number is required.");
        }

        String formattedPhone = twoFactorService.formatIndianMobileNumber(rawPhone);
        String tenDigitPhone = formattedPhone.startsWith("91") ? formattedPhone.substring(2) : formattedPhone;

        UUID targetUserId = null;
        String targetRole = null;

        var riderOpt = riderRepository.findAll().stream()
                .filter(r -> r.isActive() && r.getPhone() != null && r.getPhone().replaceAll("[^0-9]", "").endsWith(tenDigitPhone))
                .findFirst();

        if (riderOpt.isPresent()) {
            targetUserId = riderOpt.get().getId();
            targetRole = "RIDER";
        } else {

            var driverOpt = driverRepository.findAll().stream()
                    .filter(d -> d.isActive() && d.getPhone() != null && d.getPhone().replaceAll("[^0-9]", "").endsWith(tenDigitPhone))
                    .findFirst();
            if (driverOpt.isPresent()) {
                targetUserId = driverOpt.get().getId();
                targetRole = "DRIVER";
            }
        }

        if (targetUserId == null) {
            throw new IllegalArgumentException("No active account found for mobile number ending in ..." +
                    (tenDigitPhone.length() >= 4 ? tenDigitPhone.substring(tenDigitPhone.length() - 4) : "****"));
        }

        twoFactorService.sendOtp(formattedPhone);

        String resetToken = "pwd_" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        ForgotPasswordSession session = new ForgotPasswordSession(
                resetToken,
                formattedPhone,
                targetUserId,
                targetRole,
                false,
                now,
                now.plusSeconds(300),
                0,
                now
        );

        forgotPasswordSessions.put(resetToken, session);

        return Map.of(
                "success", true,
                "resetToken", resetToken,
                "phone", maskPhone(tenDigitPhone),
                "expiresInSeconds", 300,
                "message", "Verification OTP sent to your registered mobile number."
        );
    }

    public Map<String, Object> verifyForgotPasswordOtp(String resetToken, String otp) {
        if (otp == null || otp.trim().isBlank()) {
            throw new IllegalArgumentException("Please enter the verification OTP code.");
        }

        ForgotPasswordSession session = forgotPasswordSessions.get(resetToken);
        if (session == null || Instant.now().isAfter(session.expiresAt())) {
            if (session != null) forgotPasswordSessions.remove(resetToken);
            throw new IllegalArgumentException("Password reset session has expired. Please request a new OTP.");
        }

        if (session.attempts() >= 3) {
            forgotPasswordSessions.remove(resetToken);
            throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new OTP.");
        }

        try {
            twoFactorService.verifyOtp(session.phone(), otp.trim());
        } catch (Exception ex) {
            int remaining = 3 - (session.attempts() + 1);
            if (remaining <= 0) {
                forgotPasswordSessions.remove(resetToken);
                throw new IllegalArgumentException("Incorrect OTP. Maximum attempts exceeded. Please request a new OTP.");
            }
            ForgotPasswordSession updated = new ForgotPasswordSession(
                    session.resetToken(),
                    session.phone(),
                    session.userId(),
                    session.role(),
                    false,
                    session.createdAt(),
                    session.expiresAt(),
                    session.attempts() + 1,
                    session.lastSentAt()
            );
            forgotPasswordSessions.put(resetToken, updated);
            throw new IllegalArgumentException("Incorrect OTP code. (" + remaining + " attempts remaining)");
        }

        Instant now = Instant.now();
        ForgotPasswordSession verifiedSession = new ForgotPasswordSession(
                session.resetToken(),
                session.phone(),
                session.userId(),
                session.role(),
                true,
                session.createdAt(),
                now.plusSeconds(300),
                session.attempts(),
                session.lastSentAt()
        );
        forgotPasswordSessions.put(resetToken, verifiedSession);

        return Map.of(
                "success", true,
                "message", "OTP verified successfully. You may now enter your new password."
        );
    }

    @Transactional
    public Map<String, Object> confirmForgotPasswordReset(String resetToken, String newPassword) {
        ForgotPasswordSession session = forgotPasswordSessions.get(resetToken);
        if (session == null || !session.verified() || Instant.now().isAfter(session.expiresAt())) {
            if (session != null) forgotPasswordSessions.remove(resetToken);
            throw new IllegalArgumentException("Password reset authorization has expired or is invalid. Please restart.");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("New password must be at least 8 characters long.");
        }

        forgotPasswordSessions.remove(resetToken);

        if ("RIDER".equalsIgnoreCase(session.role())) {
            Rider rider = riderRepository.findById(session.userId())
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            rider.setPasswordHash(passwordEncoder.encode(newPassword));
            riderRepository.save(rider);
            try {
                refreshTokenRepository.deleteByRider(rider);
            } catch (Exception ignored) {}
            log.info("Password reset successfully for Rider: {}", rider.getEmail());
        } else {
            Driver driver = driverRepository.findById(session.userId())
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            driver.setPasswordHash(passwordEncoder.encode(newPassword));
            driverRepository.save(driver);
            try {
                refreshTokenRepository.deleteByDriver(driver);
            } catch (Exception ignored) {}
            log.info("Password reset successfully for Driver: {}", driver.getEmail());
        }

        return Map.of(
                "success", true,
                "message", "Password has been updated successfully. You can now login with your new credentials."
        );
    }

    public Map<String, Object> requestChangePasswordOtp(String currentUserEmail, String currentUserRole, String currentPassword) {
        cleanupExpiredTransactions();

        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("Current password is required.");
        }

        String phone;
        UUID userId;

        if ("DRIVER".equalsIgnoreCase(currentUserRole)) {
            Driver driver = driverRepository.findByEmailIgnoreCase(currentUserEmail.trim())
                    .orElseThrow(() -> new IllegalArgumentException("User account not found"));
            if (!passwordEncoder.matches(currentPassword, driver.getPasswordHash())) {
                throw new IllegalArgumentException("Current password is incorrect.");
            }
            if (driver.getPhone() == null || driver.getPhone().isBlank()) {
                throw new IllegalArgumentException("No registered phone number found on account. Please update phone in profile.");
            }
            phone = twoFactorService.formatIndianMobileNumber(driver.getPhone());
            userId = driver.getId();
        } else {
            Rider rider = riderRepository.findByEmailIgnoreCase(currentUserEmail.trim())
                    .orElseThrow(() -> new IllegalArgumentException("User account not found"));
            if (!passwordEncoder.matches(currentPassword, rider.getPasswordHash())) {
                throw new IllegalArgumentException("Current password is incorrect.");
            }
            if (rider.getPhone() == null || rider.getPhone().isBlank()) {
                throw new IllegalArgumentException("No registered phone number found on account. Please update phone in profile.");
            }
            phone = twoFactorService.formatIndianMobileNumber(rider.getPhone());
            userId = rider.getId();
        }

        twoFactorService.sendOtp(phone);

        String changeToken = "chg_" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        ChangePasswordSession session = new ChangePasswordSession(
                changeToken,
                userId,
                currentUserRole,
                phone,
                true,
                now,
                now.plusSeconds(300),
                0,
                now
        );

        changePasswordSessions.put(changeToken, session);

        String tenDigit = phone.startsWith("91") ? phone.substring(2) : phone;
        return Map.of(
                "success", true,
                "changeToken", changeToken,
                "phone", maskPhone(tenDigit),
                "expiresInSeconds", 300,
                "message", "Verification OTP sent to your registered mobile number."
        );
    }

    @Transactional
    public Map<String, Object> confirmChangePassword(
            String currentUserEmail,
            String currentUserRole,
            String changeToken,
            String otp,
            String currentPassword,
            String newPassword
    ) {
        if (changeToken == null || changeToken.isBlank()) {
            throw new IllegalArgumentException("Change password authorization token is required.");
        }
        if (otp == null || otp.trim().isBlank()) {
            throw new IllegalArgumentException("Please enter the verification OTP.");
        }
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("New password must be at least 8 characters long.");
        }

        ChangePasswordSession session = changePasswordSessions.get(changeToken);
        if (session == null || Instant.now().isAfter(session.expiresAt())) {
            if (session != null) changePasswordSessions.remove(changeToken);
            throw new IllegalArgumentException("Password change session has expired. Please request a new OTP.");
        }

        if (session.attempts() >= 3) {
            changePasswordSessions.remove(changeToken);
            throw new IllegalArgumentException("Maximum verification attempts exceeded. Please restart password change.");
        }

        if ("DRIVER".equalsIgnoreCase(currentUserRole)) {
            Driver driver = driverRepository.findById(session.userId())
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            if (!passwordEncoder.matches(currentPassword, driver.getPasswordHash())) {
                throw new IllegalArgumentException("Current password is incorrect.");
            }
            if (passwordEncoder.matches(newPassword, driver.getPasswordHash())) {
                throw new IllegalArgumentException("New password cannot be the same as your current password.");
            }

            try {
                twoFactorService.verifyOtp(session.phone(), otp.trim());
            } catch (Exception ex) {
                int remaining = 3 - (session.attempts() + 1);
                if (remaining <= 0) {
                    changePasswordSessions.remove(changeToken);
                    throw new IllegalArgumentException("Incorrect OTP. Maximum attempts exceeded. Please restart password change.");
                }
                ChangePasswordSession updated = new ChangePasswordSession(
                        session.changeToken(),
                        session.userId(),
                        session.role(),
                        session.phone(),
                        session.currentPasswordVerified(),
                        session.createdAt(),
                        session.expiresAt(),
                        session.attempts() + 1,
                        session.lastSentAt()
                );
                changePasswordSessions.put(changeToken, updated);
                throw new IllegalArgumentException("Incorrect OTP code. (" + remaining + " attempts remaining)");
            }

            changePasswordSessions.remove(changeToken);

            driver.setPasswordHash(passwordEncoder.encode(newPassword));
            driverRepository.save(driver);
            try {
                refreshTokenRepository.deleteByDriver(driver);
            } catch (Exception ignored) {}
            log.info("Password changed successfully for Driver: {}", driver.getEmail());
        } else {
            Rider rider = riderRepository.findById(session.userId())
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            if (!passwordEncoder.matches(currentPassword, rider.getPasswordHash())) {
                throw new IllegalArgumentException("Current password is incorrect.");
            }
            if (passwordEncoder.matches(newPassword, rider.getPasswordHash())) {
                throw new IllegalArgumentException("New password cannot be the same as your current password.");
            }

            try {
                twoFactorService.verifyOtp(session.phone(), otp.trim());
            } catch (Exception ex) {
                int remaining = 3 - (session.attempts() + 1);
                if (remaining <= 0) {
                    changePasswordSessions.remove(changeToken);
                    throw new IllegalArgumentException("Incorrect OTP. Maximum attempts exceeded. Please restart password change.");
                }
                ChangePasswordSession updated = new ChangePasswordSession(
                        session.changeToken(),
                        session.userId(),
                        session.role(),
                        session.phone(),
                        session.currentPasswordVerified(),
                        session.createdAt(),
                        session.expiresAt(),
                        session.attempts() + 1,
                        session.lastSentAt()
                );
                changePasswordSessions.put(changeToken, updated);
                throw new IllegalArgumentException("Incorrect OTP code. (" + remaining + " attempts remaining)");
            }

            changePasswordSessions.remove(changeToken);

            rider.setPasswordHash(passwordEncoder.encode(newPassword));
            riderRepository.save(rider);
            try {
                refreshTokenRepository.deleteByRider(rider);
            } catch (Exception ignored) {}
            log.info("Password changed successfully for Rider: {}", rider.getEmail());
        }

        return Map.of(
                "success", true,
                "message", "Password has been changed successfully."
        );
    }

    public Map<String, Object> sendOtp(String rawPhone) {
        String formatted = twoFactorService.formatIndianMobileNumber(rawPhone);
        twoFactorService.sendOtp(formatted);

        Instant now = Instant.now();
        simpleOtpSessions.put(formatted, new SimpleOtpSession(formatted, now, now.plusSeconds(300), 0, now));

        String tenDigit = formatted.startsWith("91") ? formatted.substring(2) : formatted;
        return Map.of(
                "success", true,
                "phone", maskPhone(tenDigit),
                "expiresInSeconds", 300,
                "message", "OTP sent to your mobile number via SMS."
        );
    }

    public boolean verifyOtp(String rawPhone, String code) {
        String formatted = twoFactorService.formatIndianMobileNumber(rawPhone);
        SimpleOtpSession session = simpleOtpSessions.get(formatted);

        if (session != null && Instant.now().isAfter(session.expiresAt())) {
            simpleOtpSessions.remove(formatted);
            throw new IllegalArgumentException("OTP has expired. Please request a new OTP.");
        }

        twoFactorService.verifyOtp(formatted, code);
        simpleOtpSessions.remove(formatted);
        return true;
    }

    @Transactional
    public Map<String, Object> resetPasswordWithOtp(String rawPhone, String code, String newPassword) {
        verifyOtp(rawPhone, code);

        String formatted = twoFactorService.formatIndianMobileNumber(rawPhone);
        String tenDigits = formatted.startsWith("91") ? formatted.substring(2) : formatted;

        boolean updated = false;

        var riderOpt = riderRepository.findAll().stream()
                .filter(r -> r.isActive() && r.getPhone() != null && r.getPhone().replaceAll("[^0-9]", "").endsWith(tenDigits))
                .findFirst();

        if (riderOpt.isPresent()) {
            Rider rider = riderOpt.get();
            rider.setPasswordHash(passwordEncoder.encode(newPassword));
            riderRepository.save(rider);
            try { refreshTokenRepository.deleteByRider(rider); } catch (Exception ignored) {}
            updated = true;
        }

        var driverOpt = driverRepository.findAll().stream()
                .filter(d -> d.isActive() && d.getPhone() != null && d.getPhone().replaceAll("[^0-9]", "").endsWith(tenDigits))
                .findFirst();

        if (driverOpt.isPresent()) {
            Driver driver = driverOpt.get();
            driver.setPasswordHash(passwordEncoder.encode(newPassword));
            driverRepository.save(driver);
            try { refreshTokenRepository.deleteByDriver(driver); } catch (Exception ignored) {}
            updated = true;
        }

        if (!updated) {
            throw new IllegalArgumentException("No active account found for mobile number +" + formatted);
        }

        return Map.of(
                "success", true,
                "message", "Password has been updated successfully. You can now login with your new credentials."
        );
    }

    public Map<String, Object> requestChangePhoneOtp(String currentUserEmail, String currentUserRole, String newPhone) {
        cleanupExpiredTransactions();

        if (newPhone == null || newPhone.trim().isBlank()) {
            throw new IllegalArgumentException("New mobile number is required.");
        }

        String cleanPhone = newPhone.replaceAll("[^0-9]", "").trim();
        if (cleanPhone.length() < 10) {
            throw new IllegalArgumentException("Please enter a valid 10 digit mobile number.");
        }

        UUID userId;
        String currentPhone;
        if ("DRIVER".equalsIgnoreCase(currentUserRole)) {
            Driver driver = driverRepository.findByEmailIgnoreCase(currentUserEmail)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            userId = driver.getId();
            currentPhone = driver.getPhone();
        } else {
            Rider rider = riderRepository.findByEmailIgnoreCase(currentUserEmail)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            userId = rider.getId();
            currentPhone = rider.getPhone();
        }

        if (currentPhone != null && currentPhone.replaceAll("[^0-9]", "").equals(cleanPhone)) {
            throw new IllegalArgumentException("This is already your registered mobile number.");
        }

        var existingRider = riderRepository.findByPhone(cleanPhone);
        if (existingRider.isPresent() && !existingRider.get().getId().equals(userId) && existingRider.get().isActive()) {
            throw new IllegalArgumentException("This mobile number is already registered with another account.");
        }
        var existingDriver = driverRepository.findByPhone(cleanPhone);
        if (existingDriver.isPresent() && !existingDriver.get().getId().equals(userId) && existingDriver.get().isActive()) {
            throw new IllegalArgumentException("This mobile number is already registered with another account.");
        }

        if (cleanPhone.length() == 10) {
            String with91 = "91" + cleanPhone;
            if (riderRepository.findByPhone(with91).filter(r -> !r.getId().equals(userId) && r.isActive()).isPresent()
                    || driverRepository.findByPhone(with91).filter(d -> !d.getId().equals(userId) && d.isActive()).isPresent()) {
                throw new IllegalArgumentException("This mobile number is already registered with another account.");
            }
        }

        try {
            twoFactorService.sendOtp(cleanPhone);
        } catch (Exception ex) {
            log.warn("2Factor dispatch notice for {}: {}", cleanPhone, ex.getMessage());
        }

        String changePhoneToken = UUID.randomUUID().toString();
        Instant now = Instant.now();
        ChangePhoneSession session = new ChangePhoneSession(
                changePhoneToken,
                userId,
                currentUserRole,
                cleanPhone,
                now,
                now.plus(Duration.ofMinutes(10)),
                0
        );
        changePhoneSessions.put(changePhoneToken, session);

        log.info("Change phone OTP dispatched to {} for user {}", cleanPhone, currentUserEmail);

        return Map.of(
                "changePhoneToken", changePhoneToken,
                "phone", cleanPhone,
                "message", "Verification OTP sent to " + cleanPhone,
                "expiresInSeconds", 600
        );
    }

    @Transactional
    public Map<String, Object> confirmChangePhone(
            String currentUserEmail,
            String currentUserRole,
            String changePhoneToken,
            String otp,
            String newPhone
    ) {
        cleanupExpiredTransactions();

        if (changePhoneToken == null || changePhoneToken.isBlank()) {
            throw new IllegalArgumentException("Session token is required.");
        }
        if (otp == null || otp.trim().isBlank()) {
            throw new IllegalArgumentException("Please enter the verification OTP.");
        }

        ChangePhoneSession session = changePhoneSessions.get(changePhoneToken);
        if (session == null || Instant.now().isAfter(session.expiresAt())) {
            if (session != null) changePhoneSessions.remove(changePhoneToken);
            throw new IllegalArgumentException("Mobile verification session has expired. Please request a new OTP.");
        }

        if (session.attempts() >= 3) {
            changePhoneSessions.remove(changePhoneToken);
            throw new IllegalArgumentException("Maximum verification attempts exceeded. Please restart.");
        }

        String targetPhone = session.newPhone();
        log.info("Processing change phone confirmation for user {} to {}", currentUserEmail, targetPhone);

        if (newPhone != null && !newPhone.trim().isBlank()) {
            String cleanParamPhone = newPhone.replaceAll("[^0-9]", "").trim();
            if (!cleanParamPhone.isEmpty() && !cleanParamPhone.equals(targetPhone)) {
                log.debug("Session phone {} matched with incoming {}", targetPhone, cleanParamPhone);
            }
        }

        try {
            twoFactorService.verifyOtp(targetPhone, otp.trim());
        } catch (Exception ex) {
            int remaining = 3 - (session.attempts() + 1);
            if (remaining <= 0) {
                changePhoneSessions.remove(changePhoneToken);
                throw new IllegalArgumentException("Incorrect OTP. Maximum attempts exceeded. Please restart.");
            }
            ChangePhoneSession updated = new ChangePhoneSession(
                    session.changePhoneToken(),
                    session.userId(),
                    session.role(),
                    session.newPhone(),
                    session.createdAt(),
                    session.expiresAt(),
                    session.attempts() + 1
            );
            changePhoneSessions.put(changePhoneToken, updated);
            throw new IllegalArgumentException("Incorrect OTP code. (" + remaining + " attempts remaining)");
        }

        changePhoneSessions.remove(changePhoneToken);

        var existingRider = riderRepository.findByPhone(targetPhone);
        if (existingRider.isPresent() && !existingRider.get().getId().equals(session.userId()) && existingRider.get().isActive()) {
            throw new IllegalArgumentException("This mobile number is already registered with another account.");
        }
        var existingDriver = driverRepository.findByPhone(targetPhone);
        if (existingDriver.isPresent() && !existingDriver.get().getId().equals(session.userId()) && existingDriver.get().isActive()) {
            throw new IllegalArgumentException("This mobile number is already registered with another account.");
        }

        if ("DRIVER".equalsIgnoreCase(currentUserRole) || "DRIVER".equalsIgnoreCase(session.role())) {
            Driver driver = driverRepository.findById(session.userId())
                    .orElseThrow(() -> new IllegalArgumentException("Driver account not found"));
            driver.setPhone(targetPhone);
            driverRepository.save(driver);
            log.info("Driver {} phone successfully updated in DB to {}", driver.getEmail(), targetPhone);
        } else {
            Rider rider = riderRepository.findById(session.userId())
                    .orElseThrow(() -> new IllegalArgumentException("Rider account not found"));
            rider.setPhone(targetPhone);
            riderRepository.save(rider);
            log.info("Rider {} phone successfully updated in DB to {}", rider.getEmail(), targetPhone);
        }

        return Map.of(
                "success", true,
                "message", "Mobile number updated successfully!",
                "phone", targetPhone
        );
    }

    private void cleanupExpiredTransactions() {
        Instant now = Instant.now();
        pendingRegistrations.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
        forgotPasswordSessions.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
        changePasswordSessions.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
        simpleOtpSessions.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "..." + phone.substring(phone.length() - 4);
    }
}
