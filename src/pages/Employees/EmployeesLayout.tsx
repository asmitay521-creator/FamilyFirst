import { useState, useMemo, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Plus, AlertTriangle, AlertCircle, Users, Target, CalendarCheck, FileText, ShieldCheck, Search, ChevronDown, X, UserPlus, UserCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService, subscriptionsService, contactsService } from '@api/index';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';

import { canEditModule, canManageModule } from '../../utils/permissions';
import { saveStoredEmployeePassword } from '../../utils/employeePasswordStorage';

// ─── Shared Employee type (re-exported so sub-pages can import it) ────────────
export interface Employee {
  id: string; firstName: string; lastName: string;
  user?: {
    id: string; email: string; role: string;
    permissions?: string[];
    lastLoginAt?: string | null;
    dailyLogs?: {
      checkIn: string | null; checkOut: string | null;
      notes?: string | null; callsMade?: number;
      visitsCompleted?: number; premiumCollected?: number;
      nextDayPlan?: string | null;
      adminRemarks?: string | null;
    }[];
  };
  designation?: string; department?: string; phone?: string; isActive: boolean;
  dateOfJoining?: string; dateOfBirth?: string; gender?: string;
  baseSalary?: number; bonusPlanned?: number; monthlyTarget?: number;
  bankName?: string; bankAccountNumber?: string; bankIfscCode?: string;
  bankBranch?: string; bankAccountType?: string;
  callsTarget?: number; visitsTarget?: number;
}

const createSchema = z.object({
  firstName:         z.string().min(1, 'Required'),
  lastName:          z.string().min(1, 'Required'),
  email:             z.string().email('Invalid email'),
  phone:             z.string().min(1, 'Phone is required').regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  password:          z.string().min(8, 'Min 8 characters'),
  aadhaarNumber:     z.string().min(1, 'Required').regex(/^\d{12}$/, 'Must be 12 digits'),
  designation:       z.string().optional(),
  department:        z.string().optional(),
  dateOfJoining:     z.string().or(z.literal('')).optional(),
  dateOfBirth:       z.string().or(z.literal('')).optional(),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER']).or(z.literal('')).optional(),
  baseSalary:        z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  bonusPlanned:      z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  monthlyTarget:     z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  callsTarget:       z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  visitsTarget:      z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode:      z.string().optional(),
  bankBranch:        z.string().optional(),
  bankAccountType:   z.string().optional(),
  contactId:         z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;


export default function EmployeesLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isOverview = location.pathname === '/employees' || location.pathname === '/employees/';
  const user      = useAuthStore(s => s.user);
  const [modalOpen, setModalOpen] = useState(false);
  const qc = useQueryClient();

  const canEditEmployees = canEditModule(user, 'employees');
  const canManageEmployees = canManageModule(user, 'employees');

  // Subscription + seat count
  const { data: subRes } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.current,
    staleTime: 5 * 60_000,
  });
  const { data: empMeta } = useQuery({
    queryKey: ['employees', 1],
    queryFn: () => employeesService.list({ page: 1, limit: 1 }),
  });

  const sub              = subRes?.data;
  const maxUsers         = sub?.plan?.maxUsers ?? 1;
  const activeUsersCount = empMeta?.meta?.total ?? 0;
  const usagePercentage  = maxUsers > 0 ? (activeUsersCount / maxUsers) * 100 : 0;
  const isLimitReached   = maxUsers !== -1 && activeUsersCount >= maxUsers;
  const isNearLimit      = maxUsers !== -1 && usagePercentage >= 80 && usagePercentage < 100;

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const { data: contactsData } = useQuery({
    queryKey: ['employees-contacts-list'],
    queryFn: () => contactsService.list({ limit: 500 }),
  });
  const contactsList = useMemo(() => {
    const arr = contactsData?.data ?? contactsData ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [contactsData]);

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'all-for-select'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });
  const employeesList = useMemo(() => {
    const arr = employeesData?.data ?? employeesData ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [employeesData]);

  const [selectedContactId, setSelectedContactId] = useState('');
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setIsContactDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Combine both existing employees and contacts into a single list
  const combinedList = useMemo(() => {
    const items: Array<{
      id: string;
      sourceType: 'EMPLOYEE' | 'CONTACT';
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      role?: string;
      designation?: string;
      department?: string;
      aadhaarNumber?: string;
      dateOfBirth?: string;
      gender?: string;
      dateOfJoining?: string;
      baseSalary?: number;
      raw: any;
    }> = [];

    // 1. Add Existing Employees
    employeesList.forEach((emp: any) => {
      items.push({
        id: emp.id || emp.userId || emp.user?.id || Math.random().toString(),
        sourceType: 'EMPLOYEE',
        firstName: emp.firstName || emp.user?.firstName || '',
        lastName: emp.lastName || emp.user?.lastName || '',
        email: emp.email || emp.user?.email || '',
        phone: emp.phone || emp.user?.phone || '',
        role: emp.user?.role || emp.role || 'EMPLOYEE',
        designation: emp.designation || '',
        department: emp.department || '',
        aadhaarNumber: emp.aadhaarNumber || '',
        dateOfBirth: emp.dateOfBirth || '',
        gender: emp.gender || '',
        dateOfJoining: emp.dateOfJoining || '',
        baseSalary: emp.baseSalary,
        raw: emp,
      });
    });

    // 2. Add Contacts (avoid duplicates if email/phone matches an existing employee)
    contactsList.forEach((c: any) => {
      const email = (c.email || '').trim().toLowerCase();
      const phone = (c.phone || '').replace(/\D/g, '');
      const alreadyInEmployees = items.some(it => 
        (email && it.email && it.email.toLowerCase() === email) ||
        (phone && it.phone && it.phone.replace(/\D/g, '') === phone)
      );
      if (!alreadyInEmployees) {
        items.push({
          id: c.id,
          sourceType: 'CONTACT',
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          role: c.leadStage || 'CONTACT',
          aadhaarNumber: c.aadhaarNumber || '',
          dateOfBirth: c.dob || c.dateOfBirth || '',
          gender: c.gender || '',
          raw: c,
        });
      }
    });

    return items;
  }, [employeesList, contactsList]);

  const filteredCombinedList = useMemo(() => {
    if (!contactSearch.trim()) return combinedList;
    const q = contactSearch.toLowerCase().trim();
    return combinedList.filter((item) => {
      const fullName = `${item.firstName} ${item.lastName}`.toLowerCase();
      const phone = (item.phone || '').toLowerCase();
      const email = (item.email || '').toLowerCase();
      const role = (item.role || '').toLowerCase();
      const desig = (item.designation || '').toLowerCase();
      const dept = (item.department || '').toLowerCase();
      return (
        fullName.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        desig.includes(q) ||
        dept.includes(q)
      );
    });
  }, [combinedList, contactSearch]);

  const selectContactItem = (item: any | null) => {
    if (item) {
      const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim();
      setSelectedContactId(item.id);
      setContactSearch(fullName || item.email || item.phone);
      setValue('firstName', item.firstName || '');
      setValue('lastName', item.lastName || '');
      setValue('phone', (item.phone || '').replace(/\D/g, '').slice(0, 10));
      setValue('email', item.email || '');
      if (item.aadhaarNumber) setValue('aadhaarNumber', String(item.aadhaarNumber).replace(/\D/g, '').slice(0, 12));
      if (item.dateOfBirth) setValue('dateOfBirth', item.dateOfBirth);
      if (item.gender) setValue('gender', item.gender);
      if (item.designation) setValue('designation', item.designation);
      if (item.department) setValue('department', item.department);
      if (item.dateOfJoining) setValue('dateOfJoining', item.dateOfJoining);
      if (item.sourceType === 'CONTACT') {
        setValue('contactId', item.id);
      } else {
        setValue('contactId', '');
      }
    } else {
      setSelectedContactId('');
      setContactSearch('');
      setValue('contactId', '');
      setValue('firstName', '');
      setValue('lastName', '');
      setValue('phone', '');
      setValue('email', '');
      setValue('aadhaarNumber', '');
      setValue('designation', '');
      setValue('department', '');
      setValue('dateOfJoining', '');
      setValue('dateOfBirth', '');
      setValue('gender', '');
    }
    setIsContactDropdownOpen(false);
  };

  const createEmployee = useMutation({
    mutationFn: (body: CreateForm) => employeesService.create(body),
    onSuccess: (res: any, variables: CreateForm) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      const newEmpId = res?.data?.id || res?.id;
      if (variables.password) {
        saveStoredEmployeePassword(
          {
            id: newEmpId,
            email: variables.email,
            phone: variables.phone,
            firstName: variables.firstName,
          },
          variables.password
        );
      }
      setModalOpen(false);
      reset();
      toast.success('Employee created successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create employee'),
  });

  const openCreateModal = () => {
    reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      aadhaarNumber: '',
      designation: '',
      department: '',
      dateOfJoining: '',
      dateOfBirth: '',
      gender: '',
      baseSalary: '' as any,
      bonusPlanned: '' as any,
      monthlyTarget: '' as any,
      callsTarget: '' as any,
      visitsTarget: '' as any,
      bankName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      bankBranch: '',
      bankAccountType: '',
      contactId: '',
    });
    setSelectedContactId('');
    setContactSearch('');
    setIsContactDropdownOpen(false);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 relative pb-20">
      {/* Near-limit warning */}
      {isNearLimit && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">Capacity Warning:</span> You have used {activeUsersCount} of your {maxUsers === -1 ? 'unlimited' : maxUsers} seats ({Math.round(usagePercentage)}%).
            </span>
          </div>
          {user?.role === 'OWNER' && (
            <button onClick={() => navigate('/subscription')} className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline cursor-pointer">Upgrade Now</button>
          )}
        </div>
      )}

      {/* Limit-reached error */}
      {isLimitReached && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">Limit Reached:</span> You have reached your limit of {maxUsers} user/employee seats.
            </span>
          </div>
          {user?.role === 'OWNER' && (
            <button onClick={() => navigate('/subscription')} className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline cursor-pointer">Upgrade Now</button>
          )}
        </div>
      )}

      {/* Sub-page Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto custom-scrollbar">
          {[
            { label: 'Directory', path: '/employees', icon: Users },
            { label: 'Attendance & Leaves', path: '/employees/attendance', icon: CalendarCheck },
            { label: 'Reports', path: '/employees/eod-reports', icon: FileText },
            ...(canManageEmployees ? [{ label: 'Access Control', path: '/employees/access-control', icon: ShieldCheck }] : []),
          ].map(tab => {
            const isActive = tab.path === '/employees'
              ? location.pathname === '/employees' || location.pathname === '/employees/'
              : location.pathname.startsWith(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={clsx(
                  'px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap select-none border',
                  isActive
                    ? 'text-white border-transparent shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                )}
                style={isActive ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Right Action Panel (Add Employee) */}
      {canEditEmployees && (
        <div className="fixed right-2 sm:right-3.5 top-60 sm:top-64 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={isLimitReached}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative disabled:opacity-60 disabled:cursor-not-allowed"
            title={isLimitReached ? 'Limit reached. Upgrade plan to add more user seats.' : 'Add Employee'}
          >
            <UserPlus size={14} strokeWidth={2.2} />
            <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
              Add Employee
            </span>
          </button>
        </div>
      )}

      {/* Sub-page rendered here */}
      <Outlet />

      {/* ── Create Employee Modal ──────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); setSelectedContactId(''); setContactSearch(''); setIsContactDropdownOpen(false); }} title="New Employee" size="xl">
        <form onSubmit={handleSubmit(async body => { try { await createEmployee.mutateAsync(body); } catch {} })} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60 relative">
              <label className="label font-bold text-slate-700 block mb-1.5">
                Link Existing Employee / Contact (Select or Promote)
              </label>

              {/* Direct Searchable Combobox */}
              <div ref={contactDropdownRef} className="relative">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-2xs"
                    placeholder="Search or select employee / contact (e.g. Vaishnavi, Asmita, Super Admin)..."
                    value={contactSearch}
                    onFocus={() => setIsContactDropdownOpen(true)}
                    onClick={() => setIsContactDropdownOpen(true)}
                    onChange={e => {
                      setContactSearch(e.target.value);
                      setIsContactDropdownOpen(true);
                      if (!e.target.value.trim()) {
                        setSelectedContactId('');
                        setValue('contactId', '');
                      }
                    }}
                  />
                  {contactSearch ? (
                    <button
                      type="button"
                      onClick={() => {
                        selectContactItem(null);
                        setIsContactDropdownOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                      title="Clear selection"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsContactDropdownOpen(!isContactDropdownOpen)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform duration-150 ${isContactDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </div>

                {/* Dropdown Options List */}
                {isContactDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 animate-fadeIn text-xs max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectContactItem(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors select-none cursor-pointer flex items-center justify-between mb-1 ${
                        !selectedContactId ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>-- None / Create New Employee Manually --</span>
                      {!selectedContactId && <span className="text-purple-600 font-bold">✓</span>}
                    </button>

                    {filteredCombinedList.length === 0 ? (
                      <div className="px-3 py-4 text-center text-slate-400 font-semibold italic text-xs">
                        No matching employees or contacts found {contactSearch ? `for "${contactSearch}"` : ''}
                      </div>
                    ) : (
                      filteredCombinedList.map((item) => {
                        const isSel = item.id === selectedContactId;
                        const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unnamed';
                        const isEmployee = item.sourceType === 'EMPLOYEE';

                        return (
                          <button
                            key={`${item.sourceType}-${item.id}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectContactItem(item);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-2 select-none cursor-pointer group ${
                              isSel ? 'bg-purple-50 border border-purple-200 text-purple-900' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800 text-xs truncate group-hover:text-purple-700 transition-colors">
                                  {fullName}
                                </span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase ${
                                  isEmployee
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}>
                                  {isEmployee ? (item.role || 'EMPLOYEE') : (item.role || 'CONTACT')}
                                </span>
                                {item.designation && (
                                  <span className="text-[10px] text-slate-400 font-medium truncate">
                                    • {item.designation}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium mt-0.5 flex-wrap">
                                {item.phone && <span>📱 {item.phone}</span>}
                                {item.email && <span className="truncate">✉️ {item.email}</span>}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                                isSel
                                  ? 'bg-purple-600 text-white'
                                  : isEmployee
                                    ? 'bg-emerald-100/80 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white'
                                    : 'bg-purple-100/80 text-purple-800 group-hover:bg-purple-600 group-hover:text-white'
                              }`}>
                                {isSel ? 'Selected ✓' : isEmployee ? 'Autofill' : 'Promote'}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">First Name <span className="text-red-500">*</span></label>
              <input {...register('firstName')} className="input" placeholder="Ravi" />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name <span className="text-red-500">*</span></label>
              <input {...register('lastName')} className="input" placeholder="Sharma" />
              {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
            </div>
            <div>
              <label className="label">Email <span className="text-red-500">*</span></label>
              <input {...register('email')} type="email" className="input" placeholder="ravi@agency.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Phone <span className="text-red-500">*</span></label>
              <input
                {...register('phone', {
                  onChange: (e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setValue('phone', digits);
                  }
                })}
                type="tel"
                className="input"
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
              />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Password <span className="text-red-500">*</span></label>
              <input {...register('password')} type="password" className="input" placeholder="Min 8 characters" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Aadhaar Number <span className="text-red-500">*</span></label>
              <input
                {...register('aadhaarNumber', {
                  onChange: (e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                    setValue('aadhaarNumber', digits);
                  }
                })}
                type="text"
                className="input"
                placeholder="12-digit Aadhaar number"
                maxLength={12}
                inputMode="numeric"
              />
              {errors.aadhaarNumber && <p className="text-xs text-red-500 mt-1">{errors.aadhaarNumber.message}</p>}
            </div>
            <div>
              <label className="label">Designation</label>
              <input {...register('designation')} className="input" placeholder="Sales Agent" />
            </div>
            <div>
              <label className="label">Department</label>
              <input {...register('department')} className="input" placeholder="Life Insurance" />
            </div>
            <div>
              <label className="label">Gender</label>
              <select {...register('gender')} className="input">
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Joining</label>
              <DatePicker {...register('dateOfJoining')} className="input" />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <DatePicker {...register('dateOfBirth')} className="input" />
            </div>
            <div>
              <label className="label">Base Salary (₹)</label>
              <input {...register('baseSalary')} type="number" className="input" placeholder="e.g. 30000" />
            </div>
            <div>
              <label className="label">Bonus Planned (₹)</label>
              <input {...register('bonusPlanned')} type="number" className="input" placeholder="e.g. 5000" />
            </div>
            <div>
              <label className="label">Monthly Sales Target (₹)</label>
              <input {...register('monthlyTarget')} type="number" className="input" placeholder="e.g. 100000" />
            </div>
            <div>
              <label className="label">Daily Calls Target</label>
              <input {...register('callsTarget')} type="number" className="input" placeholder="e.g. 30" />
            </div>
            <div>
              <label className="label">Proposal Target</label>
              <input {...register('visitsTarget')} type="number" className="input" placeholder="e.g. 5" />
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Details</h3>
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input {...register('bankName')} className="input text-xs" placeholder="e.g. HDFC Bank" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input {...register('bankAccountNumber')} className="input text-xs" placeholder="e.g. 50100123" />
              </div>
              <div>
                <label className="label">IFSC Code</label>
                <input {...register('bankIfscCode')} className="input text-xs" placeholder="e.g. HDFC0000123" />
              </div>
              <div>
                <label className="label">Branch Name</label>
                <input {...register('bankBranch')} className="input text-xs" placeholder="e.g. Connaught Place" />
              </div>
              <div>
                <label className="label">Account Type</label>
                <select {...register('bankAccountType')} className="input text-xs">
                  <option value="">Select type</option>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setModalOpen(false); reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createEmployee.isPending}>
              {createEmployee.isPending ? 'Saving…' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
