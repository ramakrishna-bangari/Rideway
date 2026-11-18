package com.rideway.dispatch_service.client;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.rideway.dispatch_service.dto.response.IdentityDriverResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class IdentityServiceClient {

    private final IdentityServiceFeignClient feignClient;

    @Autowired(required = false)
    private DiscoveryClient discoveryClient;

    @Value("${app.services.identity.base-url:${IDENTITY_SERVICE_URL:http://identity-service}}")
    private String identityServiceBaseUrl;

    @Value("${app.services.identity.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalServiceToken;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .build();

    private List<String> getCandidateBaseUrls() {
        List<String> urls = new ArrayList<>();

        if (discoveryClient != null) {
            try {
                List<ServiceInstance> instances = discoveryClient.getInstances("identity-service");
                if (instances != null) {
                    for (ServiceInstance inst : instances) {
                        if (inst.getUri() != null) {
                            String uriStr = inst.getUri().toString().replaceAll("/+$", "");
                            if (!urls.contains(uriStr)) {
                                urls.add(uriStr);
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.debug("DiscoveryClient lookup notice for identity-service: {}", ex.getMessage());
            }
        }

        if (identityServiceBaseUrl != null && !identityServiceBaseUrl.isBlank()) {
            String custom = identityServiceBaseUrl.trim().replaceAll("/+$", "");
            if (!urls.contains(custom)) {
                urls.add(custom);
            }
        }

        return urls;
    }

    public IdentityDriverResponse getDriverDetails(UUID driverId) {
        if (driverId == null) return null;
        try {
            return feignClient.getDriverDetails(driverId, internalServiceToken);
        } catch (Exception feignEx) {
            log.debug("Feign getDriverDetails failed ({}), trying direct HTTP fallbacks", feignEx.getMessage());

            List<String> candidates = getCandidateBaseUrls();
            for (String base : candidates) {
                try {
                    String url = base + "/api/identity/internal/drivers/" + driverId;
                    HttpRequest req = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .header("X-Internal-Service-Token", internalServiceToken != null ? internalServiceToken : "")
                            .timeout(Duration.ofSeconds(3))
                            .GET()
                            .build();

                    HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() == 200 && resp.body() != null && !resp.body().isBlank()) {
                        return objectMapper.readValue(resp.body(), IdentityDriverResponse.class);
                    }
                } catch (Exception ex) {
                    log.trace("Candidate URL {} failed for driver {}: {}", base, driverId, ex.getMessage());
                }
            }
            return null;
        }
    }

    public boolean isDriverEligible(UUID driverId) {
        try {
            IdentityDriverResponse driver = getDriverDetails(driverId);
            if (driver == null) {
                return true;
            }
            if (!driver.active()) {
                return false;
            }
            String status = driver.verificationStatus();
            return status == null
                    || "APPROVED".equalsIgnoreCase(status)
                    || "VERIFIED".equalsIgnoreCase(status)
                    || "PENDING".equalsIgnoreCase(status);
        } catch (Exception exception) {
            return true;
        }
    }
}
