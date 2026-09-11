import api from './api';
import { useAuthStore } from '@store/auth.store';
import { db } from './firebase';
import { doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

export const isRemoteAuth = (): boolean => {
  const token = useAuthStore.getState().accessToken;
  return Boolean(token && !token.startsWith('auth-token-') && !token.startsWith('demo-'));
};

/* ─── Initial Preset Seed Datasets ────────────────────────────────────────── */
export const INITIAL_PRESET_CONTACTS: any[] = [
  {
    id: 'contact-demo-1',
    _id: 'contact-demo-1',
    firstName: 'Rajesh',
    lastName: 'Sharma',
    phone: '9823012345',
    alternatePhone: '9823012346',
    email: 'rajesh.sharma@gmail.com',
    gender: 'MALE',
    maritalStatus: 'MARRIED',
    dateOfBirth: '1985-06-15',
    panNumber: 'ABCPS1234F',
    aadhaarNumber: '123456789012',
    annualIncome: 1200000,
    tags: ['contact', 'client'],
    isDependent: false,
    assignedEmployeeId: 'emp-vaishnavi-bhosale-1',
    isActive: true,
    createdAt: '2024-01-10T10:00:00.000Z',
    notes: 'Looking for family health insurance & life cover.',
  },
  {
    id: 'contact-demo-2',
    _id: 'contact-demo-2',
    firstName: 'Priya',
    lastName: 'Patil',
    phone: '9876543210',
    alternatePhone: '9876543211',
    email: 'priya.patil@gmail.com',
    gender: 'FEMALE',
    maritalStatus: 'MARRIED',
    dateOfBirth: '1990-03-22',
    panNumber: 'DEFPP5678G',
    aadhaarNumber: '987654321098',
    annualIncome: 950000,
    tags: ['contact', 'client'],
    isDependent: false,
    assignedEmployeeId: 'emp-gayatri-jadhav-1',
    isActive: true,
    createdAt: '2024-01-15T11:30:00.000Z',
    notes: 'Interested in Term Life & Child Education Plan.',
  },
  {
    id: 'contact-demo-3',
    _id: 'contact-demo-3',
    firstName: 'Amit',
    lastName: 'Deshmukh',
    phone: '9850123456',
    alternatePhone: '',
    email: 'amit.deshmukh@gmail.com',
    gender: 'MALE',
    maritalStatus: 'SINGLE',
    dateOfBirth: '1995-11-08',
    panNumber: 'GHIPA9012H',
    aadhaarNumber: '456789012345',
    annualIncome: 1500000,
    tags: ['contact', 'lead'],
    isDependent: false,
    assignedEmployeeId: 'emp-asmita-yadav-1',
    isActive: true,
    createdAt: '2024-02-01T09:15:00.000Z',
    notes: 'Inquired about Motor & Critical Illness Insurance.',
  },
  {
    id: 'contact-demo-4',
    _id: 'contact-demo-4',
    firstName: 'Sanjay',
    lastName: 'Kulkarni',
    phone: '9422019876',
    alternatePhone: '9422019877',
    email: 'sanjay.kulkarni@gmail.com',
    gender: 'MALE',
    maritalStatus: 'MARRIED',
    dateOfBirth: '1978-08-30',
    panNumber: 'JKLPS3456I',
    aadhaarNumber: '345678901234',
    annualIncome: 2200000,
    tags: ['contact', 'client', 'HNI'],
    isDependent: false,
    assignedEmployeeId: 'user-superadmin-1',
    isActive: true,
    createdAt: '2024-02-10T14:20:00.000Z',
    notes: 'HNI Client. Holds multiple policies for business and family.',
  }
];

export const INITIAL_PRESET_LEADS: any[] = [
  {
    id: 'lead-demo-1',
    contactId: 'contact-demo-1',
    contact: {
      id: 'contact-demo-1',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      phone: '9823012345',
      email: 'rajesh.sharma@gmail.com',
    },
    stage: 'TO_CONTACT',
    status: 'INTERESTED',
    source: 'Walk-in',
    interests: ['Health'],
    premiumBudget: 25000,
    assignedEmployeeId: 'emp-vaishnavi-bhosale-1',
    followUpDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    notes: JSON.stringify({
      leadStatus: 'INTERESTED',
      leadType: 'FRESH',
      cleanNotes: 'Requested quote for Star Health Optima Protect for 2 Adults + 1 Child.',
      assignedEmployeeId: 'emp-vaishnavi-bhosale-1',
    }),
    createdAt: '2024-02-15T10:00:00.000Z',
  },
  {
    id: 'lead-demo-2',
    contactId: 'contact-demo-2',
    contact: {
      id: 'contact-demo-2',
      firstName: 'Priya',
      lastName: 'Patil',
      phone: '9876543210',
      email: 'priya.patil@gmail.com',
    },
    stage: 'CONTACTED',
    status: 'HOT',
    source: 'Social Media',
    interests: ['Life'],
    premiumBudget: 50000,
    assignedEmployeeId: 'emp-gayatri-jadhav-1',
    followUpDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    notes: JSON.stringify({
      leadStatus: 'HOT',
      leadType: 'FRESH',
      cleanNotes: 'Needs Term Insurance cover of 1 Crore. Medicals scheduled.',
      assignedEmployeeId: 'emp-gayatri-jadhav-1',
    }),
    createdAt: '2024-02-18T11:00:00.000Z',
  },
  {
    id: 'lead-demo-3',
    contactId: 'contact-demo-3',
    contact: {
      id: 'contact-demo-3',
      firstName: 'Amit',
      lastName: 'Deshmukh',
      phone: '9850123456',
      email: 'amit.deshmukh@gmail.com',
    },
    stage: 'PROPOSAL_SENT',
    status: 'VERY_HOT',
    source: 'Referral',
    interests: ['Motor'],
    premiumBudget: 15000,
    assignedEmployeeId: 'emp-asmita-yadav-1',
    followUpDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    notes: JSON.stringify({
      leadStatus: 'VERY_HOT',
      leadType: 'RENEWAL',
      cleanNotes: 'Car Insurance renewal quote sent for Hyundai Creta.',
      assignedEmployeeId: 'emp-asmita-yadav-1',
    }),
    createdAt: '2024-02-20T12:00:00.000Z',
  }
];

export const INITIAL_PRESET_POLICIES: any[] = [
  {
    id: 'pol-demo-1',
    policyNumber: 'POL-2024-8891',
    contactId: 'contact-demo-1',
    clientName: 'Rajesh Sharma',
    contact: {
      id: 'contact-demo-1',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      phone: '9823012345',
      email: 'rajesh.sharma@gmail.com',
    },
    planId: 'plan-demo-1',
    plan: {
      id: 'plan-demo-1',
      name: 'Star Health Optima Secure',
      category: 'HEALTH',
      company: { name: 'Star Health' },
    },
    sumAssured: 1000000,
    premiumAmount: 22000,
    paymentFrequency: 'YEARLY',
    startDate: '2024-01-15',
    endDate: '2025-01-15',
    status: 'ACTIVE',
    assignedEmployeeId: 'emp-vaishnavi-bhosale-1',
    createdAt: '2024-01-15T10:00:00.000Z',
  },
  {
    id: 'pol-demo-2',
    policyNumber: 'POL-2024-9923',
    contactId: 'contact-demo-4',
    clientName: 'Sanjay Kulkarni',
    contact: {
      id: 'contact-demo-4',
      firstName: 'Sanjay',
      lastName: 'Kulkarni',
      phone: '9422019876',
      email: 'sanjay.kulkarni@gmail.com',
    },
    planId: 'plan-demo-2',
    plan: {
      id: 'plan-demo-2',
      name: 'LIC Jeevan Umang',
      category: 'LIFE',
      company: { name: 'LIC of India' },
    },
    sumAssured: 2500000,
    premiumAmount: 85000,
    paymentFrequency: 'YEARLY',
    startDate: '2023-11-01',
    endDate: '2024-11-01',
    status: 'ACTIVE',
    assignedEmployeeId: 'user-superadmin-1',
    createdAt: '2023-11-01T10:00:00.000Z',
  }
];

export const INITIAL_PRESET_CLAIMS: any[] = [
  {
    id: 'clm-demo-1',
    claimNumber: 'CLM-2024-5501',
    status: 'INTIMATED',
    claimType: 'Cashless',
    claimAmount: 45000,
    intimatedAt: '2024-02-10T10:00:00.000Z',
    approvedAmount: 45000,
    assignedEmployeeId: 'emp-vaishnavi-bhosale-1',
    notes: 'Cashless hospitalization claim at Ruby Hall Clinic for Dengue treatment.',
    contactId: 'contact-demo-1',
    contact: {
      id: 'contact-demo-1',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      phone: '9823012345',
    },
    policyId: 'pol-demo-1',
    policy: {
      id: 'pol-demo-1',
      policyNumber: 'POL-2024-8891',
      plan: { name: 'Star Health Optima Secure' },
    },
    createdAt: '2024-02-10T10:00:00.000Z',
  }
];

export const INITIAL_PRESET_COMPANIES: any[] = [
  { id: 'comp-1', name: 'Star Health', code: 'STAR', logo: '' },
  { id: 'comp-2', name: 'LIC of India', code: 'LIC', logo: '' },
  { id: 'comp-3', name: 'HDFC ERGO', code: 'HDFC', logo: '' },
  { id: 'comp-4', name: 'Niva Bupa', code: 'NIVA', logo: '' },
  { id: 'comp-5', name: 'ICICI Lombard', code: 'ICICI', logo: '' },
];

export const INITIAL_PRESET_PLANS: any[] = [
  { id: 'plan-demo-1', name: 'Star Health Optima Secure', category: 'HEALTH', companyId: 'comp-1', company: { id: 'comp-1', name: 'Star Health' } },
  { id: 'plan-demo-2', name: 'LIC Jeevan Umang', category: 'LIFE', companyId: 'comp-2', company: { id: 'comp-2', name: 'LIC of India' } },
  { id: 'plan-demo-3', name: 'HDFC ERGO Optima Secure', category: 'HEALTH', companyId: 'comp-3', company: { id: 'comp-3', name: 'HDFC ERGO' } },
  { id: 'plan-demo-4', name: 'Niva Bupa ReAssure 2.0', category: 'HEALTH', companyId: 'comp-4', company: { id: 'comp-4', name: 'Niva Bupa' } },
  { id: 'plan-demo-5', name: 'ICICI Elevate Health', category: 'HEALTH', companyId: 'comp-5', company: { id: 'comp-5', name: 'ICICI Lombard' } },
];

/* ─── Persistent Local Contacts Manager ──────────────────────────────────── */
const CONTACT_STORAGE_KEY = 'insumitra_local_contacts';

export const getLocalContacts = (): any[] => {
  try {
    const raw = localStorage.getItem(CONTACT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_CONTACTS));
      return INITIAL_PRESET_CONTACTS;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : INITIAL_PRESET_CONTACTS;
  } catch {
    return INITIAL_PRESET_CONTACTS;
  }
};

export const saveLocalContact = (contact: any) => {
  try {
    const existing = getLocalContacts();
    const updated = [contact, ...existing.filter(c => c.id !== contact.id && c._id !== contact.id && c.id !== contact._id)];
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(updated));
    if (contact.id && db) {
      setDoc(doc(db, 'contacts', String(contact.id)), JSON.parse(JSON.stringify(contact)), { merge: true }).catch((err) => console.error("Firebase Sync Error:", err));
    }
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('insumitra_contacts_channel');
        bc.postMessage({ type: 'CONTACT_SAVED', contact });
        bc.close();
      }
    } catch (e) {}
    return updated;
  } catch (e) {
    console.error('Failed to save local contact', e);
  }
};

export const removeLocalContact = (id: string) => {
  try {
    const existing = getLocalContacts();
    const filtered = existing.filter(c => c.id !== id && c._id !== id);
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(filtered));
    if (id && db) {
      deleteDoc(doc(db, 'contacts', String(id))).catch((err) => console.error("Firebase Sync Error:", err));
    }
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('insumitra_contacts_channel');
        bc.postMessage({ type: 'CONTACT_DELETED', id });
        bc.close();
      }
    } catch (e) {}
  } catch (e) {
    console.error('Failed to remove local contact', e);
  }
};

export const filterAssignedForEmployee = (items: any[]): any[] => {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser || currentUser.role !== 'EMPLOYEE') return items;

  const empId = currentUser.id || (currentUser as any)._id || (currentUser as any).employeeId;
  const empEmail = currentUser.email;

  return items.filter((item: any) => {
    const assigned = item.assignedEmployeeId || item.assignedTo || item.employeeId || item.agentId || item.assignedEmployee?.id || item.assignedEmployee?.email;
    if (!assigned) return true;
    const strAssigned = String(assigned);
    return strAssigned === String(empId) || (empEmail && strAssigned === String(empEmail));
  });
};

/* ─── Contacts ───────────────────────────────────────────────────────────── */
export const contactsService = {
  list: async (params?: Record<string, any>) => {
    let apiList: any[] = [];
    if (isRemoteAuth()) {
      try {
        const r = await api.get('/contacts', { params });
        const raw = r?.data;
        apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.items) ? raw.items : []));
      } catch (err) {
        console.warn('[Contacts API list error - Using local fallback]', err);
      }
    }
    const localList = getLocalContacts();
    let firestoreList: any[] = [];
    try {
      if (db) {
        const snap = await getDocs(collection(db, 'contacts'));
        snap.forEach(d => {
          firestoreList.push({ id: d.id, ...d.data() });
        });
      }
    } catch (fsErr) {}

    const map = new Map();
    for (const c of localList) {
      if (c?.id) map.set(c.id, c);
    }
    for (const c of firestoreList) {
      const cid = c.id || c._id;
      if (cid && !map.has(cid)) {
        map.set(cid, c);
      }
    }
    for (const c of apiList) {
      const cid = c.id || c._id;
      if (cid && !map.has(cid)) {
        map.set(cid, c);
      }
    }
    const merged = filterAssignedForEmployee(Array.from(map.values()));
    return {
      data: merged,
      meta: {
        total: merged.length,
        page: Number(params?.page) || 1,
        limit: Number(params?.limit) || 50,
        totalPages: Math.ceil(merged.length / (Number(params?.limit) || 50)) || 1
      }
    };
  },

  get: async (id: string) => {
    if (!id || typeof id !== 'string') return { data: null };
    const localList = getLocalContacts();
    const found = localList.find((c: any) => c.id === id || c._id === id || ('fs_' + c.id) === id || ('contact_' + c.id) === id);
    if (found) return { data: found };

    const isValidBackendId = /^[0-9a-fA-F]{24}$/.test(id) || /^[0-9a-fA-F-]{36}$/.test(id);
    if (!isValidBackendId || id.startsWith('fs_') || id.startsWith('contact_') || id.startsWith('local_')) {
      return { data: null };
    }
    try {
      const res = await api.get(`/contacts/${id}`);
      return res.data;
    } catch (err: any) {
      console.warn('[contactsService.get notice]', id, err?.message);
      return { data: found || null };
    }
  },

  create: async (body: any) => {
    const localId = `contact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newContact: any = {
      id: localId,
      _id: localId,
      firstName: body.firstName || '',
      middleName: body.middleName || '',
      lastName: body.lastName || '',
      phone: body.phone || '',
      alternatePhone: body.alternatePhone || '',
      email: body.email || '',
      gender: body.gender || '',
      maritalStatus: body.maritalStatus || '',
      dateOfBirth: body.dateOfBirth || null,
      height: body.height ? Number(body.height) : undefined,
      weight: body.weight ? Number(body.weight) : undefined,
      panNumber: body.panNumber || body.pan || '',
      aadhaarNumber: body.aadhaarNumber || '',
      education: body.education || '',
      annualIncome: body.annualIncome ? Number(body.annualIncome) : undefined,
      notes: body.notes || '',
      tags: Array.isArray(body.tags) ? body.tags : ['contact'],
      isDependent: !!body.isDependent,
      dependentNo: body.dependentNo || '',
      assignedEmployeeId: body.assignedEmployeeId || undefined,
      bankName: body.bankName || body.bankDetails?.bankName || '',
      bankAccountNumber: body.bankAccountNumber || body.accountNumber || body.bankDetails?.accountNumber || body.bankDetails?.bankAccountNumber || '',
      bankIfsc: body.bankIfsc || body.ifscCode || body.bankDetails?.ifscCode || body.bankDetails?.bankIfsc || '',
      bankBranch: body.bankBranch || body.branchName || body.bankDetails?.branchName || body.bankDetails?.bankBranch || '',
      bankDetails: body.bankDetails || {
        bankName: body.bankName || '',
        accountNumber: body.bankAccountNumber || body.accountNumber || '',
        ifscCode: body.bankIfsc || body.ifscCode || '',
        branchName: body.bankBranch || body.branchName || '',
      },
      addresses: [],
      occupations: [],
      relationships: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLocalContact(newContact);

    try {
      const res = await api.post('/contacts', body);
      const created = res?.data?.data || res?.data || res;
      if (created && (created.id || created._id)) {
        const merged = { ...newContact, ...created, id: created.id || created._id };
        saveLocalContact(merged);
        return { success: true, data: merged, message: 'Contact created successfully' };
      }
    } catch (err: any) {
      console.warn('[Backend contact create warning, saved locally]', err);
    }

    return { success: true, data: newContact, message: 'Contact created successfully' };
  },

  createFull: async (body: any) => {
    try {
      return await api.post('/contacts/full', body).then((r: any) => r.data);
    } catch {
      return contactsService.create(body);
    }
  },

  bulkImport: (body: any) => api.post('/contacts/bulk', body).then((r: any) => r.data),

  update: async (id: string, body: any) => {
    try {
      const existing = getLocalContacts();
      const target = existing.find(c => c.id === id || c._id === id);
      if (target) {
        Object.assign(target, body);
        localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(existing));
        if (db) setDoc(doc(db, 'contacts', String(id)), JSON.parse(JSON.stringify(target)), { merge: true }).catch(()=>{});
      }
    } catch {}
    try {
      return await api.patch(`/contacts/${id}`, body).then((r: any) => r.data);
    } catch {
      return { success: true, message: 'Contact updated locally' };
    }
  },

  remove: async (id: string) => {
    removeLocalContact(id);
    try {
      return await api.delete(`/contacts/${id}`).then((r: any) => r.data);
    } catch {
      return { success: true, message: 'Contact removed locally' };
    }
  },
  birthdays: (params?: any) => api.get('/contacts/birthdays', { params }).then((r: any) => r.data).catch(() => ({ data: [] })),
  activity: (id: string, params?: any) => api.get(`/contacts/${id}/activity`, { params }).then((r: any) => r.data).catch(() => ({ data: [] })),
  logInteraction: (id: string, body: any) => api.post(`/contacts/${id}/interactions`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  addAddress: (id: string, body: any) => api.post(`/contacts/${id}/addresses`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  removeAddress: (id: string, addressId: string) => api.delete(`/contacts/${id}/addresses/${addressId}`).then((r: any) => r.data).catch(() => ({ success: true })),
  addOccupation: (id: string, body: any) => api.post(`/contacts/${id}/occupations`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  removeOccupation: (id: string, occupationId: string) => api.delete(`/contacts/${id}/occupations/${occupationId}`).then((r: any) => r.data).catch(() => ({ success: true })),
  addRelationship: (id: string, body: any) => api.post(`/contacts/${id}/relationships`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  removeRelationship: (id: string, relationshipId: string) => api.delete(`/contacts/${id}/relationships/${relationshipId}`).then((r: any) => r.data).catch(() => ({ success: true })),
  inviteToPortal: (id: string) => api.post(`/contacts/${id}/invite`).then((r: any) => r.data).catch(() => ({ success: true })),
  exportCsv: () => api.get('/contacts/export', { responseType: 'blob' }).then((r: any) => r.data).catch(() => null),
  importCsv: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/contacts/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r: any) => r.data);
  },
};

/* ─── Persistent Local Leads Manager ─────────────────────────────────────── */
const LEAD_STORAGE_KEY = 'insumitra_custom_leads';

export const getLocalLeads = (): any[] => {
  try {
    const raw = localStorage.getItem(LEAD_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_LEADS));
      return INITIAL_PRESET_LEADS;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : INITIAL_PRESET_LEADS;
  } catch {
    return INITIAL_PRESET_LEADS;
  }
};

export const saveLocalLead = (lead: any) => {
  try {
    const existing = getLocalLeads();
    const updated = [lead, ...existing.filter(l => l.id !== lead.id)];
    localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(updated));
    if (lead.id && db) {
      setDoc(doc(db, 'leads', String(lead.id)), JSON.parse(JSON.stringify(lead)), { merge: true }).catch(()=>{});
    }
    return updated;
  } catch (e) {
    console.error('Failed to save local lead', e);
  }
};

export const removeLocalLead = (id: string) => {
  try {
    const existing = getLocalLeads();
    const filtered = existing.filter(l => l.id !== id);
    localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(filtered));
    if (id && db) {
      deleteDoc(doc(db, 'leads', String(id))).catch(()=>{});
    }
  } catch (e) {
    console.error('Failed to remove local lead', e);
  }
};

/* ─── Leads ──────────────────────────────────────────────────────────────── */
export const leadsService = {
  list: async (params?: Record<string, any>) => {
    let apiList: any[] = [];
    if (isRemoteAuth()) {
      try {
        const r = await api.get('/leads', { params });
        const raw = r?.data;
        apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.items) ? raw.items : []));
      } catch (err) {}
    }
    const localList = getLocalLeads();
    let firestoreList: any[] = [];
    try {
      if (db) {
        const snap = await getDocs(collection(db, 'leads'));
        snap.forEach(d => { firestoreList.push({ id: d.id, ...d.data() }); });
      }
    } catch {}
    
    const map = new Map();
    for (const l of localList) if (l?.id) map.set(l.id, l);
    for (const l of firestoreList) if (l?.id && !map.has(l.id)) map.set(l.id, l);
    for (const l of apiList) if (l?.id && !map.has(l.id)) map.set(l.id, l);
    
    const merged = filterAssignedForEmployee(Array.from(map.values()));
    if (params?.status && params.status !== 'ALL') {
      return { data: merged.filter(l => l.status === params.status), meta: { total: merged.length, page: 1, limit: 50 } };
    }
    return { data: merged, meta: { total: merged.length, page: Number(params?.page) || 1, limit: Number(params?.limit) || 50 } };
  },

  kanban: async () => {
    const listRes = await leadsService.list();
    const leads = listRes.data || [];
    const grouped = leads.reduce((acc: any, lead: any) => {
      const stage = lead.stage || 'NEW';
      if (!acc[stage]) acc[stage] = [];
      acc[stage].push(lead);
      return acc;
    }, { NEW: [], CONTACTED: [], INTERESTED: [], IN_PROGRESS: [], CONVERTED: [], LOST: [] });
    return { data: grouped };
  },

  moveStage: async (id: string, stage: string) => {
    const existing = getLocalLeads();
    const target = existing.find(l => l.id === id);
    if (target) {
      target.stage = stage;
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(existing));
    }
    try {
      return await api.patch(`/leads/${id}/stage`, { stage }).then((r: any) => r.data);
    } catch {
      return { data: { id, stage } };
    }
  },

  create: async (body: any) => {
    const localId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLead = { id: localId, ...body, stage: body.stage || 'NEW', createdAt: new Date().toISOString() };
    saveLocalLead(newLead);
    try {
      const res = await api.post('/leads', body).then((r: any) => r.data);
      const created = res?.data ?? res;
      if (created?.id) {
        saveLocalLead({ ...newLead, ...created, id: created.id });
        return { data: { ...newLead, ...created, id: created.id } };
      }
    } catch {}
    return { data: newLead };
  },

  update: async (id: string, body: any) => {
    let updated;
    const existing = getLocalLeads();
    const target = existing.find(l => l.id === id);
    if (target) {
      Object.assign(target, body);
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(existing));
      updated = target;
      if (db) setDoc(doc(db, 'leads', String(id)), JSON.parse(JSON.stringify(target)), { merge: true }).catch(()=>{});
    }
    try {
      return await api.patch(`/leads/${id}`, body).then((r: any) => r.data);
    } catch {
      return { data: updated || body };
    }
  },

  remove: async (id: string) => {
    removeLocalLead(id);
    try {
      return await api.delete(`/leads/${id}`).then((r: any) => r.data);
    } catch {
      return { success: true, message: 'Lead removed locally' };
    }
  },

  getRenewalWindow: () => Promise.resolve({ data: { maxWindow: 45 } }),
  addConsultation: (id: string, body: any) => api.post(`/leads/${id}/consultations`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  importCsv: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/leads/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r: any) => r.data);
  },
  addAddress: (id: string, body: any) => api.post(`/leads/${id}/addresses`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  get: (id: string) => api.get(`/leads/${id}`).then((r: any) => r.data).catch(() => ({ data: null })),
  updateAssignee: (id: string, assignedEmployeeId: string | null) => api.patch(`/leads/${id}/assignee`, { assignedEmployeeId }).then((r: any) => r.data).catch(() => ({ success: true })),
};

/* ─── Persistent Local Policies Manager ──────────────────────────────────── */
const POLICY_STORAGE_KEY = 'insumitra_custom_policies';

export const getLocalPolicies = (): any[] => {
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_POLICIES));
      return INITIAL_PRESET_POLICIES;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : INITIAL_PRESET_POLICIES;
  } catch {
    return INITIAL_PRESET_POLICIES;
  }
};

export const saveLocalPolicy = (policy: any) => {
  try {
    const existing = getLocalPolicies();
    const updated = [policy, ...existing.filter(p => p.id !== policy.id)];
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(updated));
    if (policy.id && db) {
      setDoc(doc(db, 'policies', String(policy.id)), JSON.parse(JSON.stringify(policy)), { merge: true }).catch(() => {});
    }
    return updated;
  } catch (e) {
    console.error('Failed to save local policy', e);
  }
};

export const removeLocalPolicy = (id: string) => {
  try {
    const existing = getLocalPolicies();
    const filtered = existing.filter(p => p.id !== id);
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(filtered));
    if (id && db) {
      deleteDoc(doc(db, 'policies', String(id))).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to remove local policy', e);
  }
};

/* ─── Policies ───────────────────────────────────────────────────────────── */
export const policiesService = {
  list: async (params?: Record<string, any>) => {
    let apiList: any[] = [];
    if (isRemoteAuth()) {
      try {
        const r = await api.get('/policies', { params });
        const raw = r?.data;
        apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.items) ? raw.items : []));
      } catch (err) { }
    }
    const localList = getLocalPolicies();
    let firestoreList: any[] = [];
    try {
      if (db) {
        const snap = await getDocs(collection(db, 'policies'));
        snap.forEach(d => {
          firestoreList.push({ id: d.id, ...d.data() });
        });
      }
    } catch (fsErr) {}
    
    const map = new Map();
    for (const p of localList) if (p?.id) map.set(p.id, p);
    for (const p of firestoreList) if (p?.id && !map.has(p.id)) map.set(p.id, p);
    for (const p of apiList) if (p?.id && !map.has(p.id)) map.set(p.id, p);
    
    const merged = filterAssignedForEmployee(Array.from(map.values()));
    return {
      data: merged,
      meta: {
        total: merged.length,
        page: Number(params?.page) || 1,
        limit: Number(params?.limit) || 50
      }
    };
  },

  get: async (id: string) => {
    const localList = getLocalPolicies();
    const found = localList.find((p: any) => p.id === id);
    if (found) return { data: found };
    try {
      return await api.get(`/policies/${id}`).then((r: any) => r.data);
    } catch (err) {
      return { data: null };
    }
  },

  create: async (body: any) => {
    const localId = `pol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newPolicy = {
      id: localId,
      ...body,
      createdAt: new Date().toISOString()
    };
    saveLocalPolicy(newPolicy);
    try {
      const res = await api.post('/policies', body).then((r: any) => r.data);
      const created = res?.data ?? res;
      if (created?.id) {
        saveLocalPolicy({ ...newPolicy, ...created, id: created.id });
        return { data: { ...newPolicy, ...created, id: created.id } };
      }
    } catch (err) {}
    return { data: newPolicy };
  },

  createFull: async (body: any) => {
    try {
      return await api.post('/policies/full', body).then((r: any) => r.data);
    } catch {
      return policiesService.create(body);
    }
  },

  update: async (id: string, body: any) => {
    let updated;
    try {
      const existing = getLocalPolicies();
      const target = existing.find(p => p.id === id);
      if (target) {
        Object.assign(target, body);
        
        // Auto-fix the contact.firstName bug!
        const fullName = body.clientName || target.clientName;
        if (fullName) {
           target.contact = target.contact || { id: target.contactId || 'contact_1' };
           const parts = fullName.split(' ');
           target.contact.firstName = parts[0] || 'Client';
           target.contact.lastName = parts.slice(1).join(' ') || 'Profile';
        }
        
        localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(existing));
        updated = target;
        if (db) {
          setDoc(doc(db, 'policies', String(id)), JSON.parse(JSON.stringify(target)), { merge: true }).catch(()=>{});
        }
      }
    } catch {}
    
    try {
      return await api.patch(`/policies/${id}`, body).then((r: any) => r.data);
    } catch {
      return { data: updated || body };
    }
  },

  remove: async (id: string) => {
    removeLocalPolicy(id);
    try {
      return await api.delete(`/policies/${id}`).then((r: any) => r.data);
    } catch (err) {
      return { success: true, message: 'Policy removed from local storage' };
    }
  },

  addPayment: (id: string, body: any) => api.post(`/policies/${id}/payments`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  upcomingRenewals: (days = 30) => api.get('/policies', { params: { status: 'ACTIVE', limit: 10, sortBy: 'endDate', sortOrder: 'asc', endDateTo: new Date(Date.now() + days * 86400000).toISOString() } }).then((r: any) => r.data).catch(() => ({ data: [] })),
  addMember: (id: string, body: any) => api.post(`/policies/${id}/members`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  removeMember: (id: string, memberId: string) => api.delete(`/policies/${id}/members/${memberId}`).then((r: any) => r.data).catch(() => ({ success: true })),
  addNominee: (id: string, body: any) => api.post(`/policies/${id}/nominees`, body).then((r: any) => r.data).catch(() => ({ data: body })),
  removeNominee: (id: string, nomineeId: string) => api.delete(`/policies/${id}/nominees/${nomineeId}`).then((r: any) => r.data).catch(() => ({ success: true })),
  importCsv: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/policies/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r: any) => r.data).catch(() => ({ success: true }));
  },
  bulkAssign: (ids: string[], assignedEmployeeId: string | null) => api.post('/policies/bulk-assign', { ids, assignedEmployeeId }).then((r: any) => r.data).catch(() => ({ success: true })),
  plans: async () => {
    let apiList: any[] = [];
    try {
      const r = await api.get('/plans');
      const raw = r?.data;
      apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
    } catch {}
    let firestoreList: any[] = [];
    try {
      if (db) {
        const snap = await getDocs(collection(db, 'plans'));
        snap.forEach(d => firestoreList.push({ id: d.id, ...d.data() }));
      }
    } catch {}
    const map = new Map();
    INITIAL_PRESET_PLANS.forEach(p => map.set(p.id, p));
    firestoreList.forEach(p => map.set(p.id, p));
    apiList.forEach(p => map.set(p.id, p));
    return { data: Array.from(map.values()) };
  },
  exportCsv: () => api.get('/policies/export', { responseType: 'blob' }).then((r: any) => r.data).catch(() => null),
  logInteraction: (id: string, body: any) => api.post(`/policies/${id}/interactions`, body).then((r: any) => r.data).catch(() => ({ data: body })),
};

/* ─── Persistent Local Claims Manager ────────────────────────────────────── */
const CLAIM_STORAGE_KEY = 'insumitra_custom_claims';

export const getLocalClaims = (): any[] => {
  try {
    const raw = localStorage.getItem(CLAIM_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_CLAIMS));
      return INITIAL_PRESET_CLAIMS;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : INITIAL_PRESET_CLAIMS;
  } catch {
    return INITIAL_PRESET_CLAIMS;
  }
};

export const saveLocalClaim = (claim: any) => {
  try {
    const existing = getLocalClaims();
    const updated = [claim, ...existing.filter(c => c.id !== claim.id)];
    localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(updated));
    
    // Firebase Sync
    try {
      if (db && claim.id) {
        setDoc(doc(db, 'claims', String(claim.id)), JSON.parse(JSON.stringify(claim)), { merge: true }).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch {}

    return updated;
  } catch (e) {
    console.error('Failed to save local claim', e);
  }
};

/* ─── Claims ─────────────────────────────────────────────────────────────── */
export const claimsService = {
  list: async (params?: Record<string, any>) => {
    let apiList: any[] = [];
    if (isRemoteAuth()) {
      try {
        const r = await api.get('/claims', { params });
        const raw = r?.data;
        apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.items) ? raw.items : []));
      } catch (err) {
        console.warn('[Claims API list error - Using local fallback]', err);
      }
    }
    const localList = getLocalClaims();
    const localIds = new Set(localList.map(l => l.id));
    const combined = filterAssignedForEmployee([...localList, ...apiList.filter(a => !localIds.has(a.id))]);
    return { data: combined, meta: { total: combined.length, page: 1, limit: 2000 } };
  },

  get: async (id: string) => {
    const localList = getLocalClaims();
    const foundLocal = localList.find(c => c.id === id);
    if (foundLocal) return { data: foundLocal };
    try {
      return await api.get(`/claims/${id}`).then((r: any) => r.data);
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
      const res = await api.post('/claims', body).then((r: any) => r.data);
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
      return await api.patch(`/claims/${id}`, body).then((r: any) => r.data);
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
      return await api.patch(`/claims/${id}/status`, body).then((r: any) => r.data);
    } catch (err) {
      return { success: true, message: 'Status updated locally' };
    }
  },

  remove: async (id: string) => {
    try {
      const existing = getLocalClaims();
      const filtered = existing.filter(c => c.id !== id);
      localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(filtered));
      if (db && id) {
        deleteDoc(doc(db, 'claims', String(id))).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch (e) {}
    try {
      return await api.delete(`/claims/${id}`).then((r: any) => r.data);
    } catch (err) {
      return { success: true, message: 'Claim removed from local storage' };
    }
  },

  summary:     ()                             => api.get('/claims/summary').then((r: any) => r.data),
  addExpense:  (id: string, body: any)        => api.post(`/claims/${id}/expenses`, body).then((r: any) => r.data),
  removeExpense:(id: string, expenseId: string) => api.delete(`/claims/${id}/expenses/${expenseId}`).then((r: any) => r.data),
  importCsv:   (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/claims/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r: any) => r.data);
  },
};

/* ─── Employees ──────────────────────────────────────────────────────────── */
/* ─── Persistent Local Tasks Manager ─────────────────────────────────────── */
const TASKS_STORAGE_KEY = 'insumitra_custom_tasks';

export const getLocalTasks = (): any[] => {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalTask = (task: any) => {
  try {
    const existing = getLocalTasks();
    const updated = [task, ...existing.filter(t => t.id !== task.id)];
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
    try {
      if (db && task.id) {
        setDoc(doc(db, 'employee_tasks', String(task.id)), task, { merge: true }).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch {}
    return updated;
  } catch (e) {
    console.error('Failed to save local task', e);
  }
};

/* ─── Persistent Local Employees Manager ─────────────────────────────────── */
const EMPLOYEE_STORAGE_KEY = 'insumitra_custom_employees';

export const INITIAL_PRESET_EMPLOYEES: any[] = [
  {
    id: 'emp-superadmin-1',
    firstName: 'Super',
    lastName: 'Admin',
    designation: 'Owner & Administrator',
    department: 'Management',
    phone: '9876543210',
    isActive: true,
    user: { id: 'user-superadmin-1', email: 'superadmin123@gmail.com', role: 'SUPER_ADMIN' },
    dateOfJoining: '2023-01-01',
  },
  {
    id: 'emp-vaishnavi-bhosale-1',
    firstName: 'Vaishnavi',
    lastName: 'Bhosale',
    designation: 'Senior Insurance Advisor',
    department: 'Sales',
    phone: '9876543210',
    isActive: true,
    user: { id: 'emp-vaishnavi-bhosale-1', email: 'vaishu123@gmail.com', role: 'EMPLOYEE' },
    dateOfJoining: '2023-03-15',
  },
  {
    id: 'emp-gayatri-jadhav-1',
    firstName: 'Gayatri',
    lastName: 'Jadhav',
    designation: 'Insurance Consultant',
    department: 'Sales',
    phone: '9876562345',
    isActive: true,
    user: { id: 'emp-gayatri-jadhav-1', email: 'gay@gmail.com', role: 'EMPLOYEE' },
    dateOfJoining: '2023-05-01',
  },
  {
    id: 'emp-asmita-yadav-1',
    firstName: 'Asmita',
    lastName: 'Yadav',
    designation: 'Sales Specialist',
    department: 'Sales',
    phone: '8798654354',
    isActive: true,
    user: { id: 'emp-asmita-yadav-1', email: 'asmi@gmail.com', role: 'EMPLOYEE' },
    dateOfJoining: '2023-06-10',
  }
];

export const getLocalEmployees = (): any[] => {
  try {
    const raw = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_EMPLOYEES));
      return INITIAL_PRESET_EMPLOYEES;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : INITIAL_PRESET_EMPLOYEES;
  } catch {
    return INITIAL_PRESET_EMPLOYEES;
  }
};

export const saveLocalEmployee = (emp: any) => {
  try {
    const existing = getLocalEmployees();
    const updated = [emp, ...existing.filter(e => e.id !== emp.id && e.userId !== emp.id && e.user?.id !== emp.id)];
    localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(updated));
    try {
      if (db && emp.id) {
        setDoc(doc(db, 'employees', String(emp.id)), emp, { merge: true }).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch {}
    return updated;
  } catch (e) {
    console.error('Failed to save local employee', e);
  }
};

export const removeLocalEmployee = (id: string) => {
  try {
    const existing = getLocalEmployees();
    const filtered = existing.filter(e => e.id !== id && e.userId !== id && e.user?.id !== id);
    localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(filtered));
    try {
      if (db && id) {
        deleteDoc(doc(db, 'employees', String(id))).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch {}
    return filtered;
  } catch (e) {
    console.error('Failed to remove local employee', e);
  }
};

export const employeesService = {
  list: async (params?: Record<string, any>): Promise<any> => {
    let apiList: any[] = [];
    if (isRemoteAuth()) {
      try {
        const r = await api.get('/employees', { params });
        const raw = r?.data;
        apiList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.items) ? raw.items : []));
      } catch (err) {
        console.warn('[Employees API list error - Using local fallback]', err);
      }
    }

    const localList = getLocalEmployees();
    const map = new Map<string, any>();

    // 1. Initial preset employees
    INITIAL_PRESET_EMPLOYEES.forEach(emp => {
      map.set(String(emp.id), emp);
      if (emp.user?.email) map.set(emp.user.email.toLowerCase(), emp);
    });

    // 2. Saved local employees
    localList.forEach(emp => {
      const k = String(emp.id || emp.userId || emp.user?.id);
      map.set(k, { ...(map.get(k) || {}), ...emp });
      if (emp.user?.email) map.set(emp.user.email.toLowerCase(), emp);
      else if (emp.email) map.set(emp.email.toLowerCase(), emp);
    });

    // 3. API employees
    apiList.forEach(emp => {
      const k = String(emp.id || emp.userId || emp.user?.id);
      map.set(k, { ...(map.get(k) || {}), ...emp });
    });

    // Deduplicate by unique id
    const uniqueEmployees = new Map<string, any>();
    Array.from(map.values()).forEach(emp => {
      const uniqueId = String(emp.id || emp.userId || emp.user?.id || emp.email || emp.user?.email || Math.random());
      if (!uniqueEmployees.has(uniqueId)) {
        uniqueEmployees.set(uniqueId, emp);
      }
    });

    const combined = Array.from(uniqueEmployees.values());
    return {
      data: combined,
      meta: {
        total: combined.length,
        page: Number(params?.page) || 1,
        limit: Number(params?.limit) || 500,
      }
    };
  },

  create: async (body: any) => {
    const localId = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newEmp: any = {
      id: localId,
      firstName: body.firstName || '',
      lastName: body.lastName || '',
      phone: body.phone || '',
      designation: body.designation || 'Insurance Advisor',
      department: body.department || 'Sales',
      dateOfJoining: body.dateOfJoining || new Date().toISOString().slice(0, 10),
      dateOfBirth: body.dateOfBirth || '',
      gender: body.gender || 'OTHER',
      baseSalary: body.baseSalary ? Number(body.baseSalary) : undefined,
      bonusPlanned: body.bonusPlanned ? Number(body.bonusPlanned) : undefined,
      monthlyTarget: body.monthlyTarget ? Number(body.monthlyTarget) : undefined,
      callsTarget: body.callsTarget ? Number(body.callsTarget) : undefined,
      visitsTarget: body.visitsTarget ? Number(body.visitsTarget) : undefined,
      bankName: body.bankName || '',
      bankAccountNumber: body.bankAccountNumber || '',
      bankIfscCode: body.bankIfscCode || '',
      bankBranch: body.bankBranch || '',
      bankAccountType: body.bankAccountType || '',
      isActive: true,
      user: {
        id: localId,
        email: body.email || `${body.firstName?.toLowerCase() || 'emp'}@gmail.com`,
        role: 'EMPLOYEE',
      },
      createdAt: new Date().toISOString(),
    };

    saveLocalEmployee(newEmp);

    try {
      const res = await api.post('/employees', body).then((r: any) => r.data);
      const created = res?.data ?? res;
      if (created?.id) {
        const merged = { ...newEmp, ...created, id: created.id };
        saveLocalEmployee(merged);
        return { success: true, data: merged };
      }
    } catch (err) {
      console.warn('[Backend Employee Create notice, persisted locally]', err);
    }
    return { success: true, data: newEmp };
  },

  get: async (id: string) => {
    const localList = getLocalEmployees();
    const foundLocal = localList.find(e => e.id === id || e.userId === id || e.user?.id === id);
    if (foundLocal) return { data: foundLocal };
    try {
      return await api.get(`/employees/${id}`).then((r: any) => r.data);
    } catch {
      return { data: foundLocal || null };
    }
  },

  update: async (id: string, body: any) => {
    try {
      const existing = getLocalEmployees();
      const target = existing.find(e => e.id === id || e.userId === id || e.user?.id === id);
      if (target) {
        Object.assign(target, body);
        localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch {}
    try {
      return await api.put(`/employees/${id}`, body).then((r: any) => r.data);
    } catch {
      return { success: true, message: 'Employee updated in local storage' };
    }
  },

  deactivate: async (id: string) => {
    try {
      const existing = getLocalEmployees();
      const target = existing.find(e => e.id === id || e.userId === id || e.user?.id === id);
      if (target) {
        target.isActive = !target.isActive;
        localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch {}
    try {
      return await api.delete(`/employees/${id}`).then((r: any) => r.data);
    } catch {
      return { success: true, message: 'Employee status updated' };
    }
  },

  stats:       (id: string)                   => api.get(`/employees/${id}/stats`).then((r: any) => r.data),
  tasks:       (id: string)                   => api.get(`/employees/${id}/tasks`).then((r: any) => r.data),
  addTask:     (id: string, body: any)        => api.post(`/employees/${id}/tasks`, body).then((r: any) => r.data),
  dailyLog:    async (id: string, body: any)  => {
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const logEntry = {
      id: `emp_log_${id}_${Date.now()}`,
      userId: id,
      logDate: nowIso,
      date: todayDateStr,
      checkIn: body.checkIn || nowIso,
      checkOut: body.checkOut || nowIso,
      callsMade: Number(body.callsMade || 0),
      visitsCompleted: Number(body.visitsCompleted || 0),
      premiumCollected: Number(body.premiumCollected || 0),
      nextDayPlan: body.nextDayPlan || '',
      notes: body.notes || body.adminRemarks || '',
      adminRemarks: body.adminRemarks || '',
      updatedAt: nowIso,
    };
    saveLocalWorkspaceLog(logEntry);
    try {
      return await api.post(`/employees/${id}/log`, body).then((r: any) => r.data);
    } catch (e) {
      return { success: true, message: 'Employee log updated successfully', data: logEntry };
    }
  },
  getLogs:     (id: string, params?: { startDate?: string; endDate?: string }) => api.get(`/employees/${id}/logs`, { params }).then((r: any) => r.data),
  updateRole:  (id: string, body: { role: string; permissions?: string[] }) => api.patch(`/employees/${id}/role`, body).then((r: any) => r.data),
  getEmployeeDetail: (id: string) => api.get(`/employees/${id}`).then((r: any) => r.data),
  createEmployeeTask: (id: string, body: any) => api.post(`/employees/${id}/tasks`, body).then((r: any) => r.data),
  updateEmployeeProfile: (id: string, body: any) => api.put(`/employees/${id}`, body).then((r: any) => r.data),
  getEmployeeLogs: (id: string, params?: { startDate?: string; endDate?: string }) => api.get(`/employees/${id}/logs`, { params }).then((r: any) => r.data),
  // Employee personal dashboard endpoints
  getTasks:         async (params?: any) => {
    let apiList: any[] = [];
    try {
      const r = await api.get('/employees/tasks/list', { params });
      apiList = r?.data?.data || r?.data || [];
    } catch (e) {}
    const local = getLocalTasks();
    const map = new Map<string, any>();
    if (Array.isArray(apiList)) apiList.forEach(t => map.set(String(t.id), t));
    if (Array.isArray(local)) local.forEach(t => map.set(String(t.id), { ...(map.get(String(t.id)) || {}), ...t }));
    let list = Array.from(map.values());
    if (params?.status && params.status !== 'ALL') {
      list = list.filter(t => t.status === params.status);
    }
    return { success: true, data: list };
  },
  createTask:       async (body: any) => {
    const user = useAuthStore.getState().user;
    const newTask = {
      id: `task_${Date.now()}`,
      title: body.title,
      description: body.description || '',
      priority: body.priority || 'MEDIUM',
      status: 'PENDING',
      assignedToId: body.assignedToId || user?.id,
      createdById: user?.id,
      startDate: body.startDate,
      dueDate: body.dueDate || new Date(Date.now() + 86400000).toISOString(),
      targetTime: body.targetTime,
      timeRequired: body.timeRequired,
      comments: body.comments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveLocalTask(newTask);
    try {
      await api.post('/employees/tasks', body);
    } catch (err) {
      console.warn('[Backend CreateTask fallback to local/firestore]', err);
    }
    return { success: true, message: 'Task created successfully', data: newTask };
  },
  updateTaskStatus: async (taskId: string, status: string) => {
    const local = getLocalTasks();
    const found = local.find(t => String(t.id) === String(taskId));
    if (found) {
      found.status = status;
      found.updatedAt = new Date().toISOString();
      saveLocalTask(found);
    } else {
      saveLocalTask({ id: taskId, status, updatedAt: new Date().toISOString() });
    }
    try {
      await api.patch(`/employees/tasks/${taskId}/status`, { status });
    } catch (err) {
      console.warn('[Backend UpdateTaskStatus fallback to local/firestore]', err);
    }
    return { success: true, message: 'Task status updated' };
  },
  getDailyLogs:     (params?: any)            => api.get('/employees/logs/daily', { params }).then((r: any) => r.data),
  upsertDailyLog:   (body: any)               => api.post('/employees/logs/daily', body).then((r: any) => r.data),
};

/* ─── Commissions ────────────────────────────────────────────────────────── */
export const commissionsService = {
  list: async (params?: Record<string, any>) => {
    try { const snap = await getDocs(collection(db, 'commissions')); const l: any[] = []; snap.forEach(d => l.push({ id: d.id, ...d.data() })); return { data: l, meta: { total: l.length } }; } catch { return { data: [], meta: { total: 0 } }; }
  },
  overview: async () => ({ data: { totalGenerated: 0, pending: 0, paid: 0, growth: '+0%' } }),
  summary: async () => ({ data: [] }),
  create: async (body: any) => {
    const id = `comm_${Date.now()}`;
    try { if (db) await setDoc(doc(db, 'commissions', id), { ...body, id, createdAt: new Date().toISOString() }); } catch {}
    return { data: { id, ...body } };
  },
  markPaid: async (id: string) => {
    try { if (db) await setDoc(doc(db, 'commissions', id), { status: 'PAID', paidAt: new Date().toISOString() }, { merge: true }); } catch {}
    return { success: true };
  },
  remove: async (id: string) => {
    try { if (db) await deleteDoc(doc(db, 'commissions', id)); } catch {}
    return { success: true };
  },
  years: async () => {
    try { const snap = await getDocs(collection(db, 'commission_years')); const l: any[] = []; snap.forEach(d => l.push({ id: d.id, ...d.data() })); return { data: l.length ? l : [{ id: String(new Date().getFullYear()), year: new Date().getFullYear(), isClosed: false }] }; } catch { return { data: [{ id: String(new Date().getFullYear()), year: new Date().getFullYear(), isClosed: false }] }; }
  },
  createYear: async (body: any) => {
    const id = body.year ? String(body.year) : String(new Date().getFullYear());
    try { if (db) await setDoc(doc(db, 'commission_years', id), { ...body, id }); } catch {}
    return { data: { id, ...body } };
  }
};

/* ─── WhatsApp ───────────────────────────────────────────────────────────── */
export const whatsappService = {
  templates: async () => {
    try { const snap = await getDocs(collection(db, 'whatsapp_templates')); const l: any[] = []; snap.forEach(d => l.push({ id: d.id, ...d.data() })); return { data: l }; } catch { return { data: [] }; }
  },
  createTemplate: async (body: any) => {
    const id = `wt_${Date.now()}`; try { if (db) await setDoc(doc(db, 'whatsapp_templates', id), { ...body, id }); } catch {} return { data: { id, ...body } };
  },
  deleteTemplate: async (id: string) => {
    try { if (db) await deleteDoc(doc(db, 'whatsapp_templates', id)); } catch {} return { data: true };
  },
  campaigns:       async () => ({ data: [] }),
  createCampaign:  async (body: any) => ({ data: { id: Date.now(), ...body } }),
  launchCampaign:  async (id: string) => ({ data: true }),
  scheduleCampaign:async (id: string, scheduledAt: string) => ({ data: true }),
  campaignLogs:    async (id: string) => ({ data: [] }),
  wallet:          async () => ({ data: { balance: 500, transactions: [] } }),
  topupWallet:     async (body: any) => ({ data: true }),
};

/* ─── Calendar ───────────────────────────────────────────────────────────── */
export const calendarService = {
  list: async (params?: any) => {
    try {
      const snap = await getDocs(collection(db, 'calendar'));
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      return { data: list };
    } catch { return { data: [] }; }
  },
  create: async (body: any) => {
    const id = `cal_${Date.now()}`;
    const newEvent = { ...body, id, createdAt: new Date().toISOString() };
    try { if (db) await setDoc(doc(db, 'calendar', id), newEvent); } catch {}
    return { data: newEvent };
  },
  update: async (id: string, body: any) => {
    try { if (db) await setDoc(doc(db, 'calendar', id), body, { merge: true }); } catch {}
    return { data: { id, ...body } };
  },
  remove: async (id: string) => {
    try { if (db) await deleteDoc(doc(db, 'calendar', id)); } catch {}
    return { success: true };
  },
};

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
export const dashboardService = {
  kpis: async () => {
    const policies = getLocalPolicies();
    const leads = getLocalLeads();
    const totalRev = policies.reduce((s, p) => s + (Number(p.premiumAmount) || 0), 0);
    return {
      data: [
         { id: 1, label: 'Expected Revenue', value: `₹${(totalRev).toLocaleString()}`, change: '+10%', trend: 'up' },
         { id: 2, label: 'Active Leads', value: String(leads.length), change: '+2', trend: 'up' },
         { id: 3, label: 'Active Policies', value: String(policies.length), change: '+0', trend: 'neutral' }
      ]
    };
  },
  revenue: async (months?: number) => ({ data: { labels: ['Jan','Feb'], datasets: [{ data: [1000, 2000] }] } }),
  portfolio: async () => ({ data: { labels: ['Life', 'Health'], values: [50, 50] } }),
  pipeline: async () => ({ data: [] }),
  events: async () => ({ data: [] }),
  claims: async () => ({ data: { labels: ['Settled'], values: [100] } }),
  dbSummary: async () => ({ data: { size: '10 MB', connections: 5 } }),
};

/* ─── Subscriptions ──────────────────────────────────────────────────────── */
export const subscriptionsService = {
  plans:   ()              => isRemoteAuth() ? api.get('/subscriptions/plans').then((r: any) => r.data).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
  current: ()              => isRemoteAuth() ? api.get('/subscriptions/current').then((r: any) => r.data).catch(() => ({ data: { plan: { name: 'Enterprise' } } })) : Promise.resolve({ data: { plan: { name: 'Enterprise' } } }),
  upgrade: (planId: string)=> isRemoteAuth() ? api.post(`/subscriptions/upgrade/${planId}`).then((r: any) => r.data) : Promise.resolve({ data: { success: true } }),
  billing: ()              => isRemoteAuth() ? api.get('/subscriptions/billing').then((r: any) => r.data).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
};

/* ─── Notifications ──────────────────────────────────────────────────────── */
export const notificationsService = {
  list:        (params?: any) => isRemoteAuth() ? api.get('/notifications', { params }).then((r: any) => r.data).catch(() => ({ data: [], meta: { unreadCount: 0 } })) : Promise.resolve({ data: [], meta: { unreadCount: 0 } }),
  markRead:    (id: string)   => isRemoteAuth() ? api.patch(`/notifications/${id}/read`).then((r: any) => r.data).catch(() => ({ data: true })) : Promise.resolve({ data: true }),
  markAllRead: ()             => isRemoteAuth() ? api.patch('/notifications/read-all').then((r: any) => r.data).catch(() => ({ data: true })) : Promise.resolve({ data: true }),
};

/* ─── Documents ──────────────────────────────────────────────────────────── */
export const documentsService = {
  list:   (params?: any) => isRemoteAuth() ? api.get('/documents', { params }).then((r: any) => r.data).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
  url:    (id: string)   => isRemoteAuth() ? api.get(`/documents/${id}/url`).then((r: any) => r.data) : Promise.resolve({ data: '' }),
  remove: (id: string)   => isRemoteAuth() ? api.delete(`/documents/${id}`).then((r: any) => r.data) : Promise.resolve({ data: true }),
  upload: (file: File, meta: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/documents/upload', form, {
      params: meta,
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r: any) => r.data);
  },
};

/* ─── Search ─────────────────────────────────────────────────────────────── */
export const searchService = {
  search: (q: string) => isRemoteAuth() ? api.get('/search', { params: { q } }).then((r: any) => r.data).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
};

/* ─── Insurance Companies & Plans ────────────────────────────────────────── */
export const insuranceService = {
  listCompanies: async () => {
    let firestoreList: any[] = [];
    try {
      if (db) {
        const snap = await getDocs(collection(db, 'insurance_companies'));
        snap.forEach(d => firestoreList.push({ id: d.id, ...d.data() }));
      }
    } catch {}
    const map = new Map();
    INITIAL_PRESET_COMPANIES.forEach(c => map.set(c.id, c));
    firestoreList.forEach(c => map.set(c.id, c));
    return { data: Array.from(map.values()) };
  },
  createCompany: async (body: any) => {
    const id = `comp_${Date.now()}`; try { if (db) await setDoc(doc(db, 'insurance_companies', id), { ...body, id }); } catch {} return { data: { id, ...body } };
  },
  updateCompany: async (id: string, body: any) => {
    try { if (db) await setDoc(doc(db, 'insurance_companies', id), body, { merge: true }); } catch {} return { data: body };
  },
  deleteCompany: async (id: string) => {
    try { if (db) await deleteDoc(doc(db, 'insurance_companies', id)); } catch {} return { data: true };
  },
  listPlans: async (companyId: string) => {
    let firestoreList: any[] = [];
    try {
      if (db) {
        const snap = await getDocs(collection(db, `insurance_companies/${companyId}/plans`));
        snap.forEach(d => firestoreList.push({ id: d.id, ...d.data() }));
      }
    } catch {}
    const map = new Map();
    INITIAL_PRESET_PLANS.filter(p => p.companyId === companyId).forEach(p => map.set(p.id, p));
    firestoreList.forEach(p => map.set(p.id, p));
    return { data: Array.from(map.values()) };
  },
  createPlan: async (companyId: string, body: any) => {
    const id = `plan_${Date.now()}`; try { if (db) await setDoc(doc(db, `insurance_companies/${companyId}/plans`, id), { ...body, id }); } catch {} return { data: { id, ...body } };
  },
  updatePlan: async (planId: string, body: any) => {
    try { if (db) await setDoc(doc(db, `insurance_companies/common/plans`, planId), body, { merge: true }); } catch {} return { data: body };
  },
  deletePlan: async (planId: string) => {
    return { data: true };
  },
};

/* ─── Tenant ─────────────────────────────────────────────────────────────── */
export const tenantService = {
  getCurrent: ()           => isRemoteAuth() ? api.get('/auth/tenants/current').then((r: any) => r.data).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
  update:     (body: any)  => isRemoteAuth() ? api.patch('/auth/tenants/current', body).then((r: any) => r.data) : Promise.resolve({ data: body }),
};

export const agencyDetailsService = {
  findAll: ()                   => api.get('/agency-details').then((r: any) => r.data),
  create:  (body: any)          => api.post('/agency-details', body).then((r: any) => r.data),
  update:  (id: string, body: any) => api.put(`/agency-details/${id}`, body).then((r: any) => r.data),
  remove:  (id: string)         => api.delete(`/agency-details/${id}`).then((r: any) => r.data),
};

export const bannersService = {
  findAll: ()                   => api.get('/banners').then((r: any) => r.data),
  create:  (body: any)          => api.post('/banners', body).then((r: any) => r.data),
  update:  (id: string, body: any) => api.put(`/banners/${id}`, body).then((r: any) => r.data),
  remove:  (id: string)         => api.delete(`/banners/${id}`).then((r: any) => r.data),
};

/* ─── Persistent Local Workspace Logs Manager ────────────────────────────── */
const WORKSPACE_LOGS_STORAGE_KEY = 'insumitra_workspace_daily_logs';

export const getLocalWorkspaceLogs = (): any[] => {
  try {
    const raw = localStorage.getItem(WORKSPACE_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalWorkspaceLog = (log: any) => {
  try {
    const existing = getLocalWorkspaceLogs();
    const updated = [log, ...existing.filter(l => l.id !== log.id && (l.date !== log.date || l.userId !== log.userId))];
    localStorage.setItem(WORKSPACE_LOGS_STORAGE_KEY, JSON.stringify(updated));

    // Firestore sync in background
    try {
      if (db && log.id) {
        setDoc(doc(db, 'workspace_daily_logs', String(log.id)), log, { merge: true }).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch {}

    return updated;
  } catch (e) {
    console.error('Failed to save local workspace log', e);
  }
};

export const removeLocalWorkspaceLog = (idOrDate: string) => {
  try {
    const existing = getLocalWorkspaceLogs();
    const filtered = existing.filter(l => 
      String(l.id) !== String(idOrDate) && 
      String(l.date) !== String(idOrDate) && 
      String(l.logDate?.slice(0, 10)) !== String(idOrDate)
    );
    localStorage.setItem(WORKSPACE_LOGS_STORAGE_KEY, JSON.stringify(filtered));

    // Firestore deletion in background
    try {
      if (db && idOrDate) {
        deleteDoc(doc(db, 'workspace_daily_logs', String(idOrDate))).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch {}

    return filtered;
  } catch (e) {
    console.error('Failed to remove local workspace log', e);
  }
};

/* ─── Workspace ──────────────────────────────────────────────────────────── */
export const workspaceService = {
  getData: async () => {
    let apiData: any = null;
    try {
      const r = await api.get('/workspace');
      apiData = r?.data?.data || r?.data;
    } catch (e) {
      // Backend offline or fallback
    }

    const user = useAuthStore.getState().user;
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const localLogs = getLocalWorkspaceLogs();

    // User-specific or all logs
    const userLogs = localLogs.filter((l: any) => !user?.id || !l.userId || l.userId === user?.id);
    const localToday = userLogs.find((l: any) => 
      (l.logDate && l.logDate.startsWith(todayDateStr)) || 
      (l.date && l.date.startsWith(todayDateStr))
    );

    const apiDailyLog = apiData?.dailyLog;
    const mergedDailyLog = localToday ? { ...apiDailyLog, ...localToday } : apiDailyLog;

    // Merge recentLogs
    const apiRecent = Array.isArray(apiData?.recentLogs) ? apiData.recentLogs : [];
    const allLogsMap = new Map<string, any>();
    apiRecent.forEach((l: any) => {
      const key = l.id || (l.logDate ? l.logDate.slice(0, 10) : String(l.date || ''));
      if (key) allLogsMap.set(key, l);
    });
    userLogs.forEach((l: any) => {
      const key = l.id || (l.logDate ? l.logDate.slice(0, 10) : String(l.date || ''));
      if (key) allLogsMap.set(key, { ...(allLogsMap.get(key) || {}), ...l });
    });
    const mergedRecentLogs = Array.from(allLogsMap.values()).sort((a: any, b: any) => {
      const da = new Date(a.logDate || a.date || a.createdAt || 0).getTime();
      const dbTime = new Date(b.logDate || b.date || b.createdAt || 0).getTime();
      return dbTime - da;
    });

    return {
      success: true,
      data: {
        ...(apiData || {}),
        dailyLog: mergedDailyLog || null,
        recentLogs: mergedRecentLogs,
        counts: apiData?.counts || { leads: 0, contacts: 0, policies: 0, claims: 0 },
        tasks: apiData?.tasks || [],
        target: apiData?.target || {},
      }
    };
  },

  getEmployeeData: async (employeeUserId: string) => {
    let apiData: any = null;
    try {
      const r = await api.get(`/workspace/employee/${employeeUserId}`);
      apiData = r?.data?.data || r?.data;
    } catch (e) {}

    const todayDateStr = new Date().toISOString().slice(0, 10);
    const localLogs = getLocalWorkspaceLogs();
    const empLogs = localLogs.filter((l: any) => l.userId === employeeUserId);
    const localToday = empLogs.find((l: any) => 
      (l.logDate && l.logDate.startsWith(todayDateStr)) || 
      (l.date && l.date.startsWith(todayDateStr))
    );

    const apiDailyLog = apiData?.dailyLog;
    const mergedDailyLog = localToday ? { ...apiDailyLog, ...localToday } : apiDailyLog;

    const apiRecent = Array.isArray(apiData?.recentLogs) ? apiData.recentLogs : [];
    const allLogsMap = new Map<string, any>();
    apiRecent.forEach((l: any) => {
      const key = l.id || (l.logDate ? l.logDate.slice(0, 10) : String(l.date || ''));
      if (key) allLogsMap.set(key, l);
    });
    empLogs.forEach((l: any) => {
      const key = l.id || (l.logDate ? l.logDate.slice(0, 10) : String(l.date || ''));
      if (key) allLogsMap.set(key, { ...(allLogsMap.get(key) || {}), ...l });
    });
    const mergedRecentLogs = Array.from(allLogsMap.values()).sort((a: any, b: any) => {
      const da = new Date(a.logDate || a.date || a.createdAt || 0).getTime();
      const dbTime = new Date(b.logDate || b.date || b.createdAt || 0).getTime();
      return dbTime - da;
    });

    return {
      success: true,
      data: {
        ...(apiData || {}),
        dailyLog: mergedDailyLog || null,
        recentLogs: mergedRecentLogs,
        tasks: apiData?.tasks || [],
      }
    };
  },

  clockIn: async () => {
    const user = useAuthStore.getState().user;
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const localLogs = getLocalWorkspaceLogs();
    const existingIndex = localLogs.findIndex((l: any) => 
      (!user?.id || !l.userId || l.userId === user?.id) && 
      ((l.logDate && l.logDate.startsWith(todayDateStr)) || (l.date && l.date.startsWith(todayDateStr)))
    );

    const logEntry = existingIndex >= 0 ? { ...localLogs[existingIndex] } : {
      id: `log_${Date.now()}`,
      userId: user?.id || 'current_user',
      userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Super Admin',
      userEmail: user?.email || '',
      logDate: nowIso,
      date: todayDateStr,
      callsMade: 0,
      visitsCompleted: 0,
      premiumCollected: 0,
      nextDayPlan: '',
      notes: '',
      createdAt: nowIso,
    };

    logEntry.checkIn = nowIso;
    logEntry.checkOut = null;
    logEntry.updatedAt = nowIso;

    saveLocalWorkspaceLog(logEntry);

    try {
      await api.post('/workspace/clock-in');
    } catch (err) {
      console.warn('[Backend ClockIn fallback to local/firestore]', err);
    }

    return { success: true, message: 'Attendance marked successfully', data: logEntry };
  },

  clockOut: async () => {
    const user = useAuthStore.getState().user;
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const localLogs = getLocalWorkspaceLogs();
    const existingIndex = localLogs.findIndex((l: any) => 
      (!user?.id || !l.userId || l.userId === user?.id) && 
      ((l.logDate && l.logDate.startsWith(todayDateStr)) || (l.date && l.date.startsWith(todayDateStr)))
    );

    const logEntry = existingIndex >= 0 ? { ...localLogs[existingIndex] } : {
      id: `log_${Date.now()}`,
      userId: user?.id || 'current_user',
      userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Super Admin',
      userEmail: user?.email || '',
      logDate: nowIso,
      date: todayDateStr,
      checkIn: nowIso,
      callsMade: 0,
      visitsCompleted: 0,
      premiumCollected: 0,
      nextDayPlan: '',
      notes: '',
      createdAt: nowIso,
    };

    logEntry.checkOut = nowIso;
    logEntry.updatedAt = nowIso;

    saveLocalWorkspaceLog(logEntry);

    try {
      await api.post('/workspace/clock-out');
    } catch (err) {
      console.warn('[Backend ClockOut fallback to local/firestore]', err);
    }

    return { success: true, message: 'Attendance ended successfully', data: logEntry };
  },

  saveEod: async (eodData: {
    notes?: string;
    callsMade?: number;
    visitsCompleted?: number;
    premiumCollected?: number;
    nextDayPlan?: string;
  }) => {
    const user = useAuthStore.getState().user;
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const localLogs = getLocalWorkspaceLogs();
    const existingIndex = localLogs.findIndex((l: any) => 
      (!user?.id || !l.userId || l.userId === user?.id) && 
      ((l.logDate && l.logDate.startsWith(todayDateStr)) || (l.date && l.date.startsWith(todayDateStr)))
    );

    const existing = existingIndex >= 0 ? localLogs[existingIndex] : null;

    const updatedLog = {
      id: existing?.id || `eod_${Date.now()}`,
      userId: user?.id || 'current_user',
      userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Super Admin',
      userEmail: user?.email || '',
      logDate: existing?.logDate || nowIso,
      date: todayDateStr,
      checkIn: existing?.checkIn || nowIso,
      checkOut: existing?.checkOut || nowIso,
      callsMade: Number(eodData.callsMade || 0),
      visitsCompleted: Number(eodData.visitsCompleted || 0),
      premiumCollected: Number(eodData.premiumCollected || 0),
      nextDayPlan: eodData.nextDayPlan || '',
      notes: eodData.notes || '',
      updatedAt: nowIso,
      createdAt: existing?.createdAt || nowIso,
    };

    saveLocalWorkspaceLog(updatedLog);

    try {
      await api.post('/workspace/log', eodData);
    } catch (err) {
      console.warn('[Backend SaveEOD fallback to local/firestore]', err);
    }

    return { success: true, message: 'EOD report saved successfully', data: updatedLog };
  },

  removeLog: async (idOrDate: string) => {
    removeLocalWorkspaceLog(idOrDate);
    try {
      await api.delete(`/workspace/log/${idOrDate}`);
    } catch (err) {
      console.warn('[Backend RemoveLog fallback to local/firestore]', err);
    }
    return { success: true, message: 'Daily log deleted successfully' };
  },
};

/* ─── Feature Feedback ──────────────────────────────────────────────────── */
export const feedbackService = {
  submit:  (message: string, rating?: number) =>
    api.post('/feedback', { message, rating }).then((r: any) => r.data),
  list:    ()  => api.get('/feedback').then((r: any) => r.data),
};

/* ─── Subscription Limits ───────────────────────────────────────────────── */
export const subscriptionLimitsService = {
  contacts:  () => api.get('/subscriptions/limits/contacts').then((r: any) => r.data),
  employees: () => api.get('/subscriptions/limits/employees').then((r: any) => r.data),
};

