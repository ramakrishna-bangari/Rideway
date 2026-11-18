package com.rideway.identity.config;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@NoArgsConstructor
@ConfigurationProperties(prefix = "rideway.jwt")
public class JwtProperties {

    private String secret;
    private long accessTokenMinutes = 15;
    private long refreshTokenDays = 7;
}
