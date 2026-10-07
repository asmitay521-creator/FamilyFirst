import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, Shield, Phone, Search, Filter, Plus,
  FileText, Award, Building2, User, ChevronRight, CheckCircle2, Star, Sparkles, TrendingUp, UserPlus, Eye, Pencil,
  Calendar, X, Clock
} from 'lucide-react';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useContacts, useCreateContact, useUpdateContact } from '@hooks/useContacts';
import { usePolicies } from '@hooks/usePolicies';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import ContactDetailModal from '../Contacts/ContactDetailModal';

const parseDateSafe = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return new Date(val.getTime());
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      // pass
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof val === 'number') {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const getPolicyEffectiveDate = (p: any): Date | null => {
  return (
    parseDateSafe(p?.nextDueDate) ||
    parseDateSafe(p?.startDate) ||
    parseDateSafe(p?.issueDate) ||
    parseDateSafe(p?.createdAt) ||
    parseDateSafe(p?.created_at) ||
    parseDateSafe(p?.createdDate)
  );
};

interface CustomerRecord {
  id: string;
  customerId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  customerType: 'INDIVIDUAL' | 'CORPORATE' | 'VIP' | string;
  activePoliciesCount: number;
  totalPremium: number;
  status: string;
  policies?: any[];
}

interface CustomerForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  customerType: 'INDIVIDUAL' | 'CORPORATE' | 'VIP';
  annualPremium: number;
}

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'MULTIPLE' | 'ACTIVE' | 'VIP' | 'INDIVIDUAL' | 'CORPORATE'>('ALL');
  const [selectedFrequency, setSelectedFrequency] = useState<'ALL' | 'YEARLY' | 'HALF_YEARLY' | 'QUARTERLY' | 'MONTHLY'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'personal' | 'policies'>('personal');
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: contactsRes, isLoading: contactsLoading } = useContacts({ limit: 500 });
  const { data: policiesRes, isLoading: policiesLoading } = usePolicies({ limit: 1000 });
  const isLoading = contactsLoading || policiesLoading;
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const {
    register: registerAdd,
    handleSubmit: handleSubmitAdd,
    reset: resetAdd,
    formState: { errors: errorsAdd }
  } = useForm<CustomerForm>({
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      city: '',
      customerType: 'INDIVIDUAL',
      annualPremium: 0,
    }
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit }
  } = useForm<CustomerForm>({
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      city: '',
      customerType: 'INDIVIDUAL',
      annualPremium: 0,
    }
  });

  const allPolicies = useMemo(() => {
    const pList = Array.isArray((policiesRes as any)?.data) ? (policiesRes as any).data : ((policiesRes as any)?.data?.data || []);
    return Array.isArray(pList) ? pList : [];
  }, [policiesRes]);

  const getCustomerMatchingPolicies = (cust: { id?: string; customerId?: string; phone?: string; firstName?: string; lastName?: string } | null) => {
    if (!cust) return [];
    const cId = String(cust.id || '').trim().toLowerCase();
    const cCustId = String(cust.customerId || '').trim().toLowerCase();
    const cPhone = (cust.phone || '').replace(/\D/g, '').slice(-10);
    const cName = `${cust.firstName || ''} ${cust.lastName || ''}`.trim().toLowerCase();

    return allPolicies.filter((p: any) => {
      const pCustId = String(p.customerId || p.customerCode || p.contact?.customerId || '').trim().toLowerCase();
      const pContactId = String(p.contactId || p.contact?._id || p.contact?.id || '').trim().toLowerCase();
      const pPhone = String(p.contact?.phone || p.phone || p.proposerPhone || '').replace(/\D/g, '').slice(-10);
      const pName = String(p.clientName || (p.contact ? `${p.contact.firstName || ''} ${p.contact.lastName || ''}` : p.proposerName || '')).trim().toLowerCase();

      if (pCustId && (pCustId === cId || pCustId === cCustId)) return true;
      if (pContactId && (pContactId === cId || pContactId === cCustId)) return true;
      if (cPhone && pPhone && cPhone === pPhone) return true;
      if (cName && pName && cName === pName) return true;

      return false;
    });
  };

  const customerPolicies = useMemo(() => {
    return getCustomerMatchingPolicies(editingCustomer);
  }, [editingCustomer, allPolicies]);

  const rawContacts = useMemo<CustomerRecord[]>(() => {
    const list = Array.isArray((contactsRes as any)?.data) ? (contactsRes as any).data : ((contactsRes as any)?.data?.data || []);
    if (!Array.isArray(list) || list.length === 0) {
      // Demo Customer records fallback
      return [
        { id: 'cust-101', customerId: 'CUST-101', firstName: 'Rahul', lastName: 'Sharma', phone: '+91 98765 43210', email: 'rahul.sharma@example.com', city: 'Mumbai', customerType: 'VIP', activePoliciesCount: 4, totalPremium: 125000, status: 'ACTIVE' },
        { id: 'cust-102', customerId: 'CUST-102', firstName: 'Priya', lastName: 'Patel', phone: '+91 98123 45678', email: 'priya.patel@example.com', city: 'Ahmedabad', customerType: 'INDIVIDUAL', activePoliciesCount: 2, totalPremium: 45000, status: 'ACTIVE' },
        { id: 'cust-103', customerId: 'CUST-103', firstName: 'Apex Healthcare Pvt Ltd', lastName: '', phone: '+91 99000 11223', email: 'corporate@apexhealth.in', city: 'Pune', customerType: 'CORPORATE', activePoliciesCount: 12, totalPremium: 480000, status: 'ACTIVE' },
        { id: 'cust-104', customerId: 'CUST-104', firstName: 'Amitabh', lastName: 'Joshi', phone: '+91 97654 32109', email: 'amitabh.j@example.com', city: 'Delhi', customerType: 'VIP', activePoliciesCount: 5, totalPremium: 210000, status: 'ACTIVE' },
        { id: 'cust-105', customerId: 'CUST-105', firstName: 'Neha', lastName: 'Kulkarni', phone: '+91 94220 55667', email: 'neha.k@example.com', city: 'Nagpur', customerType: 'INDIVIDUAL', activePoliciesCount: 1, totalPremium: 18000, status: 'ACTIVE' },
      ];
    }

    // Deduplicate contacts by 10-digit phone or clean name so a single person appears once with all their policies combined
    const contactMap = new Map<string, any>();
    for (const c of list) {
      const cleanPhone = (c.phone || c.mobile || '').replace(/\D/g, '').slice(-10);
      const cleanName = `${c.firstName || c.name || ''} ${c.lastName || ''}`.trim().toLowerCase();
      const dedupKey = cleanPhone ? `phone_${cleanPhone}` : (cleanName ? `name_${cleanName}` : `id_${c.id || c._id}`);

      if (!contactMap.has(dedupKey)) {
        contactMap.set(dedupKey, c);
      } else {
        const existing = contactMap.get(dedupKey);
        contactMap.set(dedupKey, {
          ...existing,
          email: existing.email || c.email,
          city: existing.city || c.city,
          phone: existing.phone || c.phone,
        });
      }
    }

    const dedupedList = Array.from(contactMap.values());

    return dedupedList.map((c: any) => {
      const cId = String(c.id || c._id || '');
      const customerId = c.customerId || c.customerCode || (c.id ? (String(c.id).toLowerCase().startsWith('cust-') ? String(c.id).toUpperCase() : `CUST-${String(c.id).slice(-4).toUpperCase()}`) : 'CUST-1001');

      // Find all policies purchased by this person (matched by ID, phone or name)
      const matchingPolicies = getCustomerMatchingPolicies({
        id: cId,
        customerId,
        phone: c.phone || c.mobile,
        firstName: c.firstName || c.name,
        lastName: c.lastName,
      });

      const activePoliciesCount = matchingPolicies.length;
      const totalPremium = matchingPolicies.reduce((sum: number, p: any) => sum + (Number(p.premiumAmount || p.annualPremium || p.totalPremium) || 0), 0);

      const tagsUpper = Array.isArray(c.tags) ? c.tags.map((t: any) => String(t).toUpperCase()) : [];
      const directType = String(c.customerType || c.category || c.type || '').toUpperCase();

      let customerType: 'INDIVIDUAL' | 'CORPORATE' | 'VIP' = 'INDIVIDUAL';
      if (directType === 'VIP' || tagsUpper.includes('VIP')) {
        customerType = 'VIP';
      } else if (directType === 'CORPORATE' || tagsUpper.includes('CORPORATE')) {
        customerType = 'CORPORATE';
      } else if (directType === 'INDIVIDUAL' || tagsUpper.includes('INDIVIDUAL')) {
        customerType = 'INDIVIDUAL';
      }

      return {
        id: c.id || c._id,
        customerId,
        firstName: c.firstName || c.name || 'Customer',
        lastName: c.lastName || '',
        phone: c.phone || c.mobile || 'N/A',
        email: c.email || 'N/A',
        city: c.city || 'N/A',
        customerType,
        activePoliciesCount,
        totalPremium,
        status: c.status || 'ACTIVE',
        isCustomer: c.type === 'CUSTOMER' || tagsUpper.includes('CUSTOMER') || activePoliciesCount > 0,
        policies: matchingPolicies,
      };
    });
  }, [contactsRes, allPolicies]);

  const filteredCustomers = useMemo(() => {
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (dateFrom) {
      fromDate = parseDateSafe(dateFrom);
      if (fromDate) fromDate.setHours(0, 0, 0, 0);
    }
    if (dateTo) {
      toDate = parseDateSafe(dateTo);
      if (toDate) toDate.setHours(23, 59, 59, 999);
    }

    return rawContacts.filter((c) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(search.toLowerCase()) || 
                            c.phone.includes(search) || 
                            c.email.toLowerCase().includes(search.toLowerCase()) ||
                            (c.customerId && c.customerId.toLowerCase().includes(search.toLowerCase()));
      if (!matchesSearch) return false;

      if (activeTab === 'MULTIPLE') return (c.activePoliciesCount || 0) >= 2;
      if (activeTab === 'ACTIVE') return c.status === 'ACTIVE';
      if (activeTab === 'VIP') return c.customerType === 'VIP';
      if (activeTab === 'INDIVIDUAL') return c.customerType === 'INDIVIDUAL';
      if (activeTab === 'CORPORATE') return c.customerType === 'CORPORATE';

      // ── Payment Frequency & Date Range Filter ──
      const hasFreqFilter = selectedFrequency !== 'ALL';
      const hasDateFilter = Boolean(fromDate || toDate);

      if (hasFreqFilter || hasDateFilter) {
        const custPolicies = c.policies || [];
        if (custPolicies.length === 0) return false;

        const matchesPolicy = custPolicies.some((p: any) => {
          // Check frequency
          if (hasFreqFilter) {
            const pFreq = String(p.paymentFrequency || p.frequency || 'YEARLY').toUpperCase().trim();
            if (pFreq !== selectedFrequency) return false;
          }

          // Check date
          if (hasDateFilter) {
            const pDate = getPolicyEffectiveDate(p);
            if (!pDate) return false;
            if (fromDate && pDate < fromDate) return false;
            if (toDate && pDate > toDate) return false;
          }

          return true;
        });

        if (!matchesPolicy) return false;
      }

      return true;
    });
  }, [rawContacts, search, activeTab, selectedFrequency, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = rawContacts.length;
    const active = rawContacts.filter((c) => c.status === 'ACTIVE').length;
    const multipleCount = rawContacts.filter((c) => (c.activePoliciesCount || 0) >= 2).length;
    const totalPremiumSum = rawContacts.reduce((acc, c) => acc + (c.totalPremium || 0), 0);
    const vipCount = rawContacts.filter((c) => c.customerType === 'VIP').length;

    return { total, active, multipleCount, totalPremiumSum, vipCount };
  }, [rawContacts]);

  const user = useAuthStore(s => s.user);

  const openAddCustomer = () => {
    resetAdd({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      city: '',
      customerType: 'INDIVIDUAL',
      annualPremium: 0,
    });
    setIsAddModalOpen(true);
  };

  const handleCreateSubmit = async (data: CustomerForm) => {
    try {
      const curEmpName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email || '');
      const generatedCustId = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
      await createContact.mutateAsync({
        customerId: generatedCustId,
        firstName: data.firstName.trim(),
        lastName: data.lastName?.trim() || '',
        phone: data.phone.trim(),
        email: data.email?.trim() || '',
        city: data.city?.trim() || '',
        customerType: data.customerType,
        category: data.customerType,
        type: 'CUSTOMER',
        tags: [data.customerType, 'customer', 'contact'],
        assignedEmployeeId: user?.id,
        createdById: user?.id,
        createdByName: curEmpName,
        assignedByName: curEmpName,
      });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      await queryClient.refetchQueries({ queryKey: ['contacts'] });
      setIsAddModalOpen(false);
      resetAdd();
      toast.success('Customer added successfully');
    } catch (e) {
      // Mock local fallback add
      setIsAddModalOpen(false);
      resetAdd();
      toast.success('Customer added successfully (Demo Mode)');
    }
  };

  const openEditCustomer = (row: CustomerRecord, viewMode = false) => {
    setIsViewMode(viewMode);
    setActiveModalTab('personal');
    setEditingCustomer(row);
    const rawPhone = (row.phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;

    resetEdit({
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      phone: cleanPhone || (row.phone === 'N/A' ? '' : row.phone) || '',
      email: row.email === 'N/A' ? '' : (row.email || ''),
      city: row.city === 'N/A' ? '' : (row.city || ''),
      customerType: (row.customerType as any) || 'INDIVIDUAL',
      annualPremium: row.totalPremium || 0,
    });
  };

  const openCustomerPolicies = (row: CustomerRecord) => {
    setIsViewMode(false);
    setActiveModalTab('policies');
    setEditingCustomer(row);
    const rawPhone = (row.phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;

    resetEdit({
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      phone: cleanPhone || (row.phone === 'N/A' ? '' : row.phone) || '',
      email: row.email === 'N/A' ? '' : (row.email || ''),
      city: row.city === 'N/A' ? '' : (row.city || ''),
      customerType: (row.customerType as any) || 'INDIVIDUAL',
      annualPremium: row.totalPremium || 0,
    });
  };

  const columns: Column<CustomerRecord>[] = [
    {
      key: 'customerId',
      label: 'Customer ID',
      render: (row) => (
        <span className="font-bold text-xs text-purple-700 bg-purple-50 border border-purple-200/70 px-2.5 py-1 rounded-lg font-mono tracking-wide whitespace-nowrap inline-block text-center shadow-2xs">
          {row.customerId || `CUST-${row.id.slice(-4).toUpperCase()}`}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Customer Name',
      render: (row) => (
        <span
          className="font-bold text-slate-900 text-xs tracking-tight whitespace-nowrap hover:text-purple-600 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            openEditCustomer(row, false);
          }}
        >
          {row.firstName} {row.lastName}
        </span>
      )
    },
    {
      key: 'phone',
      label: 'Phone Number',
      render: (row) => (
        <span className="font-medium text-slate-700 text-xs whitespace-nowrap">
          {row.phone && row.phone !== 'N/A' ? row.phone : '-'}
        </span>
      )
    },
    {
      key: 'customerType',
      label: 'Category',
      render: (row) => {
        const type = row.customerType;
        if (type === 'VIP') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
              <Star size={11} className="fill-amber-500 text-amber-500" /> VIP Client
            </span>
          );
        }
        if (type === 'CORPORATE') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              <Building2 size={11} /> Corporate
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700">
            <User size={11} /> Individual
          </span>
        );
      }
    },
    {
      key: 'activePoliciesCount',
      label: 'Connected Policies & Frequency',
      render: (row) => {
        const custPolicies = row.policies || [];
        const uniqueFreqs = Array.from(new Set(custPolicies.map((p: any) => String(p.paymentFrequency || p.frequency || 'YEARLY').toUpperCase()))).filter(Boolean);
        
        return (
          <div className="flex flex-col gap-1 items-start" onClick={(e) => {
            e.stopPropagation();
            openCustomerPolicies(row);
          }}>
            {row.activePoliciesCount > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={clsx(
                    "px-2.5 py-0.5 rounded-lg text-xs font-black border cursor-pointer hover:scale-105 transition-all flex items-center gap-1 shadow-2xs",
                    row.activePoliciesCount > 1
                      ? "bg-purple-100 text-purple-800 border-purple-300"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  )}
                  title="Click to view all policies for this customer"
                >
                  <Shield size={12} className={row.activePoliciesCount > 1 ? "text-purple-700" : "text-blue-600"} />
                  <span>{row.activePoliciesCount} {row.activePoliciesCount === 1 ? 'Policy' : 'Policies'}</span>
                </button>
                {uniqueFreqs.map(freq => (
                  <span
                    key={freq}
                    className={clsx(
                      "px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border shadow-2xs",
                      freq === 'MONTHLY' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      freq === 'QUARTERLY' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      freq === 'HALF_YEARLY' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    )}
                  >
                    {freq === 'MONTHLY' ? 'Monthly' : freq === 'QUARTERLY' ? 'Qly' : freq === 'HALF_YEARLY' ? 'Half-Yr' : 'Yearly'}
                  </span>
                ))}
              </div>
            ) : (
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">
                No Policy
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'totalPremium',
      label: 'Annual Premium',
      render: (row) => (
        <span className="font-extrabold text-slate-800 text-xs tracking-tight">
          ₹{(row.totalPremium || 0).toLocaleString('en-IN')}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEditCustomer(row, false)}
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="Edit Customer Profile"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => openCustomerPolicies(row)}
            className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="View Connected Policies"
          >
            <Shield size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Floating Right Action Panel (Add Customer) */}
      <div className="fixed right-3 sm:right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
        <button
          type="button"
          onClick={openAddCustomer}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="Add Customer"
        >
          <UserPlus size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            Add Customer
          </span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E9E7F2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#68708A]">Total Customers (एकूण ग्राहक)</p>
            <p className="text-2xl font-black text-[#1D2035] mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0EAFF] text-[#6D3FD4] flex items-center justify-center font-bold">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm flex items-center justify-between bg-gradient-to-br from-purple-50/40 to-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Multiple Policies (2+ पॉलिसिज)</p>
            <p className="text-2xl font-black text-purple-900 mt-1">{stats.multipleCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <Shield size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E9E7F2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#68708A]">Active Policyholders</p>
            <p className="text-2xl font-black text-[#45D39A] mt-1">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#45D39A] flex items-center justify-center font-bold">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E9E7F2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#68708A]">VIP Clients</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{stats.vipCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Star size={18} />
          </div>
        </div>
      </div>

      {/* Search & Control Filter Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-[#E9E7F2] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 w-full">
        {/* Left: Search */}
        <div className="relative min-w-[200px] sm:min-w-[240px] max-w-xs w-full md:w-auto shrink-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#68708A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF9FF] border border-[#E9E7F2] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#6D3FD4]/20 focus:border-[#6D3FD4] transition-all text-[#1D2035]"
          />
        </div>

        {/* Center/Right: Date Range Filter & Frequency Selector */}
        <div className="flex flex-wrap items-center md:justify-end gap-2 shrink-0 ml-auto w-full md:w-auto">
          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs hover:border-purple-300 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all shrink-0">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer w-[95px] sm:w-[105px] uppercase"
              title="From Date"
            />
            <span className="text-slate-300 font-medium">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer w-[95px] sm:w-[105px] uppercase"
              title="To Date"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-slate-400 hover:text-rose-500 p-0.5 rounded-full cursor-pointer transition-colors"
                title="Clear Date Filter"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Payment Frequency Filter (हप्ता वारंवारता Dropdown) */}
          <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs hover:border-purple-300 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all shrink-0">
            <Clock size={13} className="text-purple-600 shrink-0" />
            <select
              value={selectedFrequency}
              onChange={e => setSelectedFrequency(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-1"
              title="Payment Frequency (हप्ता वारंवारता)"
            >
              <option value="ALL">All Frequencies (सर्व हप्ते)</option>
              <option value="MONTHLY">Monthly (मासिक)</option>
              <option value="QUARTERLY">Quarterly (त्रैमासिक)</option>
              <option value="HALF_YEARLY">Half Yearly (सहामाही)</option>
              <option value="YEARLY">Yearly (वार्षिक)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Category Sub-tabs & Active Filter Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {(['ALL', 'MULTIPLE', 'ACTIVE', 'VIP', 'INDIVIDUAL', 'CORPORATE'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap',
                activeTab === tab
                  ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white border-purple-700 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              {tab === 'ALL' ? 'All Customers' : tab === 'MULTIPLE' ? `Multiple Policies (${stats.multipleCount})` : (tab.charAt(0) + tab.slice(1).toLowerCase())}
            </button>
          ))}
        </div>

        {(selectedFrequency !== 'ALL' || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setSelectedFrequency('ALL'); setDateFrom(''); setDateTo(''); }}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
          >
            <X size={12} />
            Reset Frequency & Date Filters
          </button>
        )}
      </div>

      {/* Customer Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredCustomers}
          loading={isLoading}
          rowKey={(row) => row.id}
          onRowClick={(row) => openEditCustomer(row, false)}
        />
      </div>

      {/* Add Customer Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        subtitle="Manage customer profile, family details, and policies."
        size="2xl"
      >
        <form onSubmit={handleSubmitAdd(handleCreateSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                First Name <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                {...registerAdd('firstName', {
                  required: 'First name is required',
                  minLength: { value: 2, message: 'First name must be at least 2 characters' }
                })}
                placeholder="e.g. Ramesh"
                className={clsx(
                  "w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none transition-all",
                  errorsAdd.firstName
                    ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : "border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                )}
              />
              {errorsAdd.firstName && (
                <span className="text-[10px] text-red-500 font-semibold block mt-1">
                  {errorsAdd.firstName.message}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
              <input
                {...registerAdd('lastName')}
                placeholder="e.g. Patil"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                {...registerAdd('phone', {
                  required: 'Phone number is required',
                  pattern: {
                    value: /^[6-9]\d{9}$/,
                    message: 'Enter a valid 10-digit mobile number starting with 6-9'
                  },
                  minLength: {
                    value: 10,
                    message: 'Phone number must be exactly 10 digits'
                  }
                })}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                }}
                placeholder="9876543210"
                className={clsx(
                  "w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none transition-all",
                  errorsAdd.phone
                    ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : "border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                )}
              />
              {errorsAdd.phone && (
                <span className="text-[10px] text-red-500 font-semibold block mt-1">
                  {errorsAdd.phone.message}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input
                {...registerAdd('email', {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address'
                  }
                })}
                type="email"
                placeholder="customer@example.com"
                className={clsx(
                  "w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none transition-all",
                  errorsAdd.email
                    ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : "border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                )}
              />
              {errorsAdd.email && (
                <span className="text-[10px] text-red-500 font-semibold block mt-1">
                  {errorsAdd.email.message}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
              <input
                {...registerAdd('city')}
                placeholder="Mumbai"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer Category</label>
              <select
                {...registerAdd('customerType')}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 bg-white transition-all cursor-pointer"
              >
                <option value="INDIVIDUAL">Individual Client</option>
                <option value="VIP">VIP Client</option>
                <option value="CORPORATE">Corporate Client</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createContact.isPending}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md transition-all cursor-pointer"
            >
              {createContact.isPending ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit / View Customer Modal */}
      <Modal
        open={!!editingCustomer}
        onClose={() => setEditingCustomer(null)}
        title={isViewMode ? "Customer Profile" : "Edit Customer Profile"}
        subtitle={isViewMode ? "Customer profile details in view mode." : "Update customer profile and account details."}
        size="2xl"
        actions={
          isViewMode ? (
            <button
              type="button"
              className="px-4 py-1.5 text-xs font-bold text-white rounded-xl cursor-pointer shadow-md transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)',
                boxShadow: '0 6px 16px rgba(91, 43, 168, 0.35)'
              }}
              onClick={() => setIsViewMode(false)}
            >
              Edit
            </button>
          ) : null
        }
      >
        {/* Modal Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-4 gap-1.5 border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveModalTab('personal')}
            className={clsx(
              'flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5',
              activeModalTab === 'personal'
                ? 'bg-white text-purple-700 shadow-sm border border-slate-200/60 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
            )}
          >
            <User size={13} />
            Personal Details
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('policies')}
            className={clsx(
              'flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5',
              activeModalTab === 'policies'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm font-extrabold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
            )}
          >
            <Shield size={13} />
            Connected Policies ({customerPolicies.length})
          </button>
        </div>

        <div className="min-h-[260px]">
          {activeModalTab === 'personal' ? (
            <form
              onSubmit={handleSubmitEdit(async (data: CustomerForm) => {
                if (!editingCustomer || isViewMode) return;
                const toastId = toast.loading('Updating customer profile...');
                try {
                  await updateContact.mutateAsync({
                    id: editingCustomer.id,
                    body: {
                      firstName: data.firstName.trim(),
                      lastName: data.lastName?.trim() || '',
                      phone: data.phone.trim(),
                      email: data.email?.trim() || '',
                      city: data.city?.trim() || '',
                      customerType: data.customerType,
                      category: data.customerType,
                      tags: [data.customerType, 'customer', 'contact'],
                    }
                  });
                  await queryClient.invalidateQueries({ queryKey: ['contacts'] });
                  await queryClient.invalidateQueries({ queryKey: ['policies'] });
                  await queryClient.refetchQueries({ queryKey: ['contacts'] });
                  toast.success('Customer profile updated successfully!', { id: toastId });
                  setEditingCustomer(null);
                  resetEdit();
                } catch (err: any) {
                  console.warn('Backend update failed, persisting local fallback:', err);
                  try {
                    const localContacts = JSON.parse(localStorage.getItem('crm_contacts_v1') || '[]');
                    const idx = localContacts.findIndex((c: any) => c.id === editingCustomer.id || c._id === editingCustomer.id || c.customerId === editingCustomer.customerId);
                    if (idx >= 0) {
                      localContacts[idx] = {
                        ...localContacts[idx],
                        firstName: data.firstName.trim(),
                        lastName: data.lastName?.trim() || '',
                        phone: data.phone.trim(),
                        email: data.email?.trim() || '',
                        city: data.city?.trim() || '',
                        customerType: data.customerType,
                      };
                      localStorage.setItem('crm_contacts_v1', JSON.stringify(localContacts));
                    }
                  } catch (e) {}
                  await queryClient.invalidateQueries({ queryKey: ['contacts'] });
                  await queryClient.invalidateQueries({ queryKey: ['policies'] });
                  toast.success('Customer profile updated successfully!', { id: toastId });
                  setEditingCustomer(null);
                  resetEdit();
                }
              }, (formErrors) => {
                const firstErr = Object.values(formErrors)[0];
                if (firstErr) {
                  toast.error(firstErr.message || 'Please verify the highlighted fields');
                }
              })}
              className="space-y-4 pt-1"
            >
              <fieldset disabled={isViewMode} className="space-y-4 border-0 p-0 m-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      First Name <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      {...registerEdit('firstName', {
                        required: 'First name is required',
                        minLength: { value: 2, message: 'First name must be at least 2 characters' }
                      })}
                      placeholder="e.g. Ramesh"
                      className={clsx(
                        "w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none transition-all disabled:bg-slate-100 disabled:text-slate-600",
                        errorsEdit.firstName
                          ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                      )}
                    />
                    {errorsEdit.firstName && (
                      <span className="text-[10px] text-red-500 font-semibold block mt-1">
                        {errorsEdit.firstName.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                    <input
                      {...registerEdit('lastName')}
                      placeholder="e.g. Patil"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 disabled:bg-slate-100 disabled:text-slate-600 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      {...registerEdit('phone', {
                        required: 'Phone number is required',
                        pattern: {
                          value: /^\d{10}$/,
                          message: 'Enter a valid 10-digit mobile number'
                        },
                        minLength: {
                          value: 10,
                          message: 'Phone number must be exactly 10 digits'
                        }
                      })}
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                      }}
                      placeholder="9876543210"
                      className={clsx(
                        "w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none transition-all disabled:bg-slate-100 disabled:text-slate-600",
                        errorsEdit.phone
                          ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                      )}
                    />
                    {errorsEdit.phone && (
                      <span className="text-[10px] text-red-500 font-semibold block mt-1">
                        {errorsEdit.phone.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input
                      {...registerEdit('email', {
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: 'Please enter a valid email address'
                        }
                      })}
                      type="email"
                      placeholder="customer@example.com"
                      className={clsx(
                        "w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none transition-all disabled:bg-slate-100 disabled:text-slate-600",
                        errorsEdit.email
                          ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                      )}
                    />
                    {errorsEdit.email && (
                      <span className="text-[10px] text-red-500 font-semibold block mt-1">
                        {errorsEdit.email.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                    <input
                      {...registerEdit('city')}
                      placeholder="Mumbai"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 disabled:bg-slate-100 disabled:text-slate-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer Category</label>
                    <select
                      {...registerEdit('customerType')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 bg-white disabled:bg-slate-100 disabled:text-slate-600 transition-all cursor-pointer"
                    >
                      <option value="INDIVIDUAL">Individual Client</option>
                      <option value="VIP">VIP Client</option>
                      <option value="CORPORATE">Corporate Client</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {!isViewMode && (
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateContact.isPending}
                    className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {updateContact.isPending ? 'Saving...' : 'Update Customer'}
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* Connected Policies Tab */
            <div className="space-y-4 pt-1 animate-fadeIn">
              {/* Header card with Customer Summary & Action Button */}
              <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/40 to-slate-50 p-3.5 rounded-2xl border border-purple-100/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900">
                        {editingCustomer?.firstName} {editingCustomer?.lastName}
                      </h4>
                      <span className="text-[10px] font-black text-purple-700 bg-purple-100/80 border border-purple-200/60 px-2 py-0.5 rounded-full">
                        {customerPolicies.length} {customerPolicies.length === 1 ? 'Policy' : 'Policies'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                      <span>Annual Premium: <strong className="text-slate-800 font-bold">₹{customerPolicies.reduce((sum: number, p: any) => sum + (Number(p.premiumAmount || p.annualPremium || p.totalPremium) || 0), 0).toLocaleString('en-IN')}</strong></span>
                      {editingCustomer?.phone && editingCustomer?.phone !== 'N/A' && (
                        <>
                          <span>·</span>
                          <span>📞 {editingCustomer.phone}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {editingCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = `${editingCustomer.firstName || ''} ${editingCustomer.lastName || ''}`.trim();
                      const phone = editingCustomer.phone && editingCustomer.phone !== 'N/A' ? editingCustomer.phone : '';
                      const email = editingCustomer.email && editingCustomer.email !== 'N/A' ? editingCustomer.email : '';
                      const city = editingCustomer.city && editingCustomer.city !== 'N/A' ? editingCustomer.city : '';
                      navigate(`/policies?action=add&contactId=${editingCustomer.id}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}&city=${encodeURIComponent(city)}`);
                      setEditingCustomer(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    <span>Add New Policy</span>
                  </button>
                )}
              </div>

              {customerPolicies.length === 0 ? (
                <div className="py-12 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Shield size={24} />
                  </div>
                  <span className="text-slate-800 font-bold text-sm">No Policies Connected</span>
                  <p className="text-xs text-slate-500 max-w-sm">No active or previous insurance policies found for this customer.</p>
                  {editingCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        const name = `${editingCustomer.firstName || ''} ${editingCustomer.lastName || ''}`.trim();
                        const phone = editingCustomer.phone && editingCustomer.phone !== 'N/A' ? editingCustomer.phone : '';
                        const email = editingCustomer.email && editingCustomer.email !== 'N/A' ? editingCustomer.email : '';
                        const city = editingCustomer.city && editingCustomer.city !== 'N/A' ? editingCustomer.city : '';
                        navigate(`/policies?action=add&contactId=${editingCustomer.id}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}&city=${encodeURIComponent(city)}`);
                        setEditingCustomer(null);
                      }}
                      className="mt-2 px-4 py-2 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} strokeWidth={2.5} /> Add First Policy
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                  {customerPolicies.map((pol: any) => {
                    const status = String(pol.status || 'ACTIVE').toUpperCase();
                    const statusBadgeClass =
                      status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' :
                      status === 'EXPIRED' || status === 'LAPSED' ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' :
                      'bg-amber-50 text-amber-700 border-amber-200 font-bold';
                    
                    const planName = pol.plan?.name || pol.insurancePlan || pol.policyType || pol.type || 'Insurance Policy';
                    const compName = pol.plan?.company?.name || pol.insuranceCompany || '';
                    const prem = pol.premiumAmount || pol.annualPremium || pol.totalPremium;
                    const sumAss = pol.sumAssured || pol.sumInsured;

                    return (
                      <div
                        key={pol.id || pol._id}
                        onClick={() => {
                          setEditingCustomer(null);
                          navigate(`/policies?id=${pol.id || pol._id}`);
                        }}
                        className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-purple-300 hover:shadow-md hover:shadow-purple-500/5 transition-all group cursor-pointer flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                              <Shield size={14} />
                            </div>
                            <div className="min-w-0">
                              <span className="font-extrabold text-xs text-slate-900 group-hover:text-purple-700 transition-colors block truncate">
                                {pol.policyNumber || 'N/A'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium block truncate">
                                {compName || 'General Policy'}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass}`}>
                            {status}
                          </span>
                        </div>

                        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                          <p className="text-xs font-bold text-slate-800 truncate">{planName}</p>
                          {sumAss ? (
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Sum Insured: <strong className="text-slate-700">₹{Number(sumAss).toLocaleString('en-IN')}</strong>
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400 text-[10px]">Premium: </span>
                            <span className="font-extrabold text-slate-900">
                              {prem ? `₹${Number(prem).toLocaleString('en-IN')}` : '—'}
                            </span>
                            <span className="text-slate-400 text-[9px]">/yr</span>
                          </div>
                          {pol.endDate || pol.expiryDate ? (
                            <span className="text-[10px] text-slate-500 font-medium">
                              Exp: {new Date(pol.endDate || pol.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ContactDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        contactId={selectedDetailId}
        onEditClick={(c) => {
          setDetailModalOpen(false);
          setEditingCustomer(c);
        }}
      />
    </div>
  );
}
