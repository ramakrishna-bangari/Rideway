package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.entity.DispatchAttempt;
import com.rideway.dispatch_service.enums.DispatchAttemptOutcome;
import com.rideway.dispatch_service.repository.DispatchAttemptRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DispatchAttemptService {

    private final DispatchAttemptRepository attemptRepository;

    @Transactional
    public DispatchAttempt recordAttempt(UUID rideId, UUID driverId, int attemptNumber, DispatchAttemptOutcome outcome, String remarks) {

        DispatchAttempt attempt = DispatchAttempt.builder().rideId(rideId).driverId(driverId).attemptNumber(attemptNumber).outcome(outcome).remarks(remarks).build();

        return attemptRepository.save(attempt);
    }

    @Transactional(readOnly = true)
    public List<DispatchAttempt> getRideAttempts(UUID rideId) {

        return attemptRepository.findByRideIdOrderByAttemptNumberAsc(rideId);
    }


    @Transactional(readOnly = true)
    public Set<UUID> getPreviouslyOfferedDrivers(UUID rideId) {

        return attemptRepository.findDriverIdsByRideIdAndOutcomes(rideId, List.of(DispatchAttemptOutcome.OFFERED, DispatchAttemptOutcome.REJECTED, DispatchAttemptOutcome.EXPIRED, DispatchAttemptOutcome.ACCEPTED));
    }


    @Transactional(readOnly = true)
    public int getNextAttemptNumber(UUID rideId) {

        return attemptRepository.findMaxAttemptNumberByRideId(rideId) + 1;
    }

    @Transactional(readOnly = true)
    public int getTotalOffersSent(UUID rideId) {

        return attemptRepository.countByRideIdAndOutcome(rideId, DispatchAttemptOutcome.OFFERED);
    }
}