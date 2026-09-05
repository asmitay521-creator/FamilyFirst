import axios from 'axios';
import { useSuperAdminStore } from '@store/superadmin.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const superApi = axios.create({ baseURL: BASE_URL });

superApi.interceptors.request.use((config) => {
  const token = useSuperAdminStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

superApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useSuperAdminStore.getState().logout();
      window.location.href = '/superadmin/login';
    }
    return Promise.reject(error);
  },
);

export const superAdminService = {
  async login(email: string, password: string) {
    const { data } = await superApi.post('/superadmin/auth/login', { email, password });
    const { accessToken, admin } = data.data;
    useSuperAdminStore.getState().setAuth(accessToken, admin);
    return data.data;
  },

  async getMe() {
    const { data } = await superApi.get('/superadmin/auth/me');
    return data.data;
  },

  async getPlatformStats() {
    const { data } = await superApi.get('/superadmin/auth/platform-stats');
    return data.data as {
      totalTenants:   number;
      activeTenants:  number;
      totalUsers:     number;
      totalPolicies:  number;
      totalContacts:  number;
    };
  },

  async listTenants(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await superApi.get('/superadmin/tenants', { params });
    return data;
  },

  async getTenants() {
    const { data } = await superApi.get('/superadmin/tenants');
    return data.data;
  },

  async createTenant(tenantData: any) {
    const { data } = await superApi.post('/superadmin/tenants', tenantData);
    return data.data;
  },

  async updateTenant(id: string, tenantData: any) {
    const { data } = await superApi.put(`/superadmin/tenants/${id}`, tenantData);
    return data.data;
  },

  async setTenantStatus(id: string, isActive: boolean) {
    const { data } = await superApi.put(`/superadmin/tenants/${id}/status`, { isActive });
    return data.data;
  },

  async updateTenantStatus(id: string, isActive: boolean) {
    const { data } = await superApi.put(`/superadmin/tenants/${id}/status`, { isActive });
    return data.data;
  },

  async resetTenantPassword(id: string, newPassword: string) {
    const { data } = await superApi.put(`/superadmin/tenants/${id}/password`, { newPassword });
    return data.data;
  },

  async updateTenantPlan(id: string, plan: 'STARTER' | 'PRO' | 'ENTERPRISE') {
    const { data } = await superApi.put(`/superadmin/tenants/${id}/plan`, { plan });
    return data.data;
  },

  async deleteTenant(id: string) {
    const { data } = await superApi.delete(`/superadmin/tenants/${id}`);
    return data.data;
  },

  async getAllFeedback(params?: { limit?: number }) {
    const { data } = await superApi.get('/superadmin/feedback', { params });
    return data;
  },

  async getDeletionRequests() {
    const { data } = await superApi.get('/deletion-requests');
    return data as { data: any[] };
  },

  async resolveDeletionRequest(id: string, action: 'APPROVED' | 'REJECTED') {
    const { data } = await superApi.put(`/deletion-requests/${id}/resolve`, { action });
    return data;
  },

  logout() {
    useSuperAdminStore.getState().logout();
  },
};
