package com.rideway.dispatch_service.controller;

import com.rideway.dispatch_service.messaging.RideEventConsumer;
import com.rideway.dispatch_service.service.RideDispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/dispatch/internal")
@RequiredArgsConstructor
@Slf4j
public class InternalDispatchController {

    private final RideDispatchService rideDispatchService;
    private final RideEventConsumer rideEventConsumer;

    @PostMapping("/ride-requested/{rideId}")
    public ResponseEntity<Void> triggerRideDispatch(@PathVariable UUID rideId) {
        log.info("Direct microservice trigger: dispatching ride {}", rideId);
        try {
            rideDispatchService.dispatchRide(rideId);
        } catch (Exception ex) {
            log.warn("Internal dispatch trigger error: {}", ex.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = {"/ride-boosted/{rideId}", "/rides/{rideId}/redispatch"})
    public ResponseEntity<Void> triggerRideBoosted(@PathVariable UUID rideId) {
        log.info("Direct microservice trigger: ride fare boosted {}", rideId);
        try {
            rideDispatchService.handleFareBoosted(rideId);
        } catch (Exception ex) {
            log.warn("Internal ride-boosted trigger error: {}", ex.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/ride-cancelled/{rideId}")
    public ResponseEntity<Void> triggerRideCancelled(
            @PathVariable UUID rideId,
            @RequestParam(value = "by", required = false) String cancelledBy
    ) {
        log.info("Direct microservice trigger: cancel dispatch for ride {}, by={}", rideId, cancelledBy);
        try {
            rideDispatchService.cancelDispatch(rideId, cancelledBy != null ? cancelledBy : "RIDER");
        } catch (Exception ex) {
            log.warn("Internal cancel trigger error: {}", ex.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/ride-started/{rideId}")
    public ResponseEntity<Void> triggerRideStarted(@PathVariable UUID rideId) {
        log.info("Direct microservice trigger: ride started {}", rideId);
        try {
            rideEventConsumer.handleRideStarted(rideId);
        } catch (Exception ex) {
            log.warn("Internal ride-started trigger error: {}", ex.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/ride-completed/{rideId}")
    public ResponseEntity<Void> triggerRideCompleted(@PathVariable UUID rideId) {
        log.info("Direct microservice trigger: ride completed {}", rideId);
        try {
            rideEventConsumer.handleRideCompleted(rideId);
        } catch (Exception ex) {
            log.warn("Internal ride-completed trigger error: {}", ex.getMessage());
        }
        return ResponseEntity.ok().build();
    }
}
