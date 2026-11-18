package com.rideway.ride.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.rideway.ride.dto.LocationDto;
import com.rideway.ride.dto.RouteResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class RoutingService {

    private final RestClient restClient;
    private final String osrmBaseUrl;

    public RoutingService(@Value("${rideway.routing.osrm-base-url:https://router.project-osrm.org}") String osrmBaseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(1500);
        requestFactory.setReadTimeout(2000);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
        this.osrmBaseUrl = osrmBaseUrl.replaceAll("/+$", "");
    }

    public RouteResult getRoute(LocationDto pickup, LocationDto destination) {
        validateLocation(pickup, "Pickup");
        validateLocation(destination, "Destination");

        List<String> routingEndpoints = List.of(
                osrmBaseUrl + "/route/v1/driving/" + pickup.getLongitude() + "," + pickup.getLatitude() + ";"
                        + destination.getLongitude() + "," + destination.getLatitude() + "?overview=full&geometries=geojson&steps=false",
                "https://routing.openstreetmap.de/routed-car/route/v1/driving/" + pickup.getLongitude() + "," + pickup.getLatitude() + ";"
                        + destination.getLongitude() + "," + destination.getLatitude() + "?overview=full&geometries=geojson&steps=false"
        );

        for (String routeUrl : routingEndpoints) {
            try {
                JsonNode response = restClient.get()
                        .uri(URI.create(routeUrl))
                        .header(HttpHeaders.USER_AGENT, "RideWayApp/1.0 (RideHailingPlatform)")
                        .header(HttpHeaders.ACCEPT_ENCODING, "identity")
                        .accept(MediaType.APPLICATION_JSON)
                        .retrieve()
                        .body(JsonNode.class);

                if (response != null && "Ok".equalsIgnoreCase(response.path("code").asText(""))) {
                    JsonNode routes = response.path("routes");
                    if (routes.isArray() && !routes.isEmpty()) {
                        JsonNode route = routes.get(0);
                        JsonNode coordinates = route.path("geometry").path("coordinates");

                        if (route.path("distance").isNumber() && route.path("duration").isNumber() && coordinates.isArray() && !coordinates.isEmpty()) {
                            BigDecimal distanceKm = BigDecimal.valueOf(route.path("distance").asDouble())
                                    .divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_UP);
                            BigDecimal durationMinutes = BigDecimal.valueOf(route.path("duration").asDouble())
                                    .divide(BigDecimal.valueOf(60), 1, RoundingMode.HALF_UP);

                            List<List<Double>> routeCoordinates = new ArrayList<>();
                            for (JsonNode coordinate : coordinates) {
                                if (coordinate.isArray() && coordinate.size() >= 2) {
                                    double lon = coordinate.get(0).asDouble();
                                    double lat = coordinate.get(1).asDouble();
                                    routeCoordinates.add(List.of(lat, lon));
                                }
                            }

                            return new RouteResult(distanceKm, durationMinutes, routeCoordinates);
                        }
                    }
                }
            } catch (Exception ex) {
                log.trace("Routing endpoint {} failed: {}", routeUrl, ex.getMessage());
            }
        }

        return calculateFallbackRoute(pickup, destination);
    }

    private RouteResult calculateFallbackRoute(LocationDto pickup, LocationDto destination) {
        double lat1 = pickup.getLatitude().doubleValue();
        double lon1 = pickup.getLongitude().doubleValue();
        double lat2 = destination.getLatitude().doubleValue();
        double lon2 = destination.getLongitude().doubleValue();

        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        double straightDistance = 6371.0 * c;

        double roadDistance = Math.max(1.0, straightDistance * 1.28);
        BigDecimal distanceKm = BigDecimal.valueOf(roadDistance).setScale(2, RoundingMode.HALF_UP);

        double estimatedMinutes = Math.max(4.0, (roadDistance * 2.4) + 3.0);
        BigDecimal durationMinutes = BigDecimal.valueOf(estimatedMinutes).setScale(1, RoundingMode.HALF_UP);

        return new RouteResult(distanceKm, durationMinutes, new ArrayList<>());
    }

    private void validateLocation(LocationDto location, String name) {
        if (location == null || location.getLatitude() == null || location.getLongitude() == null) {
            throw new IllegalArgumentException(name + " coordinates are required");
        }
    }
}
