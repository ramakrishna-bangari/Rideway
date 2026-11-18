package com.rideway.dispatch_service.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.rideway.dispatch_service.dto.request.AssignDriverRequest;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.dto.response.RideOfferResponse;
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
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class RideServiceClient {

    private final RideServiceFeignClient feignClient;

    @Autowired(required = false)
    private DiscoveryClient discoveryClient;

    @Value("${app.services.ride.base-url:${RIDE_SERVICE_URL:http://ride-service}}")
    private String rideServiceBaseUrl;

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
                List<ServiceInstance> instances = discoveryClient.getInstances("ride-service");
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
                log.debug("DiscoveryClient lookup notice for ride-service: {}", ex.getMessage());
            }
        }

        if (rideServiceBaseUrl != null && !rideServiceBaseUrl.isBlank()) {
            String custom = rideServiceBaseUrl.trim().replaceAll("/+$", "");
            if (!urls.contains(custom)) {
                urls.add(custom);
            }
        }

        return urls;
    }

    public RideDetailsResponse getRideDetails(UUID rideId, String internalServiceToken) {
        if (rideId == null) return null;
        try {
            return feignClient.getRideDetails(rideId, internalServiceToken);
        } catch (Exception feignEx) {
            log.debug("Feign getRideDetails failed ({}), trying direct HTTP fallbacks", feignEx.getMessage());

            List<String> candidates = getCandidateBaseUrls();
            for (String base : candidates) {
                try {
                    String url = base + "/api/rides/internal/" + rideId;
                    HttpRequest req = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .header("X-Internal-Service-Token", internalServiceToken != null ? internalServiceToken : "")
                            .timeout(Duration.ofSeconds(3))
                            .GET()
                            .build();

                    HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() == 200 && resp.body() != null && !resp.body().isBlank()) {
                        log.info("Fetched ride details for ride {} from fallback URL: {}", rideId, base);
                        return objectMapper.readValue(resp.body(), RideDetailsResponse.class);
                    }
                } catch (Exception ex) {
                    log.trace("Candidate URL {} failed for ride {}: {}", base, rideId, ex.getMessage());
                }
            }

            log.error("All direct fallbacks failed to get ride details for ride {}. Feign error: {}", rideId, feignEx.getMessage());
            throw feignEx;
        }
    }

    public List<RideDetailsResponse> getAvailableRides() {
        try {
            return feignClient.getAvailableRides();
        } catch (Exception feignEx) {
            log.debug("Feign getAvailableRides failed ({}), trying direct HTTP fallbacks", feignEx.getMessage());

            List<String> candidates = getCandidateBaseUrls();
            for (String base : candidates) {
                try {
                    String url = base + "/api/rides/available";
                    HttpRequest req = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .timeout(Duration.ofSeconds(3))
                            .GET()
                            .build();

                    HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() == 200 && resp.body() != null && !resp.body().isBlank()) {
                        return objectMapper.readValue(resp.body(), new TypeReference<List<RideDetailsResponse>>() {});
                    }
                } catch (Exception ex) {
                    log.trace("Candidate URL {} failed for available rides: {}", base, ex.getMessage());
                }
            }

            return Collections.emptyList();
        }
    }

    public RideOfferResponse assignDriver(UUID rideId, AssignDriverRequest request, String internalServiceToken) {
        try {
            return feignClient.assignDriver(rideId, request, internalServiceToken);
        } catch (Exception feignEx) {
            log.debug("Feign assignDriver failed ({}), using direct HTTP fallbacks", feignEx.getMessage());

            List<String> candidates = getCandidateBaseUrls();
            for (String base : candidates) {
                try {
                    String url = base + "/api/rides/internal/" + rideId + "/assignment";
                    String body = objectMapper.writeValueAsString(request);
                    HttpRequest req = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .header("Content-Type", "application/json")
                            .header("X-Internal-Service-Token", internalServiceToken != null ? internalServiceToken : "")
                            .timeout(Duration.ofSeconds(4))
                            .POST(HttpRequest.BodyPublishers.ofString(body))
                            .build();

                    HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() >= 200 && resp.statusCode() < 300 && resp.body() != null) {
                        log.info("Assigned driver for ride {} via fallback URL: {}", rideId, base);
                        return objectMapper.readValue(resp.body(), RideOfferResponse.class);
                    }
                } catch (Exception ex) {
                    log.trace("Candidate URL {} failed for assignDriver {}: {}", base, rideId, ex.getMessage());
                }
            }

            log.error("All direct fallbacks failed to assign driver for ride {}. Feign error: {}", rideId, feignEx.getMessage());
            throw feignEx;
        }
    }
}
