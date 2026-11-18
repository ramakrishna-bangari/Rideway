package com.rideway.ride.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidRideOperationException extends RuntimeException {

    public InvalidRideOperationException(String message) {
        super(message);
    }
}
