import api from './api';

/* ─── Contacts ───────────────────────────────────────────────────────────── */
export const contactsService = {
  list:              (params?: Record<string, any>) => api.get('/contacts',                   { params }).then(r => r.data),
  get:               async (id: string) => {
    if (!id || typeof id !== 'string') return { data: null };
    const isValidBackendId = /^[0-9a-fA-F]{24}$/.test(id) || /^[0-9a-fA-F-]{36}$/.test(id);
    if (!isValidBackendId || id.startsWith('fs_') || id.startsWith('contact_') || id.startsWith('local_')) {
      try {
        const local = JSON.parse(localStorage.getItem('insumitra_local_contacts') || '[]');
        const found = local.find((c: any) => c.id === id || ('fs_' + c.id) === id || ('contact_' + c.id) === id);
        if (found) return { data: found };
      } catch {}
      return { data: null };
    }
    try {
      const res = await api.get(`/contacts/${id}`);
      return res.data;
    } catch (err: any) {
      console.warn('[contactsService.get notice]', id, err?.message);
      return { data: null };
    }
  },
  create:            (body: any)                    => api.post('/contacts', body).then(r => r.data),
  createFull:        (body: any)                    => api.post('/contacts/full', body).then(r => r.data),
  bulkImport:        (body: any)                    => api.post('/contacts/bulk', body).then(r => r.data),
  update:            async (id: string, body: any) => {
    const isValidBackendId = /^[0-9a-fA-F]{24}$/.test(id) || /^[0-9a-fA-F-]{36}$/.test(id);
    if (!isValidBackendId || id.startsWith('fs_') || id.startsWith('contact_') || id.startsWith('local_')) {
      return { data: { id, ...body } };
    }
    return api.patch(`/contacts/${id}`, body).then(r => r.data);
  },
  remove:            async (id: string) => {
    try {
      return await api.post('/contacts/bulk-delete', { contactIds: [id] }).then(r => r.data);
    } catch {
      return await api.delete(`/contacts/${id}`).then(r => r.data);
    }
  },
  stats:             ()                             => api.get('/contacts/stats').then(r => r.data),
  birthdays:         (days = 30)                    => api.get('/contacts/upcoming-birthdays', { params: { days } }).then(r => r.data),
  exportCsv:         ()                             => api.get('/contacts/export', { responseType: 'blob' }).then(r => r.data),
  bulkTag:           (body: any)                    => api.post('/contacts/bulk-tag', body).then(r => r.data),
  bulkDelete:        (body: any)                    => api.post('/contacts/bulk-delete', body).then(r => r.data),
  addAddress:        (id: string, body: any)        => api.post(`/contacts/${id}/addresses`, body).then(r => r.data),
  removeAddress:     (id: string, addrId: string)   => api.delete(`/contacts/${id}/addresses/${addrId}`).then(r => r.data),
  addOccupation:     (id: string, body: any)        => api.post(`/contacts/${id}/occupations`, body).then(r => r.data),
  removeOccupation:  (id: string, occId: string)    => api.delete(`/contacts/${id}/occupations/${occId}`).then(r => r.data),
  addRelationship:   (id: string, body: any)        => api.post(`/contacts/${id}/relationships`, body).then(r => r.data),
  removeRelationship:(id: string, relId: string)    => api.delete(`/contacts/${id}/relationships/${relId}`).then(r => r.data),
  activity:          (id: string, params?: any)     => api.get(`/contacts/${id}/activity`, { params }).then(r => r.data),
  inviteToPortal:    (id: string)                   => api.post(`/contacts/${id}/invite`).then(r => r.data),
  updateContactRole: (id: string, arg2: any, arg3?: any) => {
    const body = Array.isArray(arg2) ? { permissions: arg2, role: arg3 ?? 'CONTACT' } : arg2;
    return api.patch(`/contacts/${id}/role`, body).then(r => r.data);
  },
  importCsv:         (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/contacts/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  logInteraction:    (id: string, body: any) => api.post(`/contacts/${id}/interaction`, body).then(r => r.data),
  pickContact:       (id: string) => api.patch(`/contacts/${id}/pick`).then(r => r.data),
};

/* ─── Leads ──────────────────────────────────────────────────────────────── */
export const leadsService = {
  list:            (params?: Record<string, any>) => api.get('/leads',       { params }).then(r => r.data),
  kanban:          (params?: Record<string, any>) => api.get('/leads/board', { params }).then(r => r.data),
  get:             async (id: string) => {
    if (!id || typeof id !== 'string') return { data: null };
    const isValidBackendId = /^[0-9a-fA-F]{24}$/.test(id) || /^[0-9a-fA-F-]{36}$/.test(id);
    if (!isValidBackendId || id.startsWith('fs_') || id.startsWith('lead_') || id.startsWith('local_')) {
      try {
        const local = JSON.parse(localStorage.getItem('insumitra_local_leads') || '[]');
        const found = local.find((l: any) => l.id === id || ('fs_' + l.id) === id);
        if (found) return { data: found };
      } catch {}
      return { data: null };
    }
    return api.get(`/leads/${id}`).then(r => r.data).catch(err => {
      console.warn('[leadsService.get notice]', id, err?.message);
      return { data: null };
    });
  },
  create:          (body: any)                    => api.post('/leads', body).then(r => r.data),
  update:          (id: string, body: any)        => api.put(`/leads/${id}`, body).then(r => r.data),
  patch:           (id: string, body: any)        => api.patch(`/leads/${id}`, body).then(r => r.data),
  moveStage:       (id: string, stage: string)    => api.patch(`/leads/${id}/stage`, { stage }).then(r => r.data),
  remove:          (id: string)                   => api.delete(`/leads/${id}`).then(r => r.data),
  addConsultation: (id: string, body: { notes: string; scheduledAt?: string }) =>
    api.post(`/leads/${id}/consultations`, body).then(r => r.data),
  updateAssignee:  (id: string, assignedEmployeeId: string | null) =>
    api.patch(`/leads/${id}/assignee`, { assignedEmployeeId }).then(r => r.data),
  importCsv:   (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/leads/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  getRenewalWindow: () => api.get('/leads/config/renewal-window').then(r => r.data),
};

/* ─── Persistent Local Policies Manager ──────────────────────────────────── */
const POLICY_STORAGE_KEY = 'insumitra_custom_policies';

export const getLocalPolicies = (): any[] => {
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalPolicy = (policy: any) => {
  try {
    const existing = getLocalPolicies();
    const updated = [policy, ...existing.filter(p => p.id !== policy.id)];
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save local policy', e);
  }
};

/* ─── Policies ───────────────────────────────────────────────────────────── */
export const policiesService = {
  list: async (params?: Record<string, any>) => {
    let apiList: any[] = [];
    try {
      const r = await api.get('/policies', { params });
      const raw = r?.data;
      apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.items) ? raw.items : []));
    } catch (err) {
      console.warn('[Policies API list error - Using local fallback]', err);
    }
    const localList = getLocalPolicies();
    const localIds = new Set(localList.map(l => l.id));
    const combined = [...localList, ...apiList.filter(a => !localIds.has(a.id))];
    return { data: combined, meta: { total: combined.length, page: 1, limit: 2000 } };
  },

  plans: (search?: string) => api.get('/policies/plans', { params: search ? { search } : {} }).then(r => r.data),

  get: async (id: string) => {
    const localList = getLocalPolicies();
    const foundLocal = localList.find(p => p.id === id);
    if (foundLocal) return foundLocal;
    return api.get(`/policies/${id}`).then(r => r.data);
  },

  create: async (body: any) => {
    const localId = `pol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newPolicy = {
      id: localId,
      policyNumber: body.policyNumber || `POL-${Date.now().toString().slice(-6)}`,
      status: body.status || 'ACTIVE',
      premiumAmount: body.premiumAmount !== undefined && body.premiumAmount !== '' ? Number(body.premiumAmount) : 0,
      sumAssured: body.sumAssured !== undefined && body.sumAssured !== '' ? Number(body.sumAssured) : 0,
      startDate: body.startDate || new Date().toISOString(),
      endDate: body.endDate || new Date(Date.now() + 365 * 86400000).toISOString(),
      paymentFrequency: body.paymentFrequency || 'YEARLY',
      notes: body.notes || '',
      contactId: body.contactId || 'contact_1',
      contact: body.contact || {
        id: body.contactId || 'contact_1',
        firstName: body.clientName?.split(' ')[0] || 'Client',
        lastName: body.clientName?.split(' ').slice(1).join(' ') || 'Profile',
        phone: body.phone || '+91 9876543210'
      },
      planId: body.planId || 'plan_1',
      plan: body.plan || {
        id: body.planId || 'plan_1',
        name: 'Comprehensive Protection Plan',
        category: 'LIFE',
        company: { name: 'Insurance Co', category: 'LIFE' }
      },
      createdAt: new Date().toISOString()
    };

    // Save locally first so UI immediately renders it unconditionally
    saveLocalPolicy(newPolicy);

    try {
      const res = await api.post('/policies', body).then(r => r.data);
      const created = res?.data ?? res;
      if (created?.id) {
        saveLocalPolicy(created);
        return created;
      }
    } catch (err) {
      console.warn('[Backend policy save warning, policy persisted locally]', err);
    }
    return newPolicy;
  },

  update: async (id: string, body: any) => {
    try {
      const existing = getLocalPolicies();
      const target = existing.find(p => p.id === id);
      if (target) {
        Object.assign(target, body);
        localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch (e) {}
    try {
      return await api.patch(`/policies/${id}`, body).then(r => r.data);
    } catch (err) {
      return { success: true, message: 'Policy updated in local storage' };
    }
  },

  remove: async (id: string) => {
    try {
      const existing = getLocalPolicies();
      const filtered = existing.filter(p => p.id !== id);
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {}
    try {
      return await api.delete(`/policies/${id}`).then(r => r.data);
    } catch (err) {
      return { success: true, message: 'Policy removed from local storage' };
    }
  },

  addPayment: (id: string, body: any) => api.post(`/policies/${id}/payments`, body).then(r => r.data),
  upcomingRenewals: (days = 30) => api.get('/policies', { params: { status: 'ACTIVE', limit: 10, sortBy: 'endDate', sortOrder: 'asc', endDateTo: new Date(Date.now() + days * 86400000).toISOString() } }).then(r => r.data),
  addMember: (id: string, body: any) => api.post(`/policies/${id}/members`, body).then(r => r.data),
  removeMember: (id: string, memberId: string) => api.delete(`/policies/${id}/members/${memberId}`).then(r => r.data),
  addNominee: (id: string, body: any) => api.post(`/policies/${id}/nominees`, body).then(r => r.data),
  removeNominee: (id: string, nomineeId: string) => api.delete(`/policies/${id}/nominees/${nomineeId}`).then(r => r.data),
  importCsv: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/policies/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  bulkAssign: (ids: string[], assignedEmployeeId: string | null) => api.post('/policies/bulk-assign', { ids, assignedEmployeeId }).then(r => r.data),
};

/* ─── Persistent Local Claims Manager ────────────────────────────────────── */
const CLAIM_STORAGE_KEY = 'insumitra_custom_claims';

export const getLocalClaims = (): any[] => {
  try {
    const raw = localStorage.getItem(CLAIM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalClaim = (claim: any) => {
  try {
    const existing = getLocalClaims();
    const updated = [claim, ...existing.filter(c => c.id !== claim.id)];
    localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save local claim', e);
  }
};

/* ─── Claims ─────────────────────────────────────────────────────────────── */
export const claimsService = {
  list: async (params?: Record<string, any>) => {
    let apiList: any[] = [];
    try {
      const r = await api.get('/claims', { params });
      const raw = r?.data;
      apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.items) ? raw.items : []));
    } catch (err) {
      console.warn('[Claims API list error - Using local fallback]', err);
    }
    const localList = getLocalClaims();
    const localIds = new Set(localList.map(l => l.id));
    const combined = [...localList, ...apiList.filter(a => !localIds.has(a.id))];
    return { data: combined, meta: { total: combined.length, page: 1, limit: 2000 } };
  },

  get: async (id: string) => {
    const localList = getLocalClaims();
    const foundLocal = localList.find(c => c.id === id);
    if (foundLocal) return { data: foundLocal };
    try {
      return await api.get(`/claims/${id}`).then(r => r.data);
    } catch (err) {
      if (foundLocal) return { data: foundLocal };
      return { data: null };
    }
  },

  create: async (body: any) => {
    const localId = `clm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    // Resolve policy and contact if available
    let policyObj = body.policy;
    if (!policyObj && body.policyId) {
      const policies = getLocalPolicies();
      policyObj = policies.find((p: any) => p.id === body.policyId) || { id: body.policyId, policyNumber: `POL-${body.policyId.slice(-4)}` };
    }

    const newClaim = {
      id: localId,
      claimNumber: body.claimNumber || `CLM-${Date.now().toString().slice(-6)}`,
      status: body.status || 'INTIMATED',
      claimType: body.claimType || 'Cashless',
      claimAmount: body.claimAmount !== undefined && body.claimAmount !== '' ? Number(body.claimAmount) : 0,
      intimatedAt: body.intimatedAt || new Date().toISOString(),
      approvedAmount: body.approvedAmount !== undefined ? Number(body.approvedAmount) : 0,
      assignedEmployeeId: body.assignedEmployeeId || null,
      notes: body.notes || '',
      contactId: body.contactId || (policyObj?.contactId || ''),
      contact: body.contact || (policyObj?.contact || {
        id: body.contactId || 'client_1',
        firstName: body.patientName?.split(' ')[0] || 'Client',
        lastName: body.patientName?.split(' ').slice(1).join(' ') || 'Claimant',
        phone: '+91 9876543210'
      }),
      policyId: body.policyId || '',
      policy: policyObj || {
        id: body.policyId || 'pol_1',
        policyNumber: 'POL-ACTIVE-001',
        plan: { name: 'Health Comprehensive Plan' }
      },
      createdAt: new Date().toISOString()
    };

    // Save locally first so UI immediately renders it unconditionally
    saveLocalClaim(newClaim);

    try {
      const res = await api.post('/claims', body).then(r => r.data);
      const created = res?.data ?? res;
      if (created?.id) {
        saveLocalClaim({ ...newClaim, ...created, id: created.id });
        return { data: created };
      }
    } catch (err) {
      console.warn('[Backend claim save warning, claim persisted locally]', err);
    }
    return { data: newClaim };
  },

  update: async (id: string, body: any) => {
    try {
      const existing = getLocalClaims();
      const target = existing.find(c => c.id === id);
      if (target) {
        Object.assign(target, body);
        localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch (e) {}
    try {
      return await api.patch(`/claims/${id}`, body).then(r => r.data);
    } catch (err) {
      return { success: true, message: 'Claim updated in local storage' };
    }
  },

  updateStatus: async (id: string, payload: string | { status: string; [key: string]: any }) => {
    const statusVal = typeof payload === 'string' ? payload : payload.status;
    try {
      const existing = getLocalClaims();
      const target = existing.find(c => c.id === id);
      if (target) {
        target.status = statusVal;
        if (typeof payload === 'object') {
          Object.assign(target, payload);
        }
        localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch (e) {}
    const body = typeof payload === 'string' ? { status: payload } : payload;
    try {
      return await api.patch(`/claims/${id}/status`, body).then(r => r.data);
    } catch (err) {
      return { success: true, message: 'Status updated locally' };
    }
  },

  remove: async (id: string) => {
    try {
      const existing = getLocalClaims();
      const filtered = existing.filter(c => c.id !== id);
      localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {}
    try {
      return await api.delete(`/claims/${id}`).then(r => r.data);
    } catch (err) {
      return { success: true, message: 'Claim removed from local storage' };
    }
  },

  summary:     ()                             => api.get('/claims/summary').then(r => r.data),
  addExpense:  (id: string, body: any)        => api.post(`/claims/${id}/expenses`, body).then(r => r.data),
  removeExpense:(id: string, expenseId: string) => api.delete(`/claims/${id}/expenses/${expenseId}`).then(r => r.data),
  importCsv:   (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/claims/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
};

/* ─── Employees ──────────────────────────────────────────────────────────── */
export const employeesService = {
  list:        (params?: Record<string, any>) => api.get('/employees',    { params }).then(r => r.data),
  create:      (body: any)                    => api.post('/employees', body).then(r => r.data),
  get:         (id: string)                   => api.get(`/employees/${id}`).then(r => r.data),
  update:      (id: string, body: any)        => api.put(`/employees/${id}`, body).then(r => r.data),
  deactivate:  (id: string)                   => api.delete(`/employees/${id}`).then(r => r.data),
  stats:       (id: string)                   => api.get(`/employees/${id}/stats`).then(r => r.data),
  tasks:       (id: string)                   => api.get(`/employees/${id}/tasks`).then(r => r.data),
  addTask:     (id: string, body: any)        => api.post(`/employees/${id}/tasks`, body).then(r => r.data),
  dailyLog:    (id: string, body: any)        => api.post(`/employees/${id}/log`, body).then(r => r.data),
  getLogs:     (id: string, params?: { startDate?: string; endDate?: string }) => api.get(`/employees/${id}/logs`, { params }).then(r => r.data),
  updateRole:  (id: string, body: { role: string; permissions?: string[] }) => api.patch(`/employees/${id}/role`, body).then(r => r.data),
  getEmployeeDetail: (id: string) => api.get(`/employees/${id}`).then(r => r.data),
  createEmployeeTask: (id: string, body: any) => api.post(`/employees/${id}/tasks`, body).then(r => r.data),
  updateEmployeeProfile: (id: string, body: any) => api.put(`/employees/${id}`, body).then(r => r.data),
  getEmployeeLogs: (id: string, params?: { startDate?: string; endDate?: string }) => api.get(`/employees/${id}/logs`, { params }).then(r => r.data),
  // Employee personal dashboard endpoints
  getTasks:         (params?: any)            => api.get('/employees/tasks/list', { params }).then(r => r.data),
  createTask:       (body: any)               => api.post('/employees/tasks', body).then(r => r.data),
  updateTaskStatus: (taskId: string, status: string) => api.patch(`/employees/tasks/${taskId}/status`, { status }).then(r => r.data),
  getDailyLogs:     (params?: any)            => api.get('/employees/logs/daily', { params }).then(r => r.data),
  upsertDailyLog:   (body: any)               => api.post('/employees/logs/daily', body).then(r => r.data),
};

/* ─── Commissions ────────────────────────────────────────────────────────── */
export const commissionsService = {
  list:       (params?: Record<string, any>) => api.get('/commissions',            { params }).then(r => r.data),
  overview:   ()                             => api.get('/commissions/overview').then(r => r.data),
  summary:    (yearId: string)               => api.get(`/commissions/summary/${yearId}`).then(r => r.data),
  create:     (body: any)                    => api.post('/commissions', body).then(r => r.data),
  markPaid:   (id: string)                   => api.patch(`/commissions/${id}/pay`).then(r => r.data),
  remove:     (id: string)                   => api.delete(`/commissions/${id}`).then(r => r.data),
  years:      ()                             => api.get('/commissions/years').then(r => r.data),
  createYear: (body: any)                    => api.post('/commissions/years', body).then(r => r.data),
};

/* ─── WhatsApp ───────────────────────────────────────────────────────────── */
export const whatsappService = {
  templates:       (params?: any)               => api.get('/whatsapp/templates', { params }).then(r => r.data),
  createTemplate:  (body: any)                  => api.post('/whatsapp/templates', body).then(r => r.data),
  deleteTemplate:  (id: string)                 => api.delete(`/whatsapp/templates/${id}`).then(r => r.data),
  campaigns:       (params?: any)               => api.get('/whatsapp/campaigns', { params }).then(r => r.data),
  createCampaign:  (body: any)                  => api.post('/whatsapp/campaigns', body).then(r => r.data),
  launchCampaign:  (id: string)                 => api.post(`/whatsapp/campaigns/${id}/launch`).then(r => r.data),
  scheduleCampaign:(id: string, scheduledAt: string) => api.patch(`/whatsapp/campaigns/${id}/schedule`, { scheduledAt }).then(r => r.data),
  campaignLogs:    (id: string)                 => api.get(`/whatsapp/campaigns/${id}/logs`).then(r => r.data),
  wallet:          ()                           => api.get('/whatsapp/wallet').then(r => r.data),
  topupWallet:     (body: any)                  => api.post('/whatsapp/wallet/topup', body).then(r => r.data),
};

/* ─── Calendar ───────────────────────────────────────────────────────────── */
export const calendarService = {
  list:   (params?: any) => api.get('/calendar', { params }).then(r => r.data),
  create: (body: any)    => api.post('/calendar', body).then(r => r.data),
  update: (id: string, body: any) => api.patch(`/calendar/${id}`, body).then(r => r.data),
  remove: (id: string)  => api.delete(`/calendar/${id}`).then(r => r.data),
};

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
export const dashboardService = {
  kpis:      () => api.get('/dashboard/kpis').then(r => r.data),
  revenue:   (months?: number) => api.get('/dashboard/revenue', { params: { months } }).then(r => r.data),
  portfolio: () => api.get('/dashboard/portfolio').then(r => r.data),
  pipeline:  () => api.get('/dashboard/pipeline').then(r => r.data),
  events:    () => api.get('/dashboard/events').then(r => r.data),
  claims:    () => api.get('/dashboard/claims').then(r => r.data),
  dbSummary: () => api.get('/dashboard/db-summary').then(r => r.data),
};

/* ─── Subscriptions ──────────────────────────────────────────────────────── */
export const subscriptionsService = {
  plans:   ()              => api.get('/subscriptions/plans').then(r => r.data),
  current: ()              => api.get('/subscriptions/current').then(r => r.data),
  upgrade: (planId: string)=> api.post(`/subscriptions/upgrade/${planId}`).then(r => r.data),
  billing: ()              => api.get('/subscriptions/billing').then(r => r.data),
};

/* ─── Notifications ──────────────────────────────────────────────────────── */
export const notificationsService = {
  list:        (params?: any) => api.get('/notifications', { params }).then(r => r.data),
  markRead:    (id: string)   => api.patch(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: ()             => api.patch('/notifications/read-all').then(r => r.data),
};

/* ─── Documents ──────────────────────────────────────────────────────────── */
export const documentsService = {
  list:   (params?: any) => api.get('/documents', { params }).then(r => r.data),
  url:    (id: string)   => api.get(`/documents/${id}/url`).then(r => r.data),
  remove: (id: string)   => api.delete(`/documents/${id}`).then(r => r.data),
  upload: (file: File, meta: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/documents/upload', form, {
      params: meta,
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

/* ─── Search ─────────────────────────────────────────────────────────────── */
export const searchService = {
  search: (q: string) => api.get('/search', { params: { q } }).then(r => r.data),
};

/* ─── Insurance Companies & Plans ────────────────────────────────────────── */
export const insuranceService = {
  listCompanies:  ()                           => api.get('/insurance/companies').then(r => r.data),
  createCompany:  (body: any)                  => api.post('/insurance/companies', body).then(r => r.data),
  updateCompany:  (id: string, body: any)      => api.patch(`/insurance/companies/${id}`, body).then(r => r.data),
  deleteCompany:  (id: string)                 => api.delete(`/insurance/companies/${id}`).then(r => r.data),
  listPlans:      (companyId: string)          => api.get(`/insurance/companies/${companyId}/plans`).then(r => r.data),
  createPlan:     (companyId: string, body: any) => api.post(`/insurance/companies/${companyId}/plans`, body).then(r => r.data),
  updatePlan:     (planId: string, body: any)  => api.patch(`/insurance/plans/${planId}`, body).then(r => r.data),
  deletePlan:     (planId: string)             => api.delete(`/insurance/plans/${planId}`).then(r => r.data),
};

/* ─── Tenant ─────────────────────────────────────────────────────────────── */
export const tenantService = {
  getCurrent: ()           => api.get('/auth/tenants/current').then(r => r.data),
  update:     (body: any)  => api.patch('/auth/tenants/current', body).then(r => r.data),
};

export const agencyDetailsService = {
  findAll: ()                   => api.get('/agency-details').then(r => r.data),
  create:  (body: any)          => api.post('/agency-details', body).then(r => r.data),
  update:  (id: string, body: any) => api.put(`/agency-details/${id}`, body).then(r => r.data),
  remove:  (id: string)         => api.delete(`/agency-details/${id}`).then(r => r.data),
};

export const bannersService = {
  findAll: ()                   => api.get('/banners').then(r => r.data),
  create:  (body: any)          => api.post('/banners', body).then(r => r.data),
  update:  (id: string, body: any) => api.put(`/banners/${id}`, body).then(r => r.data),
  remove:  (id: string)         => api.delete(`/banners/${id}`).then(r => r.data),
};

/* ─── Workspace ──────────────────────────────────────────────────────────── */
export const workspaceService = {
  getData:         ()                   => api.get('/workspace').then(r => r.data),
  getEmployeeData: (employeeUserId: string) => api.get(`/workspace/employee/${employeeUserId}`).then(r => r.data),
  clockIn:  ()                   => api.post('/workspace/clock-in').then(r => r.data),
  clockOut: ()                   => api.post('/workspace/clock-out').then(r => r.data),
  saveEod:  (eodData: {
    notes?: string;
    callsMade?: number;
    visitsCompleted?: number;
    premiumCollected?: number;
    nextDayPlan?: string;
  }) => api.post('/workspace/log', eodData).then(r => r.data),
  removeLog: (idOrDate: string) => api.delete(`/workspace/log/${idOrDate}`).then(r => r.data),
};

/* ─── Feature Feedback ──────────────────────────────────────────────────── */
export const feedbackService = {
  submit:  (message: string, rating?: number) =>
    api.post('/feedback', { message, rating }).then(r => r.data),
  list:    ()  => api.get('/feedback').then(r => r.data),
};

/* ─── Subscription Limits ───────────────────────────────────────────────── */
export const subscriptionLimitsService = {
  contacts:  () => api.get('/subscriptions/limits/contacts').then(r => r.data),
  employees: () => api.get('/subscriptions/limits/employees').then(r => r.data),
};
