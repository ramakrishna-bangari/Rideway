package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.messaging.NotificationEventProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationEventService {

    private final NotificationEventProducer notificationEventProducer;

    public void notifyRideRequested(UUID rideId, UUID riderId) {
        if (riderId == null || rideId == null) return;
        notificationEventProducer.publishNotification(
                "RIDE_REQUESTED",
                rideId,
                List.of(riderId),
                "Ride Requested",
                "Your ride request has been placed. We are searching for nearby drivers."
        );
    }

    public void notifyDriverOfNewOffer(UUID rideId, UUID driverId) {
        notificationEventProducer.publishNotification(
                "NEW_RIDE_OFFER",
                rideId,
                List.of(driverId),
                "New ride request",
                "You have received a new ride request. Open Rideway to view and respond to the offer."
        );
    }

    public void notifyDriverOfferExpired(UUID rideId, UUID driverId) {
        notificationEventProducer.publishNotification(
                "RIDE_OFFER_EXPIRED",
                rideId,
                List.of(driverId),
                "Ride offer expired",
                "The ride offer expired because no response was received in time."
        );
    }

    public void notifyDriverOfferCancelled(UUID rideId, UUID driverId) {
        notificationEventProducer.publishNotification(
                "RIDE_OFFER_CANCELLED",
                rideId,
                List.of(driverId),
                "Ride offer cancelled",
                "This ride offer is no longer available."
        );
    }

    public void notifyDriverAssigned(UUID rideId, UUID riderId, UUID driverId) {
        notifyDriverAssigned(rideId, riderId, driverId, null, null);
    }

    public void notifyDriverAssigned(UUID rideId, UUID riderId, UUID driverId, String driverName, String vehicleInfo) {
        String displayName = (driverName != null && !driverName.isBlank()) ? driverName.trim() : "Your driver partner";
        StringBuilder riderMsg = new StringBuilder();
        riderMsg.append("Your ride has been accepted! Driver ").append(displayName).append(" is on the way.");
        if (vehicleInfo != null && !vehicleInfo.isBlank()) {
            riderMsg.append(" (Vehicle: ").append(vehicleInfo.trim()).append(")");
        }
        riderMsg.append(" Please share your 4-digit PIN when the vehicle arrives.");

        notificationEventProducer.publishNotification(
                "RIDE_ASSIGNED",
                rideId,
                List.of(riderId),
                "Driver Assigned: " + displayName,
                riderMsg.toString()
        );

        notificationEventProducer.publishNotification(
                "RIDE_ASSIGNMENT_CONFIRMED",
                rideId,
                List.of(driverId),
                "Ride Assigned Successfully",
                "You have accepted this trip. Head to pickup location and verify passenger PIN to start."
        );
    }

    public void notifyNoDriverAvailable(UUID rideId, UUID riderId) {
        notificationEventProducer.publishNotification(
                "NO_DRIVER_AVAILABLE",
                rideId,
                List.of(riderId),
                "No drivers available",
                "We could not find an available driver for your ride. Please try again."
        );
    }

    public void notifyRideCancelled(UUID rideId, UUID riderId, UUID driverId) {
        notifyRideCancelled(rideId, riderId, driverId, null);
    }

    public void notifyRideCancelled(UUID rideId, UUID riderId, UUID driverId, String cancelledBy) {
        String riderMsg;
        String driverMsg;
        if ("DRIVER".equalsIgnoreCase(cancelledBy)) {
            riderMsg = "Your driver has cancelled this ride. We are searching for another nearby driver.";
            driverMsg = "You cancelled this ride. Your status has been returned to Online.";
        } else if ("RIDER".equalsIgnoreCase(cancelledBy)) {
            riderMsg = "You cancelled your ride request.";
            driverMsg = "The passenger cancelled this ride request.";
        } else {
            riderMsg = "Your ride has been cancelled.";
            driverMsg = "The assigned ride has been cancelled.";
        }

        notificationEventProducer.publishNotification(
                "RIDE_CANCELLED",
                rideId,
                List.of(riderId),
                "Ride Cancelled",
                riderMsg
        );

        if (driverId != null) {
            notificationEventProducer.publishNotification(
                    "RIDE_CANCELLED",
                    rideId,
                    List.of(driverId),
                    "Ride Cancelled",
                    driverMsg
            );
        }
    }

    public void notifyRideStarted(UUID rideId, UUID riderId) {
        notifyRideStarted(rideId, riderId, null);
    }

    public void notifyRideStarted(UUID rideId, UUID riderId, UUID driverId) {
        notificationEventProducer.publishNotification(
                "RIDE_STARTED",
                rideId,
                List.of(riderId),
                "Your trip has started",
                "Your driver partner has verified your PIN and started the trip. Have a safe journey!"
        );

        if (driverId != null) {
            notificationEventProducer.publishNotification(
                    "RIDE_STARTED",
                    rideId,
                    List.of(driverId),
                    "Trip started",
                    "PIN verified. Trip started successfully! Follow route navigation to passenger dropoff."
            );
        }
    }

    public void notifyRideCompleted(UUID rideId, UUID riderId) {
        notifyRideCompleted(rideId, riderId, null);
    }

    public void notifyRideCompleted(UUID rideId, UUID riderId, UUID driverId) {
        notificationEventProducer.publishNotification(
                "RIDE_COMPLETED",
                rideId,
                List.of(riderId),
                "Trip completed",
                "Your ride has been completed. Thank you for travelling with Rideway."
        );

        if (driverId != null) {
            notificationEventProducer.publishNotification(
                    "RIDE_COMPLETED",
                    rideId,
                    List.of(driverId),
                    "Trip completed",
                    "Trip completed successfully! Fare has been credited to your daily earnings."
            );
        }
    }
}
