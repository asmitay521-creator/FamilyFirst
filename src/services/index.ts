import api from './api';
import { useAuthStore } from '@store/auth.store';
import { db, createFirebaseUserWithoutSignout } from './firebase';
import { doc, setDoc, deleteDoc, getDoc, getDocs, collection } from 'firebase/firestore';

export const isRemoteAuth = (): boolean => {
  const token = useAuthStore.getState().accessToken;
  return Boolean(token && !token.startsWith('auth-token-') && !token.startsWith('demo-'));
};

/* ─── Initial Preset Seed Datasets (Clean Initial State) ─────────────────── */
export const INITIAL_PRESET_CONTACTS: any[] = [];
export const INITIAL_PRESET_LEADS: any[] = [];
export const INITIAL_PRESET_POLICIES: any[] = [];
export const INITIAL_PRESET_CLAIMS: any[] = [];

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
      localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
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

  const empId = String(currentUser.id || (currentUser as any)._id || (currentUser as any).employeeId || '').toLowerCase().trim();
  const empEmail = String(currentUser.email || '').toLowerCase().trim();
  const empFirst = String(currentUser.firstName || '').toLowerCase().trim();
  const empLast = String(currentUser.lastName || '').toLowerCase().trim();
  const empFullName = `${empFirst} ${empLast}`.trim();

  return items.filter((item: any) => {
    if (!item) return false;

    // Check directly assigned IDs
    const assignedId = String(
      item.assignedEmployeeId ||
      item.assignedTo ||
      item.employeeId ||
      item.agentId ||
      item.assignedEmployee?.id ||
      item.assignedEmployee?.userId ||
      item.assignedEmployee?._id ||
      ''
    ).toLowerCase().trim();

    const assignedEmail = String(
      item.assignedEmployee?.email ||
      item.assignedEmail ||
      ''
    ).toLowerCase().trim();

    const assignedName = String(
      item.assignedToName ||
      item.assignedEmployeeName ||
      item.assignedEmployee?.name ||
      ''
    ).toLowerCase().trim();

    const createdById = String(item.createdById || item.creatorId || item.userId || '').toLowerCase().trim();
    const createdByName = String(item.createdByName || '').toLowerCase().trim();
    const assignedById = String(item.assignedById || '').toLowerCase().trim();
    const assignedByName = String(item.assignedByName || '').toLowerCase().trim();

    // Check extra notes
    let extraNotes: any = null;
    if (typeof item.notes === 'string' && item.notes.trim().startsWith('{')) {
      try { extraNotes = JSON.parse(item.notes); } catch {}
    }
    const noteAssignedId = String(extraNotes?.assignedEmployeeId || extraNotes?.assignedTo || '').toLowerCase().trim();
    const noteAssignedName = String(extraNotes?.assignedEmployeeName || extraNotes?.assignedToName || '').toLowerCase().trim();
    const noteCreatedById = String(extraNotes?.createdById || '').toLowerCase().trim();
    const noteCreatedByName = String(extraNotes?.createdByName || '').toLowerCase().trim();

    // Match by ID
    if (empId && (
      assignedId === empId ||
      createdById === empId ||
      assignedById === empId ||
      noteAssignedId === empId ||
      noteCreatedById === empId
    )) return true;

    // Match by Email
    if (empEmail && (
      assignedEmail === empEmail ||
      assignedId === empEmail
    )) return true;

    // Match by Name
    if (empFullName && empFullName.length >= 3) {
      if (assignedName && (assignedName.includes(empFullName) || empFullName.includes(assignedName))) return true;
      if (noteAssignedName && (noteAssignedName.includes(empFullName) || empFullName.includes(noteAssignedName))) return true;
      if (createdByName && (createdByName.includes(empFullName) || empFullName.includes(createdByName))) return true;
      if (noteCreatedByName && (noteCreatedByName.includes(empFullName) || empFullName.includes(noteCreatedByName))) return true;
      if (assignedByName && (assignedByName.includes(empFullName) || empFullName.includes(assignedByName))) return true;
    }

    return false;
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
      followUpDate: body.followUpDate || body.nextFollowUp || body.follow_up_date || '',
      nextFollowUp: body.nextFollowUp || body.followUpDate || '',
      source: body.source || body.leadSource || 'Direct',
      leadSource: body.leadSource || body.source || 'Direct',
      stage: body.stage || body.leadStage || 'TO_CONTACT',
      leadStage: body.leadStage || body.stage || 'To Contact',
      leadStatus: body.leadStatus || body.status || 'Interested',
      productInterests: body.productInterests || [],
      interests: body.interests || [],
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
      const targetIndex = existing.findIndex((c: any) => c.id === id || c._id === id);
      let updatedContact: any;
      if (targetIndex >= 0) {
        existing[targetIndex] = { ...existing[targetIndex], ...body };
        updatedContact = existing[targetIndex];
        localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(existing));
        if (db) setDoc(doc(db, 'contacts', String(id)), JSON.parse(JSON.stringify(existing[targetIndex])), { merge: true }).catch(()=>{});
      } else {
        const newObj = { id, _id: id, ...body };
        updatedContact = newObj;
        existing.push(newObj);
        localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(existing));
        if (db) setDoc(doc(db, 'contacts', String(id)), JSON.parse(JSON.stringify(newObj)), { merge: true }).catch(()=>{});
      }

      // Sync updated customer info with all connected policies
      try {
        const fullName = `${body.firstName || ''} ${body.lastName || ''}`.trim();
        const policies = getLocalPolicies();
        let policiesChanged = false;
        const custId = updatedContact?.customerId || updatedContact?.customerCode;

        policies.forEach((p: any) => {
          const isMatch = (p.contactId && p.contactId === id) ||
            (p.contact?.id && p.contact.id === id) ||
            (p.contact?._id && p.contact._id === id) ||
            (custId && (p.customerId === custId || p.customerCode === custId));

          if (isMatch) {
            policiesChanged = true;
            if (fullName) p.clientName = fullName;
            if (body.phone) p.phone = body.phone;
            p.contact = {
              ...(p.contact || {}),
              id: id,
              firstName: body.firstName || p.contact?.firstName || 'Client',
              lastName: body.lastName !== undefined ? body.lastName : (p.contact?.lastName || ''),
              phone: body.phone || p.contact?.phone || '',
              email: body.email || p.contact?.email || ''
            };
            if (db) {
              setDoc(doc(db, 'policies', String(p.id)), JSON.parse(JSON.stringify(p)), { merge: true }).catch(()=>{});
            }
          }
        });

        if (policiesChanged) {
          localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policies));
        }
      } catch (pErr) {
        console.warn('[Sync Policies with Contact Update Notice]', pErr);
      }

      // Sync updated customer info with connected claims
      try {
        const claims = getLocalClaims();
        let claimsChanged = false;
        claims.forEach((cl: any) => {
          if (cl.contactId === id || cl.contact?.id === id || cl.contact?._id === id) {
            claimsChanged = true;
            cl.contact = {
              ...(cl.contact || {}),
              id: id,
              firstName: body.firstName || cl.contact?.firstName || 'Client',
              lastName: body.lastName !== undefined ? body.lastName : (cl.contact?.lastName || ''),
              phone: body.phone || cl.contact?.phone || '',
              email: body.email || cl.contact?.email || ''
            };
          }
        });
        if (claimsChanged) {
          localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(claims));
        }
      } catch (cErr) {
        console.warn('[Sync Claims with Contact Update Notice]', cErr);
      }

      try {
        const bc = new BroadcastChannel('crm_sync_channel');
        bc.postMessage({ type: 'CONTACT_UPDATED', id, body });
        bc.close();
      } catch (e) {}
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
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
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
    const rawId = String(id);
    const fsDocId = rawId.replace('fs_', '');
    
    // 1. Check Local Leads
    const existing = getLocalLeads();
    const target = existing.find(l => String(l.id) === rawId || String(l.id) === fsDocId);
    if (target) {
      target.stage = stage;
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(existing));
    }

    // 2. Check Website Leads
    try {
      const websiteLeads = JSON.parse(localStorage.getItem('insumitra_website_leads') || '[]');
      const wTarget = websiteLeads.find((l: any) => String(l.id) === rawId || ('website_lead_' + l.id) === rawId || ('website_lead_' + l.timestamp) === rawId);
      if (wTarget) {
        wTarget.stage = stage;
        localStorage.setItem('insumitra_website_leads', JSON.stringify(websiteLeads));
      }
    } catch {}

    // 3. Check Checkup Leads
    try {
      const checkupLeads = JSON.parse(localStorage.getItem('rahul_kulkarni_checkups') || '[]');
      const cTarget = checkupLeads.find((l: any) => String(l.id) === rawId || ('checkup_lead_' + l.id) === rawId || ('checkup_lead_' + l.timestamp) === rawId);
      if (cTarget) {
        cTarget.stage = stage;
        localStorage.setItem('rahul_kulkarni_checkups', JSON.stringify(checkupLeads));
      }
    } catch {}

    // 4. Check Contacts
    try {
      const contacts = JSON.parse(localStorage.getItem('insumitra_contacts') || '[]');
      const ctTarget = contacts.find((c: any) => String(c.id) === rawId || String(c.id) === fsDocId);
      if (ctTarget) {
        ctTarget.stage = stage;
        localStorage.setItem('insumitra_contacts', JSON.stringify(contacts));
      }
    } catch {}

    if (db) {
      try {
        setDoc(doc(db, 'leads', fsDocId), { stage }, { merge: true }).catch(() => {});
        setDoc(doc(db, 'leads', rawId), { stage }, { merge: true }).catch(() => {});
      } catch {}
    }
    try {
      return await api.patch(`/leads/${rawId}/stage`, { stage }).then((r: any) => r.data);
    } catch {
      return { data: { id: rawId, stage } };
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
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
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
    
    let merged = filterAssignedForEmployee(Array.from(map.values()));
    if (params?.contactId) {
      const cId = String(params.contactId).toLowerCase().trim();
      merged = merged.filter((p: any) => {
        const pContactId = String(p.contactId || p.contact?.id || p.contact?._id || '').toLowerCase().trim();
        const pCustId = String(p.customerId || p.customerCode || '').toLowerCase().trim();
        return pContactId === cId || pCustId === cId;
      });
    }
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
    const found = localList.find((p: any) => p.id === id || p._id === id);
    if (found) return { data: found };
    try {
      if (db) {
        const snap = await getDoc(doc(db, 'policies', String(id)));
        if (snap.exists()) {
          const fsData = { id: snap.id, ...snap.data() };
          saveLocalPolicy(fsData);
          return { data: fsData };
        }
      }
    } catch (fsErr) {}
    try {
      const res = await api.get(`/policies/${id}`).then((r: any) => r.data);
      if (res?.data || res) {
        const pol = res.data ?? res;
        saveLocalPolicy(pol);
      }
      return res;
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
      const targetIndex = existing.findIndex((p: any) => p.id === id || p._id === id);
      if (targetIndex >= 0) {
        existing[targetIndex] = { ...existing[targetIndex], ...body };
        
        // Auto-fix the contact.firstName bug!
        const fullName = body.clientName || existing[targetIndex].clientName;
        if (fullName) {
           existing[targetIndex].contact = existing[targetIndex].contact || { id: existing[targetIndex].contactId || 'contact_1' };
           const parts = fullName.split(' ');
           existing[targetIndex].contact.firstName = parts[0] || 'Client';
           existing[targetIndex].contact.lastName = parts.slice(1).join(' ') || 'Profile';
        }
        
        localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(existing));
        updated = existing[targetIndex];
        if (db) {
          setDoc(doc(db, 'policies', String(id)), JSON.parse(JSON.stringify(existing[targetIndex])), { merge: true }).catch(()=>{});
        }
      } else {
        const newPolicyObj = { id, ...body, updatedAt: new Date().toISOString() };
        const updatedList = [newPolicyObj, ...existing];
        localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(updatedList));
        updated = newPolicyObj;
        if (db) {
          setDoc(doc(db, 'policies', String(id)), JSON.parse(JSON.stringify(newPolicyObj)), { merge: true }).catch(()=>{});
        }
      }

      try {
        const bc = new BroadcastChannel('crm_sync_channel');
        bc.postMessage({ type: 'POLICY_UPDATED', id, body });
        bc.close();
      } catch (e) {}
    } catch (e) {
      console.error('Error updating policy locally:', e);
    }
    
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
      localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
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
    let combined = filterAssignedForEmployee([...localList, ...apiList.filter(a => !localIds.has(a.id))]);
    if (params?.contactId) {
      const cId = String(params.contactId).toLowerCase().trim();
      combined = combined.filter((c: any) => {
        const cContactId = String(c.contactId || c.contact?.id || c.contact?._id || '').toLowerCase().trim();
        return cContactId === cId;
      });
    }
    if (params?.policyId) {
      const pId = String(params.policyId).toLowerCase().trim();
      combined = combined.filter((c: any) => {
        const cPolId = String(c.policyId || c.policy?.id || c.policy?._id || '').toLowerCase().trim();
        return cPolId === pId;
      });
    }
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
    const currentUser = useAuthStore.getState().user;
    const currentUserId = currentUser?.id || (currentUser as any)?.userId || '';
    const currentUserName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '';

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
      assignedEmployeeId: body.assignedEmployeeId || (currentUser?.role === 'EMPLOYEE' ? currentUserId : null),
      createdById: currentUserId,
      createdByName: currentUserName,
      userId: currentUserId,
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

export const DELETED_DUMMY_EMPLOYEE_EMAILS = new Set([
  'superadmin123@gmail.com',
  'vaishu123@gmail.com',
  'vaishnavi@gmail.com',
  'gay@gmail.com',
  'gayatri@gmail.com',
  'asmi@gmail.com',
  'asmita@gmail.com',
]);

export const DELETED_DUMMY_EMPLOYEE_IDS = new Set([
  'emp-superadmin-1',
  'user-superadmin-1',
  'emp-vaishnavi-bhosale-1',
  'emp-gayatri-jadhav-1',
  'emp-asmita-yadav-1',
]);

export const isDeletedDummyEmployee = (emp: any): boolean => {
  if (!emp) return false;
  const id = String(emp.id || emp.userId || emp.user?.id || '');
  const email = String(emp.email || emp.user?.email || '').trim().toLowerCase();
  const firstName = String(emp.firstName || emp.first_name || '').trim().toLowerCase();
  const lastName = String(emp.lastName || emp.last_name || '').trim().toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim().toLowerCase();

  if (DELETED_DUMMY_EMPLOYEE_IDS.has(id)) return true;
  if (email && DELETED_DUMMY_EMPLOYEE_EMAILS.has(email)) return true;
  if (
    fullName === 'super admin' ||
    fullName === 'vaishnavi bhosale' ||
    fullName === 'gayatri jadhav' ||
    fullName === 'asmita yadav' ||
    (firstName === 'vaishnavi' && lastName === 'bhosale') ||
    (firstName === 'gayatri' && lastName === 'jadhav') ||
    (firstName === 'asmita' && lastName === 'yadav')
  ) {
    return true;
  }
  return false;
};

export const INITIAL_PRESET_EMPLOYEES: any[] = [
  {
    id: 'emp_priya_niralgi_b50',
    firstName: 'PRIYA',
    lastName: 'NIRALGI',
    designation: 'OFFICE MANAGER',
    department: 'Management',
    phone: '9561312419',
    isActive: true,
    user: { id: 'emp_priya_niralgi_b50', email: 'familyfirstrk1985@gmail.com', role: 'EMPLOYEE' },
    dateOfJoining: '2024-01-01',
  },
  {
    id: 'emp_aananda_wavre_5lv',
    firstName: 'AANANDA',
    lastName: 'WAVRE',
    designation: 'ALL IN ONE',
    department: 'Operations',
    phone: '9766334020',
    isActive: true,
    user: { id: 'emp_aananda_wavre_5lv', email: 'familyfirstrk1985@gmail.com', role: 'EMPLOYEE' },
    dateOfJoining: '2024-01-01',
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
    if (Array.isArray(list)) {
      const filtered = list.filter(emp => !isDeletedDummyEmployee(emp));
      const finalResult = filtered.length > 0 ? filtered : INITIAL_PRESET_EMPLOYEES;
      if (filtered.length !== list.length || !list.length) {
        localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(finalResult));
      }
      return finalResult;
    }
    return INITIAL_PRESET_EMPLOYEES;
  } catch {
    return INITIAL_PRESET_EMPLOYEES;
  }
};

export const saveLocalEmployee = (emp: any) => {
  try {
    if (isDeletedDummyEmployee(emp)) return;
    const existing = getLocalEmployees();
    const updated = [emp, ...existing.filter(e => e.id !== emp.id && e.userId !== emp.id && e.user?.id !== emp.id && !isDeletedDummyEmployee(e))];
    localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(updated));
    try {
      if (db && emp.id) {
        const firestoreData: any = {
          id: String(emp.id),
          first_name: emp.firstName || emp.first_name || '',
          last_name: emp.lastName || emp.last_name || '',
          firstName: emp.firstName || emp.first_name || '',
          lastName: emp.lastName || emp.last_name || '',
          phone: emp.phone || '',
          designation: emp.designation || '',
          department: emp.department || '',
          is_active: emp.isActive ?? true,
          date_of_joining: emp.dateOfJoining || emp.date_of_joining || new Date().toISOString().slice(0, 10),
          dateOfJoining: emp.dateOfJoining || emp.date_of_joining || new Date().toISOString().slice(0, 10),
          created_at: emp.createdAt || new Date().toISOString(),
          createdAt: emp.createdAt || new Date().toISOString(),
          gender: emp.gender || 'OTHER',
          date_of_birth: emp.dateOfBirth || '',
          base_salary: emp.baseSalary || 0,
          monthly_target: emp.monthlyTarget || 0,
          user: emp.user || {
            id: String(emp.id),
            email: emp.email || `${(emp.firstName || 'emp').toLowerCase()}@gmail.com`,
            role: 'EMPLOYEE',
          },
        };
        setDoc(doc(db, 'employee_profiles', String(emp.id)), firestoreData, { merge: true }).catch((err) => console.error("Firebase Sync Error (employee_profiles):", err));
        setDoc(doc(db, 'employees', String(emp.id)), firestoreData, { merge: true }).catch((err) => console.error("Firebase Sync Error (employees):", err));
      }
    } catch (e) {
      console.error("Firestore sync exception", e);
    }
    return updated;
  } catch (e) {
    console.error('Failed to save local employee', e);
  }
};

// Auto sync any unsynced local employees to Firestore on module load and purge dummy records
export const syncAllLocalEmployeesToFirestore = () => {
  if (!db) return;
  try {
    // Delete any old preset dummy docs from Firestore
    const dummyIds = [
      'emp-superadmin-1',
      'user-superadmin-1',
      'emp-vaishnavi-bhosale-1',
      'emp-gayatri-jadhav-1',
      'emp-asmita-yadav-1'
    ];
    dummyIds.forEach(id => {
      deleteDoc(doc(db, 'employees', id)).catch(() => {});
      deleteDoc(doc(db, 'employee_profiles', id)).catch(() => {});
    });

    const list = getLocalEmployees();
    list.forEach((emp) => {
      if (isDeletedDummyEmployee(emp)) return;
      if (emp.id && (String(emp.id).startsWith('emp_') || String(emp.id).startsWith('custom_') || emp.firstName === 'PRIYA' || emp.firstName === 'AANANDA' || emp.firstName === 'Abhishek' || emp.first_name === 'Abhishek')) {
        saveLocalEmployee(emp);
        const empEmail = emp.email || emp.user?.email;
        if (empEmail && empEmail.includes('@')) {
          createFirebaseUserWithoutSignout(empEmail, 'Pass@123456').catch(() => {});
        }
      }
    });
  } catch (e) {
    console.error('Sync all local employees error:', e);
  }
};
setTimeout(() => syncAllLocalEmployeesToFirestore(), 500);

export const removeLocalEmployee = (id: string) => {
  try {
    const existing = getLocalEmployees();
    const filtered = existing.filter(e => e.id !== id && e.userId !== id && e.user?.id !== id && e.email !== id && e.user?.email !== id);
    localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(filtered));
    try {
      if (db && id) {
        deleteDoc(doc(db, 'employees', String(id))).catch((err) => console.error("Firebase Sync Error:", err));
        deleteDoc(doc(db, 'employee_profiles', String(id))).catch((err) => console.error("Firebase Sync Error:", err));
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

    // Also fetch from Firestore employee_profiles if available
    let firestoreList: any[] = [];
    if (db) {
      try {
        const snap = await getDocs(collection(db, 'employee_profiles'));
        snap.forEach(docSnap => {
          const d = docSnap.data();
          const item = { id: docSnap.id, ...d };
          if (isDeletedDummyEmployee(item)) {
            deleteDoc(doc(db, 'employee_profiles', docSnap.id)).catch(() => {});
            return;
          }
          firestoreList.push({
            id: docSnap.id,
            firstName: d.first_name || d.firstName || '',
            lastName: d.last_name || d.lastName || '',
            phone: d.phone || '',
            designation: d.designation || '',
            department: d.department || '',
            dateOfJoining: d.date_of_joining || d.dateOfJoining || '',
            isActive: d.is_active ?? d.isActive ?? true,
            user: d.user || {
              id: docSnap.id,
              email: d.email || `${(d.first_name || d.firstName || 'emp').toLowerCase()}@gmail.com`,
              role: 'EMPLOYEE',
            },
            ...d,
          });
        });

        // Also clean up 'employees' collection
        try {
          const empSnap = await getDocs(collection(db, 'employees'));
          empSnap.forEach(docSnap => {
            const item = { id: docSnap.id, ...docSnap.data() };
            if (isDeletedDummyEmployee(item)) {
              deleteDoc(doc(db, 'employees', docSnap.id)).catch(() => {});
            }
          });
        } catch {}
      } catch (err) {
        console.warn('[Firestore employee_profiles list fetch notice]', err);
      }
    }

    const localList = getLocalEmployees();
    const map = new Map<string, any>();

    // 1. Initial preset employees
    INITIAL_PRESET_EMPLOYEES.forEach(emp => {
      if (!isDeletedDummyEmployee(emp)) {
        map.set(String(emp.id), emp);
        if (emp.user?.email) map.set(emp.user.email.toLowerCase(), emp);
      }
    });

    // 2. Firestore employees
    firestoreList.forEach(emp => {
      if (isDeletedDummyEmployee(emp)) return;
      const k = String(emp.id || emp.userId || emp.user?.id);
      map.set(k, { ...(map.get(k) || {}), ...emp });
      if (emp.user?.email) map.set(emp.user.email.toLowerCase(), emp);
      else if (emp.email) map.set(emp.email.toLowerCase(), emp);
    });

    // 3. Saved local employees
    localList.forEach(emp => {
      if (isDeletedDummyEmployee(emp)) return;
      const k = String(emp.id || emp.userId || emp.user?.id);
      map.set(k, { ...(map.get(k) || {}), ...emp });
      if (emp.user?.email) map.set(emp.user.email.toLowerCase(), emp);
      else if (emp.email) map.set(emp.email.toLowerCase(), emp);
    });

    // 4. API employees
    apiList.forEach(emp => {
      if (isDeletedDummyEmployee(emp)) return;
      const k = String(emp.id || emp.userId || emp.user?.id);
      map.set(k, { ...(map.get(k) || {}), ...emp });
    });

    // Deduplicate by unique id
    const uniqueEmployees = new Map<string, any>();
    Array.from(map.values()).forEach(emp => {
      if (isDeletedDummyEmployee(emp)) return;
      const uniqueId = String(emp.id || emp.userId || emp.user?.id || emp.email || emp.user?.email || Math.random());
      if (!uniqueEmployees.has(uniqueId)) {
        uniqueEmployees.set(uniqueId, emp);
      }
    });

    const combined = Array.from(uniqueEmployees.values()).filter(emp => !isDeletedDummyEmployee(emp));
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

    // Register user in Firebase Authentication (so they exist in Authentication -> Users for login & forgot password)
    const empEmail = body.email || newEmp.user?.email;
    if (empEmail && empEmail.includes('@')) {
      createFirebaseUserWithoutSignout(empEmail, body.password).catch((err) =>
        console.warn('Firebase Auth user creation notice:', err)
      );
    }

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

  delete: async (id: string) => {
    removeLocalEmployee(id);
    try {
      if (db && id) {
        await deleteDoc(doc(db, 'employees', String(id))).catch((err) => console.error("Firebase Sync Error:", err));
        await deleteDoc(doc(db, 'employee_profiles', String(id))).catch((err) => console.error("Firebase Sync Error:", err));
      }
    } catch (e) {
      console.error('Firestore delete exception', e);
    }
    try {
      return await api.delete(`/employees/${id}`).then((r: any) => r.data);
    } catch {
      return { success: true, message: 'Employee deleted successfully' };
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

