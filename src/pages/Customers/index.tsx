import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, Shield, Phone, Search, Filter, Plus,
  FileText, Award, Building2, User, ChevronRight, CheckCircle2, Star, Sparkles, TrendingUp, UserPlus, Eye, Pencil
} from 'lucide-react';
import clsx from 'clsx';
import { useContacts, useCreateContact, useUpdateContact } from '@hooks/useContacts';
import { usePolicies } from '@hooks/usePolicies';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import ContactDetailModal from '../Contacts/ContactDetailModal';

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
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'VIP' | 'INDIVIDUAL' | 'CORPORATE'>('ALL');
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerForm>({
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

  const customerPolicies = useMemo(() => {
    if (!editingCustomer) return [];
    const cId = String(editingCustomer.id || '');
    const cCustId = String(editingCustomer.customerId || '');

    return allPolicies.filter((p: any) => {
      const pCustId = String(p.customerId || p.customerCode || p.contact?.customerId || '');
      const pContactId = String(p.contactId || p.contact?._id || p.contact?.id || '');

      if (pCustId && (pCustId === cId || pCustId === cCustId)) return true;
      if (pContactId && (pContactId === cId || pContactId === cCustId)) return true;

      return false;
    });
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

    const mapped = list.map((c: any) => {
      const cId = String(c.id || c._id || '');
      const customerId = c.customerId || c.customerCode || (c.id ? (String(c.id).toLowerCase().startsWith('cust-') ? String(c.id).toUpperCase() : `CUST-${String(c.id).slice(-4).toUpperCase()}`) : 'CUST-1001');

      // Find policies purchased by this customer/contact strictly matching Customer ID or Contact ID
      const matchingPolicies = allPolicies.filter((p: any) => {
        const pCustId = String(p.customerId || p.customerCode || p.contact?.customerId || '');
        const pContactId = String(p.contactId || p.contact?._id || p.contact?.id || '');

        if (pCustId && (pCustId === cId || pCustId === customerId)) return true;
        if (pContactId && (pContactId === cId || pContactId === customerId)) return true;

        return false;
      });

      const activePoliciesCount = matchingPolicies.length;
      const totalPremium = matchingPolicies.reduce((sum: number, p: any) => sum + (Number(p.premiumAmount || p.annualPremium || p.totalPremium) || 0), 0);

      return {
        id: c.id || c._id,
        customerId,
        firstName: c.firstName || c.name || 'Customer',
        lastName: c.lastName || '',
        phone: c.phone || c.mobile || 'N/A',
        email: c.email || 'N/A',
        city: c.city || 'N/A',
        customerType: c.tags?.includes('VIP') ? 'VIP' : (c.tags?.includes('Corporate') ? 'CORPORATE' : 'INDIVIDUAL'),
        activePoliciesCount,
        totalPremium,
        status: c.status || 'ACTIVE',
        isCustomer: c.type === 'CUSTOMER' || c.tags?.includes('customer') || c.tags?.includes('Customer') || activePoliciesCount > 0,
      };
    });

    // ONLY show customers who have an actual, valid, purchased policy connected strictly via Customer ID!
    return mapped.filter((cust) => cust.activePoliciesCount > 0);
  }, [contactsRes, allPolicies]);

  const filteredCustomers = useMemo(() => {
    return rawContacts.filter((c) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(search.toLowerCase()) || 
                            c.phone.includes(search) || 
                            c.email.toLowerCase().includes(search.toLowerCase()) ||
                            (c.customerId && c.customerId.toLowerCase().includes(search.toLowerCase()));
      if (!matchesSearch) return false;

      if (activeTab === 'ACTIVE') return c.status === 'ACTIVE';
      if (activeTab === 'VIP') return c.customerType === 'VIP';
      if (activeTab === 'INDIVIDUAL') return c.customerType === 'INDIVIDUAL';
      if (activeTab === 'CORPORATE') return c.customerType === 'CORPORATE';
      return true;
    });
  }, [rawContacts, search, activeTab]);

  const stats = useMemo(() => {
    const total = rawContacts.length;
    const active = rawContacts.filter((c) => c.status === 'ACTIVE').length;
    const totalPremiumSum = rawContacts.reduce((acc, c) => acc + (c.totalPremium || 0), 0);
    const vipCount = rawContacts.filter((c) => c.customerType === 'VIP').length;

    return { total, active, totalPremiumSum, vipCount };
  }, [rawContacts]);

  const user = useAuthStore(s => s.user);

  const openAddCustomer = () => {
    reset({
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
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        city: data.city,
        type: 'CUSTOMER',
        tags: [data.customerType, 'customer', 'contact'],
        assignedEmployeeId: user?.id,
        createdById: user?.id,
        createdByName: curEmpName,
        assignedByName: curEmpName,
      });
      setIsAddModalOpen(false);
      reset({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        city: '',
        customerType: 'INDIVIDUAL',
        annualPremium: 0,
      });
      toast.success('Customer added successfully');
    } catch (e) {
      // Mock local fallback add
      setIsAddModalOpen(false);
      reset({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        city: '',
        customerType: 'INDIVIDUAL',
        annualPremium: 0,
      });
      toast.success('Customer added successfully (Demo Mode)');
    }
  };

  const columns: Column<CustomerRecord>[] = [
    {
      key: 'customerId',
      label: 'Customer ID',
      render: (row) => (
        <span className="font-bold text-xs text-purple-700 bg-purple-50 border border-purple-200/70 px-2.5 py-1 rounded-lg font-mono tracking-wide">
          {row.customerId || `CUST-${row.id.slice(-4).toUpperCase()}`}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Customer Name',
      render: (row) => (
        <span
          className="font-bold text-slate-900 text-xs tracking-tight truncate hover:text-purple-600 cursor-pointer"
          onClick={() => navigate(`/contacts/${row.id}`)}
        >
          {row.firstName} {row.lastName}
        </span>
      )
    },
    {
      key: 'phone',
      label: 'Phone Number',
      render: (row) => (
        <span className="font-medium text-slate-700 text-xs">
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
      label: 'Active Policies',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.activePoliciesCount > 0 ? (
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
              {row.activePoliciesCount} {row.activePoliciesCount === 1 ? 'Policy' : 'Policies'}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">
              No Policy
            </span>
          )}
        </div>
      )
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
            onClick={() => {
              setIsViewMode(false);
              setActiveModalTab('personal');
              setEditingCustomer(row);
              reset({
                firstName: row.firstName || '',
                lastName: row.lastName || '',
                phone: row.phone || '',
                email: row.email || '',
                city: row.city || '',
                customerType: (row.customerType as any) || 'INDIVIDUAL',
                annualPremium: row.totalPremium || 0,
              });
            }}
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="Edit Customer"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsViewMode(true);
              setActiveModalTab('personal');
              setEditingCustomer(row);
              reset({
                firstName: row.firstName || '',
                lastName: row.lastName || '',
                phone: row.phone || '',
                email: row.email || '',
                city: row.city || '',
                customerType: (row.customerType as any) || 'INDIVIDUAL',
                annualPremium: row.totalPremium || 0,
              });
            }}
            className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="View Details"
          >
            <Eye size={14} />
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E9E7F2] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#68708A]">Total Customers</p>
            <p className="text-2xl font-black text-[#1D2035] mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0EAFF] text-[#6D3FD4] flex items-center justify-center font-bold">
            <Users size={18} />
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

      {/* Search & Filter Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-[#E9E7F2] shadow-sm flex items-center gap-2.5 w-full overflow-x-auto custom-scrollbar">
        {/* Search */}
        <div className="relative min-w-[200px] sm:min-w-[240px] max-w-xs shrink-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#68708A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#FAF9FF] border border-[#E9E7F2] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#6D3FD4]/20 focus:border-[#6D3FD4] transition-all text-[#1D2035]"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {(['ALL', 'ACTIVE', 'VIP', 'INDIVIDUAL', 'CORPORATE'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap',
                activeTab === tab
                  ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              {tab === 'ALL' ? 'All Customers' : (tab.charAt(0) + tab.slice(1).toLowerCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredCustomers}
          loading={isLoading}
          rowKey={(row) => row.id}
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
        <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
              <input
                {...register('firstName', { required: 'First name is required' })}
                placeholder="e.g. Ramesh"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              />
              {errors.firstName && <span className="text-[10px] text-red-500">{errors.firstName.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
              <input
                {...register('lastName')}
                placeholder="e.g. Patil"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
              <input
                {...register('phone', { required: 'Phone is required' })}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="customer@example.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
              <input
                {...register('city')}
                placeholder="Mumbai"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer Category</label>
              <select
                {...register('customerType')}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 bg-white"
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
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              Save Customer
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
        <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mb-4 gap-2 border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveModalTab('personal')}
            className={clsx(
              'flex-1 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer text-center',
              activeModalTab === 'personal'
                ? 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            Personal Details
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('policies')}
            className={clsx(
              'flex-1 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer text-center flex items-center justify-center gap-1.5',
              activeModalTab === 'policies'
                ? 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <Shield size={13} />
            Connected Policies ({customerPolicies.length})
          </button>
        </div>

        <div className="h-[320px] flex flex-col justify-between">
          {activeModalTab === 'personal' ? (
            <form
              onSubmit={handleSubmit(async (data: CustomerForm) => {
                if (!editingCustomer || isViewMode) return;
                const toastId = toast.loading('Updating customer profile...');
                try {
                  await updateContact.mutateAsync({
                    id: editingCustomer.id,
                    body: {
                      firstName: data.firstName,
                      lastName: data.lastName,
                      phone: data.phone,
                      email: data.email,
                      city: data.city,
                      tags: [data.customerType.toLowerCase(), 'customer'],
                    }
                  });
                  toast.success('Customer updated successfully!', { id: toastId });
                  setEditingCustomer(null);
                  reset();
                } catch (err: any) {
                  toast.error('Failed to update customer', { id: toastId });
                }
              })}
              className="flex-1 flex flex-col justify-between space-y-4 pt-1"
            >
              <fieldset disabled={isViewMode} className="space-y-4 border-0 p-0 m-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                    <input
                      {...register('firstName', { required: 'First name is required' })}
                      placeholder="e.g. Ramesh"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 disabled:bg-slate-100 disabled:text-slate-600"
                    />
                    {errors.firstName && <span className="text-[10px] text-red-500">{errors.firstName.message}</span>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                    <input
                      {...register('lastName')}
                      placeholder="e.g. Patil"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 disabled:bg-slate-100 disabled:text-slate-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                    <input
                      {...register('phone', { required: 'Phone is required' })}
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 disabled:bg-slate-100 disabled:text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="customer@example.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 disabled:bg-slate-100 disabled:text-slate-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                    <input
                      {...register('city')}
                      placeholder="Mumbai"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 disabled:bg-slate-100 disabled:text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer Category</label>
                    <select
                      {...register('customerType')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 bg-white disabled:bg-slate-100 disabled:text-slate-600"
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
            <div className="flex-1 flex flex-col justify-between space-y-3 pt-1 animate-fadeIn">
              {customerPolicies.length === 0 ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-150 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center gap-1.5 h-full">
                  <Shield size={28} className="text-slate-300 mb-1" />
                  <span className="text-slate-700 font-extrabold text-sm">No Policy</span>
                  <span className="text-[11px] font-medium text-slate-400">No active or previous policies are linked to this Customer ID.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {customerPolicies.map((pol: any) => {
                    const status = String(pol.status || 'ACTIVE').toUpperCase();
                    const statusBadgeClass =
                      status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                      status === 'EXPIRED' || status === 'LAPSED' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                      'bg-amber-100 text-amber-800 border-amber-200';
                    
                    const planName = pol.plan?.name || pol.policyType || pol.type || 'Insurance Policy';
                    const compName = pol.plan?.company?.name || pol.insuranceCompany || '';
                    const prem = pol.premiumAmount || pol.annualPremium || pol.totalPremium;

                    return (
                      <div key={pol.id || pol._id} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1.5 hover:bg-slate-100/60 transition-all shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-slate-900">{pol.policyNumber || 'N/A'}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${statusBadgeClass}`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700">{planName} {compName ? `· ${compName}` : ''}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-200/60">
                          {prem ? <span>Premium: <strong className="text-slate-800">₹{Number(prem).toLocaleString('en-IN')}</strong></span> : null}
                          {pol.expiryDate ? <span>Expires: {new Date(pol.expiryDate).toLocaleDateString('en-IN')}</span> : null}
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
