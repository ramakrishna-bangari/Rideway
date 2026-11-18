import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createSvgPin = (bgColor, innerText) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        background: ${bgColor};
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 800;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      ">
        ${innerText}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const pickupIcon = createSvgPin('#10b981', 'P');
const destinationIcon = createSvgPin('#09090b', 'D');
const driverIcon = createSvgPin('#3b82f6', '🚖');

const BoundsHandler = ({ pickup, destination, driverLocation, routeCoordinates }) => {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    const points = [];
    if (pickup?.latitude && pickup?.longitude) {
      points.push([Number(pickup.latitude), Number(pickup.longitude)]);
    }
    if (destination?.latitude && destination?.longitude) {
      points.push([Number(destination.latitude), Number(destination.longitude)]);
    }
    if (driverLocation?.latitude && driverLocation?.longitude) {
      const dLat = Number(driverLocation.latitude);
      const dLng = Number(driverLocation.longitude);
      let withinRange = true;
      if (pickup?.latitude && pickup?.longitude) {
        const pLat = Number(pickup.latitude);
        const pLng = Number(pickup.longitude);
        const distApproxKm = Math.hypot((dLat - pLat) * 111, (dLng - pLng) * 111 * Math.cos(pLat * Math.PI / 180));

        if (distApproxKm > 100) withinRange = false;
      }
      if (withinRange) {
        points.push([dLat, dLng]);
      }
    }

    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [map, pickup, destination, driverLocation, routeCoordinates]);

  return null;
};

const ClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        });
      }
    },
  });
  return null;
};

const parseRoutePoints = (coords) => {
  if (!coords || !Array.isArray(coords) || coords.length < 2) {
    return null;
  }
  const parsed = coords
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const a = Number(coord[0]);
      const b = Number(coord[1]);
      if (isNaN(a) || isNaN(b)) return null;

      if (Math.abs(a) > 50 && Math.abs(b) <= 45) {
        return [b, a];
      }
      return [a, b];
    })
    .filter(Boolean);

  if (!parsed || parsed.length < 2) return null;
  return parsed;
};

export const Map = ({
  pickup,
  destination,
  driverLocation,
  routeCoordinates = null,
  routeColor = '#10b981',
  secondaryRouteCoordinates = null,
  secondaryRouteColor = '#10b981',
  secondaryRouteDashed = false,
  onMapClick,
  className = 'h-96 w-full',
  center = [17.9784, 79.5941],
  zoom = 12,
}) => {
  const initialCenter =
    pickup?.latitude && pickup?.longitude
      ? [Number(pickup.latitude), Number(pickup.longitude)]
      : driverLocation?.latitude && driverLocation?.longitude
        ? [Number(driverLocation.latitude), Number(driverLocation.longitude)]
        : center;

  const formattedRoute = useMemo(() => parseRoutePoints(routeCoordinates), [routeCoordinates]);
  const formattedSecondaryRoute = useMemo(() => parseRoutePoints(secondaryRouteCoordinates), [secondaryRouteCoordinates]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {pickup?.latitude && pickup?.longitude && (
          <Marker position={[Number(pickup.latitude), Number(pickup.longitude)]} icon={pickupIcon}>
            <Popup>
              <div className="text-xs space-y-1">
                <span className="font-bold text-emerald-700 uppercase tracking-wider text-[10px]">Pickup Location</span>
                <p className="font-medium text-gray-900">{pickup.address || 'Pickup point'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {destination?.latitude && destination?.longitude && (
          <Marker position={[Number(destination.latitude), Number(destination.longitude)]} icon={destinationIcon}>
            <Popup>
              <div className="text-xs space-y-1">
                <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Destination</span>
                <p className="font-medium text-gray-900">{destination.address || 'Destination point'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {driverLocation?.latitude && driverLocation?.longitude && (
          <Marker position={[Number(driverLocation.latitude), Number(driverLocation.longitude)]} icon={driverIcon}>
            <Popup>
              <div className="text-xs">
                <span className="font-bold text-blue-700">Driver Partner</span>
              </div>
            </Popup>
          </Marker>
        )}

        {formattedSecondaryRoute && formattedSecondaryRoute.length > 1 && (
          <Polyline
            positions={formattedSecondaryRoute}
            pathOptions={{
              color: secondaryRouteColor || '#10b981',
              weight: 4,
              opacity: 0.8,
              dashArray: secondaryRouteDashed ? '8, 8' : undefined,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {formattedRoute && formattedRoute.length > 1 && (
          <Polyline
            positions={formattedRoute}
            pathOptions={{
              color: routeColor || '#10b981',
              weight: 5,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        <BoundsHandler
          pickup={pickup}
          destination={destination}
          driverLocation={driverLocation}
          routeCoordinates={routeCoordinates}
        />
        {onMapClick && <ClickHandler onMapClick={onMapClick} />}
      </MapContainer>
    </div>
  );
};

export default Map;
