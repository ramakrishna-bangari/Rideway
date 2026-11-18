package com.rideway.dispatch_service.dto.response;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationDto {

    private BigDecimal latitude;
    private BigDecimal longitude;
    private String address;
}