import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText, Calendar, CheckCircle2, AlertTriangle, TrendingUp,
  Search, Filter, Plus, Phone, MessageSquare, ExternalLink,
  ChevronLeft, ChevronRight, Eye, MoreHorizontal, User, Shield,
  CreditCard, Check, Clock, X, Send, ArrowRight, Info, Award,
  Sparkles, SlidersHorizontal, Bell, RefreshCw, Layers, LayoutGrid, List, ChevronDown, MessageCircle, ChevronUp
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { sortData } from '../../utils/sortUtils';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface EmiRecord {
  id: string;
  policyNo: string;
  customerName: string;
  customerContactNo?: string;
  insuranceCompanyType?: string;
  customerTag: string;
  product: string;
  insurer: string;
  loanProvider?: string;
  premiumAmount?: number;
  installmentFrequency?: string;
  tenure: string;
  paymentMode: string;
  totalEmis: number;
  paidEmis: number;
  currentEmiNo: number;
  dueDate: string;
  amount: number;
  paidAmountTotal: number;
  remainingAmountTotal: number;
  status: 'DUE' | 'PAID' | 'UPCOMING' | 'OVERDUE' | 'MESSAGE SENT' | 'CUSTOMER CONTACTED' | 'PAYMENT FAILED';
  nextAction: 'Send Reminder' | 'View Receipt' | 'Upcoming' | 'Call Customer' | 'Follow Up';
  employee: string;
  history: Array<{ id: string; date: string; type: 'whatsapp' | 'call' | 'payment' | 'note'; note: string; author: string }>;
  schedule: Array<{ emiNo: number; dueDate: string; amount: number; status: 'PAID' | 'DUE' | 'UPCOMING'; paidDate?: string }>;
  notes?: string;
}

// ── Initial Mock Data ──────────────────────────────────────────────────────────
const INITIAL_EMI_DATA: EmiRecord[] = [
  {
    id: 'emi-1',
    policyNo: 'POL-001',
    customerName: 'Rahul Patil',
    customerTag: 'HEALTH - FRESH',
    product: 'HDFC Ergo - OS+',
    insurer: 'HDFC Ergo',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 4,
    currentEmiNo: 5,
    dueDate: '08 Aug 2026',
    amount: 8500,
    paidAmountTotal: 34000,
    remainingAmountTotal: 59500,
    status: 'DUE',
    nextAction: 'Send Reminder',
    employee: 'Amit Sharma',
    notes: 'Customer requested reminder on 5th of every month.',
    history: [
      { id: 'h-1', date: '05 Aug 2026, 11:30 AM', type: 'whatsapp', note: 'Reminder Sent (WhatsApp)', author: 'by Amit Sharma' },
      { id: 'h-2', date: '06 Aug 2026, 04:15 PM', type: 'call', note: 'Customer Contacted - Will pay today', author: 'by Amit Sharma' },
      { id: 'h-3', date: '08 Aug 2026, 10:20 AM', type: 'payment', note: 'Payment Confirmed - Payment receipt received', author: 'by Amit Sharma' },
    ],
    schedule: Array.from({ length: 12 }, (_, i) => ({
      emiNo: i + 1,
      dueDate: `${String((i % 28) + 1).padStart(2, '0')} ${['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'][i]} 2026`,
      amount: 8500,
      status: i < 4 ? 'PAID' : i === 4 ? 'DUE' : 'UPCOMING',
      paidDate: i < 4 ? `0${i + 4} Month 2026` : undefined,
    }))
  },
  {
    id: 'emi-2',
    policyNo: 'POL-002',
    customerName: 'Amit Shah',
    customerTag: 'LIFE - TERM',
    product: 'HDFC Life - Term',
    insurer: 'HDFC Life',
    tenure: '1 Year',
    paymentMode: 'EMI (6 Months)',
    totalEmis: 6,
    paidEmis: 3,
    currentEmiNo: 3,
    dueDate: '10 Aug 2026',
    amount: 12000,
    paidAmountTotal: 36000,
    remainingAmountTotal: 36000,
    status: 'PAID',
    nextAction: 'View Receipt',
    employee: 'Neha Joshi',
    notes: 'Auto-debit mandate active.',
    history: [
      { id: 'h-4', date: '07 Aug 2026, 09:00 AM', type: 'payment', note: 'Auto-debit successful', author: 'by System' }
    ],
    schedule: Array.from({ length: 6 }, (_, i) => ({
      emiNo: i + 1,
      dueDate: `10 ${['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][i]} 2026`,
      amount: 12000,
      status: i <= 2 ? 'PAID' : 'UPCOMING',
      paidDate: i <= 2 ? `10 ${['Jun', 'Jul', 'Aug'][i]} 2026` : undefined,
    }))
  },
  {
    id: 'emi-3',
    policyNo: 'POL-003',
    customerName: 'Priya Joshi',
    customerTag: 'HEALTH - RENEWAL',
    product: 'HDFC Ergo - OS+',
    insurer: 'HDFC Ergo',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 6,
    currentEmiNo: 7,
    dueDate: '12 Aug 2026',
    amount: 6500,
    paidAmountTotal: 39000,
    remainingAmountTotal: 32500,
    status: 'UPCOMING',
    nextAction: 'Upcoming',
    employee: 'Sagar More',
    history: [],
    schedule: Array.from({ length: 12 }, (_, i) => ({
      emiNo: i + 1,
      dueDate: `12 ${['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'][i]} 2026`,
      amount: 6500,
      status: i < 6 ? 'PAID' : i === 6 ? 'UPCOMING' : 'UPCOMING',
      paidDate: i < 6 ? `12 Month` : undefined,
    }))
  },
  {
    id: 'emi-4',
    policyNo: 'POL-004',
    customerName: 'Sneha Patil',
    customerTag: 'MOTOR - RENEWAL',
    product: 'HDFC Ergo - OS+',
    insurer: 'HDFC Ergo',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 2,
    currentEmiNo: 3,
    dueDate: '05 Aug 2026',
    amount: 9000,
    paidAmountTotal: 18000,
    remainingAmountTotal: 90000,
    status: 'OVERDUE',
    nextAction: 'Call Customer',
    employee: 'Amit Sharma',
    history: [
      { id: 'h-5', date: '04 Aug 2026, 02:00 PM', type: 'call', note: 'Called customer, line busy', author: 'by Amit Sharma' }
    ],
    schedule: Array.from({ length: 12 }, (_, i) => ({
      emiNo: i + 1,
      dueDate: `05 Month`,
      amount: 9000,
      status: i < 2 ? 'PAID' : i === 2 ? 'DUE' : 'UPCOMING',
    }))
  },
  {
    id: 'emi-5',
    policyNo: 'POL-005',
    customerName: 'Raj Mehta',
    customerTag: 'TERM - NEW',
    product: 'HDFC Life - Term',
    insurer: 'HDFC Life',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 1,
    currentEmiNo: 2,
    dueDate: '08 Aug 2026',
    amount: 10000,
    paidAmountTotal: 10000,
    remainingAmountTotal: 110000,
    status: 'MESSAGE SENT',
    nextAction: 'Follow Up',
    employee: 'Neha Joshi',
    history: [
      { id: 'h-6', date: '05 Aug 2026, 10:00 AM', type: 'whatsapp', note: 'WhatsApp message sent with payment link', author: 'by Neha Joshi' }
    ],
    schedule: Array.from({ length: 12 }, (_, i) => ({
      emiNo: i + 1,
      dueDate: `08 Month`,
      amount: 10000,
      status: i < 1 ? 'PAID' : 'DUE',
    }))
  },
  {
    id: 'emi-6',
    policyNo: 'POL-006',
    customerName: 'Pooja Singh',
    customerTag: 'HEALTH - FRESH',
    product: 'Star Comprehensive',
    insurer: 'Star Health',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 3,
    currentEmiNo: 4,
    dueDate: '08 Aug 2026',
    amount: 6000,
    paidAmountTotal: 18000,
    remainingAmountTotal: 54000,
    status: 'PAID',
    nextAction: 'View Receipt',
    employee: 'Amit Sharma',
    history: [],
    schedule: []
  },
  {
    id: 'emi-7',
    policyNo: 'POL-007',
    customerName: 'Mahesh Jadhav',
    customerTag: 'MOTOR - COMMERCIAL',
    product: 'ICICI Lombard - Motor',
    insurer: 'ICICI Lombard',
    tenure: '1 Year',
    paymentMode: 'EMI (6 Months)',
    totalEmis: 6,
    paidEmis: 1,
    currentEmiNo: 2,
    dueDate: '02 Aug 2026',
    amount: 12500,
    paidAmountTotal: 12500,
    remainingAmountTotal: 62500,
    status: 'OVERDUE',
    nextAction: 'Call Customer',
    employee: 'Sagar More',
    history: [],
    schedule: []
  },
  {
    id: 'emi-8',
    policyNo: 'POL-008',
    customerName: 'Deepak More',
    customerTag: 'HEALTH - SENIOR',
    product: 'Care Health',
    insurer: 'Care Health',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 0,
    currentEmiNo: 1,
    dueDate: '03 Aug 2026',
    amount: 8000,
    paidAmountTotal: 0,
    remainingAmountTotal: 96000,
    status: 'PAYMENT FAILED',
    nextAction: 'Follow Up',
    employee: 'Neha Joshi',
    history: [],
    schedule: []
  },
  {
    id: 'emi-9',
    policyNo: 'POL-009',
    customerName: 'Vikas Sharma',
    customerTag: 'TERM - FRESH',
    product: 'HDFC Life - Term',
    insurer: 'HDFC Life',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 1,
    currentEmiNo: 2,
    dueDate: '15 Aug 2026',
    amount: 7500,
    paidAmountTotal: 7500,
    remainingAmountTotal: 82500,
    status: 'UPCOMING',
    nextAction: 'Upcoming',
    employee: 'Amit Sharma',
    history: [],
    schedule: []
  },
  {
    id: 'emi-10',
    policyNo: 'POL-010',
    customerName: 'Rohit Kumar',
    customerTag: 'HEALTH - FAMILY',
    product: 'Star Comprehensive',
    insurer: 'Star Health',
    tenure: '1 Year',
    paymentMode: 'EMI (6 Months)',
    totalEmis: 6,
    paidEmis: 0,
    currentEmiNo: 1,
    dueDate: '18 Aug 2026',
    amount: 12000,
    paidAmountTotal: 0,
    remainingAmountTotal: 72000,
    status: 'UPCOMING',
    nextAction: 'Upcoming',
    employee: 'Sagar More',
    history: [],
    schedule: []
  },
  {
    id: 'emi-11',
    policyNo: 'POL-011',
    customerName: 'Anita Deshmukh',
    customerTag: 'HEALTH - FRESH',
    product: 'Niva Bupa - Reassure',
    insurer: 'Niva Bupa',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 3,
    currentEmiNo: 4,
    dueDate: '09 Aug 2026',
    amount: 6800,
    paidAmountTotal: 20400,
    remainingAmountTotal: 61200,
    status: 'DUE',
    nextAction: 'Send Reminder',
    employee: 'Amit Sharma',
    history: [],
    schedule: []
  },
  {
    id: 'emi-12',
    policyNo: 'POL-012',
    customerName: 'Kiran Bhosale',
    customerTag: 'LIFE - SAVINGS',
    product: 'Tata AIA - Life',
    insurer: 'Tata AIA',
    tenure: '1 Year',
    paymentMode: 'EMI (6 Months)',
    totalEmis: 6,
    paidEmis: 2,
    currentEmiNo: 3,
    dueDate: '09 Aug 2026',
    amount: 9000,
    paidAmountTotal: 18000,
    remainingAmountTotal: 36000,
    status: 'MESSAGE SENT',
    nextAction: 'Follow Up',
    employee: 'Neha Joshi',
    history: [],
    schedule: []
  },
  {
    id: 'emi-13',
    policyNo: 'POL-013',
    customerName: 'Sunil Verma',
    customerTag: 'MOTOR - PRIVATE',
    product: 'Bajaj Allianz - Motor',
    insurer: 'Bajaj Allianz',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 3,
    currentEmiNo: 4,
    dueDate: '07 Aug 2026',
    amount: 7200,
    paidAmountTotal: 21600,
    remainingAmountTotal: 64800,
    status: 'CUSTOMER CONTACTED',
    nextAction: 'Follow Up',
    employee: 'Amit Sharma',
    history: [],
    schedule: []
  },
  {
    id: 'emi-14',
    policyNo: 'POL-014',
    customerName: 'Nisha Kulkarni',
    customerTag: 'HEALTH - CRITICAL',
    product: 'HDFC Ergo - OS+',
    insurer: 'HDFC Ergo',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 4,
    currentEmiNo: 5,
    dueDate: '08 Aug 2026',
    amount: 8900,
    paidAmountTotal: 35600,
    remainingAmountTotal: 62300,
    status: 'CUSTOMER CONTACTED',
    nextAction: 'Follow Up',
    employee: 'Neha Joshi',
    history: [],
    schedule: []
  },
  {
    id: 'emi-15',
    policyNo: 'POL-015',
    customerName: 'Meena Gawade',
    customerTag: 'HEALTH - SENIOR',
    product: 'Care Health',
    insurer: 'Care Health',
    tenure: '1 Year',
    paymentMode: 'EMI (12 Months)',
    totalEmis: 12,
    paidEmis: 1,
    currentEmiNo: 2,
    dueDate: '04 Aug 2026',
    amount: 7000,
    paidAmountTotal: 7000,
    remainingAmountTotal: 77000,
    status: 'PAYMENT FAILED',
    nextAction: 'Follow Up',
    employee: 'Sagar More',
    history: [],
    schedule: []
  }
];

// Helper format function
const fmtCurr = (n: number) => `₹ ${Number(n).toLocaleString('en-IN')}`;

interface EmiKanbanCardProps {
  card: EmiRecord;
  onOpen: (c: EmiRecord) => void;
  onCall: (c: EmiRecord) => void;
  onWhatsApp: (c: EmiRecord) => void;
}

// ── Lead-Style Kanban Card Component ──────────────────────────────────────────
function EmiKanbanCard({ card, onOpen, onCall, onWhatsApp }: EmiKanbanCardProps) {
  const initials = card.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CU';

  const BORDER_TOP: Record<string, string> = {
    DUE: 'border-t-4 border-t-amber-500',
    PAID: 'border-t-4 border-t-emerald-500',
    UPCOMING: 'border-t-4 border-t-blue-500',
    'MESSAGE SENT': 'border-t-4 border-t-purple-500',
    'CUSTOMER CONTACTED': 'border-t-4 border-t-sky-500',
    OVERDUE: 'border-t-4 border-t-rose-500',
    'PAYMENT FAILED': 'border-t-4 border-t-amber-600',
  };

  const AVATAR_BG: Record<string, string> = {
    DUE: 'bg-amber-500 ring-amber-500/20',
    PAID: 'bg-emerald-500 ring-emerald-500/20',
    UPCOMING: 'bg-blue-500 ring-blue-500/20',
    'MESSAGE SENT': 'bg-purple-500 ring-purple-500/20',
    'CUSTOMER CONTACTED': 'bg-sky-500 ring-sky-500/20',
    OVERDUE: 'bg-rose-500 ring-rose-500/20',
    'PAYMENT FAILED': 'bg-amber-600 ring-amber-600/20',
  };

  return (
    <div
      onClick={() => onOpen(card)}
      className={clsx(
        'bg-white rounded-2xl p-3.5 shadow-xs border border-slate-100 hover:-translate-y-0.5 transition-all duration-150 flex flex-col gap-2.5 group relative overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300',
        BORDER_TOP[card.status] ?? 'border-t-4 border-t-slate-300'
      )}
    >
      {/* Top Header: Avatar Initials + Policy Number & Tag */}
      <div className="flex items-center justify-between min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className={clsx('h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 shadow-xs ring-4', AVATAR_BG[card.status] ?? 'bg-slate-500 ring-slate-500/20')}>
            {initials}
          </div>
          <span className="px-1.5 py-0.5 rounded border border-slate-200 text-[9px] font-bold uppercase bg-slate-50 text-slate-600 truncate">
            {card.customerTag}
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/50">
          {card.policyNo}
        </span>
      </div>

      {/* Title & Customer Name */}
      <div className="min-w-0">
        <h4 className="text-[13px] font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors truncate">
          {card.customerName}
        </h4>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-1 truncate">
          <Shield size={11} className="text-slate-400 shrink-0" />
          <span>{card.product}</span>
        </p>
      </div>

      <div className="border-t border-slate-100/80 my-0.5" />

      {/* EMI Info & Due Date */}
      <div className="space-y-1.5 text-xs text-slate-700 font-medium">
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span className="font-semibold text-slate-500">Installment No: <strong className="text-slate-800 font-extrabold">{card.paidEmis + 1}/{card.totalEmis}</strong></span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Due: {card.dueDate.split(' ')[0]} {card.dueDate.split(' ')[1]}</span>
        </div>

        {/* Installment Amount Box (Lead Card Style) */}
        <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-2.5 py-1 text-xs font-semibold text-emerald-900 mt-1">
          <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Installment Amount</span>
          <span className="font-black text-emerald-800 text-xs">
            ₹{Number(card.amount).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Footer: Assignee & Action Buttons */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-0.5 gap-2" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-1 text-slate-500 text-[10px] font-bold truncate">
          <User size={11} className="text-slate-400 shrink-0" />
          <span className="truncate">{card.employee}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onCall(card)}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
            title="Call Customer"
          >
            <Phone size={11} />
          </button>
          <button
            onClick={() => onWhatsApp(card)}
            className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-600 cursor-pointer transition-colors"
            title="Send WhatsApp Reminder"
          >
            <MessageSquare size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

export interface MonthPickerDropdownProps {
  selectedMonth: string;
  onChange: (m: string) => void;
}

// ── Redesigned Interactive 12-Month Calendar Selector Dropdown Component ──────────────
export function MonthPickerDropdown({ selectedMonth, onChange }: MonthPickerDropdownProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(2026);
  const popoverRef = useRef<HTMLDivElement>(null);

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectMonth = (m: string) => {
    onChange(`${m} ${pickerYear}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          'bg-blue-50/90 hover:bg-blue-100/90 border border-blue-200/90 rounded-2xl px-4 py-2 text-xs font-black text-blue-900 flex items-center gap-2.5 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer shadow-2xs hover:shadow-xs transition-all',
          open && 'ring-2 ring-blue-500/30 bg-blue-100/90'
        )}
      >
        <div className="w-5 h-5 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
          <Calendar size={12} />
        </div>
        <span className="tracking-tight">{selectedMonth}</span>
        <ChevronDown size={14} className={clsx('text-blue-500 transition-transform duration-200 ml-1', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2.5 w-72 bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-4 z-50 animate-fadeIn space-y-3.5">
          {/* Year Header with prev/next arrows */}
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPickerYear(y => y - 1)}
              className="p-1 rounded-lg bg-white shadow-xs border border-slate-200 hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
              title="Previous Year"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-black text-slate-900 tracking-wide">{pickerYear}</span>
              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Year</span>
            </div>
            <button
              type="button"
              onClick={() => setPickerYear(y => y + 1)}
              className="p-1 rounded-lg bg-white shadow-xs border border-slate-200 hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
              title="Next Year"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* 12 Months Grid (3x4) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MONTHS.map(m => {
              const fullMonthStr = `${m} ${pickerYear}`;
              const isSelected = selectedMonth === fullMonthStr;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMonth(m)}
                  className={clsx(
                    'py-2 px-1 rounded-xl text-xs font-bold transition-all text-center cursor-pointer',
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-blue-500/25 font-black scale-[1.02] ring-2 ring-blue-600/20'
                      : 'bg-slate-50/80 hover:bg-blue-50/90 text-slate-700 hover:text-blue-600 border border-slate-200/60 font-extrabold hover:scale-[1.02]'
                  )}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>

          {/* Quick Select Current Month */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange('August 2026');
                setPickerYear(2026);
                setOpen(false);
              }}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex flex-wrap items-center gap-1 cursor-pointer bg-blue-50/80 px-2 py-1 rounded-lg border border-blue-100"
            >
              <Sparkles size={11} className="text-blue-600" />
              <span>Current Month</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer px-2 py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmiTrackingView({ selectedMonth }: { selectedMonth: string }) {
  const [data, setData] = useState<EmiRecord[]>(() => INITIAL_EMI_DATA.map(d => ({
    ...d,
    customerContactNo: '+91 9876543210',
    insuranceCompanyType: d.customerTag.split(' - ')[0] || 'Health',
    loanProvider: 'FIBE',
    premiumAmount: d.amount * d.totalEmis,
    installmentFrequency: 'Monthly'
  })));
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [employeeFilter, setEmployeeFilter] = useState<string>('All');
  const [insurerFilter, setInsurerFilter] = useState<string>('All');
  const [productFilter, setProductFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<EmiRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'schedule' | 'communication' | 'notes'>('overview');
  const [newNoteInput, setNewNoteInput] = useState('');
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRecords(sortedFilteredData.map(r => r.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedRecords(prev => [...prev, id]);
    } else {
      setSelectedRecords(prev => prev.filter(rId => rId !== id));
    }
  };

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Filter logic
  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (statusFilter !== 'All') {
        if (statusFilter === 'Due' && item.status === 'PAID') return false;
        if (statusFilter === 'Paid' && item.status !== 'PAID') return false;
      }
      if (employeeFilter !== 'All' && item.employee !== employeeFilter) return false;
      if (insurerFilter !== 'All' && item.insurer !== insurerFilter) return false;
      if (productFilter !== 'All' && item.product !== productFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.customerName.toLowerCase().includes(q);
        const matchPol = item.policyNo.toLowerCase().includes(q);
        const matchProd = item.product.toLowerCase().includes(q);
        if (!matchName && !matchPol && !matchProd) return false;
      }
      return true;
    });
  }, [data, statusFilter, employeeFilter, insurerFilter, productFilter, searchQuery]);

  const sortedFilteredData = useMemo(() => {
    let result = [...filteredData];
    if (!sortKey) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      result.sort((a, b) => {
        const getGroup = (item: any) => {
          if (item.status === 'PAID') return 3; // Paid
          const itemDate = new Date(item.dueDate);
          itemDate.setHours(0, 0, 0, 0);
          return itemDate < today ? 1 : 2; // 1 = Overdue, 2 = Due
        };

        const aGroup = getGroup(a);
        const bGroup = getGroup(b);

        if (aGroup !== bGroup) return aGroup - bGroup; // Overdue -> Due -> Paid

        // Within each status group, sort by due date closest to today
        const aDate = new Date(a.dueDate);
        aDate.setHours(0, 0, 0, 0);
        const bDate = new Date(b.dueDate);
        bDate.setHours(0, 0, 0, 0);

        const aDist = Math.abs(aDate.getTime() - today.getTime());
        const bDist = Math.abs(bDate.getTime() - today.getTime());

        return aDist - bDist;
      });
    } else {
      result = sortData(result, sortKey, sortDir, (row: any, key: string) => {
        if (key === 'EMI (x/y)') return row.paidEmis / row.totalEmis;
        return row[key];
      });
    }
    return result;
  }, [filteredData, sortKey, sortDir]);

  // Handler for Mark as Paid
  const handleMarkAsPaid = (recordId: string) => {
    setData(prev => prev.map(rec => {
      if (rec.id === recordId) {
        const newPaidEmis = Math.min(rec.totalEmis, rec.paidEmis + 1);
        const newHistory = [
          ...rec.history,
          {
            id: `h-${Date.now()}`,
            date: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, 10:30 AM`,
            type: 'payment' as const,
            note: 'Payment Confirmed - Mark as Paid manually',
            author: 'by Amit Sharma'
          }
        ];
        return {
          ...rec,
          status: 'PAID',
          nextAction: 'View Receipt',
          paidEmis: newPaidEmis,
          paidAmountTotal: rec.paidAmountTotal + rec.amount,
          remainingAmountTotal: Math.max(0, rec.remainingAmountTotal - rec.amount),
          history: newHistory
        };
      }
      return rec;
    }));

    if (drawerRecord && drawerRecord.id === recordId) {
      setDrawerRecord(prev => prev ? {
        ...prev,
        status: 'PAID',
        nextAction: 'View Receipt',
        paidEmis: Math.min(prev.totalEmis, prev.paidEmis + 1),
        paidAmountTotal: prev.paidAmountTotal + prev.amount,
        remainingAmountTotal: Math.max(0, prev.remainingAmountTotal - prev.amount),
      } : null);
    }
    toast.success(`EMI for ${drawerRecord?.customerName || 'Customer'} marked as Paid!`);
  };

  // Handler for Send Reminder
  const handleSendReminder = (record: EmiRecord) => {
    toast.success(`WhatsApp EMI Payment Reminder sent to ${record.customerName}!`);
    setData(prev => prev.map(rec => {
      if (rec.id === record.id) {
        return {
          ...rec,
          status: rec.status === 'PAID' ? 'PAID' : 'MESSAGE SENT',
          history: [
            ...rec.history,
            {
              id: `h-${Date.now()}`,
              date: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              type: 'whatsapp',
              note: 'Reminder Sent (WhatsApp)',
              author: 'by Amit Sharma'
            }
          ]
        };
      }
      return rec;
    }));
  };

  // Handler for Call Customer
  const handleCallCustomer = (record: EmiRecord) => {
    toast.success(`Initiating call with ${record.customerName}...`);
  };

  // Handler for Status Update
  const handleUpdateStatus = (recordId: string, newStatus: EmiRecord['status']) => {
    setData(prev => prev.map(rec => {
      if (rec.id === recordId) {
        return { ...rec, status: newStatus };
      }
      return rec;
    }));
    if (drawerRecord && drawerRecord.id === recordId) {
      setDrawerRecord(prev => prev ? { ...prev, status: newStatus } : null);
    }
    setStatusUpdateOpen(false);
    toast.success(`Status updated to ${newStatus}`);
  };

  // Handler to Add History Note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteInput.trim() || !drawerRecord) return;
    const noteObj = {
      id: `h-${Date.now()}`,
      date: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      type: 'note' as const,
      note: newNoteInput.trim(),
      author: 'by Amit Sharma'
    };
    setData(prev => prev.map(r => r.id === drawerRecord.id ? { ...r, history: [...r.history, noteObj] } : r));
    setDrawerRecord(prev => prev ? { ...prev, history: [...prev.history, noteObj] } : null);
    setNewNoteInput('');
    toast.success('Note added');
  };

  // Kanban Column Definitions (Removed)

  return (
    <div className="space-y-5 animate-fadeIn font-sans pb-10">
      
      {/* ── Summary KPI Cards Row (4 Cards) ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Installments Due */}
        <div className="bg-white rounded-2xl p-4 border border-blue-100/80 shadow-xs flex flex-wrap items-center gap-3.5 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <FileText size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Installments Due</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">84</span>
            </div>
            <span className="text-xs font-bold text-slate-500 block">₹ 8,45,000</span>
          </div>
        </div>

        {/* Card 2: Due Today */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100/80 shadow-xs flex flex-wrap items-center gap-3.5 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Calendar size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Due Today</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">12</span>
            </div>
            <span className="text-xs font-bold text-slate-500 block">₹ 1,20,000</span>
          </div>
        </div>

        {/* Card 3: Pending / Overdue */}
        <div className="bg-white rounded-2xl p-4 border border-rose-100/80 shadow-xs flex flex-wrap items-center gap-3.5 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Pending / Overdue</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">28</span>
            </div>
            <span className="text-xs font-bold text-slate-500 block">₹ 2,85,000</span>
          </div>
        </div>

        {/* Card 4: Paid & Collection */}
        <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={14} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Paid / Collection</span>
              </div>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">56 Policies</span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-xl font-black text-emerald-950 block">₹ 5,60,000</span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">65% Target</span>
            </div>
          </div>
          <div className="w-full bg-emerald-200/80 h-2 rounded-full mt-2.5 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: '65%' }} />
          </div>
        </div>

      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex items-center gap-2.5 w-full overflow-x-auto custom-scrollbar">
          
          {/* Left Side: Search Box */}
          <div className="relative min-w-[200px] sm:min-w-[240px] max-w-xs shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Customer / Policy / Installment"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all shadow-2xs"
            />
          </div>
  
          {/* Right Side: Status Filter Pills + Filter Icon */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Status Filter Pills */}
            <div className="bg-slate-100/80 p-1 rounded-xl flex items-center gap-1 border border-slate-200/50 shrink-0">
              {['All', 'Due', 'Paid'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none',
                    statusFilter === st
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            title="More Filters"
            className={clsx(
              "p-2 rounded-xl border transition-all cursor-pointer",
              showFilters ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
            )}
          >
            <Filter size={14} />
          </button>
        </div>
      </div>

      {/* ── Collapsible Advanced Filter Panel ────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col gap-1 min-w-[150px] flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee</label>
            <select
              value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
            >
              <option value="All">Employee: All</option>
              <option value="Amit Sharma">Amit Sharma</option>
              <option value="Neha Joshi">Neha Joshi</option>
              <option value="Sagar More">Sagar More</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[150px] flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Insurer</label>
            <select
              value={insurerFilter}
              onChange={e => setInsurerFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
            >
              <option value="All">Insurer: All</option>
              <option value="HDFC Ergo">HDFC Ergo</option>
              <option value="HDFC Life">HDFC Life</option>
              <option value="Star Health">Star Health</option>
              <option value="ICICI Lombard">ICICI Lombard</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[150px] flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</label>
            <select
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
            >
              <option value="All">Product: All</option>
              <option value="HDFC Ergo - OS+">HDFC Ergo - OS+</option>
              <option value="HDFC Life - Term">HDFC Life - Term</option>
              <option value="Star Comprehensive">Star Comprehensive</option>
            </select>
          </div>

          <div className="flex items-end self-end">
            <button
              type="button"
              onClick={() => {
                setEmployeeFilter('All');
                setInsurerFilter('All');
                setProductFilter('All');
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* ── Table Section (List View) ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">EMI Due List – {selectedMonth}</h3>
          <span className="text-xs text-slate-400 font-bold">Showing {filteredData.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {[
                  { key: 'select', label: '' },
                  { key: 'customerName', label: 'Customer Name' },
                  { key: 'customerContactNo', label: 'Contact No.' },
                  { key: 'insuranceCompanyType', label: 'Insurance Type' },
                  { key: 'insurer', label: 'Insurer' },
                  { key: 'product', label: 'Product Name' },
                  { key: 'policyNo', label: 'Policy No.' },
                  { key: 'loanProvider', label: 'Loan Provider' },
                  { key: 'premiumAmount', label: 'Premium Amount' },
                  { key: 'amount', label: 'Inst. Amount' },
                  { key: 'installmentFrequency', label: 'Frequency' },
                  { key: 'EMI (x/y)', label: 'No. of Inst.' },
                  { key: 'dueDate', label: 'Due Date' },
                  { key: 'status', label: 'Status' },
                  { key: 'employee', label: 'Assigned Employee' },
                  { key: 'Actions', label: 'Actions', align: 'right' }
                ].map(h => (
                  <th key={h.key} 
                    className={clsx(`px-4 py-3 border border-slate-200 select-none ${h.align === 'right' ? 'text-right' : ''}`, h.key !== 'Actions' && h.key !== 'select' && 'cursor-pointer hover:text-slate-900')}
                    onClick={() => {
                      if (h.key === 'Actions' || h.key === 'select') return;
                      if (sortKey === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(h.key); setSortDir('asc'); }
                    }}
                  >
                    {h.key === 'select' ? (
                      <input type="checkbox" onChange={handleSelectAll} checked={sortedFilteredData.length > 0 && selectedRecords.length === sortedFilteredData.length} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    ) : (
                      <span className={clsx("inline-flex items-center gap-1", h.align === 'right' && "justify-end w-full")}>
                        {h.label}
                        {h.key !== 'Actions' && (
                          <span className="text-slate-400">
                            {sortKey === h.key
                              ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                              : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
                          </span>
                        )}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sortedFilteredData.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-5 py-12 text-center text-slate-400 font-semibold">
                    No EMI records match the selected filters.
                  </td>
                </tr>
              ) : (
                sortedFilteredData.map((r, idx) => (
                  <tr
                    key={r.id}
                    onClick={() => setDrawerRecord(r)}
                    className={clsx(
                      "transition-colors cursor-pointer group",
                      idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white',
                      selectedRecords.includes(r.id) && 'bg-blue-50/50'
                    )}
                  >
                    <td className="px-4 py-3.5 border border-slate-200" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRecords.includes(r.id)} onChange={(e) => handleSelectRecord(e, r.id)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3.5 border border-slate-200 font-bold text-slate-900">{r.customerName}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium whitespace-nowrap">{r.customerContactNo}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium">{r.insuranceCompanyType}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium">{r.insurer}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium">{r.product}</td>
                    <td className="px-4 py-3.5 border border-slate-200 font-semibold text-slate-700">{r.policyNo}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium">{r.loanProvider}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium whitespace-nowrap">{r.premiumAmount ? fmtCurr(r.premiumAmount) : '-'}</td>
                    <td className="px-4 py-3.5 border border-slate-200 font-extrabold text-slate-900 whitespace-nowrap">{fmtCurr(r.amount)}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium">{r.installmentFrequency}</td>
                    <td className="px-4 py-3.5 border border-slate-200 font-bold text-slate-800">{r.paidEmis + 1}/{r.totalEmis}</td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 whitespace-nowrap">{r.dueDate}</td>
                    <td className="px-4 py-3.5 border border-slate-200">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border whitespace-nowrap',
                          r.status === 'DUE' && 'bg-amber-50 text-amber-600 border-amber-200',
                          r.status === 'PAID' && 'bg-emerald-50 text-emerald-600 border-emerald-200',
                          r.status === 'UPCOMING' && 'bg-purple-50 text-purple-700 border-purple-200',
                          r.status === 'OVERDUE' && 'bg-rose-50 text-rose-600 border-rose-200',
                          r.status === 'MESSAGE SENT' && 'bg-purple-50 text-purple-600 border-purple-200',
                          r.status === 'CUSTOMER CONTACTED' && 'bg-sky-50 text-sky-600 border-sky-200',
                          r.status === 'PAYMENT FAILED' && 'bg-gray-100 text-gray-600 border-gray-200'
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border border-slate-200 text-slate-600 font-medium whitespace-nowrap">{r.employee}</td>
                    
                    <td className="px-4 py-3.5 border border-slate-200 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setDrawerRecord(r)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200/70 transition-all cursor-pointer"
                      >
                        Actions ▾
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/30">
            <span className="text-xs text-slate-400 font-semibold">Showing 1 to {filteredData.length} of 84 entries</span>
            <div className="flex flex-wrap items-center gap-1">
              <button className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14}/></button>
              <button className="px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-purple-600 text-white">1</button>
              <button className="px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-slate-100 text-slate-600">2</button>
              <button className="px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-slate-100 text-slate-600">3</button>
              <span className="text-xs text-slate-400 px-1">...</span>
              <button className="px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-slate-100 text-slate-600">17</button>
              <button className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"><ChevronRight size={14}/></button>
            </div>
          </div>
        </div>

      {/* ── NEW EMI Details Popup Modal UI (matching Add New Contact popup design) ───────── */}
      <Modal
        open={Boolean(drawerRecord)}
        onClose={() => setDrawerRecord(null)}
        title="Installment Details"
        subtitle={`View installment schedule, collections, and customer follow-ups for ${drawerRecord?.customerName || ''}`}
        size="2xl"
        actions={
          <div className="flex flex-wrap items-center gap-2 mr-1">
            {drawerRecord && (
              <button
                type="button"
                onClick={() => handleMarkAsPaid(drawerRecord.id)}
                disabled={drawerRecord.status === 'PAID'}
                className={clsx(
                  'px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer shadow-xs transition-all',
                  drawerRecord.status === 'PAID'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 hover:scale-[1.02]'
                )}
              >
                {drawerRecord.status === 'PAID' ? 'Already Paid' : 'Mark as Paid'}
              </button>
            )}
          </div>
        }
      >
        {drawerRecord && (
          <div className="space-y-3">
            {/* Customer Profile Banner Card */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-xs text-slate-900 truncate">{drawerRecord.customerName}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {drawerRecord.customerTag}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">Policy: {drawerRecord.policyNo}</p>
                </div>
              </div>

              {/* Sub details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Insurer</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{drawerRecord.insurer}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Policy Tenure</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{drawerRecord.tenure}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Mode</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{drawerRecord.paymentMode}</span>
                </div>
              </div>
            </div>

            {/* Modal sub-navigation tabs (styled like Add New Contact modal tabs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-slate-200/60 p-1.5 rounded-xl gap-2 border border-slate-200/80 shadow-2xs">
              {[
                { key: 'overview', label: 'Installment Overview' },
                { key: 'schedule', label: 'Installment Schedule' },
                { key: 'communication', label: 'Communication' },
                { key: 'notes', label: 'Notes' },
              ].map(tb => (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setDrawerTab(tb.key as any)}
                  className={clsx(
                    'w-full py-1.5 px-2 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer truncate text-center select-none',
                    drawerTab === tb.key
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  )}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* Modal Fixed Height Scroll Content */}
            <div className="h-[410px] overflow-y-auto pr-1.5 custom-scrollbar space-y-3.5">
              {/* TAB 1: OVERVIEW */}
              {drawerTab === 'overview' && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* Installment Progress */}
                  <div className="space-y-1.5 bg-white p-3 border border-slate-200/80 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">Installment Progress</span>
                      <span className="text-slate-900">{drawerRecord.paidEmis} / {drawerRecord.totalEmis} Paid</span>
                      <span className="text-slate-400 font-semibold">{((drawerRecord.paidEmis / drawerRecord.totalEmis) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(drawerRecord.paidEmis / drawerRecord.totalEmis) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Stat Cards 3 Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="bg-emerald-50/60 border border-emerald-100 p-2.5 rounded-lg text-center">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Paid</span>
                      <span className="text-xs font-extrabold text-emerald-900 block mt-0.5">{drawerRecord.paidEmis}</span>
                      <span className="text-[10px] font-bold text-emerald-700 block">{fmtCurr(drawerRecord.paidAmountTotal)}</span>
                    </div>

                    <div className="bg-amber-50/60 border border-amber-100 p-2.5 rounded-lg text-center">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Due</span>
                      <span className="text-xs font-extrabold text-amber-900 block mt-0.5">1</span>
                      <span className="text-[10px] font-bold text-amber-700 block">{fmtCurr(drawerRecord.amount)}</span>
                    </div>

                    <div className="bg-sky-50/60 border border-sky-100 p-2.5 rounded-lg text-center">
                      <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">Remaining</span>
                      <span className="text-xs font-extrabold text-sky-900 block mt-0.5">{drawerRecord.totalEmis - drawerRecord.paidEmis - 1}</span>
                      <span className="text-[10px] font-bold text-sky-700 block">{fmtCurr(drawerRecord.remainingAmountTotal)}</span>
                    </div>
                  </div>

                  {/* Current Installment Due Box */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Current Installment (Due)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs items-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">Installment No.</span>
                        <span className="font-bold text-slate-800 text-[11px]">{drawerRecord.paidEmis + 1} of {drawerRecord.totalEmis}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">Due Date</span>
                        <span className="font-bold text-slate-800 text-[11px]">{drawerRecord.dueDate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">Amount</span>
                        <span className="font-extrabold text-slate-900 text-[11px]">{fmtCurr(drawerRecord.amount)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">Status</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-700">
                          {drawerRecord.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Quick Actions</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendReminder(drawerRecord)}
                        className="w-full py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer truncate"
                      >
                        <MessageSquare size={13} className="shrink-0" />
                        <span>Send Reminder</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCallCustomer(drawerRecord)}
                        className="w-full py-2 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer truncate"
                      >
                        <Phone size={13} className="shrink-0" />
                        <span>Call Customer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusUpdateOpen(!statusUpdateOpen)}
                        className="w-full py-2 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer truncate"
                      >
                        <span>Update Status</span>
                      </button>
                    </div>

                    {statusUpdateOpen && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-md space-y-1.5 text-xs">
                        <p className="font-bold text-slate-600 text-[10px] uppercase">Select New Status</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {['DUE', 'PAID', 'UPCOMING', 'OVERDUE', 'MESSAGE SENT', 'CUSTOMER CONTACTED'].map(st => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleUpdateStatus(drawerRecord.id, st as any)}
                              className="px-2 py-1 text-left text-[10px] font-bold rounded border hover:bg-blue-50 text-slate-700"
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Communication History Timeline */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Communication History</span>
                    <div className="space-y-2 text-xs border-l-2 border-slate-200 pl-2.5">
                      {drawerRecord.history.map((h, i) => (
                        <div key={h.id || i} className="relative group">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[11px]">{h.date}</span>
                            <span className="text-[9px] text-slate-400 font-semibold">{h.author}</span>
                          </div>
                          <p className="text-slate-600 mt-0.5 font-medium text-[11px]">{h.note}</p>
                        </div>
                      ))}
                      {drawerRecord.history.length === 0 && (
                        <p className="text-xs text-slate-400 font-medium">No history logged yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SCHEDULE */}
              {drawerTab === 'schedule' && (
                <div className="space-y-2.5 text-xs animate-fadeIn">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Installment Payment Schedule ({drawerRecord.totalEmis} Months)</span>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {drawerRecord.schedule.map(sc => (
                      <div key={sc.emiNo} className="p-2.5 flex items-center justify-between bg-white hover:bg-slate-50">
                        <div>
                          <span className="font-bold text-slate-900 block text-[11px]">Installment #{sc.emiNo}</span>
                          <span className="text-slate-400 text-[10px]">Due: {sc.dueDate}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block text-[11px]">{fmtCurr(sc.amount)}</span>
                          <span className={clsx(
                            'px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase',
                            sc.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {sc.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: COMMUNICATION */}
              {drawerTab === 'communication' && (
                <div className="bg-slate-50/90 rounded-2xl border border-slate-200/70 p-4 space-y-3 shadow-xs animate-fadeIn">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <MessageCircle size={13} />
                      </div>
                      <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                        Consultation Comments & Communication Logs
                      </h4>
                    </div>
                    {drawerRecord.history.length > 0 && (
                      <span className="text-[10px] font-extrabold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-full">
                        {drawerRecord.history.length} {drawerRecord.history.length === 1 ? 'Comment' : 'Comments'}
                      </span>
                    )}
                  </div>

                  {/* Timeline List */}
                  <div className="max-h-56 overflow-y-auto space-y-2.5 custom-scrollbar pr-0.5">
                    {drawerRecord.history.length === 0 ? (
                      <div className="bg-white/60 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                        <p className="text-xs text-slate-400 font-medium italic">No comments yet. Add the first summary below.</p>
                      </div>
                    ) : (
                      drawerRecord.history.map((cmt, ci) => (
                        <div key={cmt.id || ci} className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all space-y-1.5 relative overflow-hidden group">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              {cmt.author}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold flex flex-wrap items-center gap-1">
                              {cmt.date}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap pl-0.5">
                            {cmt.note}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Call Summary & Consultation Comment Box */}
                  <form onSubmit={handleAddNote} className="bg-white rounded-xl border-2 border-blue-200/90 p-3 space-y-2 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all mt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
                        <MessageCircle size={12} className="text-blue-600" />
                        Add Call Summary / Comment
                      </label>
                      <span className="text-[9px] text-slate-400 font-semibold italic">Communication Log</span>
                    </div>
                    <textarea
                      rows={2}
                      className="w-full text-xs p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:bg-white focus:border-blue-400 outline-none resize-y transition-all"
                      placeholder="Type call summary, client discussion details, or follow-up notes..."
                      value={newNoteInput}
                      onChange={e => setNewNoteInput(e.target.value)}
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-extrabold text-[11px] shadow-xs cursor-pointer transition-all hover:scale-[1.02] flex flex-wrap items-center gap-1.5"
                      >
                        <Send size={12} />
                        <span>Add Comment</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 4: NOTES */}
              {drawerTab === 'notes' && (
                <div className="space-y-2.5 text-xs animate-fadeIn">
                  <label className="font-bold text-slate-700 block">Policy Notes</label>
                  <textarea
                    rows={6}
                    defaultValue={drawerRecord.notes || ''}
                    placeholder="Add internal notes for this policy installment..."
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500/20 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => toast.success('Notes saved successfully!')}
                    className="py-2 px-4 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 cursor-pointer text-xs transition-all hover:scale-[1.01]"
                  >
                    Save Notes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── OLD EMI Details Side Drawer Panel UI (Commented out for comparison) ───────── */}
      {/* 
      {drawerRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-full sm:w-[480px] lg:w-[520px] max-w-full bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-slideLeft">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">EMI Details</h2>
                <button
                  onClick={() => setDrawerRecord(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 bg-slate-50/70 border-b border-slate-100 space-y-4 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-200/80 text-slate-600 flex items-center justify-center font-extrabold text-base shrink-0 border border-slate-300/60">
                    <User size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 truncate">{drawerRecord.customerName}</h3>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {drawerRecord.customerTag}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500">{drawerRecord.policyNo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Insurer</span>
                    <span className="font-bold text-slate-800 text-xs truncate block">{drawerRecord.insurer}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Policy Tenure</span>
                    <span className="font-bold text-slate-800 text-xs truncate block">{drawerRecord.tenure}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Mode</span>
                    <span className="font-bold text-slate-800 text-xs truncate block">{drawerRecord.paymentMode}</span>
                  </div>
                </div>
              </div>
              <div className="flex border-b border-slate-100 px-5 text-xs font-bold shrink-0">
                {[
                  { key: 'overview', label: 'EMI Overview' },
                  { key: 'schedule', label: 'EMI Schedule' },
                  { key: 'communication', label: 'Communication' },
                  { key: 'notes', label: 'Notes' },
                ].map(tb => (
                  <button
                    key={tb.key}
                    onClick={() => setDrawerTab(tb.key as any)}
                    className={clsx(
                      'py-3 mr-4 border-b-2 transition-all cursor-pointer',
                      drawerTab === tb.key
                        ? 'border-blue-600 text-blue-600 font-extrabold'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    )}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                {drawerTab === 'overview' && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="text-slate-700">EMI Progress</span>
                        <span className="text-slate-900">{drawerRecord.paidEmis} / {drawerRecord.totalEmis} Paid</span>
                        <span className="text-slate-400 font-semibold">{((drawerRecord.paidEmis / drawerRecord.totalEmis) * 100).toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(drawerRecord.paidEmis / drawerRecord.totalEmis) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="bg-emerald-50/60 border border-emerald-100 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Paid</span>
                        <span className="text-sm font-extrabold text-emerald-900 block mt-0.5">{drawerRecord.paidEmis}</span>
                        <span className="text-[11px] font-bold text-emerald-700 block">{fmtCurr(drawerRecord.paidAmountTotal)}</span>
                      </div>
                      <div className="bg-amber-50/60 border border-amber-100 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Due</span>
                        <span className="text-sm font-extrabold text-amber-900 block mt-0.5">1</span>
                        <span className="text-[11px] font-bold text-amber-700 block">{fmtCurr(drawerRecord.amount)}</span>
                      </div>
                      <div className="bg-sky-50/60 border border-sky-100 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">Remaining</span>
                        <span className="text-sm font-extrabold text-sky-900 block mt-0.5">{drawerRecord.totalEmis - drawerRecord.paidEmis - 1}</span>
                        <span className="text-[11px] font-bold text-sky-700 block">{fmtCurr(drawerRecord.remainingAmountTotal)}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                      <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block">Current EMI (Due)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs items-center">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">EMI No.</span>
                          <span className="font-bold text-slate-800">{drawerRecord.paidEmis + 1} of {drawerRecord.totalEmis}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">Due Date</span>
                          <span className="font-bold text-slate-800">{drawerRecord.dueDate}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">Amount</span>
                          <span className="font-extrabold text-slate-900">{fmtCurr(drawerRecord.amount)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">Status</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700">
                            {drawerRecord.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Quick Actions</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleSendReminder(drawerRecord)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer"
                        >
                          <MessageSquare size={14} />
                          Send Reminder
                        </button>
                        <button
                          onClick={() => handleCallCustomer(drawerRecord)}
                          className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
                        >
                          <Phone size={14} />
                          Call Customer
                        </button>
                        <button
                          onClick={() => setStatusUpdateOpen(!statusUpdateOpen)}
                          className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          Update Status
                        </button>
                      </div>
                      {statusUpdateOpen && (
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-lg space-y-2 text-xs">
                          <p className="font-bold text-slate-600 text-[10px] uppercase">Select New Status</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {['DUE', 'PAID', 'UPCOMING', 'OVERDUE', 'MESSAGE SENT', 'CUSTOMER CONTACTED'].map(st => (
                              <button
                                key={st}
                                onClick={() => handleUpdateStatus(drawerRecord.id, st as any)}
                                className="px-2 py-1 text-left text-[11px] font-bold rounded-lg border hover:bg-blue-50 text-slate-700"
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 pt-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Communication History</span>
                      <div className="space-y-3 text-xs border-l-2 border-slate-200 pl-3">
                        {drawerRecord.history.map((h, i) => (
                          <div key={h.id || i} className="relative group">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{h.date}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{h.author}</span>
                            </div>
                            <p className="text-slate-600 mt-0.5 font-medium">{h.note}</p>
                          </div>
                        ))}
                        {drawerRecord.history.length === 0 && (
                          <p className="text-xs text-slate-400 font-medium">No history logged yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {drawerTab === 'schedule' && (
                  <div className="space-y-3 text-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">EMI Payment Schedule ({drawerRecord.totalEmis} Months)</span>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {drawerRecord.schedule.map(sc => (
                        <div key={sc.emiNo} className="p-3 flex items-center justify-between bg-white hover:bg-slate-50">
                          <div>
                            <span className="font-extrabold text-slate-900 block">EMI #{sc.emiNo}</span>
                            <span className="text-slate-400 text-[11px]">Due: {sc.dueDate}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-slate-900 block">{fmtCurr(sc.amount)}</span>
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[9px] font-black uppercase',
                              sc.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            )}>
                              {sc.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {drawerTab === 'communication' && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">Add Log / Communication Note</label>
                      <textarea
                        rows={3}
                        value={newNoteInput}
                        onChange={e => setNewNoteInput(e.target.value)}
                        placeholder="Enter details of customer call, WhatsApp response or note..."
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500/20 outline-none"
                      />
                      <button type="submit" className="w-full py-2 bg-purple-600 text-white rounded-xl font-bold text-[10px] sm:text-xs hover:bg-purple-700 shadow-xs cursor-pointer">
                        Add Communication Log
                      </button>
                    </form>
                    <div className="space-y-3 text-xs pt-2">
                      {drawerRecord.history.map(h => (
                        <div key={h.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>{h.date}</span>
                            <span>{h.author}</span>
                          </div>
                          <p className="font-semibold text-slate-800">{h.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {drawerTab === 'notes' && (
                  <div className="space-y-3 text-xs">
                    <label className="font-bold text-slate-700 block">Policy Notes</label>
                    <textarea
                      rows={6}
                      defaultValue={drawerRecord.notes || ''}
                      placeholder="Add internal notes for this policy EMI..."
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                    <button
                      onClick={() => toast.success('Notes saved successfully!')}
                      className="py-2 px-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 cursor-pointer"
                    >
                      Save Notes
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-white shrink-0">
              <button
                onClick={() => handleMarkAsPaid(drawerRecord.id)}
                disabled={drawerRecord.status === 'PAID'}
                className={clsx(
                  'w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer',
                  drawerRecord.status === 'PAID'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-blue-500/20'
                )}
              >
                <CheckCircle2 size={18} />
                {drawerRecord.status === 'PAID' ? 'Already Paid' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
      */}

    </div>
  );
}
