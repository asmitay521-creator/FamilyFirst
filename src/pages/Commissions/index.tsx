import React from 'react';
import { useState } from 'react';
import { Plus, FileText, User, Trash2, Search, TrendingUp, CheckCircle, Clock, DollarSign, Pencil, Wallet, Coins, ArrowRight, Shield, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commissionsService, policiesService, employeesService } from '@api/index';
import Modal from '@comps/common/Modal';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { DatePicker } from '@comps/common/DatePicker';
import clsx from 'clsx';
import { useAuthStore } from '@store/auth.store';
import { sortData } from '../../utils/sortUtils';
import { deletionRequestsService } from '@api/deletionRequestsService';

interface Commission {
  id: string; amount: number; rate: number; isPaid: boolean; paidAt?: string;
  notes?: string;
  policy?: { policyNumber: string };
  commissionYear?: { name: string };
  beneficiary?: { employeeProfile?: { firstName: string; lastName: string } };
}

const schema = z.object({
  policyId:         z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a policy'),
  beneficiaryId:    z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select an employee'),
  commissionYearId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a year'),
  amount:           z.coerce.number().min(0),
  rate:             z.coerce.number().min(0).max(100).optional(),
  notes:            z.string().optional(),
  
  basePremium:          z.coerce.number().optional(),
  baseCommissionRate:   z.coerce.number().optional(),
  baseCommissionAmount: z.coerce.number().optional(),
  
  addonPremium:          z.coerce.number().optional(),
  addonCommissionRate:   z.coerce.number().optional(),
  addonCommissionAmount: z.coerce.number().optional(),
  
  deductibleRate:        z.coerce.number().optional(),
  deductibleAmount:      z.coerce.number().optional(),
  monthlyGridRate:       z.coerce.number().optional(),
  monthlyGridAmount:     z.coerce.number().optional(),
  otherRate:             z.coerce.number().optional(),
  otherAmount:           z.coerce.number().optional(),
  renewalRate:           z.coerce.number().optional(),
  renewalAmount:         z.coerce.number().optional(),
  
  year1Commission:       z.coerce.number().optional(),
  year2Commission:       z.coerce.number().optional(),
  year3Commission:       z.coerce.number().optional(),
  year4Commission:       z.coerce.number().optional(),
  year5Commission:       z.coerce.number().optional(),
});
type Form = z.infer<typeof schema>;

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Section header inside modal ────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ── Small read-only computed cell ──────────────────────────────────────────────
function ComputedCell({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
      <div className={clsx(
        'px-2.5 py-1.5 rounded-lg text-sm font-bold border text-right',
        green ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-700'
      )}>
        {value}
      </div>
    </div>
  );
}

export default function Commissions() {
  const { user: authUser } = useAuthStore();
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [payConfirm, setPayConfirm] = useState<Commission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Commission | null>(null);
  const qc = useQueryClient();

  // Policy picker state
  const [policySearch, setPolicySearch]     = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<{ id: string; policyNumber: string } | null>(null);
  const [policyDrop, setPolicyDrop]         = useState(false);

  // Employee picker state
  const [empSearch, setEmpSearch]   = useState('');
  const [selectedEmp, setSelectedEmp] = useState<{ id: string; userId: string; firstName: string; lastName: string } | null>(null);
  const [empDrop, setEmpDrop]       = useState(false);

  // Visual-only addon/deduction state removed (now in React Hook Form schema)

  const { data, isLoading } = useQuery({
    queryKey: ['commissions', page],
    queryFn:  () => commissionsService.list({ page, limit: 20 }),
  });
  const { data: summary } = useQuery({
    queryKey: ['commissions', 'overview'],
    queryFn:  () => commissionsService.overview(),
  });
  const { data: yearsData } = useQuery({
    queryKey: ['commission-years'],
    queryFn:  () => commissionsService.years(),
    enabled:  modalOpen,
  });
  const { data: policyResults, isLoading: policyLoading } = useQuery({
    queryKey: ['policy-search-comm', policySearch],
    queryFn:  () => policiesService.list({ search: policySearch, limit: 8 }),
  });
  const { data: empResults, isLoading: empLoading } = useQuery({
    queryKey: ['emp-search-comm', empSearch],
    queryFn:  () => employeesService.list({ search: empSearch, limit: 8 }),
  });

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  // Live-watch for computed displays
  const w = useWatch({ control });

  // Computed values
  const basePrem     = Number(w.basePremium) || 0;
  const baseRate     = Number(w.baseCommissionRate) || 0;
  const baseComm     = Number(w.baseCommissionAmount) || (basePrem * (baseRate / 100));

  const addonPrem    = Number(w.addonPremium) || 0;
  const addonRate    = Number(w.addonCommissionRate) || 0;
  const addonComm    = Number(w.addonCommissionAmount) || (addonPrem * (addonRate / 100));

  const totalPremium = basePrem + addonPrem;

  const deducRate    = Number(w.deductibleRate) || 0;
  const deducComm    = Number(w.deductibleAmount) || (totalPremium * (deducRate / 100));

  const gridRate     = Number(w.monthlyGridRate) || 0;
  const gridComm     = Number(w.monthlyGridAmount) || (totalPremium * (gridRate / 100));

  const otherRate    = Number(w.otherRate) || 0;
  const otherComm    = Number(w.otherAmount) || (totalPremium * (otherRate / 100));

  const renewalRate  = Number(w.renewalRate) || 0;
  const renewalComm  = Number(w.renewalAmount) || (totalPremium * (renewalRate / 100));

  const totalComm    = (baseComm + addonComm + gridComm + otherComm + renewalComm) - deducComm;
  const yearlyShare  = totalComm / 5;

  const createYear = useMutation({
    mutationFn: (body: { name: string; year: number }) => commissionsService.createYear(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-years'] }),
  });
  const [newYearInput, setNewYearInput] = useState(false);
  const [newYearVal, setNewYearVal]     = useState(new Date().getFullYear());

  const createCommission = useMutation({
    mutationFn: (body: Form) => commissionsService.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); closeModal(); },
  });
  const markPaid = useMutation({
    mutationFn: (id: string) => commissionsService.markPaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); setPayConfirm(null); },
  });
  const deleteCommission = useMutation({
    mutationFn: (id: string) => commissionsService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); toast.success('Commission deleted'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting commission'),
  });

  const closeModal = () => {
    setModalOpen(false); reset();
    setSelectedPolicy(null); setPolicySearch('');
    setSelectedEmp(null);    setEmpSearch('');
    setNewYearInput(false);
  };

  const totals = summary?.data ?? {};
  const years: any[] = yearsData?.data ?? [];

  // Client-side search filter
  const allRows: Commission[] = data?.data ?? [];
  const filtered = search.trim()
    ? allRows.filter(r =>
        r.policy?.policyNumber?.toLowerCase().includes(search.toLowerCase()) ||
        `${r.beneficiary?.employeeProfile?.firstName ?? ''} ${r.beneficiary?.employeeProfile?.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : allRows;
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedFiltered = React.useMemo(() => {
    return sortData(filtered, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'AGENT') return `${row.beneficiary?.employeeProfile?.firstName ?? ''} ${row.beneficiary?.employeeProfile?.lastName ?? ''}`;
      if (key === 'POLICY') return row.policy?.policyNumber ?? '';
      if (key === 'BASE') return Number(row.amount ?? 0);
      if (key === 'ADDON') return Number(row.addon ?? 0);
      if (key === 'DEDUCTIBLE') return Number(row.deductible ?? 0);
      if (key === 'TOTAL') return Number(row.amount ?? 0) + Number(row.addon ?? 0) - Number(row.deductible ?? 0);
      if (key === 'STATUS') return row.isPaid ? 1 : -1;
      return row[key];
    });
  }, [filtered, sortKey, sortDir]);

  const STAT_CARDS = [
    { label: 'Total Commission',   value: `₹${Number((totals as any).totalAmount   ?? 0).toLocaleString('en-IN')}`, icon: TrendingUp,  bg: 'bg-blue-50',   text: 'text-blue-700'  },
    { label: 'Paid Commission',    value: `₹${Number((totals as any).paidAmount    ?? 0).toLocaleString('en-IN')}`, icon: CheckCircle, bg: 'bg-green-50',  text: 'text-green-700' },
    { label: 'Pending Commission', value: `₹${Number((totals as any).pendingAmount ?? 0).toLocaleString('en-IN')}`, icon: Clock,       bg: 'bg-amber-50',  text: 'text-amber-700' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STAT_CARDS.map(({ label, value, icon: Icon, bg, text }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
              <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', bg)}>
                <Icon size={22} className={text} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Search + Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by policy, client, ID…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-slate-800"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            <button
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
              onClick={() => setModalOpen(true)}
            >
              <Plus size={15} /> Add Commission
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {['POLICY', 'AGENT', 'BASE', 'ADDON', 'DEDUCTIBLE', 'TOTAL', 'STATUS', 'ACTIONS'].map(h => (
                  <th key={h} 
                    className={clsx("px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap select-none border border-slate-200", h !== 'ACTIONS' && "cursor-pointer hover:text-gray-900")}
                    onClick={() => {
                      if (h === 'ACTIONS') return;
                      if (sortKey === h) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(h); setSortDir('asc'); }
                    }}
                  >
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {h}
                      {h !== 'ACTIONS' && (
                        <span className="text-slate-400">
                          {sortKey === h
                            ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                            : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : sortedFiltered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <DollarSign size={40} className="text-gray-200" />
                      <p className="font-medium text-gray-500">No commissions found</p>
                      <p className="text-xs">Add a commission to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedFiltered.map((r, idx) => {
                  const agent      = r.beneficiary?.employeeProfile ? `${r.beneficiary.employeeProfile.firstName} ${r.beneficiary.employeeProfile.lastName}` : 'N/A';
                  const base       = Number(r.amount ?? 0);
                  const addon      = Number((r as any).addon ?? 0);
                  const deductible = Number((r as any).deductible ?? 0);
                  const total      = base + addon - deductible;
                  return (
                    <tr key={r.id} className={clsx("transition-colors group", idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white')}>
                      <td className="px-5 py-4 border border-slate-200">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{r.policy?.policyNumber ?? '—'}</span>
                          <span className="text-[11px] text-gray-400">{r.commissionYear?.name ?? ''}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-700 border border-slate-200">{agent}</td>
                      <td className="px-5 py-4 font-semibold text-gray-700 border border-slate-200">₹{base.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 font-semibold text-gray-700 border border-slate-200">{addon > 0 ? `₹${addon.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-5 py-4 border border-slate-200"><span className={clsx('font-semibold', deductible > 0 ? 'text-red-500' : 'text-gray-400')}>{deductible > 0 ? `-₹${deductible.toLocaleString('en-IN')}` : '—'}</span></td>
                      <td className="px-5 py-4 font-bold text-emerald-600 border border-slate-200">₹{total.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 border border-slate-200">
                        <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider', r.isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', r.isPaid ? 'bg-green-500' : 'bg-amber-500')} />
                          {r.isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-5 py-4 border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-1">
                          {!r.isPaid && (
                            <button className="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap transition-colors" onClick={() => setPayConfirm(r)}>
                              Mark Paid
                            </button>
                          )}
                          <button title="Delete" className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all" onClick={() => setDeleteTarget(r)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {(data?.meta?.total ?? 0) > 20 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">Page {page} of {Math.ceil((data?.meta?.total ?? 0) / 20)}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Previous</button>
              <button disabled={page >= Math.ceil((data?.meta?.total ?? 0) / 20)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Add New Commission Modal — rich multi-section calculator UI
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={closeModal} title="Add New Commission" subtitle="Create a new commission entry for an agent" size="xl">
        <form onSubmit={handleSubmit(d => createCommission.mutateAsync(d))} className="space-y-4 mt-2">

          {/* ── Row 1: Policy + Agent ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Policy picker */}
            <div>
              <label className="label">Policy *</label>
              <input type="hidden" {...register('policyId')} />
              {selectedPolicy ? (
                <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl border border-blue-100 bg-blue-50/30 h-10 w-full relative">
                  <Shield size={15} className="text-blue-500 shrink-0" />
                  <span className="text-xs font-semibold text-blue-800 truncate flex-1">{selectedPolicy.policyNumber}</span>
                  <button type="button" onClick={() => { setSelectedPolicy(null); setValue('policyId', ''); }} className="text-blue-400 hover:text-blue-700 text-xs shrink-0 pr-1">✕</button>
                </div>
              ) : (
                <div className="relative">
                  <Shield size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input value={policySearch} onChange={e => { setPolicySearch(e.target.value); setPolicyDrop(true); }}
                    onFocus={() => setPolicyDrop(true)} onBlur={() => setTimeout(() => setPolicyDrop(false), 150)}
                    placeholder="Select Policy" className="input pl-10 pr-8 h-10 text-xs w-full bg-white rounded-xl" />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
                  {policyDrop && (
                    <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {policyLoading ? (
                        <li className="px-3 py-2 text-sm text-gray-400">Loading...</li>
                      ) : (policyResults?.data ?? []).length === 0 ? (
                        <li className="px-3 py-2 text-sm text-gray-400">No policies found</li>
                      ) : (
                        (policyResults?.data ?? []).map((p: any) => (
                          <li key={p.id} onMouseDown={() => { setSelectedPolicy(p); setValue('policyId', p.id, { shouldValidate: true }); setPolicyDrop(false); setPolicySearch(''); }}
                            className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                            <FileText size={12} className="text-gray-400" /><span>{p.policyNumber}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}
              {errors.policyId && <p className="text-xs text-red-500 mt-1">{errors.policyId.message}</p>}
            </div>

            {/* Readonly Auto-filled Fields */}
            {selectedPolicy && (
              <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-blue-50/20 border border-blue-100 rounded-xl mb-2">
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold uppercase">Customer</label>
                  <div className="text-xs font-bold text-gray-800">
                    {(selectedPolicy as any).contact?.firstName} {(selectedPolicy as any).contact?.lastName}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold uppercase">Company</label>
                  <div className="text-xs font-bold text-gray-800">
                    {(selectedPolicy as any).plan?.company?.name || 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold uppercase">Policy Term</label>
                  <div className="text-xs font-bold text-gray-800">
                    {(selectedPolicy as any).startDate && (selectedPolicy as any).endDate 
                      ? `${new Date((selectedPolicy as any).startDate).getFullYear()} - ${new Date((selectedPolicy as any).endDate).getFullYear()}`
                      : 'N/A'}
                  </div>
                </div>
              </div>
            )}

            {/* Agent picker */}
            <div>
              <label className="label">Agent *</label>
              <input type="hidden" {...register('beneficiaryId')} />
              {selectedEmp ? (
                <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl border border-green-100 bg-green-50/30 h-10 w-full relative">
                  <User size={15} className="text-green-500 shrink-0" />
                  <span className="text-xs font-semibold text-green-800 truncate flex-1">{selectedEmp.firstName} {selectedEmp.lastName}</span>
                  <button type="button" onClick={() => { setSelectedEmp(null); setValue('beneficiaryId', ''); }} className="text-green-400 hover:text-green-700 text-xs shrink-0 pr-1">✕</button>
                </div>
              ) : (
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input value={empSearch} onChange={e => { setEmpSearch(e.target.value); setEmpDrop(true); }}
                    onFocus={() => setEmpDrop(true)} onBlur={() => setTimeout(() => setEmpDrop(false), 150)}
                    placeholder="Select Agent" className="input pl-10 pr-8 h-10 text-xs w-full bg-white rounded-xl" />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
                  {empDrop && (
                    <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {empLoading ? (
                        <li className="px-3 py-2 text-sm text-gray-400">Loading...</li>
                      ) : (empResults?.data ?? []).length === 0 ? (
                        <li className="px-3 py-2 text-sm text-gray-400">No employees found</li>
                      ) : (
                        (empResults?.data ?? []).map((e: any) => (
                          <li key={e.id} onMouseDown={() => {
                            setSelectedEmp({ id: e.id, userId: e.userId, firstName: e.firstName, lastName: e.lastName });
                            setValue('beneficiaryId', e.userId, { shouldValidate: true });
                            setEmpDrop(false); setEmpSearch('');
                          }} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-green-50 cursor-pointer">
                            <User size={12} className="text-gray-400" /><span>{e.firstName} {e.lastName}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}
              {errors.beneficiaryId && <p className="text-xs text-red-500 mt-1">{errors.beneficiaryId.message}</p>}
            </div>
          </div>

          {/* ── Commission Split Inputs ────────────────────────────────────── */}
          <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-slate-700 font-bold text-xs">
              <Coins size={15} className="text-blue-500" />
              <span>Detailed Breakdown</span>
            </div>
            
            {/* Table-like headers for alignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold text-slate-500 mb-2">
              <div>Type</div>
              <div>Premium / Base</div>
              <div>Rate (%)</div>
              <div>Amount (₹)</div>
            </div>

            {/* Base Premium */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <span className="text-xs font-medium">Base Premium</span>
              <input {...register('basePremium')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-slate-200" />
              <input {...register('baseCommissionRate')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-slate-200" />
              <div className="h-9 px-3 flex items-center justify-end bg-green-50 text-green-700 font-bold text-xs rounded-lg border border-green-200">
                {w.baseCommissionAmount ? fmt(Number(w.baseCommissionAmount)) : fmt(baseComm)}
              </div>
            </div>

            {/* Addon Premium */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <span className="text-xs font-medium">Addon Premium</span>
              <input {...register('addonPremium')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-slate-200" />
              <input {...register('addonCommissionRate')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-slate-200" />
              <div className="h-9 px-3 flex items-center justify-end bg-green-50 text-green-700 font-bold text-xs rounded-lg border border-green-200">
                {w.addonCommissionAmount ? fmt(Number(w.addonCommissionAmount)) : fmt(addonComm)}
              </div>
            </div>

            {/* Monthly Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <span className="text-xs font-medium">Monthly Grid</span>
              <div className="text-[10px] text-gray-400">on Total Prem: {fmt(totalPremium)}</div>
              <input {...register('monthlyGridRate')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-slate-200" />
              <div className="h-9 px-3 flex items-center justify-end bg-green-50 text-green-700 font-bold text-xs rounded-lg border border-green-200">
                {w.monthlyGridAmount ? fmt(Number(w.monthlyGridAmount)) : fmt(gridComm)}
              </div>
            </div>

            {/* Other */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <span className="text-xs font-medium">Other</span>
              <div className="text-[10px] text-gray-400">on Total Prem: {fmt(totalPremium)}</div>
              <input {...register('otherRate')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-slate-200" />
              <div className="h-9 px-3 flex items-center justify-end bg-green-50 text-green-700 font-bold text-xs rounded-lg border border-green-200">
                {w.otherAmount ? fmt(Number(w.otherAmount)) : fmt(otherComm)}
              </div>
            </div>

            {/* Renewal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <span className="text-xs font-medium">Renewal</span>
              <div className="text-[10px] text-gray-400">on Total Prem: {fmt(totalPremium)}</div>
              <input {...register('renewalRate')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-slate-200" />
              <div className="h-9 px-3 flex items-center justify-end bg-green-50 text-green-700 font-bold text-xs rounded-lg border border-green-200">
                {w.renewalAmount ? fmt(Number(w.renewalAmount)) : fmt(renewalComm)}
              </div>
            </div>

            {/* Deductible */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center pt-2 border-t border-slate-200 border-dashed">
              <span className="text-xs font-bold text-red-500">Deductible (-)</span>
              <div className="text-[10px] text-gray-400">on Total Prem: {fmt(totalPremium)}</div>
              <input {...register('deductibleRate')} type="number" step="0.01" placeholder="0" className="input h-9 text-xs rounded-lg w-full bg-white border border-red-200" />
              <div className="h-9 px-3 flex items-center justify-end bg-red-50 text-red-600 font-bold text-xs rounded-lg border border-red-200">
                {w.deductibleAmount ? fmt(Number(w.deductibleAmount)) : fmt(deducComm)}
              </div>
            </div>
            
            {/* Hidden amounts to pass form validation if calculated automatically */}
            <input type="hidden" {...register('amount')} value={totalComm} />
            <input type="hidden" {...register('rate')} value={0} />
          </div>

          {/* ── Two Column Bottom Row ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-slate-700 font-bold text-xs">
                  <Calendar size={15} className="text-blue-500" />
                  <span>Commission Year & Breakdown</span>
                </div>

                {/* Year picker */}
                <div>
                  <label className="label">Commission Year *</label>
                  {newYearInput ? (
                    <div className="flex gap-2 items-center">
                      <input type="number" value={newYearVal} onChange={e => setNewYearVal(Number(e.target.value))} className="input w-28 h-10 text-xs rounded-xl bg-white border border-slate-200" />
                      <button type="button" className="btn-primary text-[10px] sm:text-xs py-2 px-3 rounded-xl" disabled={createYear.isPending}
                        onClick={async () => {
                          await createYear.mutateAsync({ name: `FY ${newYearVal}-${String(newYearVal + 1).slice(-2)}`, year: newYearVal });
                          setNewYearInput(false);
                        }}>
                        {createYear.isPending ? 'Creating…' : 'Create'}
                      </button>
                      <button type="button" className="btn-secondary text-[10px] sm:text-xs py-2 px-3 rounded-xl" onClick={() => setNewYearInput(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select {...register('commissionYearId')} className="input flex-1 h-10 text-xs rounded-xl bg-white border border-slate-200">
                        <option value="">Select year…</option>
                        {years.map((y: any) => <option key={y.id} value={y.id}>{y.name} ({y.year})</option>)}
                      </select>
                      <button type="button" className="btn-secondary text-[10px] sm:text-xs px-4 h-10 shrink-0 rounded-xl border border-slate-200" onClick={() => setNewYearInput(true)}>+ New Year</button>
                    </div>
                  )}
                  {errors.commissionYearId && <p className="text-xs text-red-500 mt-1">{errors.commissionYearId.message}</p>}
                </div>

                {/* Yearly Breakdown */}
                <div>
                  <label className="label flex justify-between">
                    <span>Yearly Breakdown</span>
                    <button type="button" className="text-[10px] text-blue-500 hover:underline" onClick={() => {
                      setValue('year1Commission', yearlyShare); setValue('year2Commission', yearlyShare);
                      setValue('year3Commission', yearlyShare); setValue('year4Commission', yearlyShare);
                      setValue('year5Commission', yearlyShare);
                    }}>Auto-split</button>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(yr => (
                      <div key={yr} className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-400 font-semibold text-center">Year {yr}</span>
                        <input {...register(`year${yr}Commission` as keyof Form)} type="number" step="0.01" 
                          placeholder={Math.round(yearlyShare).toString()}
                          className="input h-9 text-xs rounded-lg w-full bg-green-50/50 border border-green-200/50 text-center font-bold text-green-700" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes (Optional)</label>
                <textarea {...register('notes')} className="input text-xs rounded-xl py-2 px-3 bg-white border border-slate-200" rows={2} placeholder="Add any additional notes..." />
              </div>
            </div>

            {/* Right Column (Summary Card) */}
            <div className="lg:col-span-1">
              <div className="bg-green-50/20 border border-green-100 rounded-2xl p-5 h-full flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold text-green-700 uppercase tracking-widest block mb-4">Commission Summary</span>
                  
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Base Comm.</span>
                      <span className="font-semibold text-green-600">{fmt(baseComm)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Addon Comm.</span>
                      <span className="font-semibold text-green-600">{fmt(addonComm)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Grid / Other / Renewal</span>
                      <span className="font-semibold text-green-600">{fmt(gridComm + otherComm + renewalComm)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span className="text-red-500">Deductible</span>
                      <span className="font-semibold text-red-600">-{fmt(deducComm)}</span>
                    </div>
                    <div className="border-t border-dashed border-green-200 my-3" />
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-green-700 font-bold whitespace-nowrap">Total Commission</span>
                      <span className="text-xl font-extrabold text-green-600 whitespace-nowrap">{fmt(totalComm)}</span>
                    </div>
                  </div>
                </div>

                {/* Illustration Card at the bottom */}
                <div className="flex flex-col items-center text-center p-4 bg-white/60 border border-white/80 rounded-xl space-y-2 mt-auto">
                  <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100/50 shadow-sm">
                    <Wallet size={18} />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 leading-snug">
                    Review the details and add the commission entry
                  </p>
                </div>
              </div>
            </div>
          </div>

          {createCommission.isError && (
            <p className="text-sm text-red-600">{(createCommission.error as any)?.response?.data?.message ?? 'Failed to create'}</p>
          )}

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
            <button type="button" className="btn-secondary px-6 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex flex-wrap items-center gap-1.5 shadow-sm shadow-blue-500/10" disabled={createCommission.isPending || !selectedPolicy || !selectedEmp}>
              {createCommission.isPending ? 'Saving…' : 'Add Commission'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Mark as Paid confirm ─────────────────────────────────────────────── */}
      {payConfirm && (
        <Modal open={!!payConfirm} onClose={() => setPayConfirm(null)} title="Mark as Paid">
          <p className="text-sm text-gray-600 mb-4">
            Mark commission of <span className="font-semibold">₹{Number(payConfirm.amount).toLocaleString('en-IN')}</span> for policy <span className="font-semibold">{payConfirm.policy?.policyNumber}</span> as paid?
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => setPayConfirm(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => markPaid.mutate(payConfirm.id)} disabled={markPaid.isPending}>
              {markPaid.isPending ? 'Updating…' : 'Mark as Paid'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete Commission confirm ────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Commission" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete commission of <strong>₹{Number(deleteTarget?.amount ?? 0).toLocaleString('en-IN')}</strong> for policy <strong>{deleteTarget?.policy?.policyNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" disabled={deleteCommission.isPending} onClick={async () => {
            const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
            if (isAdmin) {
              deleteCommission.mutate(deleteTarget!.id);
            } else {
              const toastId = toast.loading('Submitting delete request to admin...');
              try {
                await deletionRequestsService.requestDeletion('Commission', deleteTarget!.id, `Employee requested deletion of commission`);
                toast.success('Deletion request submitted to admin successfully!', { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
              }
              setDeleteTarget(null);
            }
          }}>
            {deleteCommission.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
