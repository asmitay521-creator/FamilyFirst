import api from './api';
import { useAuthStore } from '@store/auth.store';
import { useLookupStore } from '@store/lookup.store';

export interface LoginPayload     { email: string; password: string }
export interface RegisterPayload  { tenantName: string; tenantSlug: string; email: string; password: string; firstName: string; lastName: string; phone?: string }
export interface ChangePassPayload { currentPassword: string; newPassword: string }
export interface ResetPassPayload  { token: string; newPassword: string }

export const authService = {
  async login(payload: LoginPayload) {
    const response = await api.post('/auth/login', payload);
    const resData = response?.data?.data || response?.data || {};
    const accessToken = resData.accessToken || resData.token;
    const refreshToken = resData.refreshToken || resData.token;
    const user = resData.user;

    if (!accessToken || !user) {
      throw new Error('Invalid response from server');
    }

    useAuthStore.getState().setTokens(accessToken, refreshToken ?? accessToken);
    useAuthStore.getState().setUser(user);
    try {
      useLookupStore.getState().loadAll();
    } catch {}
    return { accessToken, refreshToken, user };
  },

  async register(payload: RegisterPayload) {
    const { data } = await api.post('/auth/register', payload);
    return data.data;
  },

  async sendPasswordReset(email: string) {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  async forgotPassword(email: string) {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  async resetPassword(payload: ResetPassPayload) {
    const { data } = await api.post('/auth/reset-password', payload);
    return data;
  },

  async changePassword(payload: ChangePassPayload) {
    const { data } = await api.post('/auth/change-password', payload);
    return data;
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch {}
    useAuthStore.getState().logout();
    useLookupStore.getState().clearCache();
  },
};
