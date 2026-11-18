import api from './axios';

export const driverApi = {

  updateAvailability: async (status, vehicleType) => {
    if (!['AVAILABLE', 'OFFLINE'].includes(status)) {
      throw new Error("Availability status must be 'AVAILABLE' or 'OFFLINE'");
    }
    const currentVehicle = vehicleType || (typeof window !== 'undefined' ? localStorage.getItem('rideway_driver_vehicle_type') : null) || 'AUTO';
    const response = await api.put('/api/dispatch/drivers/availability', {
      status,
      vehicleType: currentVehicle,
    });
    return response.data;
  },

  setAvailability: async (status) => driverApi.updateAvailability(status),

  getAvailability: async () => {
    const response = await api.get('/api/dispatch/drivers/availability');
    return response.data;
  },

  sendLocation: async (latitude, longitude) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      return null;
    }
    const payload = {
      latitude: lat,
      longitude: lng,
    };
    const response = await api.put('/api/dispatch/location', payload);
    return response.data;
  },

  getPendingOffer: async () => {
    const response = await api.get('/api/dispatch/offers/pending');
    return response.data;
  },

  acceptOffer: async (offerId, details = null) => {
    const response = await api.post(`/api/dispatch/offers/${offerId}/accept`, details || {});
    return response.data;
  },

  rejectOffer: async (offerId) => {
    const response = await api.post(`/api/dispatch/offers/${offerId}/reject`);
    return response.data;
  },

  declineOffer: async (offerId) => driverApi.rejectOffer(offerId),

  startRide: async (rideId, otp) => {
    const cleanOtp = otp ? String(otp).trim() : '';
    const url = cleanOtp ? `/api/rides/${rideId}/start?otp=${encodeURIComponent(cleanOtp)}` : `/api/rides/${rideId}/start`;
    const response = await api.patch(url, { otp: cleanOtp });
    return response.data;
  },

  completeRide: async (rideId) => {
    const response = await api.patch(`/api/rides/${rideId}/complete`);
    return response.data;
  },

  getHistory: async (driverId) => {
    if (!driverId) return [];
    try {
      const response = await api.get(`/api/rides/driver/${driverId}/history`);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },
};

export default driverApi;
