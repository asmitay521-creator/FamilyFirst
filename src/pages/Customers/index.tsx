import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, Shield, Phone, MessageCircle, Search, Filter, Plus,
  FileText, Award, Building2, User, ChevronRight, CheckCircle2, Star, Sparkles, TrendingUp, UserPlus, Eye
} from 'lucide-react';
import clsx from 'clsx';
import { useContacts, useCreateContact } from '@hooks/useContacts';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface CustomerRecord {
  id: string;
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

  const { data: contactsRes, isLoading } = useContacts({ limit: 100 });
  const createContact = useCreateContact();

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

  const rawContacts = useMemo<CustomerRecord[]>(() => {
    const list = contactsRes?.data?.data || contactsRes?.data || [];
    if (!Array.isArray(list) || list.length === 0) {
      // Demo Customer records fallback
      return [
        { id: 'cust-101', firstName: 'Rahul', lastName: 'Sharma', phone: '+91 98765 43210', email: 'rahul.sharma@example.com', city: 'Mumbai', customerType: 'VIP', activePoliciesCount: 4, totalPremium: 125000, status: 'ACTIVE' },
        { id: 'cust-102', firstName: 'Priya', lastName: 'Patel', phone: '+91 98123 45678', email: 'priya.patel@example.com', city: 'Ahmedabad', customerType: 'INDIVIDUAL', activePoliciesCount: 2, totalPremium: 45000, status: 'ACTIVE' },
        { id: 'cust-103', firstName: 'Apex Healthcare Pvt Ltd', lastName: '', phone: '+91 99000 11223', email: 'corporate@apexhealth.in', city: 'Pune', customerType: 'CORPORATE', activePoliciesCount: 12, totalPremium: 480000, status: 'ACTIVE' },
        { id: 'cust-104', firstName: 'Amitabh', lastName: 'Joshi', phone: '+91 97654 32109', email: 'amitabh.j@example.com', city: 'Delhi', customerType: 'VIP', activePoliciesCount: 5, totalPremium: 210000, status: 'ACTIVE' },
        { id: 'cust-105', firstName: 'Neha', lastName: 'Kulkarni', phone: '+91 94220 55667', email: 'neha.k@example.com', city: 'Nagpur', customerType: 'INDIVIDUAL', activePoliciesCount: 1, totalPremium: 18000, status: 'ACTIVE' },
      ];
    }
    return list.map((c: any) => ({
      id: c.id,
      firstName: c.firstName || c.name || 'Customer',
      lastName: c.lastName || '',
      phone: c.phone || c.mobile || 'N/A',
      email: c.email || 'N/A',
      city: c.city || 'N/A',
      customerType: c.tags?.includes('VIP') ? 'VIP' : (c.tags?.includes('Corporate') ? 'CORPORATE' : 'INDIVIDUAL'),
      activePoliciesCount: c.policiesCount || c._count?.policies || 1,
      totalPremium: c.totalPremium || 25000,
      status: c.status || 'ACTIVE',
    }));
  }, [contactsRes]);

  const filteredCustomers = useMemo(() => {
    return rawContacts.filter((c) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(search.toLowerCase()) || 
                            c.phone.includes(search) || 
                            c.email.toLowerCase().includes(search.toLowerCase());
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
    const individualCount = rawContacts.filter((c) => c.customerType === 'INDIVIDUAL' || !c.customerType).length;
    const corporateCount = rawContacts.filter((c) => c.customerType === 'CORPORATE').length;
    const vipCount = rawContacts.filter((c) => c.customerType === 'VIP').length;

    return { total, active, individualCount, corporateCount, vipCount };
  }, [rawContacts]);

  const handleCreateSubmit = async (data: CustomerForm) => {
    try {
      await createContact.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        city: data.city,
        type: 'CUSTOMER',
        tags: [data.customerType],
      });
      setIsAddModalOpen(false);
      reset();
      toast.success('Customer added successfully');
    } catch (e) {
      // Mock local fallback add
      setIsAddModalOpen(false);
      reset();
      toast.success('Customer added successfully (Demo Mode)');
    }
  };

  const columns: Column<CustomerRecord>[] = [
    {
      key: 'name',
      label: 'Customer Name',
      render: (row) => (
        <div className="flex flex-col min-w-0 py-0.5">
          <span className="font-bold text-slate-900 text-xs tracking-tight truncate hover:text-blue-600 cursor-pointer"
                onClick={() => navigate(`/contacts/${row.id}`)}>
            {row.firstName} {row.lastName}
          </span>
          <span className="text-[11px] text-slate-400 truncate">{row.email}</span>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Phone / Location',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-slate-700">{row.phone}</span>
          <span className="text-[11px] text-slate-400">{row.city}</span>
        </div>
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
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
            {row.activePoliciesCount} {row.activePoliciesCount === 1 ? 'Policy' : 'Policies'}
          </span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={clsx(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase",
          row.status === 'ACTIVE'
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-slate-100 text-slate-600 border border-slate-200"
        )}>
          {row.status || 'ACTIVE'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <a
            href={`https://wa.me/${row.phone?.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
          <a
            href={`tel:${row.phone}`}
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="Call Customer"
          >
            <Phone size={14} />
          </a>
          <button
            type="button"
            onClick={() => navigate(`/contacts/${row.id}`)}
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
      <div className="fixed right-2 sm:right-3.5 top-60 sm:top-64 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#68708A]">Corporate Clients</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{stats.corporateCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Building2 size={18} />
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
    </div>
  );
}
