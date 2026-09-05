import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, FileText, TrendingUp, DollarSign, AlertCircle,
  RefreshCw, Plus, Calendar, ChevronRight, CheckCircle,
  Clock, UserPlus, Briefcase, PhoneCall, Star, Award, Settings,
  BarChart2, Activity, Sparkles, Presentation
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  useDashboardKpis, useDashboardRevenue, useDashboardPortfolio,
  useDashboardPipeline, useDashboardDbSummary
} from '@hooks/useDashboard';
import { useClaims } from '@hooks/useClaims';
import { useContacts } from '@hooks/useContacts';
import { usePolicies } from '@hooks/usePolicies';
import { useLeads } from '@hooks/useLeads';
import { LineChartWidget, PieChartWidget, BarChartWidget, CoverageBarChartWidget } from '@comps/common/Charts';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@comps/common/Skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import { claimsService, employeesService } from '@api/index';
import { db } from '../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import clsx from 'clsx';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n?: number) {
  if (n === undefined || n === null) return '0';
  return n.toLocaleString('en-IN');
}

function fmtINR(n?: number) {
  if (n === undefined || n === null || isNaN(n)) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function getClaimNotesData(notesField?: string | null) {
  if (!notesField) return { hospital: '', diagnosis: '' };
  try {
    if (notesField.trim().startsWith('{')) {
      const parsed = JSON.parse(notesField);
      return {
        hospital: parsed.hospital || '',
        diagnosis: parsed.diagnosis || '',
      };
    }
  } catch (e) {
    // ignore
  }
  return { hospital: '', diagnosis: notesField || '' };
}

// ── Section header inside cards ──────────────────────────────────────────────
function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">{title}</h3>
      {action && (
        <button
          onClick={onAction}
          className="text-[10px] sm:text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors cursor-pointer"
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ── KPI Card Component ────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  trend: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: string;
  gradientBg?: string;
  accentBorder?: string;
  onClick?: () => void;
}

function PremiumKpiCard({ label, value, trend, trendUp = true, icon, color, gradientBg = 'from-white via-slate-50/50 to-white', accentBorder = 'border-slate-100 hover:border-slate-300', onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-2xl border p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-36 relative overflow-hidden group bg-gradient-to-br backdrop-blur-sm",
        gradientBg,
        accentBorder,
        onClick && "cursor-pointer active:scale-[0.98]"
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">{value}</span>
        </div>
        <div className={clsx('h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3', color)}>
          {icon}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-2 font-bold relative z-10">
        <span className={clsx('px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm', trendUp ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60')}>
          {trendUp ? '▲' : '▼'} {trend}
        </span>
        <span className="text-slate-400 font-medium">realtime sync</span>
      </div>
    </div>
  );
}

// ── Contacts Breakdown Indicator Card (Real Data) ────────────────────────────
function ContactsBreakdownCard({ data }: { data: { head: number, dependent: number, total: number } }) {
  const total = data.total || 0;
  const headPct = total > 0 ? ((data.head / total) * 100).toFixed(0) : '0';
  const depPct = total > 0 ? ((data.dependent / total) * 100).toFixed(0) : '0';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between group hover:shadow-md transition-all">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Total Contacts</h3>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={16} />
          </div>
        </div>
        
        <div className="mb-4">
          <span className="text-3xl font-extrabold text-gray-900">{fmt(data.total)}</span>
          <p className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-wide">Total registered contacts</p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex flex-wrap items-center gap-1.5"><UserPlus size={13} className="text-blue-500"/> Head of Family</span>
              <span>{fmt(data.head)} ({headPct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${headPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex flex-wrap items-center gap-1.5"><Users size={13} className="text-amber-500"/> Dependents</span>
              <span>{fmt(data.dependent)} ({depPct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${depPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leads Progress Indicator Card (Real Data) ────────────────────────────────
function LeadsProgressIndicator({ stageCounts, total }: { stageCounts: Record<string, number>, total: number }) {
  const stagesOrder = [
    { key: 'To Contact', label: 'To Contact', color: 'bg-blue-500' },
    { key: 'Contacted', label: 'Contacted', color: 'bg-indigo-500' },
    { key: 'Proposal Sent', label: 'Proposal Sent', color: 'bg-purple-500' },
    { key: 'Login Progress', label: 'Login Progress', color: 'bg-orange-500' },
    { key: 'Payment Done', label: 'Payment Done', color: 'bg-green-500' },
    { key: 'Process Completed', label: 'Process Completed', color: 'bg-emerald-500' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Leads Progress Indicator</h3>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
            {total} Active Leads
          </span>
        </div>
        <div className="space-y-3.5">
          {stagesOrder.map(st => {
            const count = stageCounts[st.key] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={st.key} className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                  <span>{st.label}</span>
                  <span className="font-bold">{count} ({percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={clsx("h-1.5 rounded-full transition-all duration-500", st.color)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Database Summary Status Table Card (Real Data) ───────────────────────────
function DatabaseSummary({ summaryData }: { summaryData: any }) {
  if (!summaryData) return null;

  const {
    policyTotal = 0, policyActive = 0, policyLapsed = 0, policyExpired = 0, policyCancelled = 0,
    contactsTotal = 0, leadsTotal = 0, generalContacts = 0,
    claimTotal = 0, claimPending = 0, claimInProgress = 0, claimSettled = 0, claimRejected = 0,
    seminarsTotal = 0, seminarRegistered = 0, seminarAttended = 0, seminarConverted = 0
  } = summaryData;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Database Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Total Count</th>
                <th className="px-4 py-2">Breakdown status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Policies</td>
                <td className="px-4 py-3 font-bold text-blue-600">{policyTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-emerald-600 font-semibold">{policyActive} Active</span> •{' '}
                  <span className="text-amber-500">{policyLapsed} Lapsed</span> •{' '}
                  <span>{policyExpired} Expired</span> •{' '}
                  <span className="text-red-500">{policyCancelled} Cancelled</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Contacts / Leads</td>
                <td className="px-4 py-3 font-bold text-indigo-600">{contactsTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-indigo-600 font-semibold">{leadsTotal} Interest Leads</span> •{' '}
                  <span>{generalContacts} General Contacts</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Claims</td>
                <td className="px-4 py-3 font-bold text-red-500">{claimTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-blue-500 font-semibold">{claimPending} Pending</span> •{' '}
                  <span className="text-amber-500">{claimInProgress} In-Progress</span> •{' '}
                  <span className="text-emerald-600 font-semibold">{claimSettled} Settled</span> •{' '}
                  <span className="text-red-500">{claimRejected} Rejected</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Seminars / Attendees</td>
                <td className="px-4 py-3 font-bold text-purple-600">{seminarsTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-blue-500">{seminarRegistered} Registered</span> •{' '}
                  <span className="text-purple-500">{seminarAttended} Attended</span> •{' '}
                  <span className="text-emerald-600 font-semibold">{seminarConverted} Converted</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Claims Reports Panel Component ───────────────────────────────────────────
function ClaimsReportsTab() {
  const { data: claimsRes, isLoading: claimsLoading } = useClaims({ page: 1, limit: 1000 });
  const claims = claimsRes?.data ?? [];

  const [duration, setDuration] = useState('ALL');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [claimType, setClaimType] = useState('ALL');
  const [graphCompanySelect, setGraphCompanySelect] = useState('ALL');
  const [pieChartMetric, setPieChartMetric] = useState<'count' | 'claimed' | 'settled'>('count');

  const companies = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((c: any) => {
      const name = c.policy?.plan?.company?.name || c.companyName;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [claims]);

  const filteredClaims = useMemo(() => {
    return claims.filter((c: any) => {
      if (claimType !== 'ALL') {
        const typeMatch = (c.claimType || '').toUpperCase() === claimType.toUpperCase();
        if (!typeMatch) return false;
      }
      if (selectedCompany !== 'ALL') {
        const comp = c.policy?.plan?.company?.name || c.companyName;
        if (comp !== selectedCompany) return false;
      }
      if (hospitalQuery.trim()) {
        const notesData = getClaimNotesData(c.notes);
        const hospName = (notesData.hospital || '').toLowerCase();
        if (!hospName.includes(hospitalQuery.toLowerCase())) return false;
      }
      if (duration !== 'ALL') {
        const date = c.intimatedAt ? new Date(c.intimatedAt) : new Date(c.createdAt);
        const daysDiff = differenceInDays(new Date(), date);
        if (duration === '30' && daysDiff > 30) return false;
        if (duration === '90' && daysDiff > 90) return false;
        if (duration === '365' && daysDiff > 365) return false;
      }
      return true;
    });
  }, [claims, claimType, selectedCompany, hospitalQuery, duration]);

  const stats = useMemo(() => {
    let totalCount = filteredClaims.length;
    let claimedSum = 0;
    let settledSum = 0;

    filteredClaims.forEach((c: any) => {
      claimedSum += Number(c.claimAmount || 0);
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        settledSum += Number(c.approvedAmount || c.claimAmount || 0);
      }
    });

    const ratio = claimedSum > 0 ? (settledSum / claimedSum) * 100 : 0;
    return { totalCount, claimedSum, settledSum, ratio };
  }, [filteredClaims]);

  const companyGraphData = useMemo(() => {
    const map = new Map<string, { company: string; claimed: number; settled: number }>();
    filteredClaims.forEach((c: any) => {
      const comp = c.policy?.plan?.company?.name || c.companyName || 'Other';
      const entry = map.get(comp) || { company: comp, claimed: 0, settled: 0 };
      entry.claimed += Number(c.claimAmount || 0);
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        entry.settled += Number(c.approvedAmount || c.claimAmount || 0);
      }
      map.set(comp, entry);
    });
    
    const sorted = Array.from(map.values()).sort((a, b) => b.claimed - a.claimed);
    if (graphCompanySelect === 'ALL') {
      return sorted.slice(0, 5);
    }
    return sorted.filter(c => c.company === graphCompanySelect);
  }, [filteredClaims, graphCompanySelect]);

  const typeGraphData = useMemo(() => {
    const map = new Map<string, { count: number; claimed: number; settled: number }>();
    filteredClaims.forEach((c: any) => {
      const type = c.claimType || 'General';
      const entry = map.get(type) || { count: 0, claimed: 0, settled: 0 };
      entry.count += 1;
      entry.claimed += Number(c.claimAmount || 0);
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        entry.settled += Number(c.approvedAmount || c.claimAmount || 0);
      }
      map.set(type, entry);
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [filteredClaims]);

  const hospitalGraphData = useMemo(() => {
    const map = new Map<string, number>();
    filteredClaims.forEach((c: any) => {
      const notesData = getClaimNotesData(c.notes);
      const hosp = notesData.hospital || 'Direct Clinic/Other';
      map.set(hosp, (map.get(hosp) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredClaims]);

  const timeGraphData = useMemo(() => {
    const map = new Map<string, { month: string; claimed: number; settled: number }>();
    const sorted = [...filteredClaims].sort((a: any, b: any) => {
      const da = a.intimatedAt ? new Date(a.intimatedAt) : new Date(a.createdAt);
      const db = b.intimatedAt ? new Date(b.intimatedAt) : new Date(b.createdAt);
      return da.getTime() - db.getTime();
    });

    sorted.forEach((c: any) => {
      const date = c.intimatedAt ? new Date(c.intimatedAt) : new Date(c.createdAt);
      const key = format(date, 'MMM yyyy');
      const entry = map.get(key) || { month: key, claimed: 0, settled: 0 };
      entry.claimed += Number(c.claimAmount || 0);
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        entry.settled += Number(c.approvedAmount || c.claimAmount || 0);
      }
      map.set(key, entry);
    });

    return Array.from(map.values()).slice(-12);
  }, [filteredClaims]);

  if (claimsLoading) {
    return (
      <div className="space-y-6">
        <SkeletonTable rows={4} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Duration</label>
          <select
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
          >
            <option value="ALL">All Time</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">This Year</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Insurance Company</label>
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
          >
            <option value="ALL">All Companies</option>
            {companies.map(comp => (
              <option key={comp} value={comp}>{comp}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Claim Type</label>
          <select
            value={claimType}
            onChange={e => setClaimType(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
          >
            <option value="ALL">All Types</option>
            <option value="CASHLESS">Cashless</option>
            <option value="REIMBURSEMENT">Reimbursement</option>
            <option value="DEATH">Death</option>
            <option value="ACCIDENTAL">Accidental</option>
            <option value="MATURITY">Maturity</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Hospital Name</label>
          <input
            type="text"
            placeholder="Search hospital..."
            value={hospitalQuery}
            onChange={e => setHospitalQuery(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600 placeholder-gray-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Total Claims</span>
          <span className="text-2xl font-black text-gray-900 mt-1">{stats.totalCount}</span>
          <span className="text-[10px] text-gray-400 font-semibold">Realtime registered claims</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Claimed Amount</span>
          <span className="text-2xl font-black text-gray-900 mt-1">{fmtINR(stats.claimedSum)}</span>
          <span className="text-[10px] text-gray-400 font-semibold">Sum of total claims</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Settled Amount</span>
          <span className="text-2xl font-black text-emerald-600 mt-1">{fmtINR(stats.settledSum)}</span>
          <span className="text-[10px] text-gray-400 font-semibold">Total paid out amount</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Settlement Ratio</span>
          <span className="text-2xl font-black text-blue-600 mt-1">{stats.ratio.toFixed(1)}%</span>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, stats.ratio)}%` }} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="relative">
          <div className="absolute top-4 right-5 z-10 flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Company:</label>
            <select
              value={graphCompanySelect}
              onChange={e => setGraphCompanySelect(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="ALL">Top Companies</option>
              {companies.map(comp => (
                <option key={comp} value={comp}>{comp}</option>
              ))}
            </select>
          </div>
          <BarChartWidget
            title="Claimed vs Settled Amount by Company (₹)"
            data={companyGraphData.length > 0 ? companyGraphData : [{ company: 'No Claims Yet', claimed: 0, settled: 0 }]}
            xKey="company"
            bars={[
              { key: 'claimed', label: 'Claimed (₹)', color: '#3b82f6' },
              { key: 'settled', label: 'Settled (₹)', color: '#10b981' }
            ]}
          />
        </div>
        
        <LineChartWidget
          title="Claims Collection Trend over Time (₹)"
          data={timeGraphData.length > 0 ? timeGraphData : [{ month: 'Current', claimed: 0, settled: 0 }]}
          xKey="month"
          lines={[
            { key: 'claimed', label: 'Claimed (₹)', color: '#2563eb' },
            { key: 'settled', label: 'Settled (₹)', color: '#10b981' }
          ]}
        />

        <BarChartWidget
          title="Top Hospitals by Claim Count"
          data={hospitalGraphData.length > 0 ? hospitalGraphData : [{ name: 'No Hospitals Yet', value: 0 }]}
          xKey="name"
          bars={[
            { key: 'value', label: 'Claims Count', color: '#f59e0b' }
          ]}
        />

        <div className="relative">
          <div className="absolute top-4 right-5 z-10 flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Metric:</label>
            <select
              value={pieChartMetric}
              onChange={e => setPieChartMetric(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="count">No. of Claims</option>
              <option value="claimed">Claimed Amount (₹)</option>
              <option value="settled">Settled Amount (₹)</option>
            </select>
          </div>
          <PieChartWidget
            title="Claims by Cashless / Reimbursement"
            data={typeGraphData.length > 0 ? typeGraphData : [{ name: 'No Data', value: 1 }]}
            nameKey="name"
            valueKey={pieChartMetric}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [revenueMonths, setRevenueMonths] = useState(12);
  const [portfolioView, setPortfolioView] = useState<'product' | 'company'>('product');
  const [activeTab, setActiveTab] = useState<'overview' | 'claims-reports'>('overview');
  const [firestoreLeads, setFirestoreLeads] = useState<any[]>([]);
  const [firestoreSeminars, setFirestoreSeminars] = useState<any[]>([]);

  // 1. Real Queries across all sidebar pages
  const { data: contactsRes, isLoading: contactsLoading } = useContacts({ page: 1, limit: 1000 });
  const { data: policiesRes, isLoading: policiesLoading } = usePolicies({ page: 1, limit: 1000 });
  const { data: claimsRes, isLoading: claimsLoading } = useClaims({ page: 1, limit: 1000 });
  const { data: leadsRes, isLoading: leadsLoading } = useLeads({ page: 1, limit: 1000 });
  const { data: employeesRes, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', 'dashboard'],
    queryFn: () => employeesService.list({ limit: 10 }),
    staleTime: 60_000,
  });

  // 2. Realtime Firestore Leads & Seminars Listener
  useEffect(() => {
    let unsubLeads: (() => void) | null = null;
    try {
      unsubLeads = onSnapshot(collection(db, 'leads'), (snap) => {
        const list: any[] = [];
        snap.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setFirestoreLeads(list);
      });
    } catch (e) {}

    let unsubSeminars: (() => void) | null = null;
    try {
      unsubSeminars = onSnapshot(collection(db, 'seminars'), (snap) => {
        const list: any[] = [];
        snap.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setFirestoreSeminars(list);
      });
    } catch (e) {}

    return () => {
      if (unsubLeads) unsubLeads();
      if (unsubSeminars) unsubSeminars();
    };
  }, []);

  // Normalise Real Data
  const contacts = useMemo(() => contactsRes?.data ?? [], [contactsRes]);
  const policies = useMemo(() => policiesRes?.data ?? [], [policiesRes]);
  const claims = useMemo(() => claimsRes?.data ?? [], [claimsRes]);
  const employees = useMemo(() => employeesRes?.data ?? [], [employeesRes]);
  
  // Combine API Leads + Firestore Leads seamlessly
  const allLeads = useMemo(() => {
    const apiList = leadsRes?.data ?? [];
    const map = new Map<string, any>();
    apiList.forEach((l: any) => map.set(String(l.id), l));
    firestoreLeads.forEach((fl: any) => {
      const id = 'fs_' + fl.id;
      if (!map.has(id)) {
        map.set(id, {
          id,
          stage: fl.stage || 'TO_CONTACT',
          hotness: fl.hotness || 'HOT',
          notes: fl.notes || '',
          service: fl.service || fl.serviceRequired || fl.requirement || 'Financial Planning',
          createdAt: fl.createdAt || fl.timestamp
        });
      }
    });
    return Array.from(map.values());
  }, [leadsRes, firestoreLeads]);

  // Dynamic Real Calculations for KPIs
  const totalPoliciesCount = policies.length;
  const activePoliciesCount = policies.filter((p: any) => p.status === 'ACTIVE' || !p.status).length;
  const activeLeadsCount = allLeads.filter((l: any) => l.stage !== 'PROCESS_COMPLETED' && l.stage !== 'DROPPED').length;
  
  const totalPremiumSum = useMemo(() => {
    return policies.reduce((acc: number, curr: any) => {
      return acc + Number(curr.premiumAmount || curr.grossPremium || curr.netPremium || curr.premium || 0);
    }, 0);
  }, [policies]);

  const openClaimsCount = useMemo(() => {
    return claims.filter((c: any) => c.status !== 'SETTLED' && c.status !== 'REJECTED' && c.status !== 'CLOSED').length;
  }, [claims]);

  const seminarsTotal = firestoreSeminars.length;

  // Dynamic Contacts breakdown
  const contactsData = useMemo(() => {
    const total = contacts.length;
    const head = contacts.filter((c: any) => !c.parentId || c.relationship === 'Self' || c.isHead).length;
    const dependent = contacts.filter((c: any) => !!c.parentId || (c.relationship && c.relationship !== 'Self')).length;
    return { head, dependent, total };
  }, [contacts]);

  // Dynamic Premium by Insurance Plan Category
  const premiumByPlanCategory = useMemo(() => {
    const map = new Map<string, number>();
    policies.forEach((p: any) => {
      const cat = p.plan?.category || p.category || 'General';
      const amount = Number(p.premiumAmount || p.grossPremium || p.netPremium || 0);
      map.set(cat, (map.get(cat) ?? 0) + amount);
    });

    const entries = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    if (entries.length === 0) {
      return [
        { name: 'Health', value: 0 },
        { name: 'Life', value: 0 },
        { name: 'Motor', value: 0 },
        { name: 'Mutual Funds', value: 0 },
      ];
    }
    return entries;
  }, [policies]);

  // Dynamic Active Policies by Category
  const activePoliciesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    policies.forEach((p: any) => {
      const cat = p.plan?.category || p.category || 'General';
      map.set(cat, (map.get(cat) ?? 0) + 1);
    });
    const entries = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    if (entries.length === 0) {
      return [{ name: 'No Active Policies', value: 0 }];
    }
    return entries;
  }, [policies]);

  // Dynamic Portfolio by Product vs Company
  const portfolioData = useMemo(() => {
    const map = new Map<string, number>();
    policies.forEach((p: any) => {
      const key = portfolioView === 'product'
        ? (p.plan?.category || p.category || 'General')
        : (p.plan?.company?.name || p.companyName || 'Other');
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const entries = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    return entries.length > 0 ? entries : [{ name: 'No Data Yet', value: 0 }];
  }, [policies, portfolioView]);

  // Dynamic Stage Counts for Leads Progress
  const leadStageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'To Contact': 0,
      'Contacted': 0,
      'Proposal Sent': 0,
      'Login Progress': 0,
      'Payment Done': 0,
      'Process Completed': 0
    };
    allLeads.forEach((l: any) => {
      const st = l.stage || 'TO_CONTACT';
      if (st === 'TO_CONTACT' || st === 'OPEN') counts['To Contact']++;
      else if (st === 'CONTACTED') counts['Contacted']++;
      else if (st === 'PROPOSAL_SENT') counts['Proposal Sent']++;
      else if (st === 'LOGIN_PROGRESS') counts['Login Progress']++;
      else if (st === 'PAYMENT_DONE') counts['Payment Done']++;
      else if (st === 'PROCESS_COMPLETED') counts['Process Completed']++;
    });
    return counts;
  }, [allLeads]);

  // Dynamic Stage & Hotness Wise Leads for Chart
  const leadsStatusWiseData = useMemo(() => {
    const stages = ['To Contact', 'Contacted', 'Proposal Sent', 'Login Progress', 'Payment Done'];
    return stages.map(st => {
      const inStage = allLeads.filter((l: any) => {
        const s = l.stage || 'TO_CONTACT';
        if (st === 'To Contact') return s === 'TO_CONTACT' || s === 'OPEN';
        if (st === 'Contacted') return s === 'CONTACTED';
        if (st === 'Proposal Sent') return s === 'PROPOSAL_SENT';
        if (st === 'Login Progress') return s === 'LOGIN_PROGRESS';
        if (st === 'Payment Done') return s === 'PAYMENT_DONE' || s === 'PROCESS_COMPLETED';
        return false;
      });

      const hot = inStage.filter((l: any) => (l.hotness || '').toUpperCase() === 'HOT' || !l.hotness).length;
      const warm = inStage.filter((l: any) => (l.hotness || '').toUpperCase() === 'WARM').length;
      const cold = inStage.filter((l: any) => (l.hotness || '').toUpperCase() === 'COLD').length;

      return {
        stage: st,
        hot,
        warm,
        cold,
        converted: st === 'Payment Done' ? inStage.length : 0
      };
    });
  }, [allLeads]);

  // Dynamic Revenue Trend (Monthly Premium)
  const revenueTrend = useMemo(() => {
    const map = new Map<string, number>();
    policies.forEach((p: any) => {
      const date = p.startDate ? new Date(p.startDate) : (p.createdAt ? new Date(p.createdAt) : new Date());
      const key = format(date, 'MMM');
      const amount = Number(p.premiumAmount || p.grossPremium || 0);
      map.set(key, (map.get(key) ?? 0) + amount);
    });
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(m => ({ month: m, revenue: map.get(m) ?? 0 }));
  }, [policies]);

  // Dynamic Database Summary Data
  const summaryRealData = useMemo(() => {
    const pActive = policies.filter((p: any) => p.status === 'ACTIVE' || !p.status).length;
    const pLapsed = policies.filter((p: any) => p.status === 'LAPSED').length;
    const pExpired = policies.filter((p: any) => p.status === 'EXPIRED').length;
    const pCancelled = policies.filter((p: any) => p.status === 'CANCELLED').length;

    const cPending = claims.filter((c: any) => ['INTIMATED', 'DOC_COLLECTION', 'FILED', 'PENDING'].includes(c.status)).length;
    const cInProgress = claims.filter((c: any) => c.status === 'IN_REVIEW' || c.status === 'IN_PROGRESS').length;
    const cSettled = claims.filter((c: any) => c.status === 'SETTLED' || c.status === 'APPROVED').length;
    const cRejected = claims.filter((c: any) => c.status === 'REJECTED').length;

    const sReg = firestoreSeminars.filter((s: any) => s.status === 'REGISTERED' || !s.status).length;
    const sAtt = firestoreSeminars.filter((s: any) => s.status === 'ATTENDED' || s.status === 'IN_DISCUSSION').length;
    const sConv = firestoreSeminars.filter((s: any) => s.status === 'CONVERTED').length;

    return {
      policyTotal: policies.length,
      policyActive: pActive,
      policyLapsed: pLapsed,
      policyExpired: pExpired,
      policyCancelled: pCancelled,
      contactsTotal: contacts.length,
      leadsTotal: allLeads.length,
      generalContacts: Math.max(0, contacts.length - allLeads.length),
      claimTotal: claims.length,
      claimPending: cPending,
      claimInProgress: cInProgress,
      claimSettled: cSettled,
      claimRejected: cRejected,
      seminarsTotal: firestoreSeminars.length,
      seminarRegistered: sReg,
      seminarAttended: sAtt,
      seminarConverted: sConv,
    };
  }, [policies, contacts, allLeads, claims, firestoreSeminars]);

  const handleRefreshAll = () => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['contacts'] });
    qc.invalidateQueries({ queryKey: ['policies'] });
    qc.invalidateQueries({ queryKey: ['claims'] });
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['employees'] });
  };

  const isLoading = contactsLoading || policiesLoading || claimsLoading || leadsLoading;

  return (
    <div className="space-y-6 -m-3 p-4 sm:p-6 rounded-3xl bg-[#FAF9FF] min-h-screen">
      {/* ── Tab Switcher ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#E9E7F2] gap-2 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={clsx(
              "py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer",
              activeTab === 'overview'
                ? "border-[#6D3FD4] text-[#6D3FD4] bg-white rounded-t-xl shadow-sm font-black"
                : "border-transparent text-[#68708A] hover:text-[#1D2035] hover:border-[#E9E7F2]"
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('claims-reports')}
            className={clsx(
              "py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer",
              activeTab === 'claims-reports'
                ? "border-[#6D3FD4] text-[#6D3FD4] bg-white rounded-t-xl shadow-sm font-black"
                : "border-transparent text-[#68708A] hover:text-[#1D2035] hover:border-[#E9E7F2]"
            )}
          >
            Claims Reports &amp; Analytics
          </button>
        </div>
      </div>

      {activeTab === 'claims-reports' ? (
        <ClaimsReportsTab />
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* ── Top KPI Cards Grid (Reflects Live Data) ───────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PremiumKpiCard
              label="Total Policies"
              value={fmt(activePoliciesCount)}
              trend={`${totalPoliciesCount} total`}
              trendUp={true}
              icon={<Shield size={20} className="text-white" />}
              color="bg-gradient-to-br from-[#5B2BA8] to-[#743BC4] shadow-[#5B2BA8]/30"
              gradientBg="from-white via-[#FAF9FF] to-white"
              accentBorder="border-[#E9E7F2] hover:border-[#6D3FD4]/40"
              onClick={() => navigate('/policies')}
            />

            <PremiumKpiCard
              label="Active Leads"
              value={fmt(activeLeadsCount)}
              trend={`${allLeads.length} total`}
              trendUp={true}
              icon={<TrendingUp size={20} className="text-white" />}
              color="bg-gradient-to-br from-[#6D3FD4] to-[#7C4DFF] shadow-[#6D3FD4]/30"
              gradientBg="from-white via-[#F0EAFF]/50 to-white"
              accentBorder="border-[#E9E7F2] hover:border-[#7C4DFF]/40"
              onClick={() => navigate('/leads')}
            />

            <PremiumKpiCard
              label="Open Claims"
              value={fmt(openClaimsCount)}
              trend={`${claims.length} registered`}
              trendUp={openClaimsCount === 0}
              icon={<FileText size={20} className="text-white" />}
              color="bg-gradient-to-br from-[#FF5B68] to-[#F2B51D] shadow-[#FF5B68]/30"
              gradientBg="from-white via-[#F6F7FD] to-white"
              accentBorder="border-[#E8EAEE] hover:border-[#FF5B68]/40"
              onClick={() => navigate('/claims')}
            />

            <PremiumKpiCard
              label="Seminars / Tasks"
              value={fmt(seminarsTotal)}
              trend="Registrations"
              trendUp={true}
              icon={<Presentation size={20} className="text-white" />}
              color="bg-gradient-to-br from-[#7C3AED] to-[#422988] shadow-[#7C3AED]/30"
              gradientBg="from-white via-[#FCF6FA] to-white"
              accentBorder="border-[#EDE5F0] hover:border-[#7C3AED]/40"
              onClick={() => navigate('/seminars')}
            />
          </div>

          {/* ── Real Charts Section ─────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <BarChartWidget
                title="Premium by Insurance Plan Category"
                data={premiumByPlanCategory}
                xKey="name"
                bars={[{ key: 'value', label: 'Premium (₹)', color: '#10b981' }]}
                className="h-full flex flex-col justify-center"
                height={350}
              />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="flex-1">
                <ContactsBreakdownCard data={contactsData} />
              </div>
              <div className="flex-1">
                <PieChartWidget
                  title="Active Policies by Category"
                  data={activePoliciesByCategory}
                  nameKey="name"
                  valueKey="value"
                />
              </div>
            </div>
          </div>

          {/* ── Mid-section: Chart + Portfolio Donut ─────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative">
              <div className="absolute right-5 top-5 z-10 flex flex-wrap items-center gap-2">
                <select
                  value={revenueMonths}
                  onChange={e => setRevenueMonths(Number(e.target.value))}
                  className="py-1 px-2.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
                >
                  <option value={3}>This Quarter</option>
                  <option value={6}>Last 6 Months</option>
                  <option value={12}>This Year</option>
                </select>
              </div>
              <LineChartWidget
                title="Premium Collection Trend (₹)"
                data={revenueTrend}
                xKey="month"
                lines={[{ key: 'revenue', label: 'Premium (₹)', color: '#2563eb' }]}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative">
              <div className="absolute right-5 top-5 z-10 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setPortfolioView('product')}
                  className={clsx(
                    "px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer",
                    portfolioView === 'product'
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "text-gray-400 bg-gray-50 hover:bg-gray-100 border border-transparent"
                  )}
                >
                  Product
                </button>
                <button
                  onClick={() => setPortfolioView('company')}
                  className={clsx(
                    "px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer",
                    portfolioView === 'company'
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "text-gray-400 bg-gray-50 hover:bg-gray-100 border border-transparent"
                  )}
                >
                  Company
                </button>
              </div>
              <PieChartWidget
                title={`Portfolio by ${portfolioView === 'product' ? 'Product Type' : 'Insurance Company'}`}
                data={portfolioData}
                nameKey="name"
                valueKey="value"
              />
            </div>
          </div>

          {/* ── Mid-section 2: Leads Progress Indicator + Database Summary ────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <LeadsProgressIndicator stageCounts={leadStageCounts} total={activeLeadsCount} />
            </div>
            <div className="lg:col-span-2">
              <DatabaseSummary summaryData={summaryRealData} />
            </div>
          </div>

          {/* ── New Leads Created (Stage Wise & Status Wise) ──────────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">New Leads Created (Stage Wise &amp; Hotness Wise)</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Realtime leads distribution across pipeline stages</p>
                </div>
              </div>
              <BarChartWidget
                data={leadsStatusWiseData}
                xKey="stage"
                bars={[
                  { key: 'hot', label: 'Hot', color: '#ef4444' },
                  { key: 'warm', label: 'Warm', color: '#f59e0b' },
                  { key: 'cold', label: 'Cold', color: '#3b82f6' },
                  { key: 'converted', label: 'Converted', color: '#10b981' },
                ]}
                height={300}
              />
            </div>
          </div>

          {/* ── Bottom-section: Recent Claims + Top Performing Agents ────────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent Claims Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden flex flex-col justify-between">
              <SectionHeader
                title="Recent Claims"
                action="View All"
                onAction={() => navigate('/claims')}
              />
              {claims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <CheckCircle size={36} className="mb-2 opacity-35" />
                  <p className="text-sm font-medium">No claims recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-5 -mb-5 mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/70 border-b border-gray-100">
                        {['Claim ID', 'Policy Holder', 'Policy Type', 'Amount', 'Status'].map(h => (
                          <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {claims.slice(0, 5).map((c: any) => {
                        const client = c.policy?.contact ? `${c.policy.contact.firstName} ${c.policy.contact.lastName}` : (c.clientName || 'Direct Client');
                        const amount = Number(c.claimAmount ?? c.amount ?? 0);
                        return (
                          <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-gray-950">{c.claimNumber ?? `CLM-${String(c.id).slice(-4).toUpperCase()}`}</td>
                            <td className="px-5 py-3.5 font-medium text-gray-700">{client}</td>
                            <td className="px-5 py-3.5 text-gray-600">{c.policy?.plan?.category ?? c.type ?? 'Insurance'}</td>
                            <td className="px-5 py-3.5 font-bold text-gray-800">₹{amount.toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3.5">
                              <span className={clsx(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                c.status === 'APPROVED' || c.status === 'SETTLED' ? 'bg-green-100 text-green-700' :
                                  c.status === 'PENDING' || c.status === 'INTIMATED' ? 'bg-amber-100 text-amber-700' :
                                    'bg-blue-100 text-blue-700'
                              )}>
                                {c.status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Performing Agents */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between">
              <SectionHeader
                title="Active Employees &amp; Advisors"
                action="View All"
                onAction={() => navigate('/employees')}
              />
              {employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Users size={32} className="mb-2 opacity-35" />
                  <p className="text-sm font-medium">No employees registered</p>
                </div>
              ) : (
                <ul className="space-y-3.5 mt-2 flex-1">
                  {employees.slice(0, 5).map((a: any, idx: number) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 p-1 rounded-xl">
                      <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                        {a.firstName?.[0] || 'A'}{a.lastName?.[0] || 'D'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {a.firstName} {a.lastName}
                        </p>
                        <p className="text-[11px] text-gray-400 font-semibold">{a.designation || 'Financial Advisor'}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                        Active
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
