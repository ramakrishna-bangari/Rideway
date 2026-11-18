package com.rideway.identity.controller;

import com.rideway.identity.dto.request.ChangePasswordConfirmRequest;
import com.rideway.identity.dto.request.RegistrationConfirmRequest;
import com.rideway.identity.dto.request.RegistrationOtpRequest;
import com.rideway.identity.dto.response.AuthResponse;
import com.rideway.identity.service.OtpService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth/otp")
@RequiredArgsConstructor
public class OtpController {

    private final OtpService otpService;

    @PostMapping("/registration/request")
    public ResponseEntity<?> requestRegistrationOtp(@Valid @RequestBody RegistrationOtpRequest request) {
        return ResponseEntity.ok(otpService.requestRegistrationOtp(request));
    }

    @PostMapping("/registration/resend")
    public ResponseEntity<?> resendRegistrationOtp(@RequestBody Map<String, String> body) {
        String transactionId = body.get("transactionId");
        return ResponseEntity.ok(otpService.resendRegistrationOtp(transactionId));
    }

    @PostMapping("/registration/confirm")
    public ResponseEntity<?> confirmRegistration(@Valid @RequestBody RegistrationConfirmRequest request, HttpServletResponse response) {
        AuthResponse auth = otpService.confirmRegistration(request.getTransactionId(), request.getOtp());
        attachAuthCookies(response, auth.getAccessToken(), auth.getRefreshToken());
        return ResponseEntity.status(HttpStatus.CREATED).body(auth);
    }

    @PostMapping("/forgot-password/request")
    public ResponseEntity<?> requestForgotPasswordOtp(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        return ResponseEntity.ok(otpService.requestForgotPasswordOtp(phone));
    }

    @PostMapping("/forgot-password/verify")
    public ResponseEntity<?> verifyForgotPasswordOtp(@RequestBody Map<String, String> body) {
        String resetToken = body.get("resetToken");
        String otp = body.get("otp");
        return ResponseEntity.ok(otpService.verifyForgotPasswordOtp(resetToken, otp));
    }

    @PostMapping("/forgot-password/reset")
    public ResponseEntity<?> confirmForgotPasswordReset(@RequestBody Map<String, String> body) {
        String resetToken = body.get("resetToken");
        String newPassword = body.get("newPassword");
        return ResponseEntity.ok(otpService.confirmForgotPasswordReset(resetToken, newPassword));
    }

    @PostMapping("/change-password/request")
    public ResponseEntity<?> requestChangePasswordOtp(Authentication authentication, @RequestBody Map<String, String> body) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Authentication required"));
        }

        String email = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_RIDER")
                .replace("ROLE_", "");

        String currentPassword = body.get("currentPassword");
        return ResponseEntity.ok(otpService.requestChangePasswordOtp(email, role, currentPassword));
    }

    @PostMapping("/change-password/confirm")
    public ResponseEntity<?> confirmChangePassword(Authentication authentication, @Valid @RequestBody ChangePasswordConfirmRequest request) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Authentication required"));
        }

        String email = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_RIDER")
                .replace("ROLE_", "");

        return ResponseEntity.ok(otpService.confirmChangePassword(
                email,
                role,
                request.getChangeToken(),
                request.getOtp(),
                request.getCurrentPassword(),
                request.getNewPassword()
        ));
    }

    @PostMapping("/change-phone/request")
    public ResponseEntity<?> requestChangePhoneOtp(Authentication authentication, @RequestBody Map<String, String> body) {
        String email = null;
        String role = null;

        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equalsIgnoreCase(authentication.getName())) {
            email = authentication.getName();
            role = authentication.getAuthorities().stream()
                    .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                    .findFirst()
                    .orElse("ROLE_RIDER")
                    .replace("ROLE_", "");
        } else if (body.containsKey("email")) {
            email = body.get("email");
            role = body.getOrDefault("role", "RIDER");
        }

        if (email == null || email.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Authentication required to change mobile number"));
        }

        String newPhone = body.get("newPhone");
        return ResponseEntity.ok(otpService.requestChangePhoneOtp(email, role, newPhone));
    }

    @PostMapping("/change-phone/confirm")
    public ResponseEntity<?> confirmChangePhone(Authentication authentication, @RequestBody Map<String, String> body) {
        String email = null;
        String role = null;

        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equalsIgnoreCase(authentication.getName())) {
            email = authentication.getName();
            role = authentication.getAuthorities().stream()
                    .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                    .findFirst()
                    .orElse("ROLE_RIDER")
                    .replace("ROLE_", "");
        } else if (body.containsKey("email")) {
            email = body.get("email");
            role = body.getOrDefault("role", "RIDER");
        }

        if (email == null || email.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Authentication required to change mobile number"));
        }

        String changePhoneToken = body.get("changePhoneToken");
        String otp = body.get("otp");
        String newPhone = body.get("newPhone");

        return ResponseEntity.ok(otpService.confirmChangePhone(email, role, changePhoneToken, otp, newPhone));
    }

    @PostMapping("/send")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        return ResponseEntity.ok(otpService.sendOtp(phone));
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String otp = request.get("otp");
        boolean valid = otpService.verifyOtp(phone, otp);
        return ResponseEntity.ok(Map.of("success", valid, "message", "OTP verified successfully"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String otp = request.get("otp");
        String newPassword = request.get("newPassword");
        return ResponseEntity.ok(otpService.resetPasswordWithOtp(phone, otp, newPassword));
    }

    private void attachAuthCookies(HttpServletResponse response, String token, String refreshToken) {
        if (response == null) return;

        if (token != null && !token.isBlank()) {
            ResponseCookie tokenCookie = ResponseCookie.from("rideway_access_token", token)
                    .httpOnly(true)
                    .secure(false)
                    .path("/")
                    .maxAge(7 * 24 * 3600)
                    .sameSite("Lax")
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, tokenCookie.toString());
        }

        if (refreshToken != null && !refreshToken.isBlank()) {
            ResponseCookie refreshCookie = ResponseCookie.from("rideway_refresh_token", refreshToken)
                    .httpOnly(true)
                    .secure(false)
                    .path("/")
                    .maxAge(30 * 24 * 3600)
                    .sameSite("Lax")
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        }
    }
}
