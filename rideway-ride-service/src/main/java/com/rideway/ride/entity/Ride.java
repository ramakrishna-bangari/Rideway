package com.rideway.ride.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "rides")
@Getter
@Setter
@NoArgsConstructor
public class Ride {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID riderId;

    @Column(length = 100)
    private String riderName;

    @Column(length = 30)
    private String riderPhone;

    private UUID driverId;

    @Column(length = 30)
    private String driverPhone;

    @Column(length = 100)
    private String driverName;

    @Column(length = 50)
    private String driverVehicleNumber;

    @Column(columnDefinition = "TEXT")
    private String driverProfilePictureUrl;

    @Column(length = 6)
    private String startOtp;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal pickupLatitude;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal pickupLongitude;

    @Column(nullable = false, length = 250)
    private String pickupAddress;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal destinationLatitude;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal destinationLongitude;

    @Column(nullable = false, length = 250)
    private String destinationAddress;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal distanceKm;

    @Column(length = 30)
    private String vehicleType = "AUTO";

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RideStatus status = RideStatus.REQUESTED;

    @Column(length = 20)
    private String paymentMethod = "CASH";

    @Column(length = 30)
    private String paymentStatus = "PENDING";

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime acceptedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;

    @Version
    private Long version;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (vehicleType == null || vehicleType.isBlank()) {
            vehicleType = "AUTO";
        }
        if (driverPhone == null || driverPhone.isBlank()) {
            driverPhone = null;
        }
    }
}
