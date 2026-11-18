
package com.rideway.dispatch_service.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(DispatchProperties.class)
public class DispatchConfig {
}
