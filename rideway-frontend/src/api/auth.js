import api, { setAccessToken } from './axios';

export const authApi = {
  login: async (credentials) => {
    const response = await api.post('/api/auth/login', credentials);
    const data = response.data;
    const token = data?.accessToken || data?.token;
    if (token) {
      setAccessToken(token);
    }
    return data;
  },

  loginWithGoogle: async (googleData) => {
    const response = await api.post('/api/auth/google', googleData);
    const data = response.data;
    const token = data?.accessToken || data?.token;
    if (token) {
      setAccessToken(token);
    }
    return data;
  },

  register: async (userData) => {
    const isDriver = userData.role === 'DRIVER';
    const endpoint = isDriver ? '/api/auth/drivers/register' : '/api/auth/riders/register';
    const response = await api.post(endpoint, userData);
    const data = response.data;
    const token = data?.accessToken || data?.token;
    if (token) {
      setAccessToken(token);
    }
    return data;
  },

  requestRegistrationOtp: async (registrationData) => {
    const response = await api.post('/api/auth/otp/registration/request', registrationData);
    return response.data;
  },

  resendRegistrationOtp: async (transactionId) => {
    const response = await api.post('/api/auth/otp/registration/resend', { transactionId });
    return response.data;
  },

  confirmRegistration: async (transactionId, otp) => {
    const response = await api.post('/api/auth/otp/registration/confirm', { transactionId, otp });
    const data = response.data;
    const token = data?.accessToken || data?.token;
    if (token) {
      setAccessToken(token);
    }
    return data;
  },

  requestForgotPasswordOtp: async (phone) => {
    const response = await api.post('/api/auth/otp/forgot-password/request', { phone });
    return response.data;
  },

  verifyForgotPasswordOtp: async (resetToken, otp) => {
    const response = await api.post('/api/auth/otp/forgot-password/verify', { resetToken, otp });
    return response.data;
  },

  confirmForgotPasswordReset: async (resetToken, newPassword) => {
    const response = await api.post('/api/auth/otp/forgot-password/reset', { resetToken, newPassword });
    return response.data;
  },

  requestChangePasswordOtp: async (currentPassword) => {
    const response = await api.post('/api/auth/otp/change-password/request', { currentPassword });
    return response.data;
  },

  confirmChangePassword: async (changeToken, otp, currentPassword, newPassword) => {
    const response = await api.post('/api/auth/otp/change-password/confirm', {
      changeToken,
      otp,
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  requestChangePhoneOtp: async (newPhone, userContext = {}) => {
    const response = await api.post('/api/auth/otp/change-phone/request', {
      newPhone,
      email: userContext.email,
      role: userContext.role,
    });
    return response.data;
  },

  confirmChangePhone: async (changePhoneToken, otp, newPhone, userContext = {}) => {
    const response = await api.post('/api/auth/otp/change-phone/confirm', {
      changePhoneToken,
      otp,
      newPhone,
      email: userContext.email,
      role: userContext.role,
    });
    return response.data;
  },

  uploadProfilePicture: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/auth/profile-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  sendOtp: async (phone) => {
    const response = await api.post('/api/auth/otp/send', { phone });
    return response.data;
  },

  verifyOtp: async (phone, otp) => {
    const response = await api.post('/api/auth/otp/verify', { phone, otp });
    return response.data;
  },

  resetPassword: async (phone, otp, newPassword) => {
    const response = await api.post('/api/auth/otp/reset-password', { phone, otp, newPassword });
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (ignored) {
    } finally {
      setAccessToken(null);
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (err) {

      return null;
    }
  },

  refreshToken: async () => {
    const response = await api.post('/api/auth/refresh');
    const token = response.data?.accessToken;
    if (token) {
      setAccessToken(token);
    }
    return response.data;
  },
};

export default authApi;
