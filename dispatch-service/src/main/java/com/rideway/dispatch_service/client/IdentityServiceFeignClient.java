package com.rideway.dispatch_service.client;

import com.rideway.dispatch_service.dto.response.IdentityDriverResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.UUID;

@FeignClient(name = "identity-service", url = "${app.services.identity.base-url:}")
public interface IdentityServiceFeignClient {

    @GetMapping("/api/identity/internal/drivers/{driverId}")
    IdentityDriverResponse getDriverDetails(
            @PathVariable("driverId") UUID driverId,
            @RequestHeader("X-Internal-Service-Token") String internalServiceToken
    );
}
