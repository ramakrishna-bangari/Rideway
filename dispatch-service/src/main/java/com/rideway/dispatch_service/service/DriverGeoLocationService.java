package com.rideway.dispatch_service.service;

import com.rideway.dispatch_service.config.DispatchProperties;
import org.springframework.data.geo.Circle;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResult;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands;
import org.springframework.data.redis.core.GeoOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class DriverGeoLocationService {

    private final StringRedisTemplate redisTemplate;
    private final DispatchProperties dispatchProperties;

    public DriverGeoLocationService(StringRedisTemplate redisTemplate, DispatchProperties dispatchProperties) {
        this.redisTemplate = redisTemplate;
        this.dispatchProperties = dispatchProperties;
    }

    public void updateDriverLocation(String driverId, double longitude, double latitude) {
        validateCoordinates(latitude, longitude);
        GeoOperations<String, String> geoOperations = redisTemplate.opsForGeo();
        geoOperations.add(dispatchProperties.getLocationKey(), new Point(longitude, latitude), driverId);
    }

    public Point getDriverLocation(String driverId) {
        try {
            List<Point> positions = redisTemplate.opsForGeo().position(dispatchProperties.getLocationKey(), driverId);
            if (positions != null && !positions.isEmpty() && positions.get(0) != null) {
                return positions.get(0);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    public void removeDriverLocation(String driverId) {
        redisTemplate.opsForZSet().remove(dispatchProperties.getLocationKey(), driverId);
    }

    public List<NearbyDriverLocation> findNearbyDrivers(double latitude, double longitude, double radiusKm) {
        validateCoordinates(latitude, longitude);

        if (radiusKm <= 0) {
            throw new IllegalArgumentException("Search radius must be greater than zero");
        }

        Circle searchArea = new Circle(new Point(longitude, latitude), new Distance(radiusKm, Metrics.KILOMETERS));
        RedisGeoCommands.GeoRadiusCommandArgs args = RedisGeoCommands.GeoRadiusCommandArgs
                .newGeoRadiusArgs()
                .includeDistance()
                .sortAscending();

        GeoResults<RedisGeoCommands.GeoLocation<String>> results = redisTemplate.opsForGeo()
                .radius(dispatchProperties.getLocationKey(), searchArea, args);

        List<NearbyDriverLocation> nearbyDrivers = new ArrayList<>();
        if (results != null) {
            for (GeoResult<RedisGeoCommands.GeoLocation<String>> result : results) {
                String driverId = result.getContent().getName();
                double distanceKm = result.getDistance().getValue();
                nearbyDrivers.add(new NearbyDriverLocation(driverId, distanceKm));
            }
        }

        nearbyDrivers.sort(Comparator.comparingDouble(NearbyDriverLocation::distanceKm));
        return nearbyDrivers;
    }

    private void validateCoordinates(double latitude, double longitude) {
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new IllegalArgumentException("Invalid latitude");
        }

        if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Invalid longitude");
        }
    }

    public record NearbyDriverLocation(String driverId, double distanceKm) {
    }
}
