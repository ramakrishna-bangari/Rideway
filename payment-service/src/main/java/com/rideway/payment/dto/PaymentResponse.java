package com.rideway.payment.dto;

import com.rideway.payment.entity.Payment;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class PaymentResponse {

    private UUID id;
    private UUID rideId;
    private UUID riderId;
    private UUID driverId;
    private BigDecimal amount;
    private String currency;
    private String paymentMethod;
    private String paymentStatus;
    private String razorpayOrderId;
    private String razorpayPaymentId;
    private Instant createdAt;
    private Instant updatedAt;

    public static PaymentResponse from(Payment payment) {
        PaymentResponse response = new PaymentResponse();
        response.setId(payment.getId());
        response.setRideId(payment.getRideId());
        response.setRiderId(payment.getRiderId());
        response.setDriverId(payment.getDriverId());
        response.setAmount(payment.getAmount());
        response.setCurrency(payment.getCurrency());
        response.setPaymentMethod(payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : null);
        response.setPaymentStatus(payment.getPaymentStatus() != null ? payment.getPaymentStatus().name() : null);
        response.setRazorpayOrderId(payment.getRazorpayOrderId());
        response.setRazorpayPaymentId(payment.getRazorpayPaymentId());
        response.setCreatedAt(payment.getCreatedAt());
        response.setUpdatedAt(payment.getUpdatedAt());
        return response;
    }
}
