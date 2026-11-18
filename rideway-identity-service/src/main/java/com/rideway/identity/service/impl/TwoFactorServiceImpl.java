package com.rideway.identity.service.impl;

import com.rideway.identity.service.TwoFactorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class TwoFactorServiceImpl implements TwoFactorService {

    private final RestTemplate restTemplate;

    @Value("${twofactor.api-key:${app.twofactor.api-key:${TWOFACTOR_API_KEY:}}}")
    private String apiKey;

    @Value("${twofactor.otp-template:${app.twofactor.otp-template:${TWOFACTOR_OTP_TEMPLATE:RIDEWAYOTP}}}")
    private String otpTemplate;

    @Override
    public String sendOtp(String mobileNumber) {
        String phone = formatIndianMobileNumber(mobileNumber);
        String key = getApiKey();
        String tpl = (otpTemplate != null && !otpTemplate.isBlank()) ? otpTemplate.trim() : "RIDEWAYOTP";

        String url = UriComponentsBuilder
                .fromUriString("https://2factor.in/API/V1")
                .pathSegment(key, "SMS", phone, "AUTOGEN", tpl)
                .build()
                .toUriString();

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            String body = response.getBody();
            if (response.getStatusCode().is2xxSuccessful() && body != null) {
                if (body.contains("\"Status\":\"Success\"") || body.contains("\"Status\": \"Success\"")) {
                    log.info("2Factor AUTOGEN OTP dispatched successfully to mobile ending in ...{}",
                            phone.length() >= 4 ? phone.substring(phone.length() - 4) : "****");
                    return body;
                } else if (body.contains("\"Status\":\"Error\"") || body.contains("\"Status\": \"Error\"")) {
                    String details = extractDetails(body);
                    log.warn("2Factor provider error: {}", details);
                    throw new IllegalStateException(details);
                }
            }
            return body;
        } catch (RestClientException ex) {
            log.error("2Factor sendOtp network or gateway error: {}", ex.getMessage());
            throw new IllegalStateException("SMS gateway temporarily unavailable. Please try again shortly.");
        }
    }

    @Override
    public String verifyOtp(String mobileNumber, String otp) {
        if (otp == null || !otp.trim().matches("\\d{4,8}")) {
            throw new IllegalArgumentException("Please enter a valid numeric OTP code.");
        }

        String phone = formatIndianMobileNumber(mobileNumber);
        String key = getApiKey();
        String cleanOtp = otp.trim();

        String url = UriComponentsBuilder
                .fromUriString("https://2factor.in/API/V1")
                .pathSegment(key, "SMS", "VERIFY3", phone, cleanOtp)
                .build()
                .toUriString();

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            String body = response.getBody();
            if (body != null) {
                if (body.contains("\"Status\":\"Success\"") && (body.contains("Matched") || body.contains("matched"))) {
                    log.info("2Factor OTP verified successfully for mobile ending in ...{}",
                            phone.length() >= 4 ? phone.substring(phone.length() - 4) : "****");
                    return body;
                }
                if (body.contains("Mismatch") || body.contains("mismatch")) {
                    throw new IllegalArgumentException("Incorrect OTP. Please check the code sent to your mobile.");
                }
                if (body.contains("Expired") || body.contains("expired")) {
                    throw new IllegalArgumentException("OTP has expired. Please request a new OTP.");
                }
                if (body.contains("\"Status\":\"Error\"")) {
                    throw new IllegalArgumentException(extractDetails(body));
                }
            }
            throw new IllegalArgumentException("OTP verification failed. Please try again.");
        } catch (RestClientException ex) {
            log.error("2Factor verifyOtp network error: {}", ex.getMessage());
            throw new IllegalStateException("SMS gateway temporarily unavailable. Please try again shortly.");
        }
    }

    @Override
    public String formatIndianMobileNumber(String mobileNumber) {
        if (mobileNumber == null || mobileNumber.isBlank()) {
            throw new IllegalArgumentException("Mobile number is required.");
        }

        String digits = mobileNumber.replaceAll("[^0-9]", "");
        if (digits.startsWith("91") && digits.length() == 12) {
            digits = digits.substring(2);
        } else if (digits.startsWith("0") && digits.length() == 11) {
            digits = digits.substring(1);
        }

        if (digits.length() != 10 || !digits.matches("[6-9]\\d{9}")) {
            throw new IllegalArgumentException("Please enter a valid 10-digit Indian mobile number.");
        }

        return "91" + digits;
    }

    private String getApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("2Factor API key is not configured. Please set the TWOFACTOR_API_KEY environment variable.");
        }
        return apiKey.trim();
    }

    private String extractDetails(String json) {
        if (json == null) return "Provider error";
        try {
            Matcher m = Pattern.compile("\"Details\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
            if (m.find()) {
                return m.group(1);
            }
        } catch (Exception ignored) {}
        return "Provider error";
    }
}
