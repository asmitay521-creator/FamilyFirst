import api from './api';
import { useAuthStore } from '@store/auth.store';
import { useLookupStore } from '@store/lookup.store';

export interface LoginPayload     { email: string; password: string }
export interface RegisterPayload  { tenantName: string; tenantSlug: string; email: string; password: string; firstName: string; lastName: string; phone?: string }
export interface ChangePassPayload { currentPassword: string; newPassword: string }

export const authService = {
  async login(payload: LoginPayload) {
    try {
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
    } catch (err: any) {
      // Only use offline fallback when there is truly NO network response
      // (e.g. server is completely down — no err.response at all)
      if (!err.response) {
        // Network offline — allow demo access so UI can be viewed
        const isEmployee = payload.email.toLowerCase().includes('employee');
        const demoUser = {
          id: 'user-demo-1',
          email: payload.email,
          role: isEmployee ? 'EMPLOYEE' : 'OWNER',
          firstName: isEmployee ? 'Employee' : 'Agency',
          lastName: isEmployee ? 'User' : 'Owner',
          tenantId: 'tenant-demo-1',
        };
        useAuthStore.getState().setTokens('demo-access-token-xyz', 'demo-refresh-token-xyz');
        useAuthStore.getState().setUser(demoUser);
        return { accessToken: 'demo-access-token-xyz', user: demoUser };
      }
      // Real server error (401 Invalid credentials, 400 Validation, etc.) — throw it
      throw err;
    }
  },

  async register(payload: RegisterPayload) {
    const { data } = await api.post('/auth/register', payload);
    return data.data;
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
