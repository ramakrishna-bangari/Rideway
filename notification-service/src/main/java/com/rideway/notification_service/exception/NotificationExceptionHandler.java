
package com.rideway.notification_service.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class NotificationExceptionHandler {

    public record ApiError(
            String message,
            int status,
            Instant timestamp
    ) {
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleBadRequest(
            IllegalArgumentException exception
    ) {
        return buildResponse(
                exception.getMessage(),
                HttpStatus.BAD_REQUEST
        );
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> handleIllegalState(
            IllegalStateException exception
    ) {
        return buildResponse(
                exception.getMessage(),
                HttpStatus.UNAUTHORIZED
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(
            Exception exception
    ) {
        return buildResponse(
                "An unexpected error occurred",
                HttpStatus.INTERNAL_SERVER_ERROR
        );
    }

    private ResponseEntity<ApiError> buildResponse(
            String message,
            HttpStatus status
    ) {
        return ResponseEntity.status(status).body(
                new ApiError(
                        message,
                        status.value(),
                        Instant.now()
                )
        );
    }
}
