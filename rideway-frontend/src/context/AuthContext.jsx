import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import { setAccessToken, getAccessToken } from '../api/axios';
import { registerPushNotifications, unregisterPushNotifications } from '../utils/pushNotifications';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    const cachedUserId = typeof window !== 'undefined' ? localStorage.getItem('rideway_user_id') : null;
    const cachedToken = typeof window !== 'undefined' ? localStorage.getItem('rideway_token') : null;

    if (!cachedUserId && !cachedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      let currentUser = await authApi.getCurrentUser();

      if (!currentUser || currentUser.authenticated === false || !currentUser.id) {
        try {
          const refreshRes = await authApi.refreshToken();
          if (refreshRes?.accessToken) {
            currentUser = await authApi.getCurrentUser();
          }
        } catch {

        }
      }

      if (currentUser && currentUser.authenticated !== false && (currentUser.id || currentUser.email)) {
        const userId = currentUser.id || currentUser.accountId || currentUser.userId;
        if (userId) {
          localStorage.setItem('rideway_user_id', userId);
        }
        const resolvedPhone = currentUser.phone || localStorage.getItem('rideway_user_phone') || '';
        if (resolvedPhone) {
          localStorage.setItem('rideway_user_phone', resolvedPhone);
        }
        const resolvedRole = (currentUser.role || localStorage.getItem('rideway_user_role') || 'RIDER').toUpperCase();
        localStorage.setItem('rideway_user_role', resolvedRole);
        const resolvedVehicleType = currentUser.vehicleType || localStorage.getItem('rideway_driver_vehicle_type') || 'AUTO';
        const resolvedVehicleNumber = currentUser.vehicleNumber || localStorage.getItem('rideway_driver_vehicle_number') || '';
        setUser({
          id: userId,
          fullName: currentUser.fullName || currentUser.name,
          email: currentUser.email,
          phone: resolvedPhone,
          role: resolvedRole,
          profilePictureUrl: currentUser.profilePictureUrl || '',
          licenseNumber: currentUser.licenseNumber || '',
          vehicleType: resolvedVehicleType,
          vehicleNumber: resolvedVehicleNumber,
        });
        registerPushNotifications().catch(() => { });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    const handleSessionExpired = () => {
      setAccessToken(null);
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { }
      setUser(null);
      setLoading(false);
    };

    window.addEventListener('rideway:logout', handleSessionExpired);
    return () => window.removeEventListener('rideway:logout', handleSessionExpired);
  }, [restoreSession]);

  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await authApi.login(credentials);
      const uid = response.accountId || response.id || response.userId;
      if (uid) localStorage.setItem('rideway_user_id', uid);
      const userPhone = response.phone || localStorage.getItem('rideway_user_phone') || '';
      if (userPhone) localStorage.setItem('rideway_user_phone', userPhone);
      const resolvedRole = (response.role || 'RIDER').toUpperCase();
      localStorage.setItem('rideway_user_role', resolvedRole);
      const resolvedVehicleType = response.vehicleType || localStorage.getItem('rideway_driver_vehicle_type') || 'AUTO';
      const resolvedVehicleNumber = response.vehicleNumber || localStorage.getItem('rideway_driver_vehicle_number') || '';
      if (response.vehicleType) {
        localStorage.setItem('rideway_driver_vehicle_type', response.vehicleType);
      }
      if (response.vehicleNumber) {
        localStorage.setItem('rideway_driver_vehicle_number', response.vehicleNumber);
      }
      const userData = {
        id: uid,
        fullName: response.fullName || response.name,
        email: response.email,
        phone: userPhone,
        role: resolvedRole,
        profilePictureUrl: response.profilePictureUrl || '',
        licenseNumber: response.licenseNumber || '',
        vehicleType: resolvedVehicleType,
        vehicleNumber: resolvedVehicleNumber,
      };
      setUser(userData);
      registerPushNotifications().catch(() => { });
      return response;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (googlePayload) => {
    setLoading(true);
    try {
      const response = await authApi.loginWithGoogle(googlePayload);
      const uid = response.accountId || response.id || response.userId;
      if (uid) localStorage.setItem('rideway_user_id', uid);
      const userData = {
        id: uid,
        fullName: response.fullName || response.name,
        email: response.email,
        phone: response.phone || '',
        role: (response.role || googlePayload.role || 'RIDER').toUpperCase(),
        profilePictureUrl: response.profilePictureUrl || googlePayload.picture || '',
        licenseNumber: response.licenseNumber || '',
      };
      setUser(userData);
      registerPushNotifications().catch(() => { });
      return response;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const response = await authApi.register(userData);
      const uid = response.accountId || response.id || response.userId;
      if (uid) localStorage.setItem('rideway_user_id', uid);
      const userPhone = response.phone || userData.phone || localStorage.getItem('rideway_user_phone') || '';
      if (userPhone) localStorage.setItem('rideway_user_phone', userPhone);
      const registeredUser = {
        id: uid,
        fullName: response.fullName || userData.fullName,
        email: response.email || userData.email,
        phone: userPhone,
        role: (response.role || userData.role || 'RIDER').toUpperCase(),
        profilePictureUrl: response.profilePictureUrl || userData.profilePictureUrl || '',
        licenseNumber: userData.licenseNumber || '',
        vehicleType: userData.vehicleType || response.vehicleType || 'AUTO',
        vehicleNumber: userData.vehicleNumber || response.vehicleNumber || '',
      };
      setUser(registeredUser);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await unregisterPushNotifications().catch(() => { });
      await authApi.logout();
    } catch (e) {
      console.warn('Backend logout request failed or network unavailable:', e);
    } finally {

      setAccessToken(null);

      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { }

      if (typeof document !== 'undefined') {
        document.cookie = 'rideway_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';
        document.cookie = 'rideway_refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';
      }

      setUser(null);
      setLoading(false);
    }
  };

  const updateUser = useCallback(async (partialData) => {
    setUser((prev) => {
      if (!prev) return null;
      if (partialData?.phone) {
        localStorage.setItem('rideway_user_phone', partialData.phone);
      }
      if (partialData?.vehicleType) {
        localStorage.setItem('rideway_driver_vehicle_type', String(partialData.vehicleType).toUpperCase());
      }
      if (partialData?.vehicleNumber) {
        localStorage.setItem('rideway_driver_vehicle_number', String(partialData.vehicleNumber).trim());
      }
      return { ...prev, ...partialData };
    });
  }, []);

  const isAuthenticated = !!user;
  const role = user?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        setUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
