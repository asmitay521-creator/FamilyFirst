import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@store/auth.store';

const envUrl = import.meta.env.VITE_API_URL;
const BASE_URL = (envUrl && envUrl.trim() !== '' && envUrl !== '/api/v1')
  ? envUrl
  : 'https://insumitrafinal-20072026.onrender.com/api/v1';

export const api = axios.create({ baseURL: BASE_URL });

// ── Request: attach bearer token ──────────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: auto-refresh on 401 ────────────────────────────────────────────
let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

function flushQueue(token: string) {
  queue.forEach(resolve => resolve(token));
  queue = [];
}

api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    // ── Handle Backend Offline / Connection Refused ───────────────────────
    if (!error.response) {
      const isGet = error.config?.method?.toLowerCase() === 'get';
      if (isGet) {
        return Promise.resolve({
          data: {
            data: [],
            meta: { total: 0, page: 1, limit: 10 },
            success: false,
            message: 'Backend server is offline',
          },
          status: 200,
          statusText: 'OK (Offline Fallback)',
          headers: {},
          config: error.config!,
        });
      }
      return Promise.reject(error);
    }

    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const reqUrl = original?.url || '';
    const isAuthRoute = reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register') || reqUrl.includes('/auth/refresh');
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';

    if (error.response?.status !== 401 || original._retry || isAuthRoute || isLoginPage) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise(resolve => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      if (!isLoginPage && typeof window !== 'undefined') {
        logout();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const newAccess = data?.data?.accessToken;
      if (newAccess) {
        setTokens(newAccess, data?.data?.refreshToken ?? refreshToken);
        flushQueue(newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      }
      throw new Error('No access token returned');
    } catch {
      logout();
      if (!isLoginPage && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
