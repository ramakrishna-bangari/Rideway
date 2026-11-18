package com.rideway.identity.security;

import com.rideway.identity.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private final JwtProperties jwtProperties;
    private final SecretKey signingKey;

    public JwtService(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;

        String secret = jwtProperties.getSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT signing key must be configured in application properties");
        }

        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secret);
        } catch (Exception ex) {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }

        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(String subject, String role) {
        return generateAccessToken(subject, role, null);
    }

    public String generateAccessToken(String subject, String role, String userId) {
        long minutes = jwtProperties.getAccessTokenMinutes() > 0 ? jwtProperties.getAccessTokenMinutes() : 15;
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(minutes * 60);

        var builder = Jwts.builder().subject(subject).claim("role", role);

        if (userId != null && !userId.isBlank()) {
            builder.claim("userId", userId);
        }

        return builder.issuedAt(Date.from(now)).expiration(Date.from(expiry)).signWith(signingKey).compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
    }

    public long getAccessTokenLifetimeSeconds() {
        long minutes = jwtProperties.getAccessTokenMinutes() > 0 ? jwtProperties.getAccessTokenMinutes() : 15;
        return minutes * 60;
    }
}
