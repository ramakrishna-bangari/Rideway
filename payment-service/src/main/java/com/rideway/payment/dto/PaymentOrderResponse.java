package com.rideway.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PaymentOrderResponse {

    private String orderId;
    private BigDecimal amount;
    private String currency;
    private String keyId;
    private UUID rideId;
    private String status;
}
