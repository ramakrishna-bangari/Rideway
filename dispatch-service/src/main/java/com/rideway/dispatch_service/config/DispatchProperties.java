
package com.rideway.dispatch_service.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.dispatch")
public class DispatchProperties {

    private double searchRadiusKm = 5.0;

    private long offerTimeoutSeconds = 30;

    private int maxOffersPerRide = 5;

    private long timeoutScanMs = 5000;

    private long locationFreshnessSeconds = 45;

    private String locationKey =
            "rideway:dispatch:drivers:locations";
}
