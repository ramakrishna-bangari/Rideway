package com.rideway.identity.controller;

import com.rideway.identity.dto.request.*;
import com.rideway.identity.dto.response.*;
import com.rideway.identity.service.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RiderService riderService;
    private final DriverService driverService;
    private final CloudinaryService cloudinaryService;

    @PostMapping(value = "/profile-picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadProfilePicture(@RequestParam("file") MultipartFile file) {
        try {
            String imageUrl = cloudinaryService.uploadImage(file);
            return ResponseEntity.ok(Map.of("url", imageUrl));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to upload image: " + e.getMessage()));
        }
    }

    @DeleteMapping("/profile-picture")
    public ResponseEntity<?> deleteProfilePicture(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String email = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_RIDER")
                .replace("ROLE_", "");

        authService.deleteProfilePicture(email, role);
        return ResponseEntity.ok(Map.of("message", "Profile photo deleted successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> loginUnified(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        attachAuthCookies(response, authResponse.getAccessToken(), authResponse.getRefreshToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> loginGoogle(@RequestBody Map<String, String> googleProfile, HttpServletResponse response) {
        AuthResponse authResponse = authService.loginWithGoogle(googleProfile);
        attachAuthCookies(response, authResponse.getAccessToken(), authResponse.getRefreshToken());
        return ResponseEntity.ok(authResponse);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            return ResponseEntity.ok(Map.of("authenticated", false));
        }

        String email = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("ROLE_RIDER")
                .replace("ROLE_", "");

        try {
            Map<String, Object> userData = new HashMap<>(authService.getCurrentUser(email, role));
            userData.put("authenticated", true);
            return ResponseEntity.ok(userData);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("authenticated", false));
        }
    }

    @PostMapping("/riders/register")
    public ResponseEntity<?> registerRider(@Valid @RequestBody RiderRegistrationRequest request, HttpServletResponse response) {
        var res = riderService.register(request);
        try {
            AuthResponse auth = authService.loginRider(new LoginRequest(request.getEmail(), request.getPassword()));
            attachAuthCookies(response, auth.getAccessToken(), auth.getRefreshToken());
            return ResponseEntity.status(HttpStatus.CREATED).body(auth);
        } catch (Exception ignored) {
            return ResponseEntity.status(HttpStatus.CREATED).body(res);
        }
    }

    @PostMapping("/drivers/register")
    public ResponseEntity<?> registerDriver(@Valid @RequestBody DriverRegistrationRequest request, HttpServletResponse response) {
        var res = driverService.register(request);
        try {
            AuthResponse auth = authService.loginDriver(new LoginRequest(request.getEmail(), request.getPassword()));
            attachAuthCookies(response, auth.getAccessToken(), auth.getRefreshToken());
            return ResponseEntity.status(HttpStatus.CREATED).body(auth);
        } catch (Exception ignored) {
            return ResponseEntity.status(HttpStatus.CREATED).body(res);
        }
    }

    @PostMapping("/riders/login")
    public ResponseEntity<AuthResponse> loginRider(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse auth = authService.loginRider(request);
        attachAuthCookies(response, auth.getAccessToken(), auth.getRefreshToken());
        return ResponseEntity.ok(auth);
    }

    @PostMapping("/drivers/login")
    public ResponseEntity<AuthResponse> loginDriver(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse auth = authService.loginDriver(request);
        attachAuthCookies(response, auth.getAccessToken(), auth.getRefreshToken());
        return ResponseEntity.ok(auth);
    }

    @PostMapping("/admin/login")
    public ResponseEntity<AdminLoginResponse> loginAdmin(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AdminLoginResponse auth = authService.loginAdmin(request);
        attachAuthCookies(response, auth.getAccessToken(), null);
        return ResponseEntity.ok(auth);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refreshToken(@RequestBody(required = false) RefreshTokenRequest request,
                                                     @CookieValue(name = "rideway_refresh_token", required = false) String cookieRefreshToken,
                                                     HttpServletResponse response) {
        String tokenToUse = null;
        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            tokenToUse = request.getRefreshToken().trim();
        } else if (cookieRefreshToken != null && !cookieRefreshToken.isBlank()) {
            tokenToUse = cookieRefreshToken.trim();
        }

        if (tokenToUse == null || tokenToUse.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        RefreshTokenRequest req = new RefreshTokenRequest(tokenToUse);
        AuthResponse auth = authService.refresh(req);
        attachAuthCookies(response, auth.getAccessToken(), auth.getRefreshToken());
        return ResponseEntity.ok(auth);
    }

    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout(@RequestBody(required = false) RefreshTokenRequest request,
                                                  @CookieValue(name = "rideway_refresh_token", required = false) String cookieRefreshToken,
                                                  HttpServletResponse response) {
        String tokenToRevoke = null;
        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            tokenToRevoke = request.getRefreshToken().trim();
        } else if (cookieRefreshToken != null && !cookieRefreshToken.isBlank()) {
            tokenToRevoke = cookieRefreshToken.trim();
        }

        if (tokenToRevoke != null && !tokenToRevoke.isBlank()) {
            try {
                authService.logout(tokenToRevoke);
            } catch (Exception ignored) {}
        }

        clearAuthCookies(response);
        return ResponseEntity.ok(new MessageResponse("Logged out successfully"));
    }

    @DeleteMapping("/account")
    public ResponseEntity<MessageResponse> deleteAccount(Authentication authentication,
                                                         @RequestBody(required = false) Map<String, String> body,
                                                         HttpServletResponse response) {
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equalsIgnoreCase(authentication.getName())) {
            String identifier = authentication.getName();
            String role = authentication.getAuthorities().stream()
                    .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                    .findFirst()
                    .orElse("ROLE_RIDER")
                    .replace("ROLE_", "");
            String password = (body != null) ? body.get("password") : null;
            authService.deleteAccount(identifier, role, password);
        }

        clearAuthCookies(response);
        return ResponseEntity.ok(new MessageResponse("Account deleted successfully"));
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

    private void clearAuthCookies(HttpServletResponse response) {
        if (response == null) return;

        ResponseCookie tokenCookie = ResponseCookie.from("rideway_access_token", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        ResponseCookie refreshCookie = ResponseCookie.from("rideway_refresh_token", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, tokenCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
    }
}
