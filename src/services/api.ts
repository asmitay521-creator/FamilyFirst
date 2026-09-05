import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@store/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

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
    if (error.response?.status !== 401 || original._retry) {
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

    isRefreshing = true;
    const { refreshToken, setTokens, logout } = useAuthStore.getState();

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const newAccess = data.data.accessToken;
      setTokens(newAccess, data.data.refreshToken ?? refreshToken!);
      flushQueue(newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch {
      logout();
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
