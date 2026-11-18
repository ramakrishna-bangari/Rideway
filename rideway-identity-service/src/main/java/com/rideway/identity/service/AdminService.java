package com.rideway.identity.service;

import com.rideway.identity.dto.response.AccountResponse;
import com.rideway.identity.dto.response.DriverResponse;
import com.rideway.identity.entity.Driver;
import com.rideway.identity.entity.Rider;
import com.rideway.identity.enums.DriverVerificationStatus;
import com.rideway.identity.repository.DriverRepository;
import com.rideway.identity.repository.RiderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AdminService {

    private final RiderRepository riderRepository;
    private final DriverRepository driverRepository;
    private final DriverService driverService;

    public AdminService(RiderRepository riderRepository, DriverRepository driverRepository, DriverService driverService) {
        this.riderRepository = riderRepository;
        this.driverRepository = driverRepository;
        this.driverService = driverService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAnalytics() {
        long totalRiders = riderRepository.count();
        long totalDrivers = driverRepository.count();
        long activeRiders = riderRepository.findAll().stream().filter(Rider::isActive).count();
        long activeDrivers = driverRepository.findAll().stream().filter(Driver::isActive).count();
        long pendingDrivers = driverRepository.findAll().stream().filter(d -> d.getVerificationStatus() == DriverVerificationStatus.PENDING).count();
        long approvedDrivers = driverRepository.findAll().stream().filter(d -> d.getVerificationStatus() == DriverVerificationStatus.APPROVED).count();

        return Map.of(
                "totalRiders", totalRiders,
                "totalDrivers", totalDrivers,
                "activeRiders", activeRiders,
                "activeDrivers", activeDrivers,
                "pendingDrivers", pendingDrivers,
                "approvedDrivers", approvedDrivers
        );
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> getAllRiders() {
        return riderRepository.findAll().stream().map(this::toAccountResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<DriverResponse> getAllDrivers() {
        return driverRepository.findAll().stream().map(this::toDriverResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<DriverResponse> getDriversByStatus(DriverVerificationStatus status) {
        return driverService.findByVerificationStatus(status);
    }

    @Transactional
    public DriverResponse decideDriverVerification(UUID driverId, DriverVerificationStatus status) {
        return driverService.updateVerificationStatus(driverId, status);
    }

    @Transactional
    public void setRiderActive(UUID riderId, boolean active) {
        Rider rider = riderRepository.findById(riderId).orElseThrow(() -> new IllegalArgumentException("Rider not found"));

        rider.setActive(active);
        riderRepository.save(rider);
    }

    @Transactional
    public void setDriverActive(UUID driverId, boolean active) {
        Driver driver = driverRepository.findById(driverId).orElseThrow(() -> new IllegalArgumentException("Driver not found"));

        driver.setActive(active);
        driverRepository.save(driver);
    }

    private AccountResponse toAccountResponse(Rider rider) {
        return new AccountResponse(
                rider.getId(),
                rider.getFullName(),
                rider.getEmail(),
                rider.getPhone(),
                "RIDER",
                rider.getProfilePictureUrl(),
                rider.isActive(),
                rider.getCreatedAt()
        );
    }

    private DriverResponse toDriverResponse(Driver driver) {
        return new DriverResponse(driver.getId(), driver.getFullName(), driver.getEmail(), driver.getPhone(), driver.getLicenseNumber(), driver.getVerificationStatus(), driver.isActive(), driver.getCreatedAt());
    }
}
