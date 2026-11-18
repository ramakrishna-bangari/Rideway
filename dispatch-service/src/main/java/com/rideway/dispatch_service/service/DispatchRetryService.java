package com.rideway.dispatch_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DispatchRetryService {

    private final RideDispatchService rideDispatchService;

    public void retryDispatch(UUID rideId) {

        if (rideId == null) {
            return;
        }

        log.info("Retrying driver matching for ride {}", rideId);

        rideDispatchService.dispatchRide(rideId);
    }
}
