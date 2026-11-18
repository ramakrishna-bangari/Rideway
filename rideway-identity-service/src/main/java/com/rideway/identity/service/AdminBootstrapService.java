package com.rideway.identity.service;

import com.rideway.identity.entity.Admin;
import com.rideway.identity.repository.AdminRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminBootstrapService implements ApplicationRunner {

    private final AdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String DEFAULT_ADMIN_NAME = "RideWay Administrator";
    private static final String DEFAULT_ADMIN_EMAIL = "ramakrishnabangari08@gmail.com";
    private static final String DEFAULT_ADMIN_PASSWORD = "12345678";

    @Override
    public void run(ApplicationArguments args) {
        initializeDefaultAdmin();
    }

    @Transactional
    public void initializeDefaultAdmin() {
        if (adminRepository.count() > 0) {
            log.info("Admin account already exists. Skipping bootstrap.");
            return;
        }

        Admin admin = new Admin();
        admin.setFullName(DEFAULT_ADMIN_NAME);
        admin.setEmail(DEFAULT_ADMIN_EMAIL);
        admin.setPassword(passwordEncoder.encode(DEFAULT_ADMIN_PASSWORD));
        admin.setRole("ADMIN");
        admin.setActive(true);

        adminRepository.save(admin);
        log.info("Default admin account created successfully.");
    }
}
