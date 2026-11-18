package com.rideway.identity.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfigDiagnostic {

    @Bean
    ApplicationRunner checkJwtProperties(JwtProperties properties) {
        return args -> {
            System.out.println("JWT secret null: "
                    + (properties.getSecret() == null));

            System.out.println("JWT secret blank: "
                    + (properties.getSecret() == null
                    || properties.getSecret().isBlank()));

            System.out.println("JWT access minutes: "
                    + properties.getAccessTokenMinutes());
        };
    }
}