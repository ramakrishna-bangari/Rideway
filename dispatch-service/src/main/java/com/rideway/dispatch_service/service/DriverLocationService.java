package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.dto.event.DriverLocationUpdateMessage;
import com.rideway.dispatch_service.entity.DriverAvailability;
import com.rideway.dispatch_service.repository.DriverAvailabilityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DriverLocationService {

    private static final long DATABASE_HEARTBEAT_INTERVAL_SECONDS = 60;

    private final DriverAvailabilityRepository availabilityRepository;
    private final DriverGeoLocationService geoLocationService;
    private final SimpMessagingTemplate messagingTemplate;

    public DriverLocationUpdateMessage validateAndRecordLocation(UUID driverId, BigDecimal latitude, BigDecimal longitude) {
        Instant now = Instant.now();

        try {
            geoLocationService.updateDriverLocation(driverId.toString(), longitude.doubleValue(), latitude.doubleValue());
        } catch (Exception ex) {
            log.warn("Redis GEO update notice for driver {}: {}", driverId, ex.getMessage());
        }

        DriverAvailability availability = availabilityRepository.findByDriverId(driverId).orElse(null);
        if (availability != null) {
            Instant lastLocationAt = availability.getLastLocationAt();
            if (lastLocationAt == null || lastLocationAt.isBefore(now.minusSeconds(DATABASE_HEARTBEAT_INTERVAL_SECONDS))) {
                availability.setLastLocationAt(now);
                availabilityRepository.save(availability);
            }
        }

        UUID rideId = availability != null ? availability.getActiveRideId() : null;
        DriverLocationUpdateMessage message = DriverLocationUpdateMessage.builder()
                .rideId(rideId)
                .driverId(driverId)
                .latitude(latitude.doubleValue())
                .longitude(longitude.doubleValue())
                .recordedAt(now)
                .build();

        if (rideId != null) {
            try {
                messagingTemplate.convertAndSend("/topic/rides/" + rideId + "/driver-location", message);
            } catch (Exception ex) {
                log.trace("Location websocket broadcast: {}", ex.getMessage());
            }
        }

        return message;
    }
}
