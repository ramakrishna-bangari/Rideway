import api from './axios';

export const adminApi = {
  getAnalytics: async () => {
    const response = await api.get('/api/admin/analytics');
    return response.data;
  },

  getRiders: async () => {
    const response = await api.get('/api/admin/riders');
    return response.data;
  },

  getDrivers: async () => {
    const response = await api.get('/api/admin/drivers');
    return response.data;
  },

  getDriversByStatus: async (status) => {
    const response = await api.get(`/api/admin/drivers/status/${status}`);
    return response.data;
  },

  updateDriverVerification: async (driverId, verificationStatus) => {
    const response = await api.patch(`/api/admin/drivers/${driverId}/verification`, {
      verificationStatus,
    });
    return response.data;
  },

  updateRiderStatus: async (riderId, active) => {
    const response = await api.patch(`/api/admin/riders/${riderId}/active?active=${active}`);
    return response.data;
  },

  updateDriverStatus: async (driverId, active) => {
    const response = await api.patch(`/api/admin/drivers/${driverId}/active?active=${active}`);
    return response.data;
  },

  getRides: async () => {
    const response = await api.get('/api/rides/all');
    return response.data;
  },

  getAllDrivers: async () => adminApi.getDrivers(),
  getAllRiders: async () => adminApi.getRiders(),
  getAllRides: async () => adminApi.getRides(),
  decideDriverVerification: async (driverId, status) => adminApi.updateDriverVerification(driverId, status),
  setRiderActive: async (riderId, active) => adminApi.updateRiderStatus(riderId, active),
  setDriverActive: async (driverId, active) => adminApi.updateDriverStatus(driverId, active),
};

export default adminApi;
