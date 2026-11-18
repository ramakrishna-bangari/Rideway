import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let inMemoryAccessToken = null;

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
  if (token) {
    try { localStorage.setItem('rideway_token', token); } catch {}
  } else {
    try { localStorage.removeItem('rideway_token'); } catch {}
  }
};

export const getAccessToken = () => {
  if (!inMemoryAccessToken && typeof window !== 'undefined') {
    try {
      inMemoryAccessToken = localStorage.getItem('rideway_token');
    } catch {}
  }
  return inMemoryAccessToken;
};

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('rideway_user_id') : null;
    if (storedUserId) {
      config.headers['X-User-Id'] = storedUserId;
      config.headers['X-Driver-Id'] = storedUserId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      const friendlyMessage = (error.code === 'ECONNABORTED' || error.message?.includes('timeout'))
        ? 'Connection timed out. Please check your network and try again.'
        : 'Service temporarily unavailable. Please check your network and try again.';
      error.friendlyMessage = friendlyMessage;
      error.response = {
        status: 503,
        data: {
          message: friendlyMessage,
          error: friendlyMessage,
        },
      };
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      if (
        originalRequest.url?.includes('/api/auth/login') ||
        originalRequest.url?.includes('/api/auth/google') ||
        originalRequest.url?.includes('/api/auth/refresh') ||
        originalRequest.url?.includes('/api/auth/me') ||
        originalRequest.url?.includes('/api/auth/logout') ||
        originalRequest.url?.includes('/api/auth/otp/')
      ) {
        return Promise.reject(error);
      }

      if (!getAccessToken() && (typeof window === 'undefined' || !localStorage.getItem('rideway_user_id'))) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data?.accessToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          processQueue(null, null);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rideway:logout'));
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
