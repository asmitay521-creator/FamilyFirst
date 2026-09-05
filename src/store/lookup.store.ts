import { create } from 'zustand';
import {
  insuranceService,
  policiesService,
  employeesService,
  whatsappService,
  tenantService,
} from '../services/index';

interface LookupState {
  companies: any[];
  plans: any[];
  employees: any[];
  templates: any[];
  tenantDetails: any | null;
  loading: boolean;
  error: string | null;

  loadCompanies: (force?: boolean) => Promise<void>;
  loadPlans: (force?: boolean) => Promise<void>;
  loadEmployees: (force?: boolean) => Promise<void>;
  loadTemplates: (force?: boolean) => Promise<void>;
  loadTenantDetails: (force?: boolean) => Promise<void>;
  loadAll: (force?: boolean) => Promise<void>;
  clearCache: () => void;
}

export const useLookupStore = create<LookupState>((set, get) => ({
  companies: [],
  plans: [],
  employees: [],
  templates: [],
  tenantDetails: null,
  loading: false,
  error: null,

  loadCompanies: async (force = false) => {
    if (get().companies.length > 0 && !force) return;
    try {
      const res = await insuranceService.listCompanies();
      set({ companies: res?.data ?? [] });
    } catch (_err: any) {
      set({ companies: [] });
    }
  },

  loadPlans: async (force = false) => {
    if (get().plans.length > 0 && !force) return;
    try {
      const res = await policiesService.plans();
      set({ plans: res?.data ?? [] });
    } catch (_err: any) {
      set({ plans: [] });
    }
  },

  loadEmployees: async (force = false) => {
    if (get().employees.length > 0 && !force) return;
    try {
      const res = await employeesService.list({ limit: 100 });
      const raw = res?.data?.data || res?.data || [];
      const empList = Array.isArray(raw) ? raw : (Array.isArray(res?.data) ? res.data : []);
      set({ employees: empList });
    } catch (_err: any) {
      set({ employees: [] });
    }
  },

  loadTemplates: async (force = false) => {
    if (get().templates.length > 0 && !force) return;
    try {
      const { useAuthStore } = await import('./auth.store');
      const user = useAuthStore.getState().user;
      if (user && user.role !== 'SUPERADMIN') {
        const { subscriptionsService } = await import('../services/index');
        const subRes = await subscriptionsService.current().catch(() => null);
        const planName = subRes?.data?.plan?.name || 'Free';
        if (planName !== 'Enterprise' && planName !== 'Business') {
          return;
        }
      }
      const res = await whatsappService.templates();
      set({ templates: res?.data ?? [] });
    } catch (_err: any) {
      set({ templates: [] });
    }
  },

  loadTenantDetails: async (force = false) => {
    if (get().tenantDetails && !force) return;
    try {
      const res = await tenantService.getCurrent();
      set({ tenantDetails: res?.data ?? null });
    } catch (_err: any) {
      set({ tenantDetails: null });
    }
  },

  loadAll: async (force = false) => {
    const s = get();
    if (!force && s.companies.length > 0 && s.plans.length > 0 && s.employees.length > 0 && s.tenantDetails) {
      return;
    }
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().loadCompanies(force),
        get().loadPlans(force),
        get().loadEmployees(force),
        get().loadTemplates(force),
        get().loadTenantDetails(force),
      ]);
      set({ loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to load lookups' });
    }
  },

  clearCache: () => {
    set({
      companies: [],
      plans: [],
      employees: [],
      templates: [],
      tenantDetails: null,
      loading: false,
      error: null,
    });
  },
}));
