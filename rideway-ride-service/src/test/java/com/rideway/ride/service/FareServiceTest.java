package com.rideway.ride.service;

import com.rideway.ride.exception.InvalidRideOperationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class FareServiceTest {

    private FareService fareService;

    @BeforeEach
    void setUp() {
        RoutingService routingService = mock(RoutingService.class);
        fareService = new FareService(routingService);
    }

    @ParameterizedTest(name = "Bike at {0} km should equal Rs. {1}")
    @CsvSource({
            "2.0, 20",
            "5.0, 47",
            "8.0, 74",
            "10.0, 92",
            "15.0, 137"
    })
    @DisplayName("Verify Bike Rate Card (Base 20, Included 2km, Rate 9/km)")
    void testBikeFares(double distance, int expectedFare) {
        BigDecimal fare = fareService.calculateVehicleFare(BigDecimal.valueOf(distance), "BIKE");
        assertEquals(BigDecimal.valueOf(expectedFare), fare);
    }

    @ParameterizedTest(name = "Auto at {0} km should equal Rs. {1}")
    @CsvSource({
            "2.0, 30",
            "5.0, 66",
            "8.0, 102",
            "10.0, 126",
            "15.0, 186"
    })
    @DisplayName("Verify Auto Rate Card (Base 25, Included 1.6km, Rate 12/km)")
    void testAutoFares(double distance, int expectedFare) {
        BigDecimal fare = fareService.calculateVehicleFare(BigDecimal.valueOf(distance), "AUTO");
        assertEquals(BigDecimal.valueOf(expectedFare), fare);
    }

    @ParameterizedTest(name = "Cab Mini at {0} km should equal Rs. {1}")
    @CsvSource({
            "2.0, 50",
            "5.0, 92",
            "8.0, 134",
            "10.0, 162",
            "15.0, 232"
    })
    @DisplayName("Verify Cab Mini Rate Card (Base 50, Included 2km, Rate 14/km)")
    void testCabFares(double distance, int expectedFare) {
        BigDecimal fare = fareService.calculateVehicleFare(BigDecimal.valueOf(distance), "CAB");
        assertEquals(BigDecimal.valueOf(expectedFare), fare);
    }

    @Test
    @DisplayName("Verify Bike distance restriction at 30 km")
    void testBikeDistanceRestriction() {
        assertDoesNotThrow(() -> fareService.validateTripDistance(BigDecimal.valueOf(30.0), "BIKE"));
        InvalidRideOperationException ex = assertThrows(InvalidRideOperationException.class,
                () -> fareService.validateTripDistance(BigDecimal.valueOf(30.1), "BIKE"));
        assertEquals("This trip is beyond the current Bike service range.", ex.getMessage());
    }

    @Test
    @DisplayName("Verify Auto distance restriction at 40 km")
    void testAutoDistanceRestriction() {
        assertDoesNotThrow(() -> fareService.validateTripDistance(BigDecimal.valueOf(40.0), "AUTO"));
        InvalidRideOperationException ex = assertThrows(InvalidRideOperationException.class,
                () -> fareService.validateTripDistance(BigDecimal.valueOf(40.1), "AUTO"));
        assertEquals("This trip is beyond the current Auto service range.", ex.getMessage());
    }

    @Test
    @DisplayName("Verify Cab distance restriction at 60 km")
    void testCabDistanceRestriction() {
        assertDoesNotThrow(() -> fareService.validateTripDistance(BigDecimal.valueOf(60.0), "CAB"));
        InvalidRideOperationException ex = assertThrows(InvalidRideOperationException.class,
                () -> fareService.validateTripDistance(BigDecimal.valueOf(60.1), "CAB"));
        assertEquals("This trip is beyond the current Cab service range.", ex.getMessage());
    }

    @Test
    @DisplayName("Invalid distances throw exception")
    void testInvalidDistances() {
        assertThrows(InvalidRideOperationException.class,
                () -> fareService.calculateVehicleFare(BigDecimal.ZERO, "AUTO"));
        assertThrows(InvalidRideOperationException.class,
                () -> fareService.calculateVehicleFare(BigDecimal.valueOf(-5), "AUTO"));
        assertThrows(InvalidRideOperationException.class,
                () -> fareService.calculateVehicleFare(null, "AUTO"));
    }
}
