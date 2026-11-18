package com.rideway.payment.controller;

import com.rideway.payment.dto.*;
import com.rideway.payment.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/order")
    public ResponseEntity<PaymentOrderResponse> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        PaymentOrderResponse response = paymentService.createOnlineOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/verify")
    public ResponseEntity<PaymentResponse> verifyPayment(@Valid @RequestBody VerifyPaymentRequest request) {
        PaymentResponse response = paymentService.verifyPayment(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/cash-collect")
    public ResponseEntity<PaymentResponse> cashCollect(@Valid @RequestBody CashCollectionRequest request) {
        PaymentResponse response = paymentService.collectCashPayment(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ride/{rideId}")
    public ResponseEntity<?> getPaymentByRide(@PathVariable UUID rideId) {
        PaymentResponse response = paymentService.getPaymentByRide(rideId);
        if (response == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "No payment found for ride"));
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/webhook")
    public ResponseEntity<Map<String, String>> handleWebhook(@RequestBody String payload,
                                                             @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        log.info("Received Razorpay Webhook event. Signature present: {}", signature != null);
        paymentService.processWebhook(payload, signature);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
