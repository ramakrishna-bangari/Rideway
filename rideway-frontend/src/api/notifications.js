import api from './axios';

export const notificationsApi = {

  getNotifications: async (params = {}) => {
    const response = await api.get('/api/notifications', { params });
    return response.data;
  },

  getUnreadCount: async () => {
    try {
      const response = await api.get('/api/notifications/unread-count');
      return response.data?.unreadCount || 0;
    } catch {
      return 0;
    }
  },

  markAsRead: async (notificationId) => {
    const response = await api.patch(`/api/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.patch('/api/notifications/read-all');
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/api/notifications/${notificationId}`);
    return response.data;
  },

  clearAll: async () => {
    const response = await api.delete('/api/notifications/clear-all');
    return response.data;
  },

  subscribeToPush: async (subscriptionData) => {
    const response = await api.post('/api/notifications/subscribe', subscriptionData);
    return response.data;
  },

  unsubscribeFromPush: async (endpoint) => {
    const response = await api.post('/api/notifications/unsubscribe', { endpoint });
    return response.data;
  },

  getVapidPublicKey: async () => {
    const response = await api.get('/api/notifications/vapid-public-key');
    return response.data?.publicKey;
  },
};

export default notificationsApi;
