package com.rideway.ride.service;

import com.rideway.ride.dto.*;
import com.rideway.ride.entity.Ride;
import com.rideway.ride.entity.RideStatus;
import com.rideway.ride.exception.InvalidRideOperationException;
import com.rideway.ride.exception.RideNotFoundException;
import com.rideway.ride.messaging.RideEventProducer;
import com.rideway.ride.repository.RideRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class RideService {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    private final RideRepository repository;
    private final FareService fareService;
    private final RoutingService routingService;
    private final RideEventProducer rideEventProducer;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.cloud.client.discovery.DiscoveryClient discoveryClient;

    @Value("${app.services.dispatch.base-url:${DISPATCH_SERVICE_URL:http://dispatch-service}}")
    private String dispatchServiceBaseUrl;

    private List<String> getCandidateDispatchUrls() {
        java.util.List<String> urls = new java.util.ArrayList<>();
        if (discoveryClient != null) {
            try {
                java.util.List<org.springframework.cloud.client.ServiceInstance> instances = discoveryClient.getInstances("dispatch-service");
                if (instances != null) {
                    for (org.springframework.cloud.client.ServiceInstance inst : instances) {
                        if (inst.getUri() != null) {
                            String uriStr = inst.getUri().toString().replaceAll("/+$", "");
                            if (!urls.contains(uriStr)) {
                                urls.add(uriStr);
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
        if (dispatchServiceBaseUrl != null && !dispatchServiceBaseUrl.isBlank()) {
            String custom = dispatchServiceBaseUrl.trim().replaceAll("/+$", "");
            if (!urls.contains(custom) && !custom.contains("dispatch-service")) {
                urls.add(custom);
            }
        }
        return urls;
    }

    public RideService(RideRepository repository, FareService fareService, RoutingService routingService, RideEventProducer rideEventProducer) {
        this.repository = repository;
        this.fareService = fareService;
        this.routingService = routingService;
        this.rideEventProducer = rideEventProducer;
    }

    @Transactional
    public RideResponse createRide(CreateRideRequest request) {
        if (request == null || request.getPickupLocation() == null || request.getDestination() == null || request.getRiderId() == null) {
            throw new InvalidRideOperationException("Rider, pickup and destination are required");
        }

        LocationDto pickup = request.getPickupLocation();
        LocationDto destination = request.getDestination();
        String vehicleType = request.getVehicleType() != null && !request.getVehicleType().isBlank()
                ? request.getVehicleType().toUpperCase()
                : "AUTO";

        BigDecimal distanceKm;
        BigDecimal price;
        FareResponse fare = null;

        if (request.getEstimatedDistanceKm() != null && request.getEstimatedDistanceKm().compareTo(BigDecimal.ZERO) > 0) {
            distanceKm = request.getEstimatedDistanceKm();
            price = fareService.calculateVehicleFare(distanceKm, vehicleType);
        } else {
            fare = fareService.calculateFare(pickup, destination, vehicleType);
            distanceKm = fare.getDistanceKm();
            price = fare.getPrice();
        }

        fareService.validateTripDistance(distanceKm, vehicleType);

        Ride ride = new Ride();
        ride.setRiderId(request.getRiderId());
        ride.setRiderName(request.getRiderName() != null && !request.getRiderName().isBlank() ? request.getRiderName() : "Rider");
        ride.setRiderPhone(request.getRiderPhone());
        ride.setPickupLatitude(pickup.getLatitude());
        ride.setPickupLongitude(pickup.getLongitude());
        ride.setPickupAddress(address(pickup));
        ride.setDestinationLatitude(destination.getLatitude());
        ride.setDestinationLongitude(destination.getLongitude());
        ride.setDestinationAddress(address(destination));
        ride.setDistanceKm(distanceKm);
        ride.setVehicleType(vehicleType);

        if (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank()) {
            ride.setPaymentMethod(request.getPaymentMethod().trim().toUpperCase());
        }

        if (request.getBoostAmount() != null && request.getBoostAmount().compareTo(BigDecimal.ZERO) > 0) {
            price = price.add(request.getBoostAmount()).setScale(0, RoundingMode.HALF_UP);
        }
        ride.setPrice(price);
        ride.setStartOtp(null);
        ride.setStatus(RideStatus.REQUESTED);

        Ride saved = repository.save(ride);

        publishAfterCommit(() -> {
            rideEventProducer.publishRideEvent("RIDE_REQUESTED", saved.getId());
            rideEventProducer.publishRideRequestedNotification(saved.getId(), saved.getRiderId());

            CompletableFuture.runAsync(() -> {
                for (String base : getCandidateDispatchUrls()) {
                    try {
                        HttpRequest req = HttpRequest.newBuilder()
                                .uri(URI.create(base + "/api/dispatch/internal/ride-requested/" + saved.getId()))
                                .POST(HttpRequest.BodyPublishers.noBody())
                                .timeout(Duration.ofSeconds(5))
                                .build();
                        HttpResponse<Void> resp = HTTP_CLIENT.send(req, HttpResponse.BodyHandlers.discarding());
                        if (resp.statusCode() == 200) {
                            log.info("Dispatched internal ride-requested trigger to: {}", base);
                            break;
                        }
                    } catch (Exception ex) {
                        log.debug("Dispatch candidate URL {} failed: {}", base, ex.getMessage());
                    }
                }
            });
        });

        RideResponse response = RideResponse.from(saved);
        if (fare != null && fare.getRouteCoordinates() != null) {
            response.setRouteCoordinates(fare.getRouteCoordinates());
            response.setRouteDistanceKm(fare.getDistanceKm());
            response.setRouteDurationMinutes(fare.getDurationMinutes());
        }

        return response;
    }

    @Transactional(readOnly = true)
    public RideResponse getRide(UUID rideId) {
        Ride ride = find(rideId);
        RideResponse response = RideResponse.from(ride);

        try {
            if (ride.getPickupLatitude() != null && ride.getDestinationLatitude() != null) {
                LocationDto pickup = new LocationDto(ride.getPickupLatitude(), ride.getPickupLongitude(), ride.getPickupAddress());
                LocationDto dest = new LocationDto(ride.getDestinationLatitude(), ride.getDestinationLongitude(), ride.getDestinationAddress());
                RouteResult route = routingService.getRoute(pickup, dest);
                applyRoute(response, route);
            }
        } catch (Exception ex) {
            log.trace("Could not compute route for ride {}: {}", rideId, ex.getMessage());
        }

        return response;
    }

    @Transactional(readOnly = true)
    public List<RideResponse> getRiderHistory(UUID riderId) {
        return repository.findByRiderIdOrderByCreatedAtDesc(riderId).stream().map(RideResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<RideResponse> getDriverHistory(UUID driverId) {
        return repository.findByDriverIdOrderByCreatedAtDesc(driverId).stream().map(RideResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<RideResponse> getAvailableRides() {
        return repository.findByStatusOrderByCreatedAtAsc(RideStatus.REQUESTED).stream().map(RideResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<RideResponse> getAllRides() {
        return repository.findAll().stream().map(RideResponse::from).toList();
    }

    @Transactional
    public RideResponse increasePrice(UUID rideId, FareIncreaseRequest request) {
        if (request == null) {
            throw new InvalidRideOperationException("Increase amount is required");
        }

        BigDecimal amount = request.getEffectiveIncreaseAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0 || amount.compareTo(new BigDecimal("500")) > 0) {
            throw new InvalidRideOperationException("Increase must be greater than ₹0 and at most ₹500");
        }

        Ride ride = find(rideId);
        if (ride.getStatus() != RideStatus.REQUESTED) {
            throw new InvalidRideOperationException("Price can only increase while waiting for a driver");
        }

        ride.setPrice(ride.getPrice().add(amount).setScale(0, RoundingMode.HALF_UP));
        Ride saved = repository.save(ride);

        publishAfterCommit(() -> rideEventProducer.publishRideEvent("FARE_UPDATED", saved.getId()));
        return RideResponse.from(saved);
    }

    @Transactional
    public RideResponse assignDriver(UUID rideId, AssignDriverRequest request) {
        if (request == null || request.driverId() == null) {
            throw new InvalidRideOperationException("Driver ID is required");
        }

        Ride ride = repository.findByIdForUpdate(rideId).orElseThrow(() -> new RideNotFoundException("Ride not found: " + rideId));

        if (ride.getStatus() != RideStatus.REQUESTED) {
            if (ride.getStatus() == RideStatus.ACCEPTED && request.driverId().equals(ride.getDriverId())) {
                return RideResponse.from(ride);
            }
            throw new InvalidRideOperationException("Ride is no longer available for assignment");
        }

        if (ride.getDriverId() != null && !request.driverId().equals(ride.getDriverId())) {
            throw new InvalidRideOperationException("A driver has already been assigned to this ride");
        }

        ride.setDriverId(request.driverId());
        if (request.driverPhone() != null && !request.driverPhone().isBlank()) {
            ride.setDriverPhone(request.driverPhone());
        }
        if (request.driverName() != null && !request.driverName().isBlank()) {
            ride.setDriverName(request.driverName());
        }
        if (request.driverVehicleNumber() != null && !request.driverVehicleNumber().isBlank()) {
            ride.setDriverVehicleNumber(request.driverVehicleNumber());
        }
        if (request.driverProfilePictureUrl() != null && !request.driverProfilePictureUrl().isBlank()) {
            ride.setDriverProfilePictureUrl(request.driverProfilePictureUrl());
        }
        if (ride.getStartOtp() == null || ride.getStartOtp().isBlank()) {
            ride.setStartOtp(String.format("%04d", (int)(Math.random() * 9000) + 1000));
        }
        ride.setAcceptedAt(LocalDateTime.now());
        ride.setStatus(RideStatus.ACCEPTED);

        Ride saved = repository.save(ride);
        publishAfterCommit(() -> rideEventProducer.publishRideEvent("RIDE_ACCEPTED", saved.getId()));

        return RideResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public boolean verifyStartOtp(UUID rideId, String otp) {
        Ride ride = find(rideId);
        if (ride.getStatus() != RideStatus.ACCEPTED) {
            return false;
        }
        if (ride.getStartOtp() == null || ride.getStartOtp().isBlank()) {
            return true;
        }
        if (otp == null || otp.isBlank()) {
            return false;
        }
        String cleanProvided = otp.replaceAll("\\s+", "").trim();
        String cleanExpected = ride.getStartOtp().replaceAll("\\s+", "").trim();
        return cleanExpected.equalsIgnoreCase(cleanProvided);
    }

    @Transactional
    public RideResponse startRide(UUID rideId, String otp) {
        Ride ride = find(rideId);

        if (ride.getStatus() == RideStatus.STARTED) {
            return RideResponse.from(ride);
        }

        if (ride.getStatus() != RideStatus.ACCEPTED && ride.getStatus() != RideStatus.REQUESTED) {
            throw new InvalidRideOperationException("Ride is currently in " + ride.getStatus() + " status and cannot be started.");
        }

        if (ride.getStartOtp() != null && !ride.getStartOtp().isBlank()) {
            if (otp == null || otp.isBlank()) {
                throw new InvalidRideOperationException("Start PIN is required. Please ask passenger for the 4-digit PIN.");
            }
            String cleanProvided = otp.replaceAll("\\s+", "").trim();
            String cleanExpected = ride.getStartOtp().replaceAll("\\s+", "").trim();
            if (!cleanExpected.equalsIgnoreCase(cleanProvided)) {
                throw new InvalidRideOperationException("Invalid Start PIN. Please enter the 4-digit code shown on passenger screen.");
            }
        }

        ride.setStartedAt(LocalDateTime.now());
        ride.setStatus(RideStatus.STARTED);
        ride.setStartOtp(null);

        Ride saved = repository.save(ride);
        publishAfterCommit(() -> rideEventProducer.publishRideEvent("RIDE_STARTED", saved.getId()));

        return RideResponse.from(saved);
    }

    @Transactional
    public RideResponse completeRide(UUID rideId) {
        Ride ride = find(rideId);

        if (ride.getStatus() == RideStatus.COMPLETED) {
            return RideResponse.from(ride);
        }

        ride.setCompletedAt(LocalDateTime.now());
        ride.setStatus(RideStatus.COMPLETED);

        Ride saved = repository.save(ride);
        publishAfterCommit(() -> rideEventProducer.publishRideEvent("RIDE_COMPLETED", saved.getId()));

        return RideResponse.from(saved);
    }

    @Transactional
    public RideResponse cancelRide(UUID rideId) {
        Ride ride = repository.findByIdForUpdate(rideId).orElseThrow(() -> new RideNotFoundException("Ride not found: " + rideId));

        if (ride.getStatus() != RideStatus.REQUESTED && ride.getStatus() != RideStatus.ACCEPTED) {
            throw new InvalidRideOperationException("Only requested or accepted rides can be cancelled");
        }

        ride.setCancelledAt(LocalDateTime.now());
        ride.setStatus(RideStatus.CANCELLED);

        Ride saved = repository.save(ride);

        publishAfterCommit(() -> {
            try {
                rideEventProducer.publishRideEvent("RIDE_CANCELLED", saved.getId());
            } catch (Exception e) {
                log.warn("Notice: event delivery failed for RIDE_CANCELLED: {}", e.getMessage());
            }
        });

        return RideResponse.from(saved);
    }

    private void publishAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        action.run();
                    } catch (Exception e) {
                        log.warn("Notice: event publishing failed in afterCommit: {}", e.getMessage());
                    }
                }
            });
        } else {
            try {
                action.run();
            } catch (Exception e) {
                log.warn("Notice: event publishing failed: {}", e.getMessage());
            }
        }
    }

    @Transactional
    public RideResponse updatePaymentStatus(UUID rideId, String paymentStatus, String paymentMethod) {
        Ride ride = find(rideId);
        if (paymentStatus != null && !paymentStatus.isBlank()) {
            ride.setPaymentStatus(paymentStatus.trim().toUpperCase());
        }
        if (paymentMethod != null && !paymentMethod.isBlank()) {
            ride.setPaymentMethod(paymentMethod.trim().toUpperCase());
        }
        Ride saved = repository.save(ride);
        publishAfterCommit(() -> {
            try {
                rideEventProducer.publishRideEvent("PAYMENT_COMPLETED", saved.getId());
            } catch (Exception ignored) {}
        });
        return RideResponse.from(saved);
    }

    private void applyRoute(RideResponse response, RouteResult route) {
        response.setRouteCoordinates(route.getRouteCoordinates());
        response.setRouteDistanceKm(route.getDistanceKm());
        response.setRouteDurationMinutes(route.getDurationMinutes());
    }

    private Ride find(UUID rideId) {
        return repository.findById(rideId).orElseThrow(() -> new RideNotFoundException("Ride not found: " + rideId));
    }

    private String address(LocationDto location) {
        String value = location.getAddress();
        return value == null || value.isBlank() ? "Coordinates: " + location.getLatitude() + ", " + location.getLongitude() : value.trim();
    }

    @Scheduled(fixedDelay = 15000)
    @Transactional
    public void autoExpireStaleRequestedRides() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(3);
        List<Ride> staleRides = repository.findByStatusAndCreatedAtBefore(RideStatus.REQUESTED, cutoff);
        for (Ride ride : staleRides) {
            ride.setStatus(RideStatus.CANCELLED);
            ride.setCancelledAt(LocalDateTime.now());
            repository.save(ride);
            publishAfterCommit(() -> {
                try {
                    rideEventProducer.publishRideEvent("RIDE_CANCELLED", ride.getId());
                } catch (Exception ignored) {}
            });
        }
    }
}
