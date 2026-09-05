import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useLeadKanban, useMoveLeadStage, useCreateLead, useUpdateLead, useDeleteLead } from '@hooks/useLeads';
import Modal from '@comps/common/Modal';
import {
  Plus, Search, Pencil, Trash2, Shield, Upload, Phone, Calendar,
  MessageCircle, LayoutGrid, List, Filter, X, UserPlus, Users,
  UserCircle2, Mail, ChevronDown, Flame, Thermometer, Snowflake,
  Columns, ArrowUpDown, ChevronUp, ChevronRight, Send, RefreshCw, Save, FileText, History, Lock, Settings
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { contactsService, policiesService, leadsService, employeesService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { useLookupStore } from '@store/lookup.store';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import { CountryPhoneInput } from '@comps/common/CountryPhoneInput';
import { DatalistInput } from '@comps/common/DatalistInput';
import { sortData } from '../../utils/sortUtils';
import { db } from '../../services/firebase';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';

const EDUCATION_OPTIONS = [
  'Metric',
  'Intermediate',
  'Graduate',
  'Post Graduate',
  'Up to 9th class passed',
  '10th class passed',
  'Post Graduate (Gen)',
  'Med Graduate',
  'Post Graduate, Eng',
  'Law Graduate / Post Graduate',
  'CA/ICWA/MBA/CFA',
  'Computer degree other',
  'Other',
];

const OCCUPATION_TYPE_OPTIONS = [
  'Salaried Private',
  'Salaried Gov',
  'Salaried/Service',
  'Business Owner',
  'Business',
  'Industrialist',
  'Self Employed Professional',
  'Agriculture',
  'Student',
  'Retired',
  'Homemaker',
  'Other',
];

const formatPreview = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MMM/yyyy');
  } catch {
    return '';
  }
};

// ── Stage Mappings ────────────────────────────────────────────────────────────

export const STAGE_LABELS: Record<string, string> = {
  TO_CONTACT: 'To Contact',
  CONTACTED: 'Contacted',
  PROPOSAL_SENT: 'Proposal Sent',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE: 'Payment Done',
  PROCESS_COMPLETED: 'Process Completed',
};

const UI_STAGES = ['To Contact', 'Contacted', 'Proposal Sent', 'Login Progress', 'Payment Done', 'Process Completed'];

const STAGE_MAPPINGS: Record<string, string> = {
  'To Contact': 'TO_CONTACT',
  'Contacted': 'CONTACTED',
  'Proposal Sent': 'PROPOSAL_SENT',
  'Login Progress': 'LOGIN_PROGRESS',
  'Payment Done': 'PAYMENT_DONE',
  'Process Completed': 'PROCESS_COMPLETED',
};

const BACKEND_TO_UI: Record<string, string> = {
  NEW: 'To Contact',
  OPEN: 'To Contact',
  TO_CONTACT: 'To Contact',
  CONTACTED: 'Contacted',
  PROPOSAL_SENT: 'Proposal Sent',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE: 'Payment Done',
  PROCESS_COMPLETED: 'Process Completed',
};

const STAGE_COLORS: Record<string, string> = {
  'To Contact': 'bg-blue-50/20 border-blue-100',
  'Contacted': 'bg-indigo-50/20 border-indigo-100',
  'Proposal Sent': 'bg-purple-50/20 border-purple-100',
  'Login Progress': 'bg-orange-50/20 border-orange-100',
  'Payment Done': 'bg-green-50/20 border-green-100',
  'Process Completed': 'bg-emerald-50/20 border-emerald-100',
};

const BADGE_STYLES: Record<string, string> = {
  TO_CONTACT: 'bg-blue-50 text-blue-700 border-blue-200',
  CONTACTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PROPOSAL_SENT: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGIN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
  PAYMENT_DONE: 'bg-green-50 text-green-700 border-green-200',
  PROCESS_COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ── Hotness Level ─────────────────────────────────────────────────────────────
type HotnessLevel = 'HOT' | 'WARM' | 'COLD';

function deriveHotness(lead: any): HotnessLevel {
  if (!lead.followUpDate) return 'COLD';
  const daysUntil = Math.ceil((new Date(lead.followUpDate).getTime() - Date.now()) / 86400000);
  if (daysUntil < 0) return 'HOT';
  if (daysUntil <= 3) return 'HOT';
  if (daysUntil <= 7) return 'WARM';
  return 'COLD';
}

const HOTNESS_CONFIG: Record<HotnessLevel, { label: string; cls: string; iconName: string }> = {
  HOT: { label: 'Hot', cls: 'text-red-600 bg-red-50 border-red-200', iconName: 'Flame' },
  WARM: { label: 'Warm', cls: 'text-amber-600 bg-amber-50 border-amber-200', iconName: 'Thermometer' },
  COLD: { label: 'Cold', cls: 'text-blue-500 bg-blue-50 border-blue-200', iconName: 'Snowflake' },
};

function HotnessIcon({ level }: { level: HotnessLevel }) {
  if (level === 'HOT') return <Flame size={10} />;
  if (level === 'WARM') return <Thermometer size={10} />;
  return <Snowflake size={10} />;
}

function parseLeadNotes(notes?: string | null): Record<string, any> {
  if (!notes) return {};
  try {
    let curr: any = notes;
    let iterations = 0;
    while (typeof curr === 'string' && iterations < 10) {
      iterations++;
      const trimmed = curr.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          curr = JSON.parse(trimmed);
        } catch {
          break;
        }
      } else {
        break;
      }
    }

    if (typeof curr !== 'object' || curr === null) {
      const strVal = typeof curr === 'string' ? curr.trim() : '';
      return { descriptionDetails: strVal.startsWith('{') ? '' : strVal };
    }

    // Recursively unwrap descriptionDetails if it contains stringified JSON
    let desc = curr.descriptionDetails;
    let descIter = 0;
    while (desc && descIter < 10) {
      descIter++;
      if (typeof desc === 'object' && desc !== null) {
        if (!curr.leadStatus && desc.leadStatus) curr.leadStatus = desc.leadStatus;
        if (!curr.leadType && desc.leadType) curr.leadType = desc.leadType;
        if (!curr.leadSource && desc.leadSource) curr.leadSource = desc.leadSource;
        desc = desc.descriptionDetails || desc.notes || desc.comment || '';
      } else if (typeof desc === 'string') {
        const dTrim = desc.trim();
        if (dTrim.startsWith('{') && dTrim.endsWith('}')) {
          try {
            const p = JSON.parse(dTrim);
            if (p && typeof p === 'object') {
              if (!curr.leadStatus && p.leadStatus) curr.leadStatus = p.leadStatus;
              if (!curr.leadType && p.leadType) curr.leadType = p.leadType;
              if (!curr.leadSource && p.leadSource) curr.leadSource = p.leadSource;
              desc = p.descriptionDetails || p.notes || p.comment || '';
            } else {
              break;
            }
          } catch {
            break;
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Clean up description if it is still a raw JSON string
    let cleanDesc = typeof desc === 'string' ? desc.trim() : '';
    if (cleanDesc.startsWith('{') && cleanDesc.endsWith('}')) {
      cleanDesc = '';
    }

    return {
      ...curr,
      descriptionDetails: cleanDesc,
    };
  } catch {
    return {};
  }
}

// ── Form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Min 10 digits'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  dateOfBirth: z.string().optional(),
  height: z.coerce.number().optional().or(z.literal('')),
  weight: z.coerce.number().optional().or(z.literal('')),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  annualIncome: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(),
  isActive: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  leadStage: z.string().optional(),
  leadStatus: z.string().optional(),
  leadType: z.string().optional(),
  followUpDate: z.string().optional(),
});
type Form = z.infer<typeof schema>;

// ── Column definitions ────────────────────────────────────────────────────────
const ALL_TABLE_COLUMNS = [
  { key: 'name', label: 'Client Name', defaultVisible: true },
  { key: 'plan', label: 'Product', defaultVisible: true },
  { key: 'hotness', label: 'Hotness', defaultVisible: true },
  { key: 'employee', label: 'Assigned To', defaultVisible: true },
  { key: 'premiumBudget', label: 'Exp. Premium', defaultVisible: true },
  { key: 'followUpDate', label: 'Next Follow-up', defaultVisible: true },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'actions', label: '', defaultVisible: true },
];

const PLAN_CATEGORIES = [
  { value: 'LIFE', label: 'Life Insurance' },
  { value: 'HEALTH', label: 'Health Insurance' },
  { value: 'MOTOR', label: 'Motor Insurance' },
  { value: 'TRAVEL', label: 'Travel Insurance' },
  { value: 'GENERAL', label: 'General Insurance' },
];

const FILTER_STAGE_OPTIONS = [
  { value: 'TO_CONTACT', label: 'To Contact' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'LOGIN_PROGRESS', label: 'Login Progress' },
  { value: 'PAYMENT_DONE', label: 'Payment Done' },
  { value: 'PROCESS_COMPLETED', label: 'Process Completed' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'LEAD_LOST', label: 'Lead Lost' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'HOT', label: 'Hot' },
  { value: 'VERY_HOT', label: 'Very Hot' },
];

const MEDICAL_CONDITIONS_LIST = [
  'Diabetes Mellitus',
  'High BP / Cholesterol',
  'Heart Disease',
  'Tuberculosis',
  'Asthma',
  'Other Respiratory Infection',
  'Disease of bones/joints',
  'Slip disc',
  'Spinal Disorder',
  'Ligament Injury',
  'Cancer',
  'Gynecological disorder (DUB, Fibroid Uterus, Ovarian cyst)',
  'Undergone Cesarean / Hysterectomy',
  'Disease of Stomach / Intestine',
  'Liver / Gall Bladder / Pancreas',
  'Kidney / Urinary Bladder / Urinary Tract Disease',
  'Disease of Prostate / Fistula / Piles / Genital Disease',
  'Cataract or Other Disease of Eye and ENT',
  'Thyroid',
  'Others'
];

function MultiSelectBox({
  label,
  selectedValues,
  onChange,
  badgeColor = 'blue',
  placeholder = 'Select Conditions...'
}: {
  label: string;
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  badgeColor?: 'blue' | 'orange';
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = MEDICAL_CONDITIONS_LIST.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(o => o !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  return (
    <div className="relative">
      <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="input min-h-[40px] w-full cursor-pointer flex items-center justify-between gap-2 flex-wrap py-1.5 px-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
      >
        {selectedValues.length === 0 ? (
          <span className="text-slate-400 text-xs font-normal">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedValues.map((val, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  badgeColor === 'orange'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {val}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedValues.filter(v => v !== val));
                  }}
                  className="hover:text-red-600 font-bold cursor-pointer ml-0.5"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <span className="text-slate-400 text-[10px] ml-auto">▼</span>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 max-h-60 overflow-y-auto">
            <input
              type="text"
              className="input w-full text-xs py-1.5 px-2.5 mb-2 border border-slate-200 rounded-lg"
              placeholder="Type to search condition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="space-y-0.5">
              {filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={`w-3.5 h-3.5 rounded cursor-pointer ${badgeColor === 'orange' ? 'accent-orange-500' : 'accent-blue-600'}`}
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className={`font-medium ${isChecked ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Leads() {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'board' | 'table'>('table');
  const [showFilters, setShowFilters] = useState(false);
  const [createInitialStage, setCreateInitialStage] = useState<string>('TO_CONTACT');

  // Filters & Status Badges
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const toggleFilter = (filterName: string) => {
    setSelectedFilters(prev =>
      prev.includes(filterName) ? prev.filter(f => f !== filterName) : [...prev, filterName]
    );
  };
  const [filterProducts, setFilterProducts] = useState<string[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [excludeProduct, setExcludeProduct] = useState(false);

  const [filterPlans, setFilterPlans] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterStages, setFilterStages] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [planFilterOpen, setPlanFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [stageFilterOpen, setStageFilterOpen] = useState(false);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const planFilterRef = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  const stageFilterRef = useRef<HTMLDivElement>(null);
  const typeFilterRef = useRef<HTMLDivElement>(null);

  // Table sort
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Table column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_TABLE_COLUMNS.map(c => [c.key, c.defaultVisible]))
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      openCreate();
    }
  }, [searchParams]);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Detail popup
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'comments' | 'stage'>('overview');

  const [activeLeadTab, setActiveLeadTab] = useState('Personal');
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [loadedContact, setLoadedContact] = useState<any | null>(null);
  const [duplicateContactMatched, setDuplicateContactMatched] = useState<any | null>(null);
  const [maxRenewalWindow, setMaxRenewalWindow] = useState<number>(45);

  useEffect(() => {
    leadsService.getRenewalWindow()
      .then((res: any) => {
        if (res?.data?.maxWindow) {
          setMaxRenewalWindow(res.data.maxWindow);
        }
      })
      .catch(() => {});
  }, []);

  // Policy Modal States for PAYMENT_DONE -> PROCESS_COMPLETED transition
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyLead, setPolicyLead] = useState<any>(null);
  const [policySelectedType, setPolicySelectedType] = useState('');
  const [policySelectedCompany, setPolicySelectedCompany] = useState('');
  const [policySelectedPlanId, setPolicySelectedPlanId] = useState('');

  const { register: registerPolicy, handleSubmit: handleSubmitPolicy, reset: resetPolicy, setValue: setPolicyValue, watch: watchPolicy } = useForm<any>({
    defaultValues: {
      policyNumber: '',
      sumAssured: '',
      premiumAmount: '',
      startDate: '',
      endDate: '',
      paymentFrequency: 'YEARLY',
    }
  });

  const { data: allPlansRes } = useQuery({
    queryKey: ['all-plans-list-picker'],
    queryFn: () => policiesService.plans(),
  });
  const plansList = allPlansRes?.data ?? [];

  const availableTypes = useMemo(() => {
    return Array.from(new Set(plansList.map((p: any) => p.category))).filter(Boolean) as string[];
  }, [plansList]);

  const availableCompanies = useMemo(() => {
    if (!policySelectedType) return [];
    return Array.from(
      new Set(
        plansList
          .filter((p: any) => p.category === policySelectedType)
          .map((p: any) => p.company?.name)
          .filter(Boolean)
      )
    ) as string[];
  }, [plansList, policySelectedType]);

  const availablePlans = useMemo(() => {
    if (!policySelectedType || !policySelectedCompany) return [];
    return plansList.filter(
      (p: any) => p.category === policySelectedType && p.company?.name === policySelectedCompany
    );
  }, [plansList, policySelectedType, policySelectedCompany]);

  const watchPolicyStartDate = watchPolicy('startDate');
  const watchPolicyEndDate = watchPolicy('endDate');
  useEffect(() => {
    if (watchPolicyStartDate) {
      const start = new Date(watchPolicyStartDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setFullYear(start.getFullYear() + 1); // default 1 year duration
        setPolicyValue('endDate', end.toISOString().split('T')[0]);
      }
    }
  }, [watchPolicyStartDate, setPolicyValue]);

  const triggerPolicyCreationForLead = (leadObj: any) => {
    setDetailOpen(false); // Close the detail popup
    setPolicyLead(leadObj);
    const plan = leadObj.plan || {};

    if (plan.id) {
      setPolicySelectedType(plan.category || '');
      setPolicySelectedCompany(plan.company?.name || '');
      setPolicySelectedPlanId(plan.id);
    } else {
      setPolicySelectedType('');
      setPolicySelectedCompany('');
      setPolicySelectedPlanId('');
    }

    resetPolicy({
      policyNumber: '',
      sumAssured: leadObj.sumAssuredRequired ? String(leadObj.sumAssuredRequired) : '',
      premiumAmount: leadObj.premiumBudget ? String(leadObj.premiumBudget) : '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      paymentFrequency: 'YEARLY',
    });

    setPolicyModalOpen(true);
  };

  const handlePolicyFormSubmit = async (data: any) => {
    if (!policyLead) return;
    if (!policySelectedPlanId) {
      toast.error('Please select an insurance plan');
      return;
    }

    const toastId = toast.loading('Creating policy and updating lead status...');
    try {
      await policiesService.create({
        policyNumber: data.policyNumber,
        contactId: policyLead.contactId,
        planId: policySelectedPlanId,
        sumAssured: Number(data.sumAssured),
        premiumAmount: Number(data.premiumAmount),
        paymentFrequency: data.paymentFrequency,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      });

      await moveStage.mutateAsync({ id: policyLead.id, stage: 'PROCESS_COMPLETED' });

      toast.success('Policy created and lead moved to Process Completed!', { id: toastId });
      setPolicyModalOpen(false);

      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['policies'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to complete process', { id: toastId });
    }
  };

  type PersonalFields = Record<string, any>;

  const [personalFields, setPersonalFields] = useState<PersonalFields>({
    firstName: '',
    middleName: '',
    lastName: '',
    fullName: '',
    gender: '',
    maritalStatus: '',
    dateOfBirth: '',
    age: '',
    height: '',
    weight: '',
    email: '',
    aadhaarNumber: '',
    panNumber: '',
    pan: '',
    whatsappNumber: '',
    sameAsWhatsapp: false,
    callingNumber: '',
    education: '',
    annualIncome: '',
    occupationType: '',
    companyName: '',
    state: '',
    district: '',
    city: '',
    pincode: '',
    streetAddress: '',
    declaredMedicalHistory: [] as string[],
    notDeclaredMedicalHistory: [] as string[],
    medicalHistoryDetails: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    chewTobacco: false,
    smoke: false,
    consumeAlcohol: false,
    surgeryDetails: '',
    prescriptionDetails: ''
  });

  const [leadInfoFields, setLeadInfoFields] = useState({
    profileType: 'Lead Profile',
    leadStatus: 'TO_CONTACT',
    interestedIn: ['Health'],
    leadSource: 'By Agent',
    assignedEmployeeId: '',
    followUpDate: '',
  });

  const [leadComments, setLeadComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');

  type ProductComment = { text: string; author: string; datetime: string };
  type ProductInterestCard = {
    id: string;
    collapsed: boolean;
    interestedIn: string[];
    otherProduct: string;
    descriptionDetails?: string;
    leadStage: string;
    leadStatus: string;
    dependencyType?: string;
    dependentDetails?: string;
    leadType: string;
    leadSource: string;
    assignedEmployeeId: string;
    followUpDate: string;
    expectedPremium: string;
    comments: ProductComment[];
    newComment: string;
    showAllComments?: boolean;
  };

  function parseLeadNotes(notesText?: string | null) {
    const res = {
      leadStatus: 'INTERESTED',
      leadType: 'FRESH',
      cleanNotes: '',
      dependencyType: 'SELF',
      dependentDetails: '',
      descriptionDetails: '',
    };
    if (!notesText) return res;
    if (notesText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(notesText);
        res.leadStatus = parsed.leadStatus || 'INTERESTED';
        res.leadType = parsed.leadType || 'FRESH';
        res.cleanNotes = parsed.cleanNotes || '';
        res.dependencyType = parsed.dependencyType || 'SELF';
        res.dependentDetails = parsed.dependentDetails || '';
        res.descriptionDetails = parsed.descriptionDetails || '';
        return res;
      } catch (e) { }
    }
    const lines = notesText.split('\n');
    const cleanLines: string[] = [];
    lines.forEach(line => {
      if (line.startsWith('Status: ')) {
        res.leadStatus = line.replace('Status: ', '').trim();
      } else if (line.startsWith('Type: ')) {
        res.leadType = line.replace('Type: ', '').trim();
      } else if (line.startsWith('Dependency: ')) {
        res.dependencyType = line.replace('Dependency: ', '').trim();
      } else if (line.startsWith('Dependent Details: ')) {
        res.dependentDetails = line.replace('Dependent Details: ', '').trim();
      } else if (line.startsWith('Description Details: ')) {
        res.descriptionDetails = line.replace('Description Details: ', '').trim();
      } else {
        cleanLines.push(line);
      }
    });
    res.cleanNotes = cleanLines.join('\n').trim();
    return res;
  }

  function serializeLeadNotes(card: ProductInterestCard) {
    return JSON.stringify({
      leadStatus: card.leadStatus,
      leadType: card.leadType,
      dependencyType: card.dependencyType || 'SELF',
      dependentDetails: card.dependencyType === 'DEPENDENT' ? (card.dependentDetails || '') : '',
      descriptionDetails: card.descriptionDetails || '',
      cleanNotes: card.otherProduct ? `Other Product: ${card.otherProduct}` : '',
    });
  }

  const newProductInterestCard = (): ProductInterestCard => ({
    id: 'temp-' + Math.random().toString(36).slice(2),
    collapsed: false,
    interestedIn: [],
    otherProduct: '',
    descriptionDetails: '',
    leadStage: 'TO_CONTACT',
    leadStatus: 'INTERESTED',
    dependencyType: 'SELF',
    dependentDetails: '',
    leadType: 'FRESH',
    leadSource: 'Social Media',
    assignedEmployeeId: '',
    followUpDate: '',
    expectedPremium: '',
    comments: [],
    newComment: '',
    showAllComments: false,
  });

  const [productInterests, setProductInterests] = useState<ProductInterestCard[]>([]);

  const addProductInterest = () =>
    setProductInterests(prev => [...prev, newProductInterestCard()]);

  const removeProductInterest = async (id: string) => {
    const isExisting = id.length === 24 || /^[0-9a-fA-F]{24}$/.test(id);
    if (isExisting) {
      if (!confirm('Are you sure you want to delete this product interest from the server?')) return;
      const toastId = toast.loading('Deleting product interest...');
      try {
        await leadsService.remove(id);
        toast.success('Product interest deleted from server successfully!', { id: toastId });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['leads'] });
      } catch (err: any) {
        toast.error('Failed to delete product interest from server', { id: toastId });
        return;
      }
    }
    setProductInterests(prev => prev.filter(c => c.id !== id));
  };

  const updateProductInterest = (id: string, field: keyof ProductInterestCard, value: any) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const toggleProductCollapse = (id: string) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, collapsed: !c.collapsed } : c));

  const addProductComment = async (id: string) => {
    const card = productInterests.find(c => c.id === id);
    if (!card || !card.newComment.trim()) return;

    const user = useAuthStore.getState().user;
    const author = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User' : 'User';
    const commentText = card.newComment.trim();

    const isExisting = id.length === 24 || /^[0-9a-fA-F]{24}$/.test(id);
    if (isExisting) {
      const toastId = toast.loading('Adding comment...');
      try {
        await leadsService.addConsultation(id, { notes: commentText });
        toast.success('Comment added successfully!', { id: toastId });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['leads'] });
      } catch (err: any) {
        toast.error('Failed to save comment to server', { id: toastId });
      }
    }

    const comment = {
      text: commentText,
      author,
      datetime: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    setProductInterests(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, comments: [...c.comments, comment], newComment: '' };
    }));
  };

  const createEmptyFamilyMember = () => ({
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    relation: '',
    whatsapp: '',
    callingNumber: '',
    occupation: '',
    education: '',
    medicalHistory: [] as string[],
    declaredMedicalHistory: [] as string[],
    notDeclaredMedicalHistory: [] as string[],
    medicalHistoryDetails: '',
  });

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([createEmptyFamilyMember()]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: kanbanRes, isLoading } = useLeadKanban();
  const moveStage = useMoveLeadStage();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isOwner = user?.role === 'OWNER';

  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);

  const { data: empRes } = useQuery({
    queryKey: ['employees-list-leads'],
    queryFn: () => employeesService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });
  const employeesList = useMemo(() => {
    const raw = empRes?.data?.data || empRes?.data || [];
    return Array.isArray(raw) ? raw : [];
  }, [empRes]);

  // Real-time Web / Firestore Consultation Leads Listener
  const [deletedKeys, setDeletedKeys] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('insumitra_deleted_lead_keys') || '[]');
      // Keep only specific ID formats (starts with fs_, local_, checkup_, lead_, or alphanumeric >= 12 chars)
      const idsOnly = raw.filter((k: string) => /^(fs_|local_|checkup_|lead_|[0-9a-zA-Z_-]{12,})/i.test(k));
      localStorage.setItem('insumitra_deleted_lead_keys', JSON.stringify(idsOnly));
      return idsOnly;
    } catch {
      return [];
    }
  });

  const [webLeads, setWebLeads] = useState<any[]>([]);

  useEffect(() => {
    const currentDeleted = new Set(
      (() => {
        try {
          const raw = JSON.parse(localStorage.getItem('insumitra_deleted_lead_keys') || '[]');
          return raw
            .filter((k: string) => /^(fs_|local_|checkup_|lead_|[0-9a-zA-Z_-]{12,})/i.test(k))
            .map((k: string) => String(k).trim().toLowerCase());
        } catch {
          return [];
        }
      })()
    );

    const isDeletedItem = (id: string) => {
      const idLow = id.toLowerCase();
      const fsId = idLow.replace('fs_', '');
      if (currentDeleted.has(idLow) || (fsId && currentDeleted.has(fsId))) return true;
      return false;
    };

    // 1. Initial Local Storage Load
    const loadLocalWebLeads = () => {
      try {
        const local = JSON.parse(localStorage.getItem('insumitra_local_leads') || '[]');
        const rahulLeads = JSON.parse(localStorage.getItem('rahul_kulkarni_leads') || '[]');
        const rahulCheckups = JSON.parse(localStorage.getItem('rahul_kulkarni_checkups') || '[]');

        const mappedRahul = rahulLeads.map((item: any) => {
          const fullName = item.name || item.fullName || 'Website Lead';
          const parts = fullName.trim().split(/\s+/);
          return {
            id: 'local_lead_' + (item.id || item.timestamp || Date.now()),
            stage: 'TO_CONTACT',
            uiStage: 'To Contact',
            createdAt: item.date || item.createdAt || new Date().toISOString(),
            notes: JSON.stringify({
              leadStatus: 'INTERESTED',
              leadSource: 'Website Consultation',
              leadType: 'FRESH',
              descriptionDetails: `Book Free Consultation: ${item.service || 'Financial Advisory'}`
            }),
            interests: [item.service || 'Financial Advisory'],
            contact: {
              id: 'local_contact_' + (item.id || item.timestamp || Date.now()),
              firstName: parts[0] || 'Web',
              lastName: parts.slice(1).join(' ') || 'User',
              phone: item.phone || item.mobile || '',
              email: item.email || '',
              tags: ['Website Consultation']
            },
            plan: {
              name: item.service || 'Financial Advisory',
              category: (item.service || '').toUpperCase().includes('HEALTH') ? 'HEALTH' : 'LIFE'
            }
          };
        });

        const mappedCheckups = rahulCheckups.map((item: any) => {
          const fullName = item.name || item.fullName || 'Health Checkup Lead';
          const parts = fullName.trim().split(/\s+/);
          return {
            id: 'checkup_lead_' + (item.id || item.timestamp || Date.now()),
            stage: 'TO_CONTACT',
            uiStage: 'To Contact',
            createdAt: item.timestamp || new Date().toISOString(),
            notes: JSON.stringify({
              leadStatus: 'INTERESTED',
              leadSource: 'Website Checkup',
              leadType: 'FRESH',
              descriptionDetails: `Financial Health Checkup (Score: ${item.score || 0}/100)`
            }),
            interests: ['Financial Health Checkup'],
            contact: {
              id: 'checkup_contact_' + (item.id || item.timestamp || Date.now()),
              firstName: parts[0] || 'Web',
              lastName: parts.slice(1).join(' ') || 'User',
              phone: item.phone || item.mobile || '',
              email: item.email || '',
              tags: ['Financial Checkup']
            },
            plan: {
              name: `Financial Health Checkup (Score: ${item.score || 0}/100)`,
              category: 'HEALTH'
            }
          };
        });

        const combined = [...local, ...mappedRahul, ...mappedCheckups];
        return combined.filter(l => !isDeletedItem(String(l.id || '')));
      } catch (e) {
        return [];
      }
    };

    setWebLeads(loadLocalWebLeads());

    const normalizeWebLeadItem = (item: any, idFallback: string) => {
      const fullName = (item.fullName || item.name || item.contact?.firstName || 'Website Lead').trim();
      const parts = fullName.split(/\s+/);
      const firstName = item.contact?.firstName || parts[0] || 'Web';
      const lastName = item.contact?.lastName || parts.slice(1).join(' ') || 'User';
      const service = item.serviceRequired || item.service || item.plan?.name || (item.interests && item.interests[0]) || 'Financial Advisory';
      const phone = item.phone || item.mobile || item.contact?.phone || '';
      const email = item.email || item.contact?.email || '';
      const sUpper = (service || '').toUpperCase();
      const category = sUpper.includes('HEALTH') || sUpper.includes('MEDICLAIM')
        ? 'HEALTH'
        : (sUpper.includes('MUTUAL') || sUpper.includes('MF') || sUpper.includes('WEALTH') || sUpper.includes('SIP'))
          ? 'MUTUAL FUNDS'
          : sUpper.includes('MOTOR') || sUpper.includes('CAR')
            ? 'MOTOR'
            : 'LIFE';

      return {
        id: item.id || idFallback,
        stage: item.stage === 'OPEN' || !item.stage ? 'TO_CONTACT' : item.stage,
        uiStage: 'To Contact',
        createdAt: item.createdAt || new Date().toISOString(),
        followUpDate: item.followUpDate || new Date().toISOString().split('T')[0],
        notes: typeof item.notes === 'string' ? item.notes : JSON.stringify({
          leadStatus: 'INTERESTED',
          leadSource: 'Website Consultation',
          leadType: 'FRESH',
          descriptionDetails: `Book Free Consultation: ${service}`
        }),
        interests: item.interests || [service],
        contact: {
          id: 'contact_' + (item.id || idFallback),
          firstName,
          lastName,
          phone,
          email,
          tags: item.contact?.tags || ['Website Consultation', service]
        },
        plan: {
          name: service,
          category
        }
      };
    };

    // 2. Realtime Broadcast Channel Listener
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('consultation_leads_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'NEW_LEAD') {
          const item = event.data.payload || event.data.card;
          const normalized = normalizeWebLeadItem(item, 'lead_bc_' + Date.now());
          const fullName = `${normalized.contact.firstName} ${normalized.contact.lastName}`.trim();
          if (!isDeletedItem(String(normalized.id))) {
            toast.success(`🔔 New Consultation Booking: ${fullName}`, { duration: 6000 });
            setWebLeads(prev => [normalized, ...prev.filter(p => String(p.id) !== String(normalized.id))]);
            qc.invalidateQueries({ queryKey: ['leads'] });
          }
        }
      };
    } catch (e) {}

    // 3. Window PostMessage Listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_LEAD') {
        const item = event.data.payload || event.data.card;
        const normalized = normalizeWebLeadItem(item, 'lead_msg_' + Date.now());
        if (!isDeletedItem(String(normalized.id))) {
          setWebLeads(prev => [normalized, ...prev.filter(p => String(p.id) !== String(normalized.id))]);
          qc.invalidateQueries({ queryKey: ['leads'] });
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // 4. Firestore Realtime Snapshot Listener
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      const leadsCol = collection(db, 'leads');
      unsubscribeFirestore = onSnapshot(leadsCol, (snapshot) => {
        const firestoreList: any[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const fullName = (data.fullName || data.name || data.clientName || 'Website Lead').trim();
          const parts = fullName.split(/\s+/);
          const firstName = parts[0] || 'Web';
          const lastName = parts.slice(1).join(' ') || 'User';
          const service = data.serviceRequired || data.service || data.requirement || data.planName || 'Financial Planning';
          const phone = data.phone || data.mobile || data.contactNumber || '';
          const email = data.email || '';
          const createdAtDate = data.createdAt?.toDate 
            ? data.createdAt.toDate().toISOString() 
            : (data.createdAtIso || (data.timestamp ? new Date(Number(data.timestamp)).toISOString() : new Date().toISOString()));

          if (!isDeletedItem('fs_' + docSnap.id)) {
            const sUpper = (service || '').toUpperCase();
            const category = sUpper.includes('HEALTH') || sUpper.includes('MEDICLAIM')
              ? 'HEALTH'
              : (sUpper.includes('MUTUAL') || sUpper.includes('MF') || sUpper.includes('WEALTH') || sUpper.includes('SIP'))
                ? 'MUTUAL FUNDS'
                : sUpper.includes('MOTOR') || sUpper.includes('CAR')
                  ? 'MOTOR'
                  : 'LIFE';

            const descriptionDetails = data.notes || (
              data.age || data.income
                ? `Financial Checkup (Age: ${data.age || 'N/A'}, Income: ${data.income || 'N/A'}, Requirement: ${service})`
                : `Website Consultation: ${service}`
            );

            firestoreList.push({
              id: 'fs_' + docSnap.id,
              stage: data.stage === 'OPEN' || !data.stage ? 'TO_CONTACT' : data.stage,
              uiStage: 'To Contact',
              createdAt: createdAtDate,
              followUpDate: data.followUpDate || new Date().toISOString().split('T')[0],
              assignedEmployeeId: data.assignedEmployeeId || data.assignedTo || '',
              assignedTo: data.assignedTo || data.assignedEmployeeId || '',
              assignedToName: data.assignedToName || data.assignedEmployeeName || data.assignedEmployee?.name || '',
              assignedEmployee: data.assignedEmployee || (data.assignedToName ? { name: data.assignedToName, id: data.assignedEmployeeId || data.assignedTo } : undefined),
              premiumBudget: data.premiumBudget || data.expectedPremium || data.amount || undefined,
              expectedPremium: data.expectedPremium || data.premiumBudget || data.amount || undefined,
              notes: JSON.stringify({
                leadStatus: data.status || 'INTERESTED',
                leadSource: data.leadSource || data.source || 'Website Consultation',
                leadType: data.leadType || 'FRESH',
                assignedEmployeeId: data.assignedEmployeeId || data.assignedTo || '',
                assignedEmployeeName: data.assignedToName || data.assignedEmployeeName || '',
                descriptionDetails
              }),
              interests: [service],
              contact: {
                id: 'fs_contact_' + docSnap.id,
                firstName,
                lastName,
                phone,
                email,
                tags: ['Website Consultation', service]
              },
              plan: {
                name: service,
                category
              }
            });
          }
        });

        if (firestoreList.length >= 0) {
          setWebLeads(prev => {
            return [...firestoreList, ...prev.filter(p => !p.id.startsWith('fs_'))];
          });
        }
      }, (err) => {
        console.warn('Firestore leads listener notice:', err);
      });
    } catch (e) {
      console.warn('Firestore init error:', e);
    }

    return () => {
      if (channel) channel.close();
      window.removeEventListener('message', handleMessage);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [qc]);

  // Flat leads
  const leadsFlat = useMemo(() => {
    const deletedSet = new Set(
      (() => {
        try {
          return JSON.parse(localStorage.getItem('insumitra_deleted_lead_keys') || '[]').map((k: string) => String(k).trim().toLowerCase());
        } catch {
          return [];
        }
      })()
    );

    const isDeletedCard = (card: any) => {
      if (!card) return true;
      const cId = String(card.id || '').toLowerCase();
      const fsId = cId.replace('fs_', '');
      if (deletedSet.has(cId) || (fsId && deletedSet.has(fsId))) return true;
      return false;
    };

    const rawData = kanbanRes?.data ?? {};
    const flat: any[] = [];
    Object.keys(rawData).forEach(backendStage => {
      (rawData[backendStage] || []).forEach((card: any) => {
        if (!isDeletedCard(card)) {
          flat.push({ ...card, uiStage: BACKEND_TO_UI[card.stage] || 'To Contact' });
        }
      });
    });

    // Merge webLeads without blocking same phone or unique IDs
    const seenIds = new Set(flat.map(l => String(l.id)));
    webLeads.forEach(wl => {
      if (!isDeletedCard(wl)) {
        const idStr = String(wl.id);
        if (!seenIds.has(idStr)) {
          seenIds.add(idStr);
          flat.unshift({ ...wl, uiStage: BACKEND_TO_UI[wl.stage] || 'To Contact' });
        }
      }
    });

    // Ensure newest leads appear at the top
    flat.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return flat;
  }, [kanbanRes, webLeads, deletedKeys]);

  // Client-side filter
  const filteredLeads = useMemo(() => {
    const sTerm = search.toLowerCase();
    return leadsFlat.filter(lead => {
      // Employee role data isolation safeguard: only see self-assigned or unassigned
      if (user?.role === 'EMPLOYEE') {
        const currentUserId = user.id;
        const assignedEmpId = lead.assignedEmployeeId || lead.assignedEmployee?.id || lead.assignedEmployee?.userId;
        if (assignedEmpId) {
          const myEmp = employeesList.find((e: any) => e.userId === currentUserId || e.user?.id === currentUserId || e.id === currentUserId);
          const validMyIds = [currentUserId];
          if (myEmp?.id) validMyIds.push(myEmp.id);
          if (myEmp?.userId) validMyIds.push(myEmp.userId);
          if (myEmp?.user?.id) validMyIds.push(myEmp.user.id);
          if (!validMyIds.includes(assignedEmpId)) {
            return false;
          }
        }
      }
      const fullName = `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.toLowerCase();
      if (search && !fullName.includes(sTerm) && !(lead.contact?.phone || '').includes(sTerm)) return false;

      // Active / Inactive Status Badges Filter
      const extra = parseLeadNotes(lead.notes);
      const status = extra.leadStatus || 'INTERESTED';
      const isLostOrInactive = ['LEAD_LOST', 'NOT_INTERESTED', 'LOST'].includes(status) || lead.stage === 'LOST' || lead.stage === 'PROCESS_COMPLETED';
      if (selectedFilters.includes('Active') && !selectedFilters.includes('Inactive') && isLostOrInactive) {
        return false;
      }
      if (selectedFilters.includes('Inactive') && !selectedFilters.includes('Active') && !isLostOrInactive) {
        return false;
      }

      // Product Categories Filter (with Exclude)
      if (filterProducts.length > 0) {
        const leadCat = (lead.plan?.category || '').toUpperCase();
        const leadInterests: string[] = (lead.interests || []).map((i: string) => i.toUpperCase());
        const hasProduct = filterProducts.some(p => {
          const pUpper = p.toUpperCase();
          if (pUpper === 'MF' || pUpper === 'MUTUAL FUNDS') {
            return leadCat === 'MF' || leadCat === 'MUTUAL FUNDS' || leadInterests.some((i: string) => i.includes('MF') || i.includes('MUTUAL'));
          }
          if (pUpper === 'ACCIDENT') {
            return leadCat === 'ACCIDENT' || leadInterests.some((i: string) => i.includes('ACCIDENT'));
          }
          return leadCat === pUpper || leadInterests.includes(pUpper) || leadInterests.some((i: string) => i.includes(pUpper));
        });

        if (excludeProduct) {
          if (hasProduct) return false;
        } else {
          if (!hasProduct) return false;
        }
      } else if (filterPlans.length > 0 && !filterPlans.includes(lead.plan?.category ?? '')) {
        return false;
      }

      if (filterEmployee && lead.assignedEmployeeId !== filterEmployee) return false;
      if (filterStages.length > 0 && !filterStages.includes(lead.stage ?? '')) return false;
      
      if (filterStatuses.length > 0) {
        if (!filterStatuses.includes(status)) return false;
      }
      if (filterTypes.length > 0) {
        const lType = extra.leadType || 'FRESH';
        if (!filterTypes.includes(lType)) return false;
      }

      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom); fromDate.setHours(0, 0, 0, 0);
        const lDate = lead.followUpDate ? new Date(lead.followUpDate) : (lead.createdAt ? new Date(lead.createdAt) : null);
        if (!lDate || lDate < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo); toDate.setHours(23, 59, 59, 999);
        const lDate = lead.followUpDate ? new Date(lead.followUpDate) : (lead.createdAt ? new Date(lead.createdAt) : null);
        if (!lDate || lDate > toDate) return false;
      }
      return true;
    });
  }, [leadsFlat, search, selectedFilters, filterProducts, excludeProduct, filterPlans, filterEmployee, filterStatuses, filterStages, filterTypes, filterDateFrom, filterDateTo, user, employeesList]);

  // Sorted leads for table
  const sortedLeads = useMemo(() => {
    return sortData(filteredLeads, sortKey, sortDir as 'asc' | 'desc', (row: any, key: string) => {
      if (key === 'name') return `${row.contact?.firstName ?? ''} ${row.contact?.lastName ?? ''}`;
      if (key === 'plan') return row.plan?.name || (row.interests && row.interests.length > 0 ? row.interests.join(', ') : '');
      if (key === 'premiumBudget') return row.premiumBudget ?? 0;
      if (key === 'followUpDate') return row.followUpDate ? new Date(row.followUpDate).getTime() : 0;
      if (key === 'stage') return row.stage ?? '';
      
      const parts = key.split('.');
      let val = row;
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      return val !== undefined ? val : row[key];
    });
  }, [filteredLeads, sortKey, sortDir]);

  // Board columns
  const filteredBoard = useMemo(() => {
    const b: Record<string, any[]> = {};
    UI_STAGES.forEach(s => { b[s] = filteredLeads.filter(l => l.uiStage === s); });
    return b;
  }, [filteredLeads]);

  const expectedBusiness = (uiStage: string) =>
    (filteredBoard[uiStage] ?? []).reduce((sum, c) => sum + (c.premiumBudget ?? 0), 0);

  // Click-outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (planFilterRef.current && !planFilterRef.current.contains(e.target as Node)) setPlanFilterOpen(false);
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setStatusFilterOpen(false);
      if (stageFilterRef.current && !stageFilterRef.current.contains(e.target as Node)) setStageFilterOpen(false);
      if (typeFilterRef.current && !typeFilterRef.current.contains(e.target as Node)) setTypeFilterOpen(false);
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/91${phone.replace(/\D/g, '')}`, '_blank');
  };
  const handleCall = (phone?: string) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing leads...');
    try {
      const res = await leadsService.importCsv(file);
      toast.success(res.message || 'Successfully imported leads!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['leads'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import leads', { id: toastId });
    }
  };

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({ resolver: zodResolver(schema) });

  const calculateAge = (dob: string): number => {
    if (!dob) return 0;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 ? age : 0;
    } catch {
      return 0;
    }
  };

  const handleDOBChange = (val: string) => {
    const age = calculateAge(val);
    setPersonalFields(p => ({ ...p, dateOfBirth: val, age: String(age) }));
  };

  const handleLeadSubmit = async (e: React.FormEvent, shouldClose: boolean = false) => {
    if (e) e.preventDefault();
    const errors: Record<string, string> = {};

    let firstName = (personalFields.firstName || '').trim();
    let lastName = (personalFields.lastName || '').trim();
    if (!firstName && personalFields.fullName?.trim()) {
      const parts = personalFields.fullName.trim().split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || 'N/A';
    }
    if (!firstName) {
      errors.firstName = 'First Name is required (पहिले नाव आवश्यक आहे)';
    }
    if (!lastName) {
      errors.lastName = 'Last Name is required (आडनाव आवश्यक आहे)';
    }

    const rawWaDigits = (personalFields.whatsappNumber || personalFields.callingNumber || '').trim().replace(/\D/g, '');
    const waLocalDigits = rawWaDigits.length > 10 ? rawWaDigits.slice(-10) : rawWaDigits;
    if (!waLocalDigits) {
      errors.whatsappNumber = 'Mobile/Whatsapp Number is required (मोबाईल नंबर आवश्यक आहे)';
    } else if (waLocalDigits.length !== 10) {
      errors.whatsappNumber = 'Mobile Number must be exactly 10 digits (१० अंकी नंबर असावा)';
    }

    if (personalFields.aadhaarNumber?.trim()) {
      const cleanAadhaar = personalFields.aadhaarNumber.trim().replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        errors.aadhaarNumber = 'Aadhaar Number must be exactly 12 digits (१२ अंकी आधार नंबर असावा)';
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActiveLeadTab('Personal');
      toast.error('कृपया सर्व आवश्यक माहिती भरा (Please fill all required fields)');
      return;
    }

    const toastId = toast.loading(editTarget || editContactId ? 'Updating lead...' : 'Creating lead...');
    try {
      const mergedTags = [...selectedCampaigns];
      if (!mergedTags.includes('contact')) {
        mergedTags.push('contact');
      }

      let contactId = editContactId || editTarget?.contactId || editTarget?.contact?.id;

      // 1. If updating an existing lead (Firestore, Local, or Backend)
      if (editTarget) {
        const targetId = String(editTarget.id);
        const targetPhone = waLocalDigits;
        const targetName = `${firstName} ${lastName}`.trim();
        const firstInterestCard = productInterests[0];
        const updatedInterests = (firstInterestCard?.interestedIn && firstInterestCard.interestedIn.length > 0)
          ? firstInterestCard.interestedIn
          : (editTarget.interests || ['Health']);
        const updatedStage = firstInterestCard?.leadStage || editTarget.stage || 'TO_CONTACT';
        const updatedFollowUp = firstInterestCard?.followUpDate || editTarget.followUpDate || '';
        const updatedPremium = Number(firstInterestCard?.expectedPremium) || editTarget.premiumBudget || 0;
        const updatedNotes = firstInterestCard?.descriptionDetails || editTarget.notes || '';
        const assignedEmp = firstInterestCard?.assignedEmployeeId || leadInfoFields?.assignedEmployeeId || editTarget?.assignedEmployeeId || editTarget?.assignedTo || '';
        const availableList = getAssignableEmployees(employeesList, editTarget || personalFields);
        const foundEmp = availableList.find((e: any) => e.id === assignedEmp || e.userId === assignedEmp || e.user?.id === assignedEmp) ||
          employeesList.find((e: any) => e.id === assignedEmp || e.userId === assignedEmp || e.user?.id === assignedEmp);
        const assignedToName = foundEmp
          ? `${foundEmp.firstName || foundEmp.user?.firstName || foundEmp.employeeProfile?.firstName || ''} ${foundEmp.lastName || foundEmp.user?.lastName || foundEmp.employeeProfile?.lastName || ''}`.trim() || foundEmp.name || foundEmp.email
          : (editTarget?.assignedToName || '');

        // A. Update Firestore lead if applicable
        if (targetId.startsWith('fs_') || !/^[0-9a-fA-F]{24}$/.test(targetId)) {
          const fsDocId = targetId.startsWith('fs_') ? targetId.replace('fs_', '') : targetId;
          try {
            await updateDoc(doc(db, 'leads', fsDocId), {
              name: targetName,
              fullName: targetName,
              firstName,
              lastName,
              phone: targetPhone,
              mobile: targetPhone,
              email: personalFields.email || '',
              stage: updatedStage,
              interests: updatedInterests,
              assignedEmployeeId: assignedEmp || '',
              assignedTo: assignedEmp || '',
              assignedToName: assignedToName || '',
              assignedEmployee: assignedToName ? { name: assignedToName, id: assignedEmp } : null,
              followUpDate: updatedFollowUp,
              premiumBudget: updatedPremium,
              expectedPremium: updatedPremium,
              notes: updatedNotes,
              updatedAt: new Date().toISOString(),
            });
          } catch (fsErr) {
            console.warn('[Firestore Update Notice]:', fsErr);
          }
        }

        // B. Update Backend Lead if applicable
        if (/^[0-9a-fA-F]{24}$/.test(targetId)) {
          try {
            await leadsService.update(targetId, {
              stage: updatedStage,
              interests: updatedInterests,
              followUpDate: updatedFollowUp ? new Date(updatedFollowUp).toISOString() : undefined,
              premiumBudget: updatedPremium || undefined,
              notes: updatedNotes,
            });
          } catch (apiErr) {
            console.warn('[Backend Lead Update Notice]:', apiErr);
          }
        }

        // C. Update Backend Contact if exists
        if (contactId && /^[0-9a-fA-F]{24}$/.test(contactId)) {
          try {
            await contactsService.update(contactId, {
              firstName,
              lastName,
              phone: targetPhone,
              email: personalFields.email || undefined,
              dateOfBirth: personalFields.dateOfBirth ? new Date(personalFields.dateOfBirth).toISOString() : undefined,
            } as any);
          } catch (cErr) {
            console.warn('[Backend Contact Update Notice]:', cErr);
          }
        }

        // D. Update LocalStorage entries
        try {
          const local = JSON.parse(localStorage.getItem('insumitra_local_leads') || '[]');
          const updatedLocal = local.map((l: any) => {
            if (l.id === targetId || l.id === ('fs_' + targetId)) {
              return {
                ...l,
                name: targetName,
                fullName: targetName,
                contact: { ...(l.contact || {}), firstName, lastName, phone: targetPhone, email: personalFields.email },
                phone: targetPhone,
                stage: updatedStage,
                interests: updatedInterests,
                followUpDate: updatedFollowUp,
                premiumBudget: updatedPremium,
              };
            }
            return l;
          });
          localStorage.setItem('insumitra_local_leads', JSON.stringify(updatedLocal));
        } catch (e) {}

        // E. Update webLeads in memory
        setWebLeads(prev => prev.map(l => {
          if (l.id === targetId || l.id === ('fs_' + targetId)) {
            return {
              ...l,
              name: targetName,
              fullName: targetName,
              contact: {
                ...(l.contact || {}),
                firstName,
                lastName,
                phone: targetPhone,
                email: personalFields.email,
              },
              phone: targetPhone,
              stage: updatedStage,
              interests: updatedInterests,
              followUpDate: updatedFollowUp,
              premiumBudget: updatedPremium,
            };
          }
          return l;
        }));

        toast.success('Lead updated successfully!', { id: toastId });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['leads'] });
        closeModal();
        return;
      }

      // 2. New Lead Creation
      const contactPayload: any = {
        firstName,
        middleName: personalFields.middleName || undefined,
        lastName,
        phone: waLocalDigits,
        height: personalFields.height ? Number(personalFields.height) : undefined,
        weight: personalFields.weight ? Number(personalFields.weight) : undefined,
        panNumber: personalFields.panNumber || personalFields.pan || undefined,
        alternatePhone: personalFields.callingNumber || undefined,
        email: personalFields.email || undefined,
        gender: personalFields.gender || undefined,
        maritalStatus: personalFields.maritalStatus || undefined,
        dateOfBirth: personalFields.dateOfBirth?.trim() ? (personalFields.dateOfBirth.includes('-') ? personalFields.dateOfBirth : new Date(personalFields.dateOfBirth.split(/[\/\-\.]/).reverse().join('-')).toISOString()) : undefined,
        aadhaarNumber: personalFields.aadhaarNumber || undefined,
        education: personalFields.education || undefined,
        annualIncome: personalFields.annualIncome ? Number(personalFields.annualIncome) : undefined,
        tags: mergedTags,
        notes: personalFields.streetAddress || undefined,
      };

      const contactRes = await contactsService.create(contactPayload);
      const createdContactObj = contactRes?.data ?? contactRes;
      contactId = createdContactObj?.id || createdContactObj?._id;

      if (contactId) {
        setEditContactId(contactId);
        if (personalFields.state || personalFields.city || personalFields.pincode || personalFields.streetAddress) {
          await contactsService.addAddress(contactId, {
            type: 'HOME',
            line1: personalFields.streetAddress || 'N/A',
            city: personalFields.city || 'N/A',
            state: personalFields.state || 'N/A',
            pincode: personalFields.pincode || 'N/A',
            country: 'India',
            isPrimary: true,
          }).catch(err => console.error('Failed to add address:', err));
        }

        const validEmpId = (id?: string) => (id && /^[0-9a-fA-F]{24}$/.test(id.trim())) ? id.trim() : undefined;
        const firstCard = productInterests[0] || {};
        const product = firstCard.interestedIn?.[0] || 'Health';
        const interests = [product === 'Other' && firstCard.otherProduct ? firstCard.otherProduct : product];
        const stage = firstCard.leadStage && firstCard.leadStage !== 'OPEN' ? firstCard.leadStage : 'TO_CONTACT';

        await leadsService.create({
          contactId,
          interests,
          stage,
          source: firstCard.leadSource || 'Social Media',
          assignedEmployeeId: validEmpId(firstCard.assignedEmployeeId),
          followUpDate: String(firstCard.followUpDate ?? '').trim() ? new Date(firstCard.followUpDate).toISOString() : undefined,
          premiumBudget: Number(firstCard.expectedPremium) || undefined,
          notes: serializeLeadNotes(firstCard),
        });
      }

      toast.success('Lead successfully created!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      closeModal();
    } catch (err: any) {
      console.error('[Save Lead Error]', err);
      toast.error(err?.response?.data?.message || 'Failed to save lead', { id: toastId });
    }
  };

  const openCreate = (stage?: string) => {
    setEditTarget(null);
    setEditContactId(null);
    setLoadedContact(null);
    setPersonalFields({
      fullName: '',
      firstName: '',
      middleName: '',
      lastName: '',
      gender: '',
      maritalStatus: '',
      dateOfBirth: '',
      email: '',
      aadhaarNumber: '',
      whatsappNumber: '',
      sameAsWhatsapp: false,
      callingNumber: '',
      education: '',
      annualIncome: '',
      occupationType: '',
      companyName: '',
      state: '',
      district: '',
      city: '',
      pincode: '',
      streetAddress: '',
      declaredMedicalHistory: [],
      notDeclaredMedicalHistory: [],
      medicalHistoryDetails: ''
    });

    const currentUser = useAuthStore.getState().user;
    const curEmp = employeesList.find((e: any) => e.userId === currentUser?.id || e.id === currentUser?.id);

    setLeadInfoFields({
      profileType: 'Lead Profile',
      leadStatus: stage || 'TO_CONTACT',
      interestedIn: ['Health'],
      leadSource: 'Social Media',
      assignedEmployeeId: curEmp?.userId || currentUser?.id || '',
      followUpDate: '',
    });
    setLeadComments([]);
    setNewComment('');
    setProductInterests([]);
    setFamilyMembers([createEmptyFamilyMember()]);
    setPolicies([]);
    setSelectedCampaigns([]);
    setActiveLeadTab('Personal');
    setModalOpen(true);
  };

  const openEdit = async (card: any) => {
    setEditTarget(card);
    const contactId = card.contactId || card.contact?.id;

    // 1. Pre-fill all personal fields directly from the card (works for ALL leads: web/landing/firestore/backend)
    const cardFullName = (card.contact?.firstName || card.contact?.lastName)
      ? `${card.contact?.firstName || ''} ${card.contact?.lastName || ''}`.trim()
      : (card.name || card.fullName || card.clientName || '').trim();
    const cardPhone = card.contact?.phone || card.phone || card.mobile || '';
    const cardEmail = card.contact?.email || card.email || '';
    const cardDob = card.contact?.dateOfBirth ? card.contact.dateOfBirth.split('T')[0] : (card.dob ? card.dob.split('T')[0] : '');

    const initialPersonal = {
      firstName: card.contact?.firstName || cardFullName.split(' ')[0] || '',
      middleName: card.contact?.middleName || '',
      lastName: card.contact?.lastName || cardFullName.split(' ').slice(1).join(' ') || '',
      fullName: cardFullName,
      gender: card.contact?.gender || card.gender || '',
      maritalStatus: card.contact?.maritalStatus || card.maritalStatus || '',
      dateOfBirth: cardDob,
      email: cardEmail,
      aadhaarNumber: card.contact?.aadhaarNumber || card.aadhaarNumber || '',
      whatsappNumber: cardPhone,
      sameAsWhatsapp: true,
      callingNumber: cardPhone,
      education: card.contact?.education || card.education || '',
      annualIncome: card.contact?.annualIncome ? String(card.contact.annualIncome) : (card.annualIncome ? String(card.annualIncome) : ''),
      occupationType: card.contact?.occupationType || card.occupation || '',
      companyName: card.contact?.companyName || '',
      state: card.contact?.state || card.state || '',
      district: card.contact?.district || card.district || '',
      city: card.contact?.city || card.city || '',
      pincode: card.contact?.pincode || card.pincode || '',
      streetAddress: card.contact?.streetAddress || card.address || '',
      declaredMedicalHistory: card.contact?.declaredMedicalHistory || [],
      notDeclaredMedicalHistory: card.contact?.notDeclaredMedicalHistory || [],
      medicalHistoryDetails: card.contact?.medicalHistoryDetails || ''
    };

    setPersonalFields(initialPersonal);

    // Prepare default Product Interests from card
    const cardInterests = (card.interests && card.interests.length > 0)
      ? card.interests
      : (card.plan?.name ? [card.plan.name] : ['Health']);
    const cardStage = card.stage || 'TO_CONTACT';
    const cardPremium = card.premiumBudget ? String(card.premiumBudget) : (card.expectedPremium ? String(card.expectedPremium) : '');
    const cardFollowUp = card.followUpDate ? card.followUpDate.split('T')[0] : '';

    setProductInterests([
      {
        id: card.id || `lead-${Date.now()}`,
        collapsed: false,
        interestedIn: cardInterests,
        otherProduct: '',
        descriptionDetails: card.notes || '',
        leadStage: cardStage,
        leadStatus: 'ACTIVE_LEAD',
        dependencyType: 'SELF',
        dependentDetails: '',
        leadType: 'FRESH',
        leadSource: card.source || 'Social Media',
        assignedEmployeeId: card.assignedEmployeeId || '',
        followUpDate: cardFollowUp,
        expectedPremium: cardPremium,
        comments: [],
        newComment: '',
      }
    ]);

    // 2. If contactId exists and is valid backend UUID, attempt to enrich with full profile
    if (contactId && /^[0-9a-fA-F]{24}$/.test(contactId)) {
      try {
        const res = await contactsService.get(contactId);
        const contact = res?.data ?? res;
        if (contact) {
          setLoadedContact(contact);
          setEditContactId(contact.id);
          const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
          const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];
          setPersonalFields({
            firstName: contact.firstName || initialPersonal.firstName,
            middleName: contact.middleName || initialPersonal.middleName,
            lastName: contact.lastName || initialPersonal.lastName,
            fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || initialPersonal.fullName,
            gender: contact.gender || initialPersonal.gender,
            maritalStatus: contact.maritalStatus || initialPersonal.maritalStatus,
            dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.split('T')[0] : initialPersonal.dateOfBirth,
            email: contact.email || initialPersonal.email,
            aadhaarNumber: contact.aadhaarNumber || initialPersonal.aadhaarNumber,
            whatsappNumber: contact.phone || initialPersonal.whatsappNumber,
            sameAsWhatsapp: contact.phone === contact.alternatePhone,
            callingNumber: contact.alternatePhone || contact.phone || initialPersonal.callingNumber,
            education: contact.education || initialPersonal.education,
            annualIncome: contact.annualIncome ? String(contact.annualIncome) : initialPersonal.annualIncome,
            occupationType: primaryOcc?.type || initialPersonal.occupationType,
            companyName: primaryOcc?.companyName || initialPersonal.companyName,
            state: primaryAddr?.state || initialPersonal.state,
            district: primaryAddr?.district || initialPersonal.district,
            city: primaryAddr?.city || initialPersonal.city,
            pincode: primaryAddr?.pincode || initialPersonal.pincode,
            streetAddress: primaryAddr?.line1 || contact.notes || initialPersonal.streetAddress,
            declaredMedicalHistory: contact.declaredMedicalHistory || [],
            notDeclaredMedicalHistory: contact.notDeclaredMedicalHistory || [],
            medicalHistoryDetails: contact.medicalHistoryDetails || ''
          });
        }
      } catch (cErr) {
        console.warn('[Edit Lead Contact fetch notice]', cErr);
      }
    }

    setActiveLeadTab('Personal');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setEditContactId(null);
    setLoadedContact(null);
    setDuplicateContactMatched(null);
    setProductInterests([]);
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
  };

  const checkForDuplicateContact = async (phone: string, aadhaar: string) => {
    // Only search when BOTH fields are fully entered
    if (!phone || !aadhaar) return;
    try {
      const searchPhone = phone.slice(-10);
      const res = await contactsService.list({ search: searchPhone, limit: 100 });
      const list = res.data || [];
      // Require BOTH mobile/altMobile AND aadhaar to match the same contact record
      const match = list.find((c: any) => {
        const contactPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
        const cleanContactPhone = contactPhone.length > 10 ? contactPhone.slice(-10) : contactPhone;

        const contactAltPhone = c.alternatePhone ? c.alternatePhone.replace(/\D/g, '') : '';
        const cleanContactAltPhone = contactAltPhone.length > 10 ? contactAltPhone.slice(-10) : contactAltPhone;

        const matchPhone = (cleanContactPhone && cleanContactPhone === searchPhone) ||
          (cleanContactAltPhone && cleanContactAltPhone === searchPhone);

        const contactAadhaar = c.aadhaarNumber ? c.aadhaarNumber.replace(/\D/g, '') : '';
        const cleanContactAadhaar = contactAadhaar.length > 12 ? contactAadhaar.slice(-12) : contactAadhaar;
        const searchAadhaar = aadhaar.slice(-12);
        const matchAadhaar = cleanContactAadhaar && cleanContactAadhaar === searchAadhaar;

        return matchPhone && matchAadhaar;
      });

      if (match) {
        const fullRes = await contactsService.get(match.id);
        const contact = fullRes.data;

        // Load address & occupation for personal fields
        const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
        const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];

        setPersonalFields({
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          gender: contact.gender || '',
          maritalStatus: contact.maritalStatus || '',
          dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.split('T')[0] : '',
          email: contact.email || '',
          height: "",
          weight: "",
          aadhaarNumber: contact.aadhaarNumber || '',
          whatsappNumber: contact.phone || '',
          sameAsWhatsapp: contact.phone === contact.alternatePhone,
          callingNumber: contact.alternatePhone || '',
          education: contact.education || '',
          annualIncome: contact.annualIncome ? String(contact.annualIncome) : '',
          occupationType: primaryOcc?.type || '',
          companyName: primaryOcc?.companyName || '',
          state: primaryAddr?.state || '',
          district: primaryAddr?.district || '',
          city: primaryAddr?.city || '',
          pincode: primaryAddr?.pincode || '',
          streetAddress: primaryAddr?.line1 || contact.notes || '',
          declaredMedicalHistory: contact.declaredMedicalHistory || [],
          notDeclaredMedicalHistory: contact.notDeclaredMedicalHistory || [],
          medicalHistoryDetails: contact.medicalHistoryDetails || ''
        });

        const fams = (contact.relationships || []).map((r: any) => {
          const c = r.relatedContact;
          return {
            name: `${c?.firstName || ''} ${c?.lastName || ''}`.trim(),
            dob: c?.dateOfBirth ? c.dateOfBirth.split('T')[0] : '',
            relation: r.relationshipType,
            whatsapp: c?.phone || '',
            occupation: '',
            education: '',
            medicalHistory: []
          };
        });
        setFamilyMembers(fams);

        const healthEntries: any[] = [];
        const lifeEntries: any[] = [];
        (contact.policies || []).forEach((p: any) => {
          const entry = {
            company: p.plan?.company?.name || 'Other',
            planName: p.plan?.name || 'Other',
            policyNo: p.policyNumber,
            startDate: p.startDate ? p.startDate.split('T')[0] : '',
            duration: '1 Year',
            endDate: p.endDate ? p.endDate.split('T')[0] : '',
            premium: String(p.premiumAmount),
            sumInsured: String(p.sumAssured),
            deductible: '',
            sumAssured: String(p.sumAssured),
            maturityDate: p.maturityDate ? p.maturityDate.split('T')[0] : '',
            paymentTerm: '',
            entryType: p.status === 'ACTIVE' ? 'New' : 'Renewal'
          };
          if (p.plan?.category === 'HEALTH') healthEntries.push(entry);
          else lifeEntries.push(entry);
        });

        const parsedPolicies: any[] = [];
        if (healthEntries.length > 0) parsedPolicies.push({ policyType: 'Health', entries: healthEntries });
        if (lifeEntries.length > 0) parsedPolicies.push({ policyType: 'Life', entries: lifeEntries });
        setPolicies(parsedPolicies);

        // WhatsApp Campaigns — populate from contact tags
        const campaignsList = [
          'Health Awareness', 'New Year Offer', 'Pension Plan',
          'Monsoon Safety', 'Term Insurance Promo', 'Family Health Package'
        ];
        const campaigns = contact.tags?.filter((t: string) => campaignsList.includes(t)) || [];
        setSelectedCampaigns(campaigns);

        // Product Interests — map existing leads for the Product Interest tab
        const backendInterests = contact.productInterests || [];
        const mappedInterests = backendInterests.map((lead: any) => {
          const extra = parseLeadNotes(lead.notes);
          const comments = (lead.consultations || []).map((c: any) => ({
            text: c.notes || '',
            author: c.author || 'System',
            datetime: c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
          }));

          const interestsList = lead.interests || [];
          const isStandard = (p: string) => ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'].includes(p);
          const standardInterests = interestsList.filter((p: string) => isStandard(p));
          const otherInterests = interestsList.filter((p: string) => !isStandard(p));

          const interestedIn = [...standardInterests];
          let otherProduct = '';
          if (otherInterests.length > 0) {
            interestedIn.push('Other');
            otherProduct = otherInterests.join(', ');
          }

          const expectedPremium = lead.premiumBudget ? String(lead.premiumBudget) : '';
          const leadStage = lead.stage || 'TO_CONTACT';

          return {
            id: lead.id,
            collapsed: true,
            interestedIn,
            otherProduct,
            descriptionDetails: extra.descriptionDetails || '',
            leadStage,
            leadStatus: extra.leadStatus,
            dependencyType: extra.dependencyType || 'SELF',
            dependentDetails: extra.dependentDetails || '',
            leadType: extra.leadType,
            leadSource: lead.source || 'Social Media',
            assignedEmployeeId: lead.assignedEmployeeId || '',
            followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
            expectedPremium,
            comments,
            newComment: '',
          };
        });
        setProductInterests(mappedInterests);

        // All data loaded — now mark contact as matched and show banner
        setLoadedContact(contact);
        setEditContactId(contact.id);
        setDuplicateContactMatched(contact);
        toast.success("Existing Contact Found – Details Loaded.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!editTarget && !duplicateContactMatched) {
      const cleanPhone = (personalFields.whatsappNumber || '').replace(/\D/g, '');
      const cleanAltPhone = (personalFields.callingNumber || '').replace(/\D/g, '');
      const cleanAadhaar = (personalFields.aadhaarNumber || '').replace(/\D/g, '');

      const phoneToSearch = cleanPhone.length === 10 ? cleanPhone : (cleanAltPhone.length === 10 ? cleanAltPhone : '');

      if (phoneToSearch && cleanAadhaar.length === 12) {
        checkForDuplicateContact(phoneToSearch, cleanAadhaar);
      }
    }
  }, [personalFields.whatsappNumber, personalFields.callingNumber, personalFields.aadhaarNumber, editTarget, duplicateContactMatched]);

  const hasActivePolicyForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const activePolicies = (loadedContact.policies || []).filter((p: any) => p.status === 'ACTIVE' || !p.status);
    return card.interestedIn.some((prod: string) => {
      return activePolicies.some((p: any) => {
        const cat = (p.plan?.category || p.category || '').toUpperCase();
        const prodUpper = prod.toUpperCase();
        if (prodUpper === 'HEALTH' && cat === 'HEALTH') return true;
        if (prodUpper === 'LIFE' && cat === 'LIFE') return true;
        if (prodUpper === 'MOTOR' && cat === 'MOTOR') return true;
        return false;
      });
    });
  };

  const isPolicyOutsideRenewalWindowForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const activePolicies = (loadedContact.policies || []).filter((p: any) => p.status === 'ACTIVE' || !p.status);
    return card.interestedIn.some((prod: string) => {
      return activePolicies.some((p: any) => {
        const cat = (p.plan?.category || p.category || '').toUpperCase();
        const prodUpper = prod.toUpperCase();

        let match = false;
        if (prodUpper === 'HEALTH' && cat === 'HEALTH') match = true;
        if (prodUpper === 'LIFE' && cat === 'LIFE') match = true;
        if (prodUpper === 'MOTOR' && cat === 'MOTOR') match = true;

        if (match && p.endDate) {
          const expiryDate = new Date(p.endDate);
          const now = new Date();
          expiryDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > maxRenewalWindow) {
            return true;
          }
        }
        return false;
      });
    });
  };

  const hasActiveRenewalLeadForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const backendInterests = loadedContact.productInterests || [];
    return card.interestedIn.some((prod: string) => {
      return backendInterests.some((lead: any) => {
        const extra = parseLeadNotes(lead.notes);
        const leadStatus = extra.leadStatus || '';
        const stage = lead.stage || '';
        const leadType = extra.leadType || 'FRESH';

        if (leadStatus === 'LEAD_LOST' || leadStatus === 'NOT_INTERESTED' || stage === 'PROCESS_COMPLETED' || stage === 'PAYMENT_DONE') {
          return false;
        }
        if (leadType !== 'RENEWAL') return false;
        return (lead.interests || []).some((i: string) => i.toLowerCase() === prod.toLowerCase());
      });
    });
  };

  const isProductAlreadyExistsForContact = (prod: string, cardLeadType?: string): boolean => {
    if (!loadedContact) return false;
    const backendInterests = loadedContact.productInterests || [];

    const activeLead = backendInterests.find((lead: any) => {
      const extra = parseLeadNotes(lead.notes);
      const leadStatus = extra.leadStatus || '';
      const stage = lead.stage || '';

      if (leadStatus === 'LEAD_LOST' || leadStatus === 'NOT_INTERESTED' || stage === 'PROCESS_COMPLETED' || stage === 'PAYMENT_DONE') {
        return false;
      }
      return (lead.interests || []).some((i: string) => i.toLowerCase() === prod.toLowerCase());
    });

    if (activeLead) {
      const activeLeadExtra = parseLeadNotes(activeLead.notes);
      const activeLeadType = activeLeadExtra.leadType || 'FRESH';

      if (cardLeadType === 'RENEWAL') {
        if (activeLeadType === 'RENEWAL') return true;
      } else {
        return true;
      }
    }

    const hasInPolicies = (loadedContact.policies || []).some((p: any) => {
      if (p.status && p.status !== 'ACTIVE') return false;

      const cat = (p.plan?.category || p.category || '').toUpperCase();
      const prodUpper = prod.toUpperCase();

      let match = false;
      if (prodUpper === 'HEALTH' && cat === 'HEALTH') match = true;
      if (prodUpper === 'LIFE' && cat === 'LIFE') match = true;
      if (prodUpper === 'MOTOR' && cat === 'MOTOR') match = true;

      if (match) {
        if (cardLeadType !== 'RENEWAL') return true;
        if (p.endDate) {
          const expiryDate = new Date(p.endDate);
          const now = new Date();
          expiryDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > maxRenewalWindow) return true;
        }
      }
      return false;
    });
    if (hasInPolicies) return true;

    return false;
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const targetId = String(deleteTarget.id);
    const toastId = toast.loading('Deleting lead...');

    try {
      const targetPhone = String(deleteTarget.contact?.phone || deleteTarget.phone || deleteTarget.mobile || '').replace(/\D/g, '');
      const targetName = `${deleteTarget.contact?.firstName || ''} ${deleteTarget.contact?.lastName || ''}`.trim().toLowerCase();
      const rawName = String(deleteTarget.name || deleteTarget.fullName || '').trim().toLowerCase();

      // 1. Add to persistent deleted keys (Unique ID only)
      const newKeysToAdd: string[] = [targetId.toLowerCase()];
      if (targetId.startsWith('fs_')) newKeysToAdd.push(targetId.replace('fs_', '').toLowerCase());

      try {
        const stored = JSON.parse(localStorage.getItem('insumitra_deleted_lead_keys') || '[]');
        const updatedKeys = Array.from(new Set([...stored, ...newKeysToAdd]));
        localStorage.setItem('insumitra_deleted_lead_keys', JSON.stringify(updatedKeys));
        setDeletedKeys(updatedKeys);
      } catch (e) {}

      // 2. If it is a Firestore lead (id starts with 'fs_' or raw Firestore ID)
      const firestoreDocId = targetId.startsWith('fs_') ? targetId.replace('fs_', '') : targetId;
      try {
        await deleteDoc(doc(db, 'leads', firestoreDocId));
      } catch (fsErr) {
        console.warn('Firestore doc delete notice:', fsErr);
      }

      // 3. If it is a backend lead (24 hex char ID or standard ID)
      if (/^[0-9a-fA-F]{24}$/.test(targetId)) {
        try {
          await deleteLead.mutateAsync(targetId);
        } catch (apiErr: any) {
          console.warn('Backend lead delete notice:', apiErr);
        }
      }

      // 4. Remove from all possible localStorage stores
      try {
        // insumitra_local_leads
        const local = JSON.parse(localStorage.getItem('insumitra_local_leads') || '[]');
        const updatedLocal = local.filter((l: any) => {
          const lPhone = String(l.contact?.phone || l.phone || '').replace(/\D/g, '');
          const lName = `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim().toLowerCase();
          return l.id !== targetId && (!targetPhone || lPhone !== targetPhone) && (!targetName || lName !== targetName);
        });
        localStorage.setItem('insumitra_local_leads', JSON.stringify(updatedLocal));

        // rahul_kulkarni_leads
        const rahul = JSON.parse(localStorage.getItem('rahul_kulkarni_leads') || '[]');
        const updatedRahul = rahul.filter((r: any) => {
          const rPhone = String(r.phone || r.mobile || '').replace(/\D/g, '');
          const rName = String(r.name || r.fullName || '').trim().toLowerCase();
          return ('local_lead_' + (r.id || r.timestamp)) !== targetId && (!targetPhone || rPhone !== targetPhone) && (!targetName || rName !== targetName);
        });
        localStorage.setItem('rahul_kulkarni_leads', JSON.stringify(updatedRahul));

        // rahul_kulkarni_checkups
        const checkups = JSON.parse(localStorage.getItem('rahul_kulkarni_checkups') || '[]');
        const updatedCheckups = checkups.filter((c: any) => {
          const cName = String(c.name || c.fullName || '').trim().toLowerCase();
          const cPhone = String(c.phone || c.mobile || '').replace(/\D/g, '');
          return (!targetName || cName !== targetName) && (!targetPhone || cPhone !== targetPhone);
        });
        localStorage.setItem('rahul_kulkarni_checkups', JSON.stringify(updatedCheckups));

        // pending_web_lead, consultation_lead, family_first_lead
        ['pending_web_lead', 'consultation_lead', 'family_first_lead'].forEach(k => {
          const itemStr = localStorage.getItem(k);
          if (itemStr) {
            try {
              const item = JSON.parse(itemStr);
              const iName = String(item.name || item.fullName || '').trim().toLowerCase();
              const iPhone = String(item.phone || item.mobile || '').replace(/\D/g, '');
              if ((targetName && iName === targetName) || (targetPhone && iPhone === targetPhone)) {
                localStorage.removeItem(k);
              }
            } catch (e) {}
          }
        });
      } catch (lsErr) {}

      // 5. Update webLeads state immediately
      setWebLeads(prev => prev.filter(l => {
        const lId = String(l.id || '').toLowerCase();
        const lName = `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim().toLowerCase();
        const lPhone = String(l.contact?.phone || l.phone || '').replace(/\D/g, '');

        if (lId === targetId.toLowerCase() || lId === ('fs_' + targetId.toLowerCase())) return false;
        if (targetName && lName === targetName) return false;
        if (targetPhone && lPhone === targetPhone) return false;
        return true;
      }));

      // 6. Invalidate query cache
      qc.invalidateQueries({ queryKey: ['leads'] });

      toast.success('Lead deleted successfully', { id: toastId });
    } catch (err: any) {
      console.error('Failed to delete lead:', err);
      toast.error('Failed to delete lead', { id: toastId });
    } finally {
      setDeleteTarget(null);
    }
  };

  const openDetail = (card: any) => {
    setDetailTarget(card);
    setDetailTab('overview');
    setDetailOpen(true);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const activeFilterCount =
    filterPlans.length + filterStatuses.length + filterStages.length + filterTypes.length +
    (filterEmployee ? 1 : 0) + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading pipeline…</div>;

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Floating Right Action Panel */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      <div className="fixed right-2 sm:right-3.5 top-60 sm:top-64 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="Import Leads CSV"
        >
          <Upload size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            Import Leads CSV
          </span>
        </button>

        {/* New Lead */}
        <button
          type="button"
          onClick={() => openCreate('TO_CONTACT')}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="New Lead"
        >
          <UserPlus size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            New Lead
          </span>
        </button>
      </div>

      {/* Main Control Hub Card */}
      <div className="bg-white rounded-2xl border border-[#EDE5F0] p-2.5 sm:p-3 shadow-sm">
        {/* Single Line Layout */}
        <div className="flex items-center gap-2.5 w-full overflow-x-auto custom-scrollbar py-0.5">

          {/* Left Side: Search Bar */}
          <div className="relative min-w-[200px] sm:min-w-[240px] max-w-xs shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all shadow-2xs"
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Right Side: View Mode Toggle, Active/Inactive Badges, Date Range Selector & Filters */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* View Mode Toggle: Table / Kanban Board */}
            <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  viewMode === 'table'
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-100'
                    : 'text-slate-500 hover:text-slate-800'
                )}
                title="Table View (टेबल व्ह्यू)"
              >
                <List size={13} strokeWidth={2.5} />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  viewMode === 'board'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                )}
                title="Kanban Cards View (कानबान कार्ड्स व्ह्यू)"
              >
                <Columns size={13} strokeWidth={2.5} />
                <span>Kanban</span>
              </button>
            </div>

            {/* Active / Inactive Status Badges */}
            <button
              type="button"
              onClick={() => toggleFilter('Active')}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap',
                selectedFilters.includes('Active')
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('Inactive')}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap',
                selectedFilters.includes('Inactive')
                  ? 'bg-rose-600 text-white border-rose-600 shadow-rose-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Inactive
            </button>

            {/* Date Range Selector */}
            <div className="flex flex-nowrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs shrink-0">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <DatePicker
                value={filterDateFrom}
                onChange={val => { setFilterDateFrom(val); }}
                className="bg-transparent border-0 outline-none text-[11px] font-semibold text-slate-700 w-22 focus:ring-0 p-0 cursor-pointer"
                title="From Date"
              />
              <span className="text-slate-300 font-bold">-</span>
              <DatePicker
                value={filterDateTo}
                onChange={val => { setFilterDateTo(val); }}
                className="bg-transparent border-0 outline-none text-[11px] font-semibold text-slate-700 w-22 focus:ring-0 p-0 cursor-pointer"
                title="To Date"
              />
            </div>

            {/* Advanced Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all shrink-0",
                showFilters && "bg-purple-50 border-purple-200 text-purple-700"
              )}
              title="Advanced Filters"
            >
              <Filter size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="card grid grid-cols-1 sm:grid-cols-4 gap-4 bg-gradient-to-r from-slate-50 via-blue-50/20 to-slate-50 rounded-2xl border border-slate-200/70 p-4 mb-2 shadow-sm animate-fadeIn">
          <div>
            <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Agent</label>
            <select
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
              className="input text-xs font-semibold"
            >
              <option value="">All Agents</option>
              {getAssignableEmployees(employeesList).map((emp: any) => {
                const empUserId = emp.userId || emp.user?.id || emp.id;
                const empName = `${emp.firstName || emp.employeeProfile?.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.employeeProfile?.lastName || emp.user?.lastName || ''}`.trim() || emp.name || emp.email || 'Employee';
                return (
                  <option key={emp.id || empUserId} value={empUserId}>
                    {empName}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Stage</label>
            <select
              value={filterStages[0] || ''}
              onChange={e => setFilterStages(e.target.value ? [e.target.value] : [])}
              className="input text-xs font-semibold"
            >
              <option value="">All Stages</option>
              {FILTER_STAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Status</label>
            <select
              value={filterStatuses[0] || ''}
              onChange={e => setFilterStatuses(e.target.value ? [e.target.value] : [])}
              className="input text-xs font-semibold"
            >
              <option value="">All Statuses</option>
              {LEAD_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Type</label>
            <select
              value={filterTypes[0] || ''}
              onChange={e => setFilterTypes(e.target.value ? [e.target.value] : [])}
              className="input text-xs font-semibold"
            >
              <option value="">All Types</option>
              <option value="FRESH">Fresh</option>
              <option value="RENEWAL">Renewal</option>
              <option value="PORTING">Porting</option>
            </select>
          </div>
        </div>
      )}

      {/* Main View Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {viewMode === 'board' ? (
          <div className="p-3 sm:p-4 overflow-x-auto custom-scrollbar">
            <div className="flex gap-3 pb-4 min-h-[550px] items-start">
              {UI_STAGES.map(stage => {
                const cards = filteredBoard[stage] ?? [];
                const totalBudget = expectedBusiness(stage);
                const backendStage = STAGE_MAPPINGS[stage];
                return (
                  <div
                    key={stage}
                    className="flex flex-col min-w-[260px] max-w-[285px] w-[275px] shrink-0"
                    onDragEnter={e => {
                      e.preventDefault();
                      if (draggedOverStage !== stage) setDraggedOverStage(stage);
                    }}
                    onDragOver={e => {
                      e.preventDefault();
                    }}
                    onDragLeave={() => {
                      if (draggedOverStage === stage) setDraggedOverStage(null);
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      setDraggedOverStage(null);
                      const cardId = e.dataTransfer.getData('cardId');
                      if (cardId && backendStage) {
                        const draggedLead = filteredLeads.find(l => l.id === cardId);
                        if (backendStage === 'PROCESS_COMPLETED') {
                          if (draggedLead) {
                            triggerPolicyCreationForLead(draggedLead);
                            return;
                          }
                        }
                        if (draggedLead && draggedLead.stage !== backendStage) {
                          return;
                        }
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2 px-1 py-1 select-none">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={clsx('h-2.5 w-2.5 rounded-full shrink-0',
                          stage === 'To Contact' && 'bg-blue-500',
                          stage === 'Contacted' && 'bg-indigo-500',
                          stage === 'Proposal Sent' && 'bg-purple-500',
                          stage === 'Login Progress' && 'bg-orange-500',
                          stage === 'Payment Done' && 'bg-emerald-500',
                          stage === 'Process Completed' && 'bg-teal-500'
                        )} />
                        <span className="text-xs font-black text-slate-800 truncate">{stage}</span>
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0">{cards.length}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-black shrink-0">
                          ₹{totalBudget >= 100000 ? `${(totalBudget / 100000).toFixed(1)}L` : `${(totalBudget / 1000).toFixed(1)}K`}
                        </span>
                        <button
                          onClick={() => openCreate(backendStage)}
                          className="p-1 rounded-md text-slate-400 hover:text-purple-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title={`Add lead in ${stage}`}
                        >
                          <Plus size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    <div className={clsx(
                      'flex-1 min-h-[420px] rounded-2xl border p-2 space-y-2 transition-all duration-200 overflow-y-auto custom-scrollbar',
                      STAGE_COLORS[stage],
                      draggedOverStage === stage ? 'ring-2 ring-purple-500 scale-[1.01] bg-purple-50/50' : 'bg-slate-50/60'
                    )}>
                      {cards.map(card => (
                        <KanbanCard
                          key={card.id}
                          card={card}
                          employeesList={employeesList}
                          onEdit={openEdit}
                          onDelete={c => setDeleteTarget(c)}
                          onOpen={openDetail}
                          onCall={handleCall}
                          onWhatsApp={handleWhatsApp}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <LeadsTable
            data={sortedLeads}
            employeesList={employeesList}
            loading={isLoading}
            visibleColumns={visibleColumns}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={openDetail}
            onEdit={openEdit}
            onDelete={c => setDeleteTarget(c)}
            onCall={handleCall}
            onWhatsApp={handleWhatsApp}
            onCreate={() => openCreate('TO_CONTACT')}
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          editTarget
            ? "Edit Lead"
            : "Add New Lead"
        }
        subtitle={
          editTarget
            ? "Update lead profile, family details, and policies."
            : "Manage lead profile, family details, and address."
        }
        size="2xl"
        actions={
          <div className="flex gap-2.5 mr-1">
            <button
              type="button"
              className="px-4 sm:px-6 py-2 text-xs font-bold text-white rounded-xl cursor-pointer shadow-md transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)',
                boxShadow: '0 6px 16px rgba(91, 43, 168, 0.35)'
              }}
              onClick={(e) => handleLeadSubmit(e, false)}
            >
              {editTarget || editContactId ? 'Update Profile' : 'Save'}
            </button>
          </div>
        }
      >
        <form className="space-y-3">

          {/* Modal sub-navigation tabs */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mt-0 mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
            {['Personal', 'Family'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveLeadTab(tab)}
                className={clsx(
                  'px-6 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap',
                  activeLeadTab === tab
                    ? 'text-white shadow-md scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                )}
                style={activeLeadTab === tab ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
              >
                {tab}
              </button>
            ))}
          </div>

          {editContactId && !editTarget && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold mb-3 flex items-center justify-between shadow-2xs animate-fadeIn">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping shrink-0" />
                Existing Contact Found – Details Loaded.
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditContactId(null);
                  setLoadedContact(null);
                  setDuplicateContactMatched(null);
                  setPersonalFields({
                    fullName: '',
                    gender: '',
                    maritalStatus: '',
                    dateOfBirth: '',
                    email: '',
                    aadhaarNumber: '',
                    whatsappNumber: '',
                    sameAsWhatsapp: false,
                    callingNumber: '',
                    education: '',
                    annualIncome: '',
                    occupationType: '',
                    companyName: '',
                    state: '',
                    district: '',
                    city: '',
                    pincode: '',
                    streetAddress: ''
                  });
                  setFamilyMembers([]);
                  setPolicies([]);
                }}
                className="text-[10px] text-emerald-600 hover:text-emerald-800 underline uppercase tracking-wider font-extrabold cursor-pointer"
              >
                Clear / Reset
              </button>
            </div>
          )}

          {/* Tab contents */}
          <div className="h-[430px] overflow-y-auto pr-2 custom-scrollbar">
            {activeLeadTab === 'Product Interest' && (
              <div className="space-y-3 animate-fadeIn pb-2">

                {/* Cards List */}
                {productInterests.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-1">
                      <Shield size={24} className="text-blue-300" />
                    </div>
                    <p className="font-semibold text-slate-500">No product interests added yet.</p>
                    <p className="text-[11px] text-slate-400">Click "+ Add Product Interest" below to get started.</p>
                  </div>
                )}

                {productInterests.map((card, idx) => {
                  const displayName = card.interestedIn.length > 0
                    ? card.interestedIn.map(p => p === 'Other' && card.otherProduct ? card.otherProduct : p).join(', ')
                    : 'New Product Interest';

                  const PRODUCT_COLORS: Record<string, string> = {
                    Health: 'from-emerald-500 to-teal-600',
                    Life: 'from-blue-500 to-indigo-600',
                    Term: 'from-violet-500 to-purple-600',
                    'Accident Policy': 'from-orange-500 to-amber-600',
                    Motor: 'from-rose-500 to-pink-600',
                    'Mutual Funds': 'from-cyan-500 to-sky-600',
                    Porting: 'from-yellow-500 to-orange-500',
                    Other: 'from-slate-500 to-gray-600',
                  };
                  const firstProduct = card.interestedIn[0] || 'Other';
                  const headerGradient = PRODUCT_COLORS[firstProduct] || 'from-blue-500 to-indigo-600';

                  const isExisting = Boolean(card.id && !card.id.startsWith('temp-'));

                  return (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all"
                    >
                      {/* Card Header — always visible */}
                      <div
                        className={`bg-gradient-to-r ${headerGradient} px-4 py-3 flex items-center justify-between cursor-pointer select-none`}
                        onClick={() => toggleProductCollapse(card.id)}
                      >
                        <div className="flex flex-wrap items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                            <span className="text-white font-black text-[11px]">{idx + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-extrabold text-xs truncate">
                              {displayName}
                              {isExisting && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-white font-bold text-[9px] uppercase tracking-wider">
                                  Existing
                                </span>
                              )}
                            </p>
                            {card.collapsed && card.leadStage && (
                              <p className="text-white/70 text-[10px] font-semibold truncate">
                                {card.leadStage.replace(/_/g, ' ')} · {card.leadStatus.replace(/_/g, ' ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!isExisting && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); removeProductInterest(card.id); }}
                              className="p-1 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-all"
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <ChevronDown
                            size={16}
                            className={`text-white transition-transform duration-200 ${card.collapsed ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Card Body — collapse/expand */}
                      {!card.collapsed && (
                        <div className="p-4 space-y-4 bg-white">

                          {/* Interested In — toggle buttons */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Interested In</label>
                              {isExisting && (
                                <span className="text-[10px] text-slate-400 font-medium italic">
                                  Category fixed for existing records. Change status below or click "+ Add Product Interest" for a new product.
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting', 'Other'].map(prod => {
                                const isSel = card.interestedIn.includes(prod);
                                const isAlreadySelected = false;
                                const PILL_COLORS: Record<string, string> = {
                                  Health: isSel ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                                  Life: isSel ? 'bg-purple-600 border-blue-600 text-white' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                                  Term: isSel ? 'bg-violet-600 border-violet-600 text-white' : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
                                  'Accident Policy': isSel ? 'bg-orange-600 border-orange-600 text-white' : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
                                  Motor: isSel ? 'bg-rose-600 border-rose-600 text-white' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
                                  'Mutual Funds': isSel ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
                                  Porting: isSel ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100',
                                  Other: isSel ? 'bg-slate-700 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
                                };
                                let btnStyle = PILL_COLORS[prod] || (isSel ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600');
                                return (
                                  <button
                                    key={prod}
                                    type="button"
                                    disabled={isExisting}
                                    onClick={() => {
                                      const next = isSel ? [] : [prod];
                                      updateProductInterest(card.id, 'interestedIn', next);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all select-none ${btnStyle} ${isExisting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                  >
                                    {isSel ? '✓ ' : '+ '}{prod}
                                  </button>
                                );
                              })}
                            </div>
                            {hasActiveRenewalLeadForCard(card) && card.leadType === 'RENEWAL' && (
                              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                An active Renewal lead already exists for this product.
                              </div>
                            )}
                            {hasActivePolicyForCard(card) && card.leadType === 'RENEWAL' && isPolicyOutsideRenewalWindowForCard(card) && (
                              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                Renewal cannot be created yet. The policy is outside the renewal period.
                              </div>
                            )}
                            {hasActivePolicyForCard(card) && card.leadType !== 'RENEWAL' && (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                An active policy already exists for this product. Only a Renewal lead can be created.
                              </div>
                            )}
                            {card.interestedIn.includes('Other') && (
                              <div className="bg-slate-100/90 border-2 border-slate-300 rounded-xl p-3 space-y-1.5 animate-fadeIn mt-2.5">
                                <label className="label text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                                  Specify Other Product Name *
                                </label>
                                <input
                                  type="text"
                                  disabled={isExisting}
                                  className={`w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none shadow-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                  placeholder="Specify product name..."
                                  value={card.otherProduct}
                                  onChange={e => updateProductInterest(card.id, 'otherProduct', e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          {/* Description Details Box */}
                          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/70 p-4 space-y-2 shadow-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                <FileText size={13} />
                              </div>
                              <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                Description Details
                              </h4>
                            </div>
                            <textarea
                              rows={2}
                              className="w-full text-xs p-3 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-slate-800 placeholder-slate-400 font-medium outline-none resize-y transition-all shadow-2xs"
                              placeholder="Enter details for whom they are interested, specific coverage requirements, family member preferences, or notes..."
                              value={card.descriptionDetails || ''}
                              onChange={e => updateProductInterest(card.id, 'descriptionDetails', e.target.value)}
                            />
                          </div>
                          {/* Row 1: Stage, Status, Dependency, Type */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Stage <span className="text-red-500">*</span></label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadStage}
                                onChange={e => updateProductInterest(card.id, 'leadStage', e.target.value)}
                              >
                                <option value="TO_CONTACT">To Contact</option>
                                <option value="CONTACTED">Contacted</option>
                                <option value="PROPOSAL_SENT">Proposal Sent</option>
                                <option value="LOGIN_PROGRESS">Login in Progress</option>
                                <option value="PAYMENT_DONE">Payment Done</option>
                                <option value="PROCESS_COMPLETED">Process Completed</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Lead Status <span className="text-red-500">*</span>{isExisting ? ' (Editable)' : ''}
                              </label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadStatus}
                                onChange={e => updateProductInterest(card.id, 'leadStatus', e.target.value)}
                              >
                                <option value="INTERESTED">Interested</option>
                                <option value="HOT">Hot 🔥</option>
                                <option value="VERY_HOT">Very Hot 🔥🔥</option>
                                <option value="NOT_INTERESTED">Not Interested</option>
                                <option value="LEAD_LOST">Lead Lost</option>
                              </select>
                            </div>
                            {/* <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Dependency *</label>
                              <select
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.dependencyType || 'SELF'}
                                onChange={e => updateProductInterest(card.id, 'dependencyType', e.target.value)}
                              >
                                <option value="SELF">Self</option>
                                <option value="DEPENDENT">Depend</option>
                              </select>
                            </div> */}
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Type <span className="text-red-500">*</span></label>
                              <select
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.leadType}
                                onChange={e => updateProductInterest(card.id, 'leadType', e.target.value)}
                              >
                                <option value="FRESH">Fresh</option>
                                <option value="RENEWAL">Renewal</option>
                                <option value="PORTING">Porting</option>
                              </select>
                            </div>
                          </div>

                          {/* Members Included Multi-Select Box */}


                          {/* Row 2: Source, Assigned Employee, Follow-up Date, Expected Premium */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Source <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                disabled={isExisting}
                                list={`lead-source-list-${card.id}`}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                placeholder="e.g. Social Media"
                                value={card.leadSource}
                                onChange={e => updateProductInterest(card.id, 'leadSource', e.target.value)}
                              />
                              <datalist id={`lead-source-list-${card.id}`}>
                                <option value="Social Media" />
                                <option value="Our Customer Self" />
                                <option value="Referred by Customer" />
                                <option value="Walk-in" />
                                <option value="BNI" />
                              </datalist>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Employee</label>
                              <select
                                className="input w-full text-xs bg-white"
                                value={card.assignedEmployeeId}
                                onChange={e => updateProductInterest(card.id, 'assignedEmployeeId', e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {getAssignableEmployees(employeesList, editTarget || personalFields).map((emp: any) => {
                                  const empUserId = emp.userId || emp.user?.id || emp.id;
                                  const empName = `${emp.firstName || emp.employeeProfile?.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.employeeProfile?.lastName || emp.user?.lastName || ''}`.trim() || emp.name || emp.email || 'Employee';
                                  return (
                                    <option key={emp.id || empUserId} value={empUserId}>
                                      {empName}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Follow-up Date <span className="text-red-500">*</span></label>
                              <DatePicker
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.followUpDate}
                                onChange={val => updateProductInterest(card.id, 'followUpDate', val)}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expected Premium / Budget (₹) <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                placeholder="e.g. 12000"
                                min={0}
                                value={card.expectedPremium}
                                onChange={e => updateProductInterest(card.id, 'expectedPremium', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Consultation Comments Section */}
                          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/70 p-4 space-y-3 shadow-xs">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                  <MessageCircle size={13} />
                                </div>
                                <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                  Consultation Comments
                                </h4>
                              </div>
                              {card.comments.length > 0 && (
                                <span className="text-[10px] font-extrabold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-full">
                                  {card.comments.length} {card.comments.length === 1 ? 'Comment' : 'Comments'}
                                </span>
                              )}
                            </div>

                            {/* Timeline List */}
                            <div className="max-h-56 overflow-y-auto space-y-2.5 custom-scrollbar pr-0.5">
                              {card.comments.length === 0 ? (
                                <div className="bg-white/60 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                                  <p className="text-xs text-slate-400 font-medium italic">No comments yet. Add the first summary below.</p>
                                </div>
                              ) : (
                                (card.showAllComments ? card.comments : card.comments.slice(0, 2)).map((cmt, ci) => (
                                  <div key={ci} className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all space-y-1.5 relative overflow-hidden group">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                        {cmt.author}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-semibold flex flex-wrap items-center gap-1">
                                        {cmt.datetime}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap pl-0.5">
                                      {cmt.text}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Know More / Show Less Toggle Button */}
                            {card.comments.length > 2 && (
                              <div className="pt-0.5 flex justify-start">
                                <button
                                  type="button"
                                  onClick={() => updateProductInterest(card.id, 'showAllComments', !card.showAllComments)}
                                  className="inline-flex flex-wrap items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-all"
                                >
                                  {card.showAllComments ? (
                                    <>
                                      Show Less <ChevronUp size={13} />
                                    </>
                                  ) : (
                                    <>
                                      Know More ({card.comments.length - 2} more history) <ChevronDown size={13} />
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Add Call Summary & Consultation Comment Box */}
                            <div className="bg-white rounded-xl border-2 border-blue-200/90 p-3 space-y-2 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all mt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
                                  <MessageCircle size={12} className="text-blue-600" />
                                  Add Call Summary / Comment
                                </label>
                                <span className="text-[9px] text-slate-400 font-semibold italic">Press Ctrl+Enter to save</span>
                              </div>
                              <textarea
                                rows={2}
                                className="w-full text-xs p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:bg-white focus:border-blue-400 outline-none resize-y transition-all"
                                placeholder="Type call summary, client discussion details, or follow-up notes..."
                                value={card.newComment}
                                onChange={e => updateProductInterest(card.id, 'newComment', e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    addProductComment(card.id);
                                  }
                                }}
                              />
                              <div className="flex justify-end pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => addProductComment(card.id)}
                                  disabled={!card.newComment.trim()}
                                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex flex-wrap items-center gap-1.5"
                                >
                                  <Send size={12} />
                                  Save Call Summary
                                </button>
                              </div>
                            </div>


                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Product Interest Button */}
                {(() => {
                  const standardProds = ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'];
                  const allProductsAdded = false;

                  return (
                    <>
                      {allProductsAdded && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-xl text-xs font-bold mb-3 shadow-2xs animate-fadeIn">
                          All available products have already been added for this contact.
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={allProductsAdded}
                        onClick={addProductInterest}
                        className={clsx(
                          "w-full mt-1 py-3 rounded-2xl border-2 border-dashed text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer group",
                          allProductsAdded
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                            : "border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-600 hover:text-blue-700"
                        )}
                      >
                        <Plus size={15} className="group-hover:scale-110 transition-transform" />
                        + Add Product Interest
                      </button>
                    </>
                  );
                })()}

              </div>
            )}
            {activeLeadTab === 'Personal' && (
              <fieldset disabled={!!editContactId} className="w-full">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center justify-between shadow-2xs">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
                  {/* 1. Personal Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                        Personal Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Basic Demographics</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          First Name <span className="text-red-500 font-black">*</span>
                        </label>
                        <input
                          type="text"
                          className={clsx(
                            "input w-full rounded-xl transition-all",
                            formErrors.firstName ? "border-rose-500 ring-1 ring-rose-500 bg-rose-50/20" : "focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500"
                          )}
                          placeholder="e.g. Rahul"
                          value={personalFields.firstName}
                          onChange={e => {
                            setPersonalFields(p => ({ ...p, firstName: e.target.value }));
                            if (formErrors.firstName) setFormErrors(prev => ({ ...prev, firstName: '' }));
                          }}
                        />
                        {formErrors.firstName && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.firstName}</p>
                        )}
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Middle Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Kumar"
                          value={personalFields.middleName}
                          onChange={e => setPersonalFields(p => ({ ...p, middleName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Last Name <span className="text-red-500 font-black">*</span>
                        </label>
                        <input
                          type="text"
                          className={clsx(
                            "input w-full rounded-xl transition-all",
                            formErrors.lastName ? "border-rose-500 ring-1 ring-rose-500 bg-rose-50/20" : "focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500"
                          )}
                          placeholder="e.g. Sharma"
                          value={personalFields.lastName}
                          onChange={e => {
                            setPersonalFields(p => ({ ...p, lastName: e.target.value }));
                            if (formErrors.lastName) setFormErrors(prev => ({ ...prev, lastName: '' }));
                          }}
                        />
                        {formErrors.lastName && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.lastName}</p>
                        )}
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Mother's Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Sunita Sharma"
                          value={personalFields.motherName || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, motherName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Gender</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={['MALE', 'FEMALE', ''].includes(personalFields.gender) ? personalFields.gender : 'OTHER'}
                          onChange={e => setPersonalFields(p => ({ ...p, gender: e.target.value }))}
                        >
                          <option value="">Select Gender</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Marital Status</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.maritalStatus}
                          onChange={e => setPersonalFields(p => ({ ...p, maritalStatus: e.target.value }))}
                        >
                          <option value="">Select Status</option>
                          <option value="SINGLE">Single</option>
                          <option value="MARRIED">Married</option>
                          <option value="DIVORCED">Divorced</option>
                          <option value="WIDOWED">Widowed</option>
                        </select>
                      </div>
                      {personalFields.maritalStatus === 'MARRIED' && (
                        <div className="animate-fadeIn">
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Wedding Anniversary Date</label>
                          <DatePicker
                            className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                            value={personalFields.weddingAnniversaryDate || ''}
                            onDateChange={(val) => setPersonalFields(p => ({ ...p, weddingAnniversaryDate: val }))}
                          />
                        </div>
                      )}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth</label>
                        <DatePicker
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.dateOfBirth}
                          onDateChange={handleDOBChange}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Age</label>
                        <input
                          type="text"
                          className="input w-full bg-slate-50 font-semibold text-slate-600 cursor-not-allowed rounded-xl"
                          value={personalFields.age}
                          disabled
                          placeholder="Auto-calculated"
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Height (cm)</label>
                        <input
                          type="number"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. 170"
                          value={personalFields.height}
                          onChange={(e) => setPersonalFields((p) => ({ ...p, height: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. 65"
                          value={personalFields.weight}
                          onChange={(e) => setPersonalFields((p) => ({ ...p, weight: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PAN Number</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                          placeholder="ABCDE1234F"
                          maxLength={10}
                          value={personalFields.panNumber || personalFields.pan || ''}
                          onChange={(e) =>
                            setPersonalFields((p) => ({
                              ...p,
                              panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                              pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Contact Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                        Contact Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Communication Info</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                        <input
                          type="email"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="client@example.com"
                          value={personalFields.email}
                          onChange={e => setPersonalFields(p => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Aadhaar Number</label>
                        <input
                          type="text"
                          className={clsx(
                            "input w-full rounded-xl transition-all",
                            formErrors.aadhaarNumber ? "border-rose-500 ring-1 ring-rose-500 bg-rose-50/20" : "focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500"
                          )}
                          placeholder="12-digit Aadhaar No"
                          maxLength={12}
                          value={personalFields.aadhaarNumber}
                          onChange={e => {
                            setPersonalFields(p => ({ ...p, aadhaarNumber: e.target.value.replace(/\D/g, '') }));
                            if (formErrors.aadhaarNumber) setFormErrors(prev => ({ ...prev, aadhaarNumber: '' }));
                          }}
                        />
                        {formErrors.aadhaarNumber && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.aadhaarNumber}</p>
                        )}
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Whatsapp Number <span className="text-red-500 font-black">*</span>
                        </label>
                        <CountryPhoneInput
                          value={personalFields.whatsappNumber}
                          onChange={(value: string) => {
                            setPersonalFields((p) => ({
                              ...p,
                              whatsappNumber: value,
                              callingNumber: p.sameAsWhatsapp ? value : p.callingNumber,
                            }));
                            if (formErrors.whatsappNumber) setFormErrors(prev => ({ ...prev, whatsappNumber: '' }));
                          }}
                        />
                        {formErrors.whatsappNumber && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.whatsappNumber}</p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Calling Number</label>
                          <label className="flex flex-wrap items-center gap-1 text-[10px] text-blue-600 font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="accent-blue-600 w-3 h-3 rounded"
                              checked={personalFields.sameAsWhatsapp}
                              onChange={e => {
                                const checked = e.target.checked;
                                setPersonalFields(p => ({
                                  ...p,
                                  sameAsWhatsapp: checked,
                                  callingNumber: checked ? p.whatsappNumber : p.callingNumber
                                }));
                              }}
                            />
                            Same as Whatsapp
                          </label>
                        </div>
                        <CountryPhoneInput
                          disabled={personalFields.sameAsWhatsapp}
                          value={personalFields.callingNumber}
                          onChange={(value: string) =>
                            setPersonalFields((p) => ({
                              ...p,
                              callingNumber: value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Education & Occupation */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                        Education &amp; Occupation
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Professional Profile</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Education</label>
                        <DatalistInput
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="Select or enter Education"
                          value={personalFields.education || ''}
                          options={EDUCATION_OPTIONS}
                          onChange={val => setPersonalFields(p => ({ ...p, education: val }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Annual Income</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.annualIncome}
                          onChange={e => setPersonalFields(p => ({ ...p, annualIncome: e.target.value }))}
                        >
                          <option value="">Select Income Bracket</option>
                          <option value="200000">Below 2 Lakhs</option>
                          <option value="500000">2 - 5 Lakhs</option>
                          <option value="1000000">5 - 10 Lakhs</option>
                          <option value="2000000">10 - 20 Lakhs</option>
                          <option value="5000000">20+ Lakhs</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Occupation Type</label>
                        <DatalistInput
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="Select or enter Occupation Type"
                          value={personalFields.occupationType || ''}
                          options={OCCUPATION_TYPE_OPTIONS}
                          onChange={val => setPersonalFields(p => ({ ...p, occupationType: val }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Company / Business Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Infosys / Traders"
                          value={personalFields.companyName}
                          onChange={e => setPersonalFields(p => ({ ...p, companyName: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Address Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                        Address Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Location &amp; Residence</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">State</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.state}
                          onChange={e => setPersonalFields(p => ({ ...p, state: e.target.value }))}
                        >
                          <option value="">Select State</option>
                          <option value="Maharashtra">Maharashtra</option>
                          <option value="Delhi">Delhi</option>
                          <option value="Karnataka">Karnataka</option>
                          <option value="Gujarat">Gujarat</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">District</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.district}
                          onChange={e => setPersonalFields(p => ({ ...p, district: e.target.value }))}
                        >
                          <option value="">Select District</option>
                          <option value="Pune">Pune</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Bangalore">Bangalore</option>
                          <option value="Ahmedabad">Ahmedabad</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">City / Town</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Pune"
                          value={personalFields.city}
                          onChange={e => setPersonalFields(p => ({ ...p, city: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Pincode</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="000000"
                          value={personalFields.pincode}
                          onChange={e => setPersonalFields(p => ({ ...p, pincode: e.target.value }))}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Street Address / House No</label>
                        <textarea
                          className="input w-full text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          rows={2}
                          placeholder="Flat No, Street, Landmark..."
                          value={personalFields.streetAddress}
                          onChange={e => setPersonalFields(p => ({ ...p, streetAddress: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Bank Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                        Bank Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Banking Information</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Bank Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. HDFC Bank"
                          value={personalFields.bankName || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Account Number</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. 50100012345678"
                          value={personalFields.bankAccountNumber || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankAccountNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">IFSC Code</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                          placeholder="e.g. HDFC0001234"
                          value={personalFields.bankIfsc || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Branch Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-purple-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Shivajinagar Branch"
                          value={personalFields.bankBranch || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankBranch: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>
            )}


            {activeLeadTab === 'Family' && (
              <div className="h-full flex flex-col gap-0">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center justify-between shadow-2xs flex-shrink-0">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">Family Members &amp; Dependents</h3>
                    <p className="text-[11px] text-slate-400 font-semibold">Fill family details directly below</p>
                  </div>
                  {!editContactId && (
                    <button
                      type="button"
                      onClick={() => setFamilyMembers(prev => [...(prev.length === 0 ? [createEmptyFamilyMember()] : prev), createEmptyFamilyMember()])}
                      className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-xs"
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                {/* Members */}
                <fieldset disabled={!!editContactId} className="flex-1 overflow-y-auto pr-0.5 min-h-0">
                  <div className="space-y-3">
                    {(familyMembers.length === 0 ? [createEmptyFamilyMember()] : familyMembers).map((member, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                          {/* Card header */}
                          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Member #{idx + 1}</span>
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setFamilyMembers(prev => prev.filter((_, i) => i !== idx))}
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors cursor-pointer text-xs font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Row 1: First Name | Middle Name | Last Name */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Name <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                className="input w-full mt-1"
                                placeholder="First name"
                                value={member.firstName || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, firstName: e.target.value } : m))}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Middle Name</label>
                              <input
                                type="text"
                                className="input w-full mt-1"
                                placeholder="Middle name"
                                value={member.middleName || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, middleName: e.target.value } : m))}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Name <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                className="input w-full mt-1"
                                placeholder="Last name"
                                value={member.lastName || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, lastName: e.target.value } : m))}
                              />
                            </div>
                          </div>

                          {/* Row 2: DOB | Relation */}
                          {/* Row 2: DOB | Relation | Occupation */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">DOB</label>
                              <DatePicker
                                className="input w-full mt-1"
                                value={member.dob}
                                onChange={val => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, dob: val } : m))}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Relation</label>
                              <select
                                className="input w-full mt-1"
                                value={['SPOUSE', 'SON', 'DAUGHTER', 'FATHER', 'MOTHER', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Child', ''].includes(member.relation) ? member.relation : 'OTHER'}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, relation: e.target.value } : m))}
                              >
                                <option value="">Select</option>
                                <option value="SPOUSE">Spouse</option>
                                <option value="SON">Son</option>
                                <option value="DAUGHTER">Daughter</option>
                                <option value="FATHER">Father</option>
                                <option value="MOTHER">Mother</option>
                                <option value="OTHER">Other</option>
                              </select>
                              {(member.relation === 'OTHER' || member.relation === 'Other' || (member.relation && !['SPOUSE', 'SON', 'DAUGHTER', 'FATHER', 'MOTHER', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Child', ''].includes(member.relation))) && (
                                <div className="mt-1.5 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs"
                                    placeholder="Specify Relation..."
                                    value={['OTHER', 'Other'].includes(member.relation) ? '' : member.relation}
                                    onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, relation: e.target.value || 'OTHER' } : m))}
                                  />
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Occupation</label>
                              <select
                                className="input w-full mt-1"
                                value={['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'STUDENT', 'HOMEMAKER', 'RETIRED', 'Salaried', 'Self Employed', 'Business', 'Student', 'Homemaker', 'Retired', ''].includes(member.occupation) ? member.occupation : 'OTHER'}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, occupation: e.target.value } : m))}
                              >
                                <option value="">Select Type</option>
                                <option value="SALARIED">Salaried</option>
                                <option value="SELF_EMPLOYED">Self Employed</option>
                                <option value="BUSINESS">Business</option>
                                <option value="STUDENT">Student</option>
                                <option value="HOMEMAKER">Homemaker</option>
                                <option value="RETIRED">Retired</option>
                                <option value="OTHER">Other</option>
                              </select>
                              {(member.occupation === 'OTHER' || member.occupation === 'Other' || (member.occupation && !['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'STUDENT', 'HOMEMAKER', 'RETIRED', 'Salaried', 'Self Employed', 'Business', 'Student', 'Homemaker', 'Retired', ''].includes(member.occupation))) && (
                                <div className="mt-1.5 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs"
                                    placeholder="Specify Occupation..."
                                    value={['OTHER', 'Other'].includes(member.occupation) ? '' : member.occupation}
                                    onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, occupation: e.target.value || 'OTHER' } : m))}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Row 3: Whatsapp | Calling Number | Education */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Whatsapp</label>
                              <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all mt-1">
                                <span className="bg-slate-50 px-2.5 py-1.5 text-xs border-r border-slate-200 text-slate-500 font-bold">+91</span>
                                <input
                                  type="tel"
                                  className="px-3 py-1.5 text-xs w-full outline-none bg-transparent"
                                  placeholder="Number"
                                  maxLength={10}
                                  value={member.whatsapp}
                                  onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, whatsapp: e.target.value.replace(/\D/g, '') } : m))}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Calling Number</label>
                              <div className="mt-1">
                                <CountryPhoneInput
                                  value={member.callingNumber || ''}
                                  onChange={(value: string) => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, callingNumber: value } : m))}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Education</label>
                              <select
                                className="input w-full mt-1"
                                value={['HighSchool', 'Graduate', 'PostGraduate', 'Professional', 'Below 10th', '10th Pass', '12th Pass', ''].includes(member.education) ? member.education : 'OTHER'}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, education: e.target.value } : m))}
                              >
                                <option value="">Select Type</option>
                                <option value="HighSchool">High School</option>
                                <option value="Graduate">Graduate</option>
                                <option value="PostGraduate">Post Graduate</option>
                                <option value="Professional">Professional</option>
                                <option value="OTHER">Other</option>
                              </select>
                              {(member.education === 'OTHER' || member.education === 'Other' || (member.education && !['HighSchool', 'Graduate', 'PostGraduate', 'Professional', 'Below 10th', '10th Pass', '12th Pass', ''].includes(member.education))) && (
                                <div className="mt-1.5 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs"
                                    placeholder="Specify Education..."
                                    value={['OTHER', 'Other'].includes(member.education) ? '' : member.education}
                                    onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, education: e.target.value || 'OTHER' } : m))}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Row 4: Medical History */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3 pb-3">
                            {/* Generic Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Medical History (Select if applicable)</label>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map((condition) => {
                                  const isOthers = condition === 'Others';
                                  const current = member.medicalHistory || [];
                                  const isSelected = isOthers
                                    ? current.some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                    : current.includes(condition);
                                  return (
                                    <label key={condition} className="flex flex-wrap items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="accent-blue-600 w-3.5 h-3.5"
                                        checked={isSelected}
                                        onChange={() => {
                                          setFamilyMembers(prev => prev.map((m, i) => {
                                            if (i !== idx) return m;
                                            const list: string[] = m.medicalHistory || [];
                                            if (isOthers) {
                                              if (isSelected) {
                                                return {
                                                  ...m,
                                                  medicalHistory: list.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                                };
                                              } else {
                                                return {
                                                  ...m,
                                                  medicalHistory: [...list, '']
                                                };
                                              }
                                            } else {
                                              return {
                                                ...m,
                                                medicalHistory: isSelected
                                                  ? list.filter((c: string) => c !== condition)
                                                  : [...list, condition]
                                              };
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs text-slate-600 font-medium">{condition}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {(member.medicalHistory || []).some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) && (
                                <div className="mt-2 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1 px-2.5"
                                    placeholder="Type medical conditions..."
                                    value={(member.medicalHistory || []).find((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setFamilyMembers(prev => prev.map((m, i) => {
                                        if (i !== idx) return m;
                                        const current: string[] = m.medicalHistory || [];
                                        const baseVal = current.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c));
                                        return {
                                          ...m,
                                          medicalHistory: [...baseVal, val]
                                        };
                                      }));
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Declared Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Declared Medical History</label>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map((condition) => {
                                  const isOthers = condition === 'Others';
                                  const current = member.declaredMedicalHistory || [];
                                  const isSelected = isOthers
                                    ? current.some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                    : current.includes(condition);
                                  return (
                                    <label key={condition} className="flex flex-wrap items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="accent-blue-600 w-3.5 h-3.5"
                                        checked={isSelected}
                                        onChange={() => {
                                          setFamilyMembers(prev => prev.map((m, i) => {
                                            if (i !== idx) return m;
                                            const list: string[] = m.declaredMedicalHistory || [];
                                            if (isOthers) {
                                              if (isSelected) {
                                                return {
                                                  ...m,
                                                  declaredMedicalHistory: list.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                                };
                                              } else {
                                                return {
                                                  ...m,
                                                  declaredMedicalHistory: [...list, '']
                                                };
                                              }
                                            } else {
                                              return {
                                                ...m,
                                                declaredMedicalHistory: isSelected
                                                  ? list.filter((c: string) => c !== condition)
                                                  : [...list, condition]
                                              };
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs text-slate-600 font-medium">{condition}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {(member.declaredMedicalHistory || []).some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) && (
                                <div className="mt-2 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1 px-2.5"
                                    placeholder="Type medical conditions..."
                                    value={(member.declaredMedicalHistory || []).find((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setFamilyMembers(prev => prev.map((m, i) => {
                                        if (i !== idx) return m;
                                        const current: string[] = m.declaredMedicalHistory || [];
                                        const baseVal = current.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c));
                                        return {
                                          ...m,
                                          declaredMedicalHistory: [...baseVal, val]
                                        };
                                      }));
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* NOT Declared Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">NOT Declared Medical History</label>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map((condition) => {
                                  const isOthers = condition === 'Others';
                                  const current = member.notDeclaredMedicalHistory || [];
                                  const isSelected = isOthers
                                    ? current.some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                    : current.includes(condition);
                                  return (
                                    <label key={condition} className="flex flex-wrap items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="accent-orange-500 w-3.5 h-3.5"
                                        checked={isSelected}
                                        onChange={() => {
                                          setFamilyMembers(prev => prev.map((m, i) => {
                                            if (i !== idx) return m;
                                            const list: string[] = m.notDeclaredMedicalHistory || [];
                                            if (isOthers) {
                                              if (isSelected) {
                                                return {
                                                  ...m,
                                                  notDeclaredMedicalHistory: list.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                                };
                                              } else {
                                                return {
                                                  ...m,
                                                  notDeclaredMedicalHistory: [...list, '']
                                                };
                                              }
                                            } else {
                                              return {
                                                ...m,
                                                notDeclaredMedicalHistory: isSelected
                                                  ? list.filter((c: string) => c !== condition)
                                                  : [...list, condition]
                                              };
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs text-slate-600 font-medium">{condition}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {(member.notDeclaredMedicalHistory || []).some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) && (
                                <div className="mt-2 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1 px-2.5"
                                    placeholder="Type medical conditions..."
                                    value={(member.notDeclaredMedicalHistory || []).find((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setFamilyMembers(prev => prev.map((m, i) => {
                                        if (i !== idx) return m;
                                        const current: string[] = m.notDeclaredMedicalHistory || [];
                                        const baseVal = current.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c));
                                        return {
                                          ...m,
                                          notDeclaredMedicalHistory: [...baseVal, val]
                                        };
                                      }));
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Details of Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Details of Medical History</label>
                              <textarea
                                className="input w-full resize-none"
                                rows={2}
                                placeholder="Add any additional medical history details..."
                                value={member.medicalHistoryDetails || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, medicalHistoryDetails: e.target.value } : m))}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                    {!editContactId && (
                      <button
                        type="button"
                        onClick={() => setFamilyMembers(prev => [...(prev.length === 0 ? [createEmptyFamilyMember()] : prev), createEmptyFamilyMember()])}
                        className="w-full py-3 border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50 text-purple-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                      >
                        + Add Another Family Member
                      </button>
                    )}
                  </div>
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'Policy' && (
              <div className="h-full flex flex-col gap-3">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold flex-shrink-0 shadow-2xs">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div className="flex items-center justify-between flex-shrink-0">
                  <h3 className="text-base font-bold text-gray-800 text-sm">Policy Portfolio</h3>
                  {!editContactId && (
                    <button
                      type="button"
                      onClick={() => setPolicies(prev => [...prev, { policyType: 'Health', entries: [{ company: '', planName: '', policyNo: '', startDate: '', duration: '1 Year', endDate: '', premium: '', sumInsured: '', deductible: '', sumAssured: '', maturityDate: '', paymentTerm: '', entryType: 'New' }] }])}
                      className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      + Add Policy Type Card
                    </button>
                  )}
                </div>

                <fieldset disabled={!!editContactId} className="flex-1 overflow-y-auto pr-0.5 min-h-0">
                  <div className="space-y-4">
                    {policies.length === 0 ? (
                      <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50" style={{ minHeight: '120px' }}>
                        <p className="text-xs text-gray-400 font-medium">No policies found for this contact.</p>
                      </div>
                    ) : (
                      policies.map((pGroup, gIdx) => (
                        <div key={gIdx} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-gray-100">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-600">Type:</span>
                              <select
                                value={pGroup.policyType}
                                onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, policyType: e.target.value } : pg))}
                                className="bg-transparent border-none text-xs font-extrabold text-blue-600 focus:ring-0 cursor-pointer p-0"
                              >
                                <option value="Health">Health</option>
                                <option value="Life">Life</option>
                              </select>
                            </div>
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setPolicies(prev => prev.filter((_, gi) => gi !== gIdx))}
                                className="text-xs text-red-500 hover:text-red-700 font-bold"
                              >
                                Remove Card
                              </button>
                            )}
                          </div>

                          <div className="p-3 space-y-3">
                            {pGroup.entries.map((entry: any, eIdx: number) => (
                              <div key={eIdx} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400">Entry #{eIdx + 1}</span>
                                  {pGroup.entries.length > 1 && !editContactId && (
                                    <button
                                      type="button"
                                      onClick={() => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.filter((_: any, ei: number) => ei !== eIdx) } : pg))}
                                      className="text-[10px] text-red-500 hover:underline"
                                    >
                                      Remove Entry
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="label text-[10px]">Company</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Company name"
                                      value={entry.company}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, company: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Plan Name</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Plan name"
                                      value={entry.planName}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, planName: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Policy Number</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Policy No"
                                      value={entry.policyNo}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, policyNo: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Start Date</label>
                                    <DatePicker
                                      className="input w-full mt-1 text-xs"
                                      value={entry.startDate}
                                      onChange={val => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, startDate: val } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">End Date</label>
                                    <DatePicker
                                      className="input w-full mt-1 text-xs"
                                      value={entry.endDate}
                                      onChange={val => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, endDate: val } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">{pGroup.policyType === 'Health' ? 'Premium (₹)' : 'Premium (₹)'}</label>
                                    <input
                                      type="number"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Premium"
                                      value={entry.premium}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, premium: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">{pGroup.policyType === 'Health' ? 'Sum Insured (₹)' : 'Sum Assured (₹)'}</label>
                                    <input
                                      type="number"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Amount"
                                      value={pGroup.policyType === 'Health' ? entry.sumInsured : entry.sumAssured}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, [pGroup.policyType === 'Health' ? 'sumInsured' : 'sumAssured']: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: [...pg.entries, { company: '', planName: '', policyNo: '', startDate: '', duration: '1 Year', endDate: '', premium: '', sumInsured: '', deductible: '', sumAssured: '', maturityDate: '', paymentTerm: '', entryType: 'New' }] } : pg))}
                                className="w-full py-2 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-700 bg-white"
                              >
                                + Add Entry
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'WA Campaign' && (
              <div className="space-y-4">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 shadow-2xs">
                    <span>Contact campaigns are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-gray-800">Select Campaigns</h3>
                  <p className="text-[11px] text-gray-500 mt-1">Choose which WhatsApp campaigns this lead should be part of:</p>
                </div>
                <fieldset disabled={!!editContactId} className="space-y-2 mt-3">
                  {[
                    'Health Awareness',
                    'New Year Offer',
                    'Pension Plan',
                    'Monsoon Safety',
                    'Term Insurance Promo',
                    'Family Health Package'
                  ].map((campaign) => (
                    <label
                      key={campaign}
                      className="flex flex-wrap items-center gap-3 p-3 bg-gray-50/50 border border-gray-150 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedCampaigns.includes(campaign)}
                        onChange={() => {
                          setSelectedCampaigns(prev =>
                            prev.includes(campaign) ? prev.filter(c => c !== campaign) : [...prev, campaign]
                          );
                        }}
                      />
                      <span className="text-xs font-semibold text-gray-700">{campaign}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'History' && (
              <div className="space-y-4">
                {/* Tab Header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <History size={13} />
                    </div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Contact & Family History Log
                    </h3>
                  </div>
                  <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full">
                    {familyMembers.length} Family {familyMembers.length === 1 ? 'Member' : 'Members'}
                  </span>
                </div>

                <div className="max-h-[420px] overflow-y-auto pr-1 custom-scrollbar space-y-4">
                  {/* 1. Personal Details Log Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <UserCircle2 size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Personal Information Log
                        </h4>
                      </div>
                      <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md">
                        Active Contact
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Name</span>
                        <p className="font-bold text-slate-800">
                          {(personalFields.firstName || personalFields.middleName || personalFields.lastName) ? `${personalFields.firstName} ${personalFields.middleName} ${personalFields.lastName}`.trim() : (loadedContact ? `${loadedContact.firstName || ''} ${loadedContact.middleName || ''} ${loadedContact.lastName || ''}`.trim() : 'Not provided')}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Mobile & Email</span>
                        <p className="font-semibold text-slate-700">
                          {watch('phone') || (loadedContact?.phone) || 'No phone'}
                          {(watch('email') || loadedContact?.email) ? ` · ${watch('email') || loadedContact?.email}` : ''}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Date of Birth & Gender</span>
                        <p className="font-semibold text-slate-700">
                          {(watch as any)('dob') || loadedContact?.dob || 'DOB not set'}
                          {(watch('gender') || loadedContact?.gender) ? ` · ${watch('gender') || loadedContact?.gender}` : ''}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Occupation & Marital Status</span>
                        <p className="font-semibold text-slate-700">
                          {(watch as any)('occupation') || loadedContact?.occupation || 'Not specified'}
                          {((watch as any)('maritalStatus') || loadedContact?.maritalStatus) ? ` · ${watch('maritalStatus' as any) || loadedContact?.maritalStatus}` : ''}
                        </p>
                      </div>
                    </div>

                    {((watch as any)('address') || loadedContact?.address) && (
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 text-xs space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Address Details</span>
                        <p className="text-slate-700 font-medium">{(watch as any)('address') || loadedContact?.address}</p>
                      </div>
                    )}
                  </div>

                  {/* 2. Family Members Created & Linked Log Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Users size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Family Members Created ({familyMembers.length})
                        </h4>
                      </div>
                      {familyMembers.length > 0 && (
                        <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                          {familyMembers.length} {familyMembers.length === 1 ? 'Member Created' : 'Members Created'}
                        </span>
                      )}
                    </div>

                    {familyMembers.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-xs text-slate-400 font-medium italic">No family members created for this contact yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {familyMembers.map((member, idx) => (
                          <div key={idx} className="bg-slate-50/80 rounded-xl border border-slate-200/70 p-3 space-y-2 text-xs hover:border-blue-200 transition-all">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-extrabold text-slate-800 text-xs">
                                  {member.name || `Family Member #${idx + 1}`}
                                </span>
                              </div>
                              {member.relation && (
                                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                                  {member.relation}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Date of Birth / Phone</span>
                                <p className="font-semibold text-slate-700">
                                  {member.dob || 'DOB not set'} {member.whatsapp ? ` · ${member.whatsapp}` : ''}
                                </p>
                              </div>
                              <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Occupation & Education</span>
                                <p className="font-semibold text-slate-700">
                                  {member.occupation || 'Not set'} {member.education ? ` · ${member.education}` : ''}
                                </p>
                              </div>
                            </div>

                            {member.medicalHistory && member.medicalHistory.length > 0 && (
                              <div className="pt-1">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block mb-1">Medical History Tags</span>
                                <div className="flex flex-wrap gap-1">
                                  {member.medicalHistory.map((tag: any, ti: number) => (
                                    <span key={ti} className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Particular Contact Audit Log Card */}
                  {loadedContact && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Calendar size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Contact Record Audit Log
                        </h4>
                      </div>
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        {loadedContact.createdAt && (
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-500 font-medium">Record Created Date</span>
                            <span className="font-bold text-slate-700">
                              {new Date(loadedContact.createdAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {loadedContact.updatedAt && (
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-500 font-medium">Last Modified Date</span>
                            <span className="font-bold text-slate-700">
                              {new Date(loadedContact.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Lead" size="sm">
        <div className="space-y-4 py-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Confirm Deletion</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Are you sure you want to delete the lead for <strong className="text-slate-800">{deleteTarget?.contact?.firstName} {deleteTarget?.contact?.lastName}</strong>?
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button className="btn-secondary text-xs px-4 py-2 font-bold cursor-pointer" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="btn-danger text-xs px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer" onClick={executeDelete}>
              Delete Lead
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Popup */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailTarget(null); }}
        title={detailTarget ? `${detailTarget.contact?.firstName ?? ''} ${detailTarget.contact?.lastName ?? ''}` : 'Lead Details'}
        size="xl"
      >
        {detailTarget && (
          <LeadDetailPopup
            lead={detailTarget}
            tab={detailTab}
            onTabChange={setDetailTab}
            employees={employeesList}
            isOwner={isOwner}
            onEdit={() => { setDetailOpen(false); openEdit(detailTarget); }}
            onTriggerPolicyCreation={triggerPolicyCreationForLead}
          />
        )}
      </Modal>

      {/* Issue Policy on Move to Process Completed Modal */}
      <Modal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        title="Add New Policy"
        subtitle="Pre-fill details from lead to create a new policy."
        size="xl"
      >
        <form onSubmit={handleSubmitPolicy(handlePolicyFormSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Customer (Read-only display) */}
            <div className="col-span-2 flex flex-col gap-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-extrabold">Customer Details</label>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  {policyLead?.contact?.firstName?.[0] || 'C'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {policyLead?.contact?.firstName} {policyLead?.contact?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 font-medium font-medium">
                    {policyLead?.contact?.email || 'No email'} · {policyLead?.contact?.phone || 'No phone'}
                  </p>
                </div>
              </div>
            </div>

            {/* Policy Number */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Number *</label>
              <input
                type="text"
                {...registerPolicy('policyNumber', { required: true })}
                placeholder="Enter policy number..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Policy Type (Select category) */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Type *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedType}
                onChange={e => {
                  setPolicySelectedType(e.target.value);
                  setPolicySelectedCompany('');
                  setPolicySelectedPlanId('');
                }}
                required
              >
                <option value="">Select Type</option>
                {availableTypes.map(t => (
                  <option key={t} value={t}>{t === 'HEALTH' ? 'Health Insurance' : t === 'LIFE' ? 'Life Insurance' : t}</option>
                ))}
              </select>
            </div>

            {/* Insurance Company */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Company *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedCompany}
                onChange={e => {
                  setPolicySelectedCompany(e.target.value);
                  setPolicySelectedPlanId('');
                }}
                disabled={!policySelectedType}
                required
              >
                <option value="">Select Company</option>
                {availableCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Insurance Plan */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Plan *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedPlanId}
                onChange={e => setPolicySelectedPlanId(e.target.value)}
                disabled={!policySelectedCompany}
                required
              >
                <option value="">Select Plan</option>
                {availablePlans.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Sum Assured */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Sum Assured *</label>
              <input
                type="number"
                step="any"
                {...registerPolicy('sumAssured', { required: true })}
                placeholder="Enter sum assured..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Premium Amount */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Premium Amount *</label>
              <input
                type="number"
                step="any"
                {...registerPolicy('premiumAmount', { required: true })}
                placeholder="Enter premium amount..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Start Date *</label>
              <DatePicker
                {...registerPolicy('startDate', { required: true })}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">End Date *</label>
              <DatePicker
                {...registerPolicy('endDate', { required: true })}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Payment Frequency */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="label">Payment Frequency *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                {...registerPolicy('paymentFrequency', { required: true })}
                required
              >
                <option value="YEARLY">Yearly</option>
                <option value="HALF_YEARLY">Half Yearly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="SINGLE">Single</option>
              </select>
            </div>

          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-all"
              onClick={() => setPolicyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
            >
              Issue Policy & Complete Lead
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Standard Agency Advisors & Staff ──────────────────────────────────────────
export const DEFAULT_AGENCY_STAFF = [
  { id: 'emp_asmita_yadav', userId: 'emp_asmita_yadav', firstName: 'Asmita', lastName: 'Yadav', designation: 'Senior Insurance Advisor', role: 'EMPLOYEE', email: 'asmita.yadav@insumitra.com' },
  { id: 'emp_rahul_kulkarni', userId: 'emp_rahul_kulkarni', firstName: 'Rahul', lastName: 'Kulkarni', designation: 'Financial Advisor', role: 'EMPLOYEE', email: 'rahul.kulkarni@insumitra.com' },
  { id: 'emp_pooja_sharma', userId: 'emp_pooja_sharma', firstName: 'Pooja', lastName: 'Sharma', designation: 'Relationship Manager', role: 'EMPLOYEE', email: 'pooja.sharma@insumitra.com' },
  { id: 'emp_amit_verma', userId: 'emp_amit_verma', firstName: 'Amit', lastName: 'Verma', designation: 'Health & Life Specialist', role: 'EMPLOYEE', email: 'amit.verma@insumitra.com' },
  { id: 'emp_sneha_patil', userId: 'emp_sneha_patil', firstName: 'Sneha', lastName: 'Patil', designation: 'Policy Consultant', role: 'EMPLOYEE', email: 'sneha.patil@insumitra.com' },
  { id: 'emp_rohan_deshmukh', userId: 'emp_rohan_deshmukh', firstName: 'Rohan', lastName: 'Deshmukh', designation: 'Claims & Advisory Expert', role: 'EMPLOYEE', email: 'rohan.deshmukh@insumitra.com' },
];

// ── Helper to filter assignable employees (excludes clients, customers, Super Admin / Owner) ──
export function getAssignableEmployees(empList: any[] = [], currentLeadOrContact?: any): any[] {
  const rawList = Array.isArray(empList) ? empList : [];
  // Merge backend employees with default agency staff (backend takes precedence)
  const mergedPool: any[] = [...rawList];
  DEFAULT_AGENCY_STAFF.forEach(def => {
    const exists = mergedPool.some(e => {
      const eFn = (e.firstName || e.user?.firstName || e.employeeProfile?.firstName || '').toLowerCase().trim();
      const eLn = (e.lastName || e.user?.lastName || e.employeeProfile?.lastName || '').toLowerCase().trim();
      return (eFn === def.firstName.toLowerCase() && eLn === def.lastName.toLowerCase()) || (e.email && e.email.toLowerCase() === def.email.toLowerCase());
    });
    if (!exists) {
      mergedPool.push(def);
    }
  });

  const leadFirst = String(currentLeadOrContact?.contact?.firstName || currentLeadOrContact?.firstName || '').toLowerCase().trim();
  const leadLast = String(currentLeadOrContact?.contact?.lastName || currentLeadOrContact?.lastName || '').toLowerCase().trim();
  const rawLeadFull = (
    currentLeadOrContact?.contact?.fullName ||
    currentLeadOrContact?.fullName ||
    `${leadFirst} ${leadLast}`.trim() ||
    currentLeadOrContact?.name ||
    ''
  ).toLowerCase().trim();

  // Normalize sound/consonants for matching names with slight spelling differences (e.g. bhosle vs bhosale)
  const norm = (s: string) => s.replace(/[^a-z0-9]/g, '').replace(/[aeiou]/g, '');
  const leadFirstNorm = norm(leadFirst);
  const leadLastNorm = norm(leadLast);

  const leadPhone = String(
    currentLeadOrContact?.contact?.phone ||
    currentLeadOrContact?.phone ||
    currentLeadOrContact?.mobile ||
    ''
  ).replace(/\D/g, '').slice(-10);

  const leadEmail = String(
    currentLeadOrContact?.contact?.email ||
    currentLeadOrContact?.email ||
    ''
  ).toLowerCase().trim();

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  return mergedPool.filter((emp: any) => {
    if (!emp) return false;

    const id = String(emp.userId || emp.user?.id || emp.id || emp._id || '');
    if (id && seenIds.has(id)) return false;

    const role = String(emp.role || emp.user?.role || '').toUpperCase();
    const designation = String(emp.designation || '').toLowerCase();
    const fn = (emp.firstName || emp.user?.firstName || emp.employeeProfile?.firstName || '').trim();
    const ln = (emp.lastName || emp.user?.lastName || emp.employeeProfile?.lastName || '').trim();
    const empName = `${fn} ${ln}`.trim().toLowerCase();
    const fnLow = fn.toLowerCase();
    const lnLow = ln.toLowerCase();
    const email = String(emp.email || emp.user?.email || '').toLowerCase().trim();
    const phone = String(emp.phone || emp.mobile || emp.user?.phone || '').replace(/\D/g, '').slice(-10);

    if (empName && seenNames.has(empName)) return false;

    // 1. Exclude Super Admin / Owner / System Admins (the assigners)
    if (
      role === 'SUPER_ADMIN' ||
      role === 'OWNER' ||
      role === 'ADMIN' ||
      empName.includes('super admin') ||
      empName.includes('superadmin') ||
      empName === 'owner' ||
      empName === 'administrator' ||
      designation.includes('super admin') ||
      designation.includes('owner') ||
      email.includes('superadmin') ||
      email.startsWith('admin@')
    ) {
      return false;
    }

    // 2. Exclude Clients / Customers / Non-Staff
    if (
      role === 'CLIENT' ||
      role === 'CUSTOMER' ||
      role === 'LEAD' ||
      emp.isClient ||
      emp.type === 'CLIENT' ||
      emp.type === 'CUSTOMER' ||
      designation.includes('client') ||
      designation.includes('customer')
    ) {
      return false;
    }

    // 3. Exclude the current Lead / Client themselves (match first name, last name, normalized name, phone, or email)
    if (leadFirst && (fnLow === leadFirst || fnLow.includes(leadFirst) || leadFirst.includes(fnLow))) {
      return false;
    }
    if (leadFirstNorm && fnLow && norm(fnLow) === leadFirstNorm) {
      return false;
    }
    if (leadLast && (lnLow === leadLast || (leadLastNorm && norm(lnLow) === leadLastNorm))) {
      return false;
    }
    if (rawLeadFull && empName && (empName === rawLeadFull || empName.includes(rawLeadFull) || rawLeadFull.includes(empName))) {
      return false;
    }
    if (leadPhone && phone && leadPhone === phone) {
      return false;
    }
    if (leadEmail && email && leadEmail === email) {
      return false;
    }

    if (id) seenIds.add(id);
    if (empName) seenNames.add(empName);
    return true;
  });
}

// ── Helper to resolve assignee display name ─────────────────────────────────────
function getAssigneeDisplayName(item: any, empList?: any[]) {
  if (!item) return 'Unassigned';

  const clientName = (
    item.contact?.fullName ||
    `${item.contact?.firstName || ''} ${item.contact?.lastName || ''}`.trim() ||
    item.name ||
    item.fullName ||
    ''
  ).toLowerCase().trim();

  const isInvalidAssigneeName = (name?: string) => {
    if (!name) return true;
    const n = name.trim().toLowerCase();
    if (!n || n === 'unassigned' || n === 'super admin' || n === 'superadmin' || n === 'owner' || n === 'administrator') return true;
    if (clientName && (n === clientName || n.includes(clientName) || clientName.includes(n))) return true;
    return false;
  };

  // 1. Direct name properties
  if (item.assignedToName && !isInvalidAssigneeName(item.assignedToName)) {
    return String(item.assignedToName).trim();
  }
  if (item.assignedEmployeeName && !isInvalidAssigneeName(item.assignedEmployeeName)) {
    return String(item.assignedEmployeeName).trim();
  }
  if (item.assignedEmployee?.name && !isInvalidAssigneeName(item.assignedEmployee.name)) {
    return String(item.assignedEmployee.name).trim();
  }
  if (item.assignedEmployee?.employeeProfile) {
    const ep = item.assignedEmployee.employeeProfile;
    const fn = ep.firstName || '';
    const ln = ep.lastName || '';
    const full = `${fn} ${ln}`.trim();
    if (full && !isInvalidAssigneeName(full)) return full;
  }
  if (item.assignedEmployee?.firstName || item.assignedEmployee?.lastName) {
    const full = `${item.assignedEmployee.firstName || ''} ${item.assignedEmployee.lastName || ''}`.trim();
    if (full && !isInvalidAssigneeName(full)) return full;
  }

  // 2. Lookup by ID in empList
  const empId = item.assignedEmployeeId || item.assignedEmployee?.id || item.assignedEmployee?.userId || item.assignedTo;
  if (empId && empList && empList.length > 0) {
    const found = empList.find((e: any) =>
      String(e.id) === String(empId) ||
      String(e.userId) === String(empId) ||
      String(e.user?.id) === String(empId) ||
      String(e._id) === String(empId) ||
      (e.email && e.email.toLowerCase() === String(empId).toLowerCase())
    );
    if (found) {
      const p = found.employeeProfile || found;
      const fn = p.firstName || found.firstName || found.user?.firstName || '';
      const ln = p.lastName || found.lastName || found.user?.lastName || '';
      const name = `${fn} ${ln}`.trim() || found.name || '';
      if (name && !isInvalidAssigneeName(name)) return name;
    }
  }

  // 3. Fallback to parsing notes JSON
  try {
    if (item.notes && typeof item.notes === 'string') {
      const parsed = JSON.parse(item.notes);
      if (parsed.assignedEmployeeName && !isInvalidAssigneeName(parsed.assignedEmployeeName)) {
        return parsed.assignedEmployeeName;
      }
      if (parsed.assignedToName && !isInvalidAssigneeName(parsed.assignedToName)) {
        return parsed.assignedToName;
      }
      if (parsed.assignedEmployeeId && empList) {
        const found = empList.find((e: any) =>
          String(e.id) === String(parsed.assignedEmployeeId) ||
          String(e.userId) === String(parsed.assignedEmployeeId) ||
          String(e.user?.id) === String(parsed.assignedEmployeeId)
        );
        if (found) {
          const fn = found.firstName || found.user?.firstName || '';
          const ln = found.lastName || found.user?.lastName || '';
          const name = `${fn} ${ln}`.trim();
          if (name && !isInvalidAssigneeName(name)) return name;
        }
      }
    }
  } catch {}

  return 'Unassigned';
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ card, employeesList, onEdit, onDelete, onOpen, onCall, onWhatsApp }: {
  card: any;
  employeesList?: any[];
  onEdit: (c: any) => void;
  onDelete: (c: any) => void;
  onOpen: (c: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (phone?: string) => void;
}) {
  const formattedDate = card.createdAt ? format(new Date(card.createdAt), 'dd/MMM/yyyy') : '';
  const followUp = card.followUpDate ? format(new Date(card.followUpDate), 'dd/MMM/yyyy') : null;
  const assigneeName = getAssigneeDisplayName(card, employeesList);
  const hotness = deriveHotness(card);
  const hotnessConf = HOTNESS_CONFIG[hotness];

  const clientFullName = (card.contact?.firstName || card.contact?.lastName)
    ? `${card.contact?.firstName || ''} ${card.contact?.lastName || ''}`.trim()
    : (card.name || card.fullName || card.clientName || 'Lead').trim();

  const phoneNum = card.contact?.phone || card.phone || card.mobile || '';
  const productName = card.plan?.name || (card.interests && card.interests.length > 0 ? card.interests.join(', ') : 'Mutual Funds');
  const premiumVal = Number(card.premiumBudget || card.expectedPremium || 0);

  const rawId = String(card.id || '');
  const cleanDigits = rawId.replace(/\D/g, '');
  const leadIdCode = card.leadNumber
    ? `L${card.leadNumber}`
    : cleanDigits.length >= 2
      ? `L${cleanDigits.slice(-2)}`
      : `L${rawId.slice(-2) || '1'}`;

  const BORDER_STAGE: Record<string, string> = {
    TO_CONTACT: 'border-slate-200 hover:border-blue-400',
    CONTACTED: 'border-slate-200 hover:border-indigo-400',
    PROPOSAL_SENT: 'border-slate-200 hover:border-purple-400',
    LOGIN_PROGRESS: 'border-slate-200 hover:border-orange-400',
    PAYMENT_DONE: 'border-slate-200 hover:border-emerald-400',
    PROCESS_COMPLETED: 'border-slate-200 hover:border-teal-400',
  };

  const STAGE_TOP_ACCENT: Record<string, string> = {
    TO_CONTACT: 'border-t-2 border-t-blue-500',
    CONTACTED: 'border-t-2 border-t-indigo-500',
    PROPOSAL_SENT: 'border-t-2 border-t-purple-500',
    LOGIN_PROGRESS: 'border-t-2 border-t-orange-500',
    PAYMENT_DONE: 'border-t-2 border-t-emerald-500',
    PROCESS_COMPLETED: 'border-t-2 border-t-teal-500',
  };

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('cardId', card.id)}
      onClick={() => onOpen(card)}
      className={clsx(
        'bg-white rounded-xl p-2.5 sm:p-3 border shadow-2xs hover:shadow-md transition-all duration-150 flex flex-col gap-1.5 group relative cursor-grab active:cursor-grabbing select-none',
        BORDER_STAGE[card.stage] ?? 'border-slate-200',
        STAGE_TOP_ACCENT[card.stage] ?? 'border-t-2 border-t-blue-500'
      )}
    >
      {/* Line 1: Lead ID Badge + Client Name + (Hover Actions & Hotness Badge) */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
            {leadIdCode}
          </span>
          <h4 className="text-xs font-black text-slate-800 truncate" title={clientFullName}>
            {clientFullName}
          </h4>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Action icons visible on hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(card)} className="p-0.5 rounded text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
              <Pencil size={11} />
            </button>
            <button onClick={() => onDelete(card)} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition-colors" title="Delete">
              <Trash2 size={11} />
            </button>
          </div>

          {/* Hotness Badge */}
          <span className={clsx('flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0', hotnessConf.cls)}>
            <HotnessIcon level={hotness} /> {hotnessConf.label}
          </span>
        </div>
      </div>

      {/* Line 2: Created Date (Left) + Client Phone Number (Right) */}
      <div className="flex items-center justify-between gap-1 text-[10px] font-semibold leading-none">
        <span className="text-slate-400">Created {formattedDate}</span>
        {phoneNum && (
          <span className="text-slate-700 font-bold flex items-center gap-1 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded-md">
            <Phone size={9} className="text-purple-600" />
            {phoneNum}
          </span>
        )}
      </div>

      {/* Line 3: Product Category (Left) + Expected Premium (Right) */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 pt-0.5">
        <div className="flex items-center gap-1.5 min-w-0 max-w-[58%] text-xs font-bold text-slate-700">
          <span className="w-1.5 h-1.5 rounded-full border border-slate-400 shrink-0" />
          <span className="truncate text-[11px] font-semibold text-slate-700" title={productName}>
            {productName}
          </span>
        </div>

        <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg shrink-0">
          ₹{premiumVal > 0 ? premiumVal.toLocaleString('en-IN') : '0'}
        </span>
      </div>

      {/* Line 4: Assignee (Left) + Follow-up Date & Call/WhatsApp (Right) */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-0.5 gap-1.5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-[10px] text-slate-600 font-bold truncate max-w-[48%]" title={`Assigned to: ${assigneeName}`}>
          <UserCircle2 size={12} className="text-purple-600 shrink-0" />
          <span className="truncate">{assigneeName}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {followUp ? (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50/80 border border-amber-200/70 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Calendar size={10} className="text-amber-600 shrink-0" />
              {followUp}
            </span>
          ) : (
            <span className="text-[10px] text-slate-300 font-medium">—</span>
          )}

          <button onClick={() => onCall(phoneNum)} className="p-1 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer" title="Call">
            <Phone size={10} />
          </button>
          <button onClick={() => onWhatsApp(phoneNum)} className="p-1 rounded bg-green-50 border border-green-200 hover:bg-green-100 text-green-600 cursor-pointer" title="WhatsApp">
            <MessageCircle size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table Component ───────────────────────────────────────────────────────────
function LeadsTable({ data, employeesList, loading, visibleColumns, sortKey, sortDir, onSort, onRowClick, onEdit, onDelete, onCall, onWhatsApp, onCreate }: {
  data: any[];
  employeesList?: any[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  onRowClick: (r: any) => void;
  onEdit: (r: any) => void;
  onDelete: (r: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (phone?: string) => void;
  onCreate?: () => void;
}) {
  const sortableKeys = ['name', 'plan', 'premiumBudget', 'followUpDate', 'stage'];

  const colDefs = [
    {
      key: 'name', label: 'Client Name',
      render: (r: any) => (
        <div>
          <p className="font-semibold text-gray-900 text-[13px]">{r.contact?.firstName} {r.contact?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.contact?.phone}</p>
        </div>
      ),
    },
    {
      key: 'plan', label: 'Product',
      render: (r: any) => {
        const prodName = r.plan?.name || (r.interests && r.interests.length > 0 ? r.interests.join(', ') : '—');
        const prodCat = r.plan?.category || '';
        return (
          <div>
            <p className="text-[13px] font-medium text-gray-800">{prodName}</p>
            {prodCat && <p className="text-[11px] text-gray-400">{prodCat}</p>}
          </div>
        );
      },
    },
    {
      key: 'hotness', label: 'Hotness',
      render: (r: any) => {
        const h = deriveHotness(r);
        const conf = HOTNESS_CONFIG[h];
        return (
          <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold w-fit', conf.cls)}>
            <HotnessIcon level={h} /> {conf.label}
          </span>
        );
      },
    },
    {
      key: 'employee', label: 'Assigned To',
      render: (r: any) => {
        const name = getAssigneeDisplayName(r, employeesList);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
              {name !== 'Unassigned' && name !== '—' ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '—'}
            </div>
            <span className="text-[12px] font-medium text-gray-700">{name}</span>
          </div>
        );
      },
    },
    {
      key: 'premiumBudget', label: 'Exp. Premium',
      render: (r: any) => r.premiumBudget
        ? <span className="font-semibold text-slate-800">₹{Number(r.premiumBudget).toLocaleString('en-IN')}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'followUpDate', label: 'Next Follow-up',
      render: (r: any) => r.followUpDate ? (
        <div className={clsx('flex items-center gap-1 text-[11px] font-semibold',
          new Date(r.followUpDate) < new Date() ? 'text-red-600' : 'text-amber-700')}>
          <Calendar size={11} />
          {format(new Date(r.followUpDate), 'dd/MMM/yyyy')}
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'stage', label: 'Stage',
      render: (r: any) => (
        <span className={clsx('inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold border uppercase tracking-wider', BADGE_STYLES[r.stage])}>
          {STAGE_LABELS[r.stage]}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r: any) => (
        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
          <button
            title="Call Lead"
            className="p-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-blue-500/20 hover:shadow-md hover:scale-105 transition-all"
            onClick={() => onCall(r.contact?.phone)}
          >
            <Phone size={12} />
          </button>
          <button
            title="Share on WhatsApp"
            className="p-1.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-green-500/20 hover:shadow-md hover:scale-105 transition-all"
            onClick={() => onWhatsApp(r.contact?.phone)}
          >
            <MessageCircle size={12} />
          </button>
          <button
            title="Edit Lead"
            className="p-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-purple-500/20 hover:shadow-md hover:scale-105 transition-all"
            onClick={() => onEdit(r)}
          >
            <Pencil size={12} />
          </button>
          <button
            title="Delete Lead"
            className="p-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-rose-500/20 hover:shadow-md hover:scale-105 transition-all"
            onClick={() => onDelete(r)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  const activeCols = colDefs.filter(c => visibleColumns[c.key] !== false);

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm flex-1">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100/60 border-b border-slate-200/80">
              {activeCols.map(col => (
                <th key={col.key}
                  onClick={() => sortableKeys.includes(col.key) && onSort(col.key)}
                  className={clsx('px-3.5 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap select-none border border-slate-200',
                    sortableKeys.includes(col.key) && 'cursor-pointer hover:text-slate-900')}>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {col.label}
                    {sortableKeys.includes(col.key) && (
                      <span className="text-slate-400">
                        {sortKey === col.key
                          ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                          : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {activeCols.map(col => (
                    <td key={col.key} className="px-3.5 py-2.5 border border-slate-200">
                      <div className="h-3.5 rounded-full animate-pulse bg-gray-100" style={{ width: `${55 + (i * 13 + col.label.length * 7) % 35}%` }} />
                    </td>
                  ))}
                </tr>
              ))
              : data.length === 0
                ? (
                  <tr>
                    <td colSpan={activeCols.length} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center border border-slate-100">
                          <Shield size={20} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-medium">No leads found</p>
                        <button onClick={() => onCreate?.()} className="btn-primary py-1 px-3 text-xs mt-1">
                          Create Lead
                        </button>
                      </div>
                    </td>
                  </tr>
                )
                : data.map((row, idx) => (
                  <tr key={row.id} onClick={() => onRowClick(row)}
                    className={clsx("cursor-pointer transition-colors duration-150", idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white')}>
                    {activeCols.map(col => (
                      <td key={col.key} className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Lead Detail Popup ─────────────────────────────────────────────────────────
function LeadDetailPopup({ lead, tab, onTabChange, employees, isOwner, onEdit, onTriggerPolicyCreation }: {
  lead: any;
  tab: 'overview' | 'comments' | 'stage';
  onTabChange: (t: 'overview' | 'comments' | 'stage') => void;
  employees: any[];
  isOwner: boolean;
  onEdit: () => void;
  onTriggerPolicyCreation?: (lead: any) => void;
}) {
  const qc = useQueryClient();
  const moveStage = useMoveLeadStage();
  const [commentText, setCommentText] = useState('');
  const [followUpEdit, setFollowUpEdit] = useState(lead.followUpDate ? lead.followUpDate.slice(0, 10) : '');
  const [assigneeEdit, setAssigneeEdit] = useState(lead.assignedEmployeeId ?? '');
  const [savingFollowup, setSavingFollowup] = useState(false);

  const { data: fullLeadData, refetch } = useQuery({
    queryKey: ['lead-detail-popup', lead.id],
    queryFn: () => leadsService.get(lead.id),
    staleTime: 0,
  });
  const fullLead = fullLeadData?.data ?? lead;
  const contactId = fullLead?.contact?.id || lead?.contact?.id || lead?.contactId;
  const { data: contactData } = useQuery({
    queryKey: ['contact-lead-popup', contactId],
    queryFn: () => contactsService.get(contactId!),
    enabled: !!contactId,
  });
  const consultations: any[] = fullLead.consultations ?? [];

  const initialNotes = parseLeadNotes(fullLead.notes);
  const [editStage, setEditStage] = useState(fullLead.stage || 'TO_CONTACT');
  const [editStatus, setEditStatus] = useState(initialNotes.leadStatus || fullLead.status || 'Interested');
  const [editType, setEditType] = useState(initialNotes.leadType || fullLead.type || 'Fresh');
  const [editSource, setEditSource] = useState(fullLead.source || 'Walk-in');
  const [editAssignee, setEditAssignee] = useState(fullLead.assignedEmployeeId ?? '');
  const [editFollowUp, setEditFollowUp] = useState(fullLead.followUpDate ? fullLead.followUpDate.slice(0, 10) : '');
  const [editPremium, setEditPremium] = useState<string | number>(fullLead.premiumBudget || fullLead.expectedPremium || '');
  const [savingLeadDetails, setSavingLeadDetails] = useState(false);

  useEffect(() => {
    if (fullLead) {
      const parsed = parseLeadNotes(fullLead.notes);
      setEditStage(fullLead.stage || 'TO_CONTACT');
      setEditStatus(parsed.leadStatus || fullLead.status || 'Interested');
      setEditType(parsed.leadType || fullLead.type || 'Fresh');
      setEditSource(fullLead.source || 'Walk-in');
      setEditAssignee(fullLead.assignedEmployeeId ?? '');
      setEditFollowUp(fullLead.followUpDate ? fullLead.followUpDate.slice(0, 10) : '');
      setEditPremium(fullLead.premiumBudget || fullLead.expectedPremium || '');
    }
  }, [fullLead]);

  const handleUpdateLeadDetails = async (overrides?: Record<string, any>) => {
    setSavingLeadDetails(true);
    const targetId = String(lead?.id || fullLead?.id || '');
    const fsId = targetId.startsWith('fs_') ? targetId.replace('fs_', '') : targetId;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(targetId);

    try {
      const currentNotes = fullLead?.notes || lead?.notes || '';
      const currentParsed = parseLeadNotes(currentNotes);
      const updatedStatus = overrides?.status ?? editStatus;
      const updatedType = overrides?.type ?? editType;
      const updatedStage = overrides?.stage ?? editStage;
      const updatedSource = overrides?.source ?? editSource;
      const rawFollowUp = overrides?.followUp !== undefined ? overrides.followUp : editFollowUp;
      const rawPremium = overrides?.premium !== undefined ? overrides.premium : editPremium;
      const assignedEmp = overrides?.assignee !== undefined ? overrides.assignee : editAssignee;

      // Safe date formatting
      let validFollowUpIso: string | undefined = undefined;
      let validFollowUpStr: string = '';
      if (rawFollowUp) {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawFollowUp)) {
          const [d, m, y] = rawFollowUp.split('/');
          validFollowUpStr = `${y}-${m}-${d}`;
          validFollowUpIso = new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
        } else {
          validFollowUpStr = String(rawFollowUp).slice(0, 10);
          const dt = new Date(rawFollowUp);
          if (!isNaN(dt.getTime())) validFollowUpIso = dt.toISOString();
        }
      }

      const newParsedNotes = {
        ...currentParsed,
        leadStatus: updatedStatus,
        leadType: updatedType,
        leadSource: updatedSource,
        descriptionDetails: currentParsed.descriptionDetails || '',
      };
      const notesJsonStr = JSON.stringify(newParsedNotes);

      // A. Update Backend API if valid MongoDB lead
      if (isMongoId) {
        try {
          const payload: any = {
            stage: updatedStage,
            source: updatedSource,
            notes: notesJsonStr,
          };
          if (validFollowUpIso) payload.followUpDate = validFollowUpIso;
          const premNum = Number(rawPremium);
          if (!isNaN(premNum) && premNum > 0) payload.premiumBudget = premNum;
          if (assignedEmp && /^[0-9a-fA-F]{24}$/.test(assignedEmp)) {
            payload.assignedEmployeeId = assignedEmp;
          }

          await leadsService.update(targetId, payload);
          if (assignedEmp && /^[0-9a-fA-F]{24}$/.test(assignedEmp)) {
            try { await leadsService.updateAssignee(targetId, assignedEmp); } catch {}
          }
        } catch (apiErr) {
          console.warn('[Backend Lead Update Warning]:', apiErr);
        }
      }

      // Find assignee display name from employees list
      const availableList = getAssignableEmployees(employees, fullLead || lead);
      const foundEmp = availableList.find((e: any) => e.id === assignedEmp || e.userId === assignedEmp || e.user?.id === assignedEmp) ||
        employees.find((e: any) => e.id === assignedEmp || e.userId === assignedEmp || e.user?.id === assignedEmp);
      const assignedToName = foundEmp
        ? `${foundEmp.firstName || foundEmp.user?.firstName || foundEmp.employeeProfile?.firstName || ''} ${foundEmp.lastName || foundEmp.user?.lastName || foundEmp.employeeProfile?.lastName || ''}`.trim() || foundEmp.name || foundEmp.email
        : '';

      // B. Update Firestore if applicable
      if (targetId.startsWith('fs_') || fsId) {
        try {
          const collectionsToTry = ['leads', 'consultation_bookings', 'contacts', 'web_leads'];
          for (const collName of collectionsToTry) {
            try {
              const docRef = doc(db, collName, fsId);
              await updateDoc(docRef, {
                stage: updatedStage,
                status: updatedStatus,
                leadType: updatedType,
                source: updatedSource,
                assignedEmployeeId: assignedEmp || '',
                assignedTo: assignedEmp || '',
                assignedToName: assignedToName || '',
                assignedEmployee: assignedToName ? { name: assignedToName, id: assignedEmp } : null,
                followUpDate: validFollowUpStr || validFollowUpIso || '',
                premiumBudget: rawPremium || '',
                expectedPremium: rawPremium || '',
                notes: notesJsonStr,
                updatedAt: new Date().toISOString(),
              });
              break;
            } catch {}
          }
        } catch (fsErr) {
          console.warn('[Firestore Update Warning]:', fsErr);
        }
      }

      // C. Update LocalStorage leads
      try {
        const local = JSON.parse(localStorage.getItem('insumitra_local_leads') || '[]');
        const updatedLocal = local.map((l: any) => {
          if (l.id === targetId || l.id === ('fs_' + targetId) || l.id === fsId) {
            return {
              ...l,
              stage: updatedStage,
              status: updatedStatus,
              type: updatedType,
              source: updatedSource,
              assignedEmployeeId: assignedEmp,
              assignedTo: assignedEmp,
              assignedToName: assignedToName,
              assignedEmployee: assignedToName ? { name: assignedToName, id: assignedEmp } : undefined,
              followUpDate: validFollowUpStr,
              premiumBudget: rawPremium,
              expectedPremium: rawPremium,
              notes: notesJsonStr,
            };
          }
          return l;
        });
        localStorage.setItem('insumitra_local_leads', JSON.stringify(updatedLocal));

        // rahul_kulkarni_leads & checkups
        ['rahul_kulkarni_leads', 'rahul_kulkarni_checkups'].forEach(storageKey => {
          try {
            const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const updated = list.map((item: any) => {
              if (item.id === targetId || item.id === fsId || ('local_lead_' + item.id) === targetId) {
                return {
                  ...item,
                  stage: updatedStage,
                  status: updatedStatus,
                  assignedEmployeeId: assignedEmp,
                  assignedTo: assignedEmp,
                  assignedToName: assignedToName,
                  assignedEmployee: assignedToName ? { name: assignedToName, id: assignedEmp } : undefined,
                  followUpDate: validFollowUpStr,
                  amount: rawPremium || item.amount,
                  notes: notesJsonStr,
                };
              }
              return item;
            });
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch {}
        });

        // Dispatch storage event / BroadcastChannel notification
        try {
          window.dispatchEvent(new Event('storage'));
        } catch {}
      } catch (lsErr) {}

      // Invalidate queries & refetch
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-detail-popup', targetId] });
      try { refetch(); } catch {}

      toast.success('Lead details saved successfully!');
    } catch (err: any) {
      console.error('Lead update error:', err);
      toast.success('Lead details updated');
    } finally {
      setSavingLeadDetails(false);
    }
  };

  const addConsultationMutation = useMutation({
    mutationFn: (notes: string) => leadsService.addConsultation(lead.id, { notes }),
    onSuccess: () => {
      setCommentText('');
      refetch();
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const updateAssigneeMutation = useMutation({
    mutationFn: (empId: string | null) => leadsService.updateAssignee(lead.id, empId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Assignee updated');
    },
    onError: () => toast.error('Failed to update assignee'),
  });

  const handleStageChange = async (newStage: string) => {
    if (newStage === 'PROCESS_COMPLETED') {
      if (onTriggerPolicyCreation) {
        onTriggerPolicyCreation(fullLead || lead);
        return;
      }
    }
    await moveStage.mutateAsync({ id: lead.id, stage: newStage });
    toast.success('Stage updated');
    qc.invalidateQueries();
  };

  const handleFollowUpSave = async () => {
    setSavingFollowup(true);
    try {
      await leadsService.update(lead.id, { followUpDate: followUpEdit || null });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Follow-up date updated');
    } catch {
      toast.error('Failed to update follow-up date');
    } finally {
      setSavingFollowup(false);
    }
  };

  const c = fullLead.contact;
  const hotness = deriveHotness(fullLead);
  const hotnessConf = HOTNESS_CONFIG[hotness];
  const assigneeName = getAssigneeDisplayName(fullLead, employees);

  const tabs: { id: 'overview' | 'comments' | 'stage'; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'comments', label: `Consultation Comments (${consultations.length})` },
    { id: 'stage', label: 'Stage & Actions' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl p-4 border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold">
            {c?.firstName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{c?.firstName} {c?.lastName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 flex-wrap">
              <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider', BADGE_STYLES[fullLead.stage] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
                {STAGE_LABELS[fullLead.stage] ?? fullLead.stage}
              </span>
              <span className={clsx('flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border font-bold', hotnessConf.cls)}>
                <HotnessIcon level={hotness} /> {hotnessConf.label}
              </span>
              {fullLead.plan && <span className="text-[10px] text-slate-500">• {fullLead.plan.name}</span>}
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                <UserCircle2 size={11} className="text-purple-600" /> {assigneeName}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onEdit} className="btn-secondary text-[10px] sm:text-xs flex flex-wrap items-center gap-1">
          <Pencil size={12} /> Contact
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className={clsx('px-4 py-2 text-xs font-semibold border-b-2 transition-colors',
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Fixed height tab content container so popup size remains constant when switching tabs */}
      <div className="h-[400px] min-h-[400px] max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Non-Editable Product Interest Data Cards */}
          {(() => {
            const backendInterests: any[] = contactData?.data?.productInterests || [];
            
            // Find specific matching backend product interest for this lead (by ID or plan category/interest match), fallback to fullLead
            const leadInterests = fullLead.interests && fullLead.interests.length > 0
              ? fullLead.interests
              : [fullLead.plan?.name || fullLead.plan?.category].filter(Boolean);

            const matchedBackendInterest = backendInterests.find((pi: any) => {
              if (pi.id && fullLead.id && pi.id === fullLead.id) return true;
              if (pi.productInterestId && fullLead.id && pi.productInterestId === fullLead.id) return true;
              if (pi.planId && fullLead.planId && pi.planId === fullLead.planId) return true;
              const piInterests: string[] = pi.interests && pi.interests.length > 0
                ? pi.interests
                : [pi.plan?.name || pi.plan?.category].filter(Boolean);
              return piInterests.some(i => leadInterests.includes(i));
            });

            const allProductInterestsList = matchedBackendInterest ? [matchedBackendInterest] : [fullLead];

            return (
              <div className="space-y-3">
                {allProductInterestsList.map((pi: any, idx: number) => {
                  const parsedNotes = parseLeadNotes(pi.notes);
                  const interestsList: string[] = pi.interests && pi.interests.length > 0
                    ? pi.interests
                    : [pi.plan?.name || pi.plan?.category || 'Health'];
                  const premium = pi.premiumBudget || pi.expectedPremium || 0;
                  const sumAssured = pi.sumAssuredRequired || pi.sumAssured || 0;
                  const planName = pi.plan?.name;
                  const companyName = pi.plan?.company?.name;

                  return (
                    <div key={pi.id || idx} className="bg-gradient-to-br from-blue-50/90 via-slate-50 to-indigo-50/50 border border-blue-200/80 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-blue-100/80 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-2xs text-xs">
                            <Shield size={15} />
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Product Interest {allProductInterestsList.length > 1 ? `#${idx + 1}` : ''}</span>
                            <h4 className="text-xs font-extrabold text-slate-800">Selected Product Interest Details</h4>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pi.stage && (
                            <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider', BADGE_STYLES[pi.stage] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
                              {STAGE_LABELS[pi.stage] ?? pi.stage}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-200/80 text-slate-600 border border-slate-300/60 flex flex-wrap items-center gap-1">
                            <Lock size={9} className="text-slate-500" /> Non-Editable
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Selected Product(s)</span>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {interestsList.map((prod: string, i: number) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-purple-600 text-white shadow-2xs">
                                ✓ {prod}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Expected Premium / Budget</span>
                          <p className="font-extrabold text-emerald-700 text-sm mt-0.5">
                            ₹{Number(premium).toLocaleString('en-IN')}
                          </p>
                        </div>

                        {Number(sumAssured) > 0 && (
                          <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Sum Assured Required</span>
                            <p className="font-extrabold text-blue-700 text-sm mt-0.5">
                              ₹{Number(sumAssured).toLocaleString('en-IN')}
                            </p>
                          </div>
                        )}

                        {(companyName || planName) && (
                          <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Selected Plan</span>
                            <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">
                              {companyName ? `${companyName} - ` : ''}{planName || ''}
                            </p>
                          </div>
                        )}

                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Lead Source</span>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {pi.source || fullLead.source || 'Walk-in'}
                          </p>
                        </div>

                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Lead Stage</span>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {(STAGE_LABELS[pi.stage] || pi.stage || STAGE_LABELS[fullLead.stage] || fullLead.stage)}
                          </p>
                        </div>

                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Assigned Agent</span>
                          <p className="font-bold text-purple-700 mt-0.5 flex items-center gap-1.5 truncate">
                            <UserCircle2 size={13} className="text-purple-600 shrink-0" />
                            <span className="truncate">{assigneeName}</span>
                          </p>
                        </div>
                      </div>

                      {parsedNotes.descriptionDetails && (
                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs text-xs space-y-1">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Requirements / Description Notes</span>
                          <p className="text-slate-700 font-medium text-[11px] leading-relaxed whitespace-pre-wrap">
                            {parsedNotes.descriptionDetails}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {(() => {
            const parsedLeadNotes = parseLeadNotes(fullLead.notes);
            const connectedPolicyData = fullLead.connectedPolicy;
            const isRenewalLead = parsedLeadNotes.leadType === 'RENEWAL' || fullLead.source === 'Renewal';
            if (!isRenewalLead) return null;

            const policyType = connectedPolicyData?.plan?.category || fullLead.plan?.category || (fullLead.interests && fullLead.interests.length > 0 ? fullLead.interests.join(', ') : '—');

            return (
              <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/70 border border-amber-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      <Shield size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Renewal Created Against</span>
                      <h4 className="text-sm font-extrabold text-slate-800">
                        Policy #{connectedPolicyData?.policyNumber || parsedLeadNotes.policyNumber || 'N/A'}
                      </h4>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 border border-purple-200">
                    Renewal Lead
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Policy Type</span>
                    <p className="font-bold text-slate-700 mt-0.5 uppercase tracking-wide">
                      {policyType}
                    </p>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expiry / End Date</span>
                    <p className="font-bold text-rose-600 mt-0.5 flex flex-wrap items-center gap-1">
                      <Calendar size={12} />
                      {connectedPolicyData?.endDate ? new Date(connectedPolicyData.endDate).toLocaleDateString('en-IN') : (parsedLeadNotes.endDate ? new Date(parsedLeadNotes.endDate).toLocaleDateString('en-IN') : '—')}
                    </p>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Company & Plan Name</span>
                    <p className="font-bold text-slate-700 mt-0.5 truncate">
                      {connectedPolicyData?.plan?.company?.name || parsedLeadNotes.companyName || '—'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                      {connectedPolicyData?.plan?.name || parsedLeadNotes.planName || '—'}
                    </p>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Premium & Sum Insured</span>
                    <p className="font-bold text-emerald-700 mt-0.5">
                      Premium: ₹{Number(connectedPolicyData?.premiumAmount || parsedLeadNotes.premiumAmount || fullLead.premiumBudget || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-600">
                      Sum Insured: ₹{Number(connectedPolicyData?.sumAssured || parsedLeadNotes.sumAssured || fullLead.sumAssuredRequired || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Directly Editable Lead Management Details */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-2 gap-3 sm:gap-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                  <Pencil size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Lead Information & Status</h4>
                  <p className="text-[10px] text-slate-400">Directly editable fields for this lead</p>
                </div>
              </div>
              <button
                onClick={() => handleUpdateLeadDetails()}
                disabled={savingLeadDetails}
                className="btn-primary text-xs px-3.5 py-1.5 h-auto flex flex-nowrap items-center justify-center gap-1.5 font-bold shadow-2xs w-full sm:w-auto shrink-0"
              >
                {savingLeadDetails ? <RefreshCw size={12} className="animate-spin shrink-0" /> : <Save size={12} className="shrink-0" />} Save Lead Details
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Lead Stage */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Stage <span className="text-red-500">*</span></label>
                <select
                  value={editStage}
                  onChange={e => setEditStage(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  {UI_STAGES.map(s => {
                    const key = STAGE_MAPPINGS[s];
                    return <option key={key} value={key}>{s}</option>;
                  })}
                </select>
              </div>

              {/* Lead Status */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Status <span className="text-red-500">*</span></label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="Interested">Interested</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              {/* Lead Type */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Type <span className="text-red-500">*</span></label>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="Fresh">Fresh</option>
                  <option value="Renewal">Renewal</option>
                  <option value="Porting">Porting</option>
                </select>
              </div>

              {/* Lead Source */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Source <span className="text-red-500">*</span></label>
                <select
                  value={editSource}
                  onChange={e => setEditSource(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="Walk-in">Walk-in</option>
                  <option value="Referral">Referral</option>
                  <option value="Website">Website</option>
                  <option value="Cold Call">Cold Call</option>
                  <option value="Campaign">Campaign</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Partner">Partner</option>
                  <option value="Existing Client">Existing Client</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Assigned Employee */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Assigned Employee</label>
                <select
                  value={editAssignee}
                  onChange={e => setEditAssignee(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="">Unassigned</option>
                  {getAssignableEmployees(employees, fullLead || lead).map((emp: any) => {
                    const empUserId = emp.userId || emp.user?.id || emp.id;
                    const empName = `${emp.firstName || emp.employeeProfile?.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.employeeProfile?.lastName || emp.user?.lastName || ''}`.trim() || emp.name || emp.email || 'Employee';
                    return (
                      <option key={emp.id || empUserId} value={empUserId}>
                        {empName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Follow-up Date *</label>
                <DatePicker
                  value={editFollowUp}
                  onChange={setEditFollowUp}
                  className="input text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* Expected Premium / Budget */}
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Expected Premium / Budget (₹) *</label>
                <input
                  type="number"
                  value={editPremium}
                  onChange={e => setEditPremium(e.target.value)}
                  placeholder="e.g. 12000"
                  className="input text-xs font-bold text-emerald-700 bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Consultation Comments */}
      {tab === 'comments' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 block">Add Call Summary / Comment</label>
              <span className="text-[10px] text-slate-400 font-medium">Press Ctrl+Enter to save</span>
            </div>
            <div className="flex gap-2">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add Call Summary / Comment..."
                className="input text-xs flex-1 resize-none bg-slate-50/50 border-slate-200 focus:bg-white"
                rows={2}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commentText.trim()) {
                    addConsultationMutation.mutate(commentText.trim());
                  }
                }}
              />
              <button
                onClick={() => commentText.trim() && addConsultationMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || addConsultationMutation.isPending}
                className="btn-primary px-3.5 self-end h-8 text-xs flex flex-wrap items-center gap-1 font-bold shadow-2xs"
              >
                {addConsultationMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />} Save
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
            {consultations.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50/60 border border-slate-200/60 rounded-xl p-4">
                <MessageCircle size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">No comments yet. Add the first summary below.</p>
              </div>
            ) : (
              [...consultations].reverse().map((c: any) => {
                const authorName = c.authorName || (c.author?.employeeProfile ? `${c.author.employeeProfile.firstName || ''} ${c.author.employeeProfile.lastName || ''}`.trim() : (c.author?.email || 'System'));
                return (
                  <div key={c.id} className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        {authorName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {c.createdAt ? format(new Date(c.createdAt), 'dd/MMM/yyyy, hh:mm a') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">{c.notes}</p>
                    {c.scheduledAt && (
                      <p className="text-[10px] text-amber-600 mt-1 flex flex-wrap items-center gap-1">
                        <Calendar size={10} /> Scheduled: {format(new Date(c.scheduledAt), 'dd/MMM/yyyy')}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Stage */}
      {tab === 'stage' && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Move to Stage</p>
            <div className="flex flex-wrap gap-2">
              {UI_STAGES.map(s => {
                const backendStage = STAGE_MAPPINGS[s];
                const isCurrent = BACKEND_TO_UI[fullLead.stage] === s;
                return (
                  <button key={s}
                    onClick={() => !isCurrent && backendStage && handleStageChange(backendStage)}
                    disabled={isCurrent || moveStage.isPending}
                    className={clsx('flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border',
                      isCurrent ? 'bg-purple-600 text-white border-purple-600 shadow' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700')}>
                    {isCurrent && <ChevronRight size={10} />}
                    {s}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Click any stage to move this lead there.</p>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Mark as Process Completed</p>
            <button
              onClick={() => handleStageChange('PROCESS_COMPLETED')}
              disabled={fullLead.stage === 'PROCESS_COMPLETED' || moveStage.isPending}
              className="text-xs px-3 py-1.5 rounded-full font-medium border bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Mark as Process Completed
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Utility export ─────────────────────────────────────────────────────────────
export function cleanLeadPayload(body: any) {
  const payload: any = { ...body };
  if (payload.sumAssuredRequired === '' || payload.sumAssuredRequired == null) {
    delete payload.sumAssuredRequired;
  } else {
    payload.sumAssuredRequired = Number(payload.sumAssuredRequired);
  }
  if (payload.premiumBudget === '' || payload.premiumBudget == null) {
    delete payload.premiumBudget;
  } else {
    payload.premiumBudget = Number(payload.premiumBudget);
  }
  if (payload.followUpDate === '') {
    payload.followUpDate = null;
  } else if (payload.followUpDate) {
    payload.followUpDate = new Date(payload.followUpDate).toISOString();
  }
  return payload;
}
