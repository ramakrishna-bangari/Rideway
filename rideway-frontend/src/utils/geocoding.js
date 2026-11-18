
const cache = new Map();

export async function searchLocations(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim();
  const cacheKey = cleanQuery.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cleanQuery
    )}&countrycodes=in&limit=6&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = data.map((item) => {
          const parts = item.display_name.split(',');
          const mainName = parts[0]?.trim() || cleanQuery;
          const secondary = parts.slice(1, 4).join(',').trim();
          return {
            id: String(item.place_id),
            name: mainName,
            fullAddress: secondary ? `${mainName}, ${secondary}` : item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          };
        });
        cache.set(cacheKey, results);
        return results;
      }
    }
  } catch (err) {
    console.warn('Nominatim search failed, trying fallback geocoder:', err);
  }

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=6`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const json = await res.json();
      const features = json.features || [];
      const results = features.map((f, idx) => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        const name = props.name || cleanQuery;
        const city = props.city || props.county || props.state || '';
        return {
          id: `photon-${idx}-${coords[1]}-${coords[0]}`,
          name,
          fullAddress: city ? `${name}, ${city}` : name,
          latitude: coords[1],
          longitude: coords[0],
        };
      });
      cache.set(cacheKey, results);
      return results;
    }
  } catch (photonErr) {
    console.warn('Photon fallback failed:', photonErr);
  }

  return [];
}

export async function reverseGeocode(latitude, longitude) {
  if (!latitude || !longitude) return '';

  const cacheKey = `rev-${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};
      const place =
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.amenity ||
        addr.commercial ||
        addr.city ||
        addr.town ||
        data.display_name?.split(',')[0];

      const city = addr.city || addr.town || addr.county || addr.state || '';
      const formatted = place && city ? `${place}, ${city}` : data.display_name?.split(',').slice(0, 3).join(',') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      cache.set(cacheKey, formatted);
      return formatted;
    }
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
  }

  return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
}

export function getCurrentGpsPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          resolve({ latitude, longitude, address });
        } catch {
          resolve({
            latitude,
            longitude,
            address: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          });
        }
      },
      (error) => {
        let msg = 'Unable to retrieve location';
        if (error.code === 1) msg = 'Location access was denied. Please allow GPS permissions in your browser.';
        else if (error.code === 2) msg = 'GPS position unavailable. Please check your device location settings.';
        else if (error.code === 3) msg = 'Location request timed out. Please try again.';
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000,
      }
    );
  });
}

export async function getDrivingRouteCoordinates(fromLat, fromLng, toLat, toLng) {
  if (!fromLat || !fromLng || !toLat || !toLng) return null;
  const fLat = Number(fromLat);
  const fLng = Number(fromLng);
  const tLat = Number(toLat);
  const tLng = Number(toLng);

  if (isNaN(fLat) || isNaN(fLng) || isNaN(tLat) || isNaN(tLng)) return null;

  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=full&geometries=geojson`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes[0]?.geometry?.coordinates) {

          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [Number(lat), Number(lng)]);
          if (coords.length >= 2) {
            return coords;
          }
        }
      }
    } catch {

    }
  }

  return null;
}

function distanceToSegmentKm(pLat, pLng, aLat, aLng, bLat, bLng) {
  const meanLat = ((aLat + bLat) / 2) * (Math.PI / 180);
  const kx = Math.cos(meanLat) * 111.32;
  const ky = 110.574;

  const px = (pLng - aLng) * kx;
  const py = (pLat - aLat) * ky;
  const bx = (bLng - aLng) * kx;
  const by = (bLat - aLat) * ky;

  const bMagSq = bx * bx + by * by;
  if (bMagSq === 0) {
    return Math.hypot(px, py);
  }

  const u = Math.max(0, Math.min(1, (px * bx + py * by) / bMagSq));
  const projX = u * bx;
  const projY = u * by;

  return Math.hypot(px - projX, py - projY);
}

export function getMinimumDistanceToPolyline(point, polyline) {
  if (!point?.latitude || !point?.longitude || !Array.isArray(polyline) || polyline.length < 2) {
    return 0;
  }

  let minDistance = Infinity;
  const pLat = Number(point.latitude);
  const pLng = Number(point.longitude);

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    if (a && b && a.length >= 2 && b.length >= 2) {
      const d = distanceToSegmentKm(pLat, pLng, Number(a[0]), Number(a[1]), Number(b[0]), Number(b[1]));
      if (d < minDistance) {
        minDistance = d;
      }
    }
  }

  return minDistance === Infinity ? 0 : minDistance;
}
