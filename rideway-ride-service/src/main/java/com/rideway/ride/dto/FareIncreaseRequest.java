package com.rideway.ride.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FareIncreaseRequest {

    private BigDecimal increaseAmount;
    private BigDecimal amount;

    public BigDecimal getEffectiveIncreaseAmount() {
        if (increaseAmount != null && increaseAmount.compareTo(BigDecimal.ZERO) > 0) {
            return increaseAmount;
        }
        if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
            return amount;
        }
        return BigDecimal.ZERO;
    }
}
