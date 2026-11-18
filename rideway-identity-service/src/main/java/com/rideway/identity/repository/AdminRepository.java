
package com.rideway.identity.repository;

import com.rideway.identity.entity.Admin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AdminRepository extends JpaRepository<Admin, UUID> {

    Optional<Admin> findByEmailIgnoreCase(String email);
}
