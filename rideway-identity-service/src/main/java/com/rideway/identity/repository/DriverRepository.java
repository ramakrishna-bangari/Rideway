package com.rideway.identity.repository;

import com.rideway.identity.entity.Driver;
import com.rideway.identity.enums.DriverVerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DriverRepository extends JpaRepository<Driver, UUID> {

    Optional<Driver> findByEmailIgnoreCase(String email);

    Optional<Driver> findByPhone(String phone);

    Optional<Driver> findByLicenseNumberIgnoreCase(String licenseNumber);

    boolean existsByLicenseNumberIgnoreCase(String licenseNumber);

    List<Driver> findAllByVerificationStatus(DriverVerificationStatus verificationStatus);
}
