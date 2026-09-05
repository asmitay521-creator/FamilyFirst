import axios, { InternalAxiosRequestConfig } from 'axios';
import { useClientStore } from '@store/client.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// Separate axios instance for client portal — uses client JWT from client.store
export const clientApi = axios.create({ baseURL: BASE_URL });

clientApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useClientStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

clientApi.interceptors.response.use(
  res => res,
  (error) => {
    if (error.response?.status === 401) {
      useClientStore.getState().logout();
      window.location.href = '/client/login';
    }
    return Promise.reject(error);
  },
);

export const clientService = {
  // Auth (reuse main /auth/login endpoint)
  login: (email: string, password: string) =>
    axios.post(`${BASE_URL}/auth/login`, { email, password }).then(r => r.data),

  // Profile
  getMe:         () => clientApi.get('/client/me').then(r => r.data),
  updateProfile: (body: { phone?: string; email?: string; notes?: string }) =>
    clientApi.patch('/client/me', body).then(r => r.data),

  // Policies
  getPolicies:      () => clientApi.get('/client/policies').then(r => r.data),
  getPolicyDetail:  (id: string) => clientApi.get(`/client/policies/${id}`).then(r => r.data),

  // Claims
  getClaims: () => clientApi.get('/client/claims').then(r => r.data),

  // Documents
  getDocuments: () => clientApi.get('/client/documents').then(r => r.data),
};
