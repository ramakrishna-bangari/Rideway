package com.rideway.dispatch_service.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.rideway.dispatch_service.client.RideServiceClient;
import com.rideway.dispatch_service.dto.event.RideDomainEvent;
import com.rideway.dispatch_service.dto.response.RideDetailsResponse;
import com.rideway.dispatch_service.service.NotificationEventService;
import com.rideway.dispatch_service.service.RideDispatchService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class RideEventConsumer {

    private final RideDispatchService rideDispatchService;
    private final NotificationEventService notificationEventService;
    private final RideServiceClient rideServiceClient;
    private final com.rideway.dispatch_service.service.DriverAvailabilityService driverAvailabilityService;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Value("${app.services.ride.internal-service-token:${INTERNAL_SERVICE_TOKEN:}}")
    private String internalServiceToken;

    @KafkaListener(
            topics = "${app.kafka.topics.ride-events}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consume(Object rawEvent) {

        if (rawEvent == null) {
            log.error("Received null ride event");
            return;
        }

        RideDomainEvent event;
        if (rawEvent instanceof RideDomainEvent rde) {
            event = rde;
        } else {
            try {
                String msg = rawEvent.toString();
                if (msg.startsWith("\"") && msg.endsWith("\"")) {
                    try {
                        msg = objectMapper.readValue(msg, String.class);
                    } catch (Exception ignored) {}
                }
                event = objectMapper.readValue(msg, RideDomainEvent.class);
            } catch (Exception ex) {
                log.error("Failed to parse ride event from raw message: {}", rawEvent, ex);
                return;
            }
        }

        if (event == null || event.getRideId() == null) {
            log.error("Received invalid ride event");
            return;
        }

        log.info(
                "Received ride event: eventType={}, rideId={}",
                event.getEventType(),
                event.getRideId()
        );

        switch (event.getEventType()) {

            case "RIDE_REQUESTED" ->
                    rideDispatchService.dispatchRide(event.getRideId());

            case "FARE_UPDATED" ->
                    rideDispatchService.handleFareBoosted(event.getRideId());

            case "RIDE_CANCELLED" ->
                    rideDispatchService.cancelDispatch(event.getRideId());

            case "RIDE_STARTED" ->
                    handleRideStarted(event.getRideId());

            case "RIDE_COMPLETED" ->
                    handleRideCompleted(event.getRideId());

            default ->
                    log.info(
                            "No dispatch action required for eventType={}",
                            event.getEventType()
                    );
        }
    }

    public void handleRideStarted(UUID rideId) {
        try {
            RideDetailsResponse ride = rideServiceClient.getRideDetails(rideId, internalServiceToken);
            if (ride != null && ride.riderId() != null) {
                notificationEventService.notifyRideStarted(ride.rideId(), ride.riderId(), ride.driverId());
            }
        } catch (Exception ex) {
            log.warn("Could not dispatch RIDE_STARTED notification: {}", ex.getMessage());
        }
    }

    public void handleRideCompleted(UUID rideId) {
        try {
            RideDetailsResponse ride = rideServiceClient.getRideDetails(rideId, internalServiceToken);
            if (ride != null && ride.driverId() != null) {
                driverAvailabilityService.completeDriverRide(ride.driverId(), ride.rideId());
            } else {
                driverAvailabilityService.completeRideByRideId(rideId);
            }
            if (ride != null && ride.riderId() != null) {
                notificationEventService.notifyRideCompleted(ride.rideId(), ride.riderId(), ride.driverId());
            }
        } catch (Exception ex) {
            log.warn("Could not dispatch RIDE_COMPLETED or release driver: {}", ex.getMessage());
        }
    }
}
