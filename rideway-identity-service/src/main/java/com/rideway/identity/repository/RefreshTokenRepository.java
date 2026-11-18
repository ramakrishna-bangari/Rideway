package com.rideway.identity.repository;

import com.rideway.identity.entity.Driver;
import com.rideway.identity.entity.RefreshToken;
import com.rideway.identity.entity.Rider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    void deleteByRider(Rider rider);

    void deleteByDriver(Driver driver);
}
