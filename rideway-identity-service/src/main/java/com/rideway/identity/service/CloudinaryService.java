package com.rideway.identity.service;

import com.rideway.identity.config.CloudinaryProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CloudinaryService {

    private final CloudinaryProperties cloudinaryProperties;
    private final RestTemplate restTemplate = new RestTemplate();

    public String uploadImage(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file");
        }

        if (cloudinaryProperties.getApiKey() != null && !cloudinaryProperties.getApiKey().isBlank()
                && cloudinaryProperties.getApiSecret() != null && !cloudinaryProperties.getApiSecret().isBlank()) {
            try {
                String cloudName = cloudinaryProperties.getCloudName();
                String uploadUrl = "https://api.cloudinary.com/v1_1/" + cloudName + "/image/upload";

                long timestamp = Instant.now().getEpochSecond();
                Map<String, Object> paramsToSign = new TreeMap<>();
                if (cloudinaryProperties.getFolder() != null && !cloudinaryProperties.getFolder().isBlank()) {
                    paramsToSign.put("folder", cloudinaryProperties.getFolder());
                }
                paramsToSign.put("timestamp", timestamp);

                String signature = generateSignature(paramsToSign, cloudinaryProperties.getApiSecret());

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.MULTIPART_FORM_DATA);

                ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                    @Override
                    public String getFilename() {
                        return file.getOriginalFilename() != null ? file.getOriginalFilename() : "avatar.jpg";
                    }
                };

                MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
                body.add("file", fileResource);
                body.add("api_key", cloudinaryProperties.getApiKey());
                body.add("timestamp", String.valueOf(timestamp));
                if (cloudinaryProperties.getFolder() != null && !cloudinaryProperties.getFolder().isBlank()) {
                    body.add("folder", cloudinaryProperties.getFolder());
                }
                body.add("signature", signature);

                HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
                ResponseEntity<Map> response = restTemplate.postForEntity(uploadUrl, requestEntity, Map.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Object secureUrl = response.getBody().get("secure_url");
                    if (secureUrl != null) {
                        log.info("Successfully uploaded profile picture to Cloudinary: {}", secureUrl);
                        return secureUrl.toString();
                    }
                }
            } catch (Exception ex) {
                log.warn("Cloudinary upload notice: {}. Using Base64 fallback.", ex.getMessage());
            }
        }

        String mimeType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
        return "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(file.getBytes());
    }

    public boolean deleteImage(String imageUrlOrPublicId) {
        if (imageUrlOrPublicId == null || imageUrlOrPublicId.isBlank() || imageUrlOrPublicId.startsWith("data:")) {

            return true;
        }

        String publicId = extractPublicId(imageUrlOrPublicId);
        if (publicId == null || publicId.isBlank()) {
            log.debug("No Cloudinary public ID found in URL: {}", imageUrlOrPublicId);
            return true;
        }

        if (cloudinaryProperties.getApiKey() == null || cloudinaryProperties.getApiKey().isBlank()
                || cloudinaryProperties.getApiSecret() == null || cloudinaryProperties.getApiSecret().isBlank()) {
            log.debug("Cloudinary credentials not configured; skipping remote asset removal for: {}", publicId);
            return true;
        }

        try {
            String cloudName = cloudinaryProperties.getCloudName();
            String destroyUrl = "https://api.cloudinary.com/v1_1/" + cloudName + "/image/destroy";

            long timestamp = Instant.now().getEpochSecond();
            Map<String, Object> paramsToSign = new TreeMap<>();
            paramsToSign.put("public_id", publicId);
            paramsToSign.put("timestamp", timestamp);

            String signature = generateSignature(paramsToSign, cloudinaryProperties.getApiSecret());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("public_id", publicId);
            body.add("api_key", cloudinaryProperties.getApiKey());
            body.add("timestamp", String.valueOf(timestamp));
            body.add("signature", signature);

            HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(destroyUrl, requestEntity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String result = String.valueOf(response.getBody().get("result"));
                if ("ok".equalsIgnoreCase(result) || "not found".equalsIgnoreCase(result)) {
                    log.info("Cloudinary successfully deleted image: {} (result={})", publicId, result);
                    return true;
                } else {
                    log.warn("Cloudinary returned non-ok result for {}: {}", publicId, result);
                    return false;
                }
            }
            return false;
        } catch (Exception ex) {
            log.warn("Cloudinary image deletion failed for {}: {}", publicId, ex.getMessage());
            return false;
        }
    }

    public static String extractPublicId(String url) {
        if (url == null || url.isBlank() || url.startsWith("data:")) {
            return null;
        }
        int uploadIdx = url.indexOf("/upload/");
        if (uploadIdx == -1) {

            return url.contains("http") ? null : url;
        }
        String path = url.substring(uploadIdx + "/upload/".length());

        if (path.matches("^v\\d+/.*")) {
            path = path.substring(path.indexOf('/') + 1);
        }

        int lastDot = path.lastIndexOf('.');
        if (lastDot != -1) {
            path = path.substring(0, lastDot);
        }
        return path;
    }

    private String generateSignature(Map<String, Object> params, String apiSecret) {
        String toSign = params.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&")) + apiSecret;

        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(toSign.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new RuntimeException("SHA-1 unavailable", ex);
        }
    }
}
