import api from './axios';

export const ridesApi = {

  calculateFare: async (pickupLocation, destination) => {
    const response = await api.post('/api/fares', {
      pickupLocation,
      destination,
    });
    return response.data;
  },

  createRide: async (rideData) => {
    const response = await api.post('/api/rides', rideData);
    return response.data;
  },

  getRide: async (rideId) => {
    const response = await api.get(`/api/rides/${rideId}`);
    return response.data;
  },

  getRideById: async (rideId) => ridesApi.getRide(rideId),

  getRiderHistory: async (riderId) => {
    if (!riderId) return [];
    try {
      const response = await api.get(`/api/rides/rider/${riderId}/history`);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },

  getDriverHistory: async (driverId) => {
    if (!driverId) return [];
    try {
      const response = await api.get(`/api/rides/driver/${driverId}/history`);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },

  startRide: async (rideId, pin) => {
    const cleanPin = pin ? String(pin).trim() : '';
    const url = cleanPin ? `/api/rides/${rideId}/start?otp=${encodeURIComponent(cleanPin)}` : `/api/rides/${rideId}/start`;
    const response = await api.patch(url, { otp: cleanPin });
    return response.data;
  },

  completeRide: async (rideId) => {
    const response = await api.patch(`/api/rides/${rideId}/complete`, {});
    return response.data;
  },

  cancelRide: async (rideId) => {
    const response = await api.patch(`/api/rides/${rideId}/cancel`);
    return response.data;
  },

  getAvailableRides: async () => {
    const response = await api.get('/api/rides/available');
    return response.data;
  },
};

export default ridesApi;
