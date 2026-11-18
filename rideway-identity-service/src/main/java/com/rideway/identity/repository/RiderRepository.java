package com.rideway.identity.repository;

import com.rideway.identity.entity.Rider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RiderRepository extends JpaRepository<Rider, UUID> {

    Optional<Rider> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    Optional<Rider> findByPhone(String phone);

    boolean existsByPhone(String phone);

}
