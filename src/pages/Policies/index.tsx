import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Plus, X, User, Shield, Pencil, Trash2, Upload, Filter, Search, Info, Save, ChevronDown, Settings, CreditCard, Building, CheckCircle2, AlertTriangle, Users, Activity, FileText, FileCheck2, Clock, Download, MessageCircle, History, Heart } from 'lucide-react';
import EmiTrackingView, { MonthPickerDropdown } from './EmiTrackingView';
import PhcTrackingView from './PhcTrackingView';
import { usePolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy, useBulkAssignPolicies } from '@hooks/usePolicies';
import { useClaims, useCreateClaim } from '@hooks/useClaims';
import { sortData } from '../../utils/sortUtils';
import { formatIndianNumber, numberToIndianWords } from '../../utils/numberUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, employeesService, claimsService, documentsService, agencyDetailsService } from '@api/index';
import { deletionRequestsService } from '@api/deletionRequestsService';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import clsx from 'clsx';
import { DatalistInput } from '@comps/common/DatalistInput';

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

const EDUCATION_OPTIONS = [
  'Metric (10th)',
  'Intermediate (12th)',
  'Graduate',
  'Post Graduate',
  'B.Com',
  'B.Sc',
  'B.A',
  'B.Tech / B.E',
  'MBA / PGDM',
  'CA / ICWA / CFA',
  'Med Graduate (MBBS / MD / BAMS)',
  'Post Graduate (Eng)',
  'Law Graduate / Post Graduate',
  'Computer degree other',
  'Up to 9th class passed',
  '10th class passed',
  'Other',
];

const OCCUPATION_OPTIONS = [
  'Salaried Private',
  'Salaried Gov',
  'Salaried/Service',
  'Business Owner',
  'Business',
  'Engineer',
  'Teacher / Professor',
  'Doctor / Medical Professional',
  'CA / Financial Consultant',
  'Lawyer / Legal Professional',
  'Industrialist',
  'Self Employed Professional',
  'Agriculture / Farmer',
  'Student',
  'Retired',
  'Homemaker',
  'Other',
];


interface Policy {
  id: string; policyNumber: string; status: string;
  premiumAmount: number; sumAssured?: number; startDate?: string; endDate: string;
  paymentFrequency?: string; agentCode?: string; notes?: string;
  nextDueDate?: string; maturityDate?: string;
  contactId?: string;
  contact?: { id: string; firstName: string; lastName: string; phone?: string };
  planId?: string;
  plan?: {
    id: string;
    name: string;
    category: string;
    categoryId?: string;
    companyId?: string;
    company?: { id: string; name: string; category?: string };
  };
  assignedEmployee?: { employeeProfile?: { firstName: string; lastName: string } };
  assignedEmployeeId?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-green',
  EXPIRED: 'badge-gray',
  LAPSED: 'badge-red',
  CANCELLED: 'badge-red',
  PENDING: 'badge-yellow',
};

const schema = z.object({
  contactId: z.string().optional(),
  planId: z.string().optional(),
  policyNumber: z.string().optional(),
  sumAssured: z.coerce.number().optional(),
  premiumAmount: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']).optional().default('YEARLY'),
  riders: z.array(z.string()).optional(),
  deductible: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']).optional().default('ACTIVE'),
  assignedEmployeeId: z.string().optional(),
  nextDueDate: z.string().optional(),
  maturityDate: z.string().optional(),
  agentCode: z.string().optional(),
  notes: z.string().optional(),
  firstPremiumDate: z.string().optional(),
  premiumPaymentPeriod: z.coerce.number().optional(),
  lastPremiumDate: z.string().optional(),
  emiCase: z.boolean().optional(),
  emiGateway: z.string().optional(),
  emiDate: z.string().optional(),
  emiPremium: z.coerce.number().optional(),
  phcRequired: z.boolean().optional(),
  phcAmount: z.coerce.number().optional(),
  phcStatus: z.string().optional(),
  phcClaimSettled: z.boolean().optional(),
  firstYearPremium: z.coerce.number().optional(),
  secondYearPremium: z.coerce.number().optional(),
});
type Form = z.infer<typeof schema>;

function parseExtraNotes(notesText?: string | null) {
  const res = {
    deductible: '',
    riders: [] as string[],
    firstPremiumDate: '',
    premiumPaymentPeriod: undefined as number | undefined,
    lastPremiumDate: '',
    emiCase: false,
    emiGateway: '',
    emiDate: '',
    emiPremium: undefined as number | undefined,
    phcRequired: false,
    phcAmount: undefined as number | undefined,
    phcStatus: '',
    phcClaimSettled: false,
    birthPlace: '',
    education: '',
    occupation: '',
    weight: '',
    height: '',
    smokerStatus: 'NON_SMOKER' as 'NON_SMOKER' | 'SMOKER',
    smokerCount: '',
    nonSmokerCount: '',
    dob: '',
    proposalData: null as any,
    cleanNotes: '',
  };
  if (!notesText) return res;

  let textToParse = notesText;

  // 1. Check for structured proposal data JSON block
  if (notesText.includes('<!-- PROPOSAL_DATA_START -->')) {
    try {
      const match = notesText.match(/<!-- PROPOSAL_DATA_START -->([\s\S]*?)<!-- PROPOSAL_DATA_END -->/);
      if (match && match[1]) {
        res.proposalData = JSON.parse(match[1].trim());
      }
      textToParse = notesText.replace(/<!-- PROPOSAL_DATA_START -->[\s\S]*?<!-- PROPOSAL_DATA_END -->/g, '').trim();
    } catch (e) {
      console.warn('[Proposal JSON parse error]', e);
    }
  }

  const lines = textToParse.split('\n');
  const cleanLines: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('Deductible: ')) {
      res.deductible = trimmed.replace('Deductible: ', '').trim();
    } else if (trimmed.startsWith('Riders/Addons: ')) {
      res.riders = trimmed.replace('Riders/Addons: ', '').split(',').map(s => s.trim());
    } else if (trimmed.startsWith('First Premium Date: ')) {
      res.firstPremiumDate = trimmed.replace('First Premium Date: ', '').trim();
    } else if (trimmed.startsWith('Premium Payment Period: ')) {
      res.premiumPaymentPeriod = Number(trimmed.replace('Premium Payment Period: ', '').replace(' Years', '').trim()) || undefined;
    } else if (trimmed.startsWith('Last Premium Date: ')) {
      res.lastPremiumDate = trimmed.replace('Last Premium Date: ', '').trim();
    } else if (trimmed.startsWith('Birth Place: ')) {
      res.birthPlace = trimmed.replace('Birth Place: ', '').trim();
    } else if (trimmed.startsWith('Education: ')) {
      res.education = trimmed.replace('Education: ', '').trim();
    } else if (trimmed.startsWith('Occupation: ')) {
      res.occupation = trimmed.replace('Occupation: ', '').trim();
    } else if (trimmed.startsWith('Weight: ')) {
      res.weight = trimmed.replace('Weight: ', '').trim();
    } else if (trimmed.startsWith('Height: ')) {
      res.height = trimmed.replace('Height: ', '').trim();
    } else if (trimmed.startsWith('Smoker Status: ')) {
      const s = trimmed.replace('Smoker Status: ', '').trim();
      res.smokerStatus = s === 'SMOKER' ? 'SMOKER' : 'NON_SMOKER';
    } else if (trimmed.startsWith('Smoker Count: ')) {
      res.smokerCount = trimmed.replace('Smoker Count: ', '').trim();
    } else if (trimmed.startsWith('Non-Smoker Count: ')) {
      res.nonSmokerCount = trimmed.replace('Non-Smoker Count: ', '').trim();
    } else if (trimmed.startsWith('DOB: ')) {
      res.dob = trimmed.replace('DOB: ', '').trim();
    } else if (trimmed.startsWith('EMI Case: ')) {
      res.emiCase = true;
      const gatewayMatch = trimmed.match(/Gateway:\s*([^,)]+)/);
      const dateMatch = trimmed.match(/Date:\s*([^,)]+)/);
      const premiumMatch = trimmed.match(/Premium:\s*₹([0-9.]+)/);
      if (gatewayMatch) res.emiGateway = gatewayMatch[1].trim();
      if (dateMatch) res.emiDate = dateMatch[1].trim();
      if (premiumMatch) res.emiPremium = Number(premiumMatch[1]) || undefined;
    } else if (trimmed.startsWith('Preventive Health Checkup: ')) {
      res.phcRequired = true;
      const amountMatch = trimmed.match(/Amount:\s*₹([0-9.]+)/);
      const statusMatch = trimmed.match(/Status:\s*([^,)]+)/);
      const settledMatch = trimmed.match(/Claim Settled:\s*([^,)]+)/);
      if (amountMatch) res.phcAmount = Number(amountMatch[1]) || undefined;
      if (statusMatch) res.phcStatus = statusMatch[1].trim();
      if (settledMatch) res.phcClaimSettled = settledMatch[1].trim().toLowerCase() === 'yes';
    } else if (!trimmed.includes('<!-- PROPOSAL_DATA') && !trimmed.includes('PROPOSAL_DATA_END -->') && !trimmed.startsWith('Birth Place:')) {
      cleanLines.push(trimmed);
    }
  });

  let clean = cleanLines.join('\n').trim();
  // Strip any inline artifacts if concatenated
  clean = clean.replace(/Birth Place:[\s\S]*?(Smoker Status:\s*(NON_SMOKER|SMOKER)|$)/gi, '').trim();
  clean = clean.replace(/<!-- PROPOSAL_DATA_START -->[\s\S]*?<!-- PROPOSAL_DATA_END -->/gi, '').trim();

  res.cleanNotes = clean;
  return res;
}

const editSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']),
  premiumAmount: z.coerce.number().positive('Enter a valid premium'),
  sumAssured: z.coerce.number().positive().optional(),
  endDate: z.string().min(1, 'End date required'),
  nextDueDate: z.string().optional(),
  maturityDate: z.string().optional(),
  paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
  agentCode: z.string().optional(),
  notes: z.string().optional(),
  riders: z.array(z.string()).optional(),
  deductible: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  firstPremiumDate: z.string().optional(),
  premiumPaymentPeriod: z.coerce.number().optional(),
  lastPremiumDate: z.string().optional(),
  emiCase: z.boolean().optional(),
  emiGateway: z.string().optional(),
  emiDate: z.string().optional(),
  emiPremium: z.coerce.number().optional(),
  phcRequired: z.boolean().optional(),
  phcAmount: z.coerce.number().optional(),
  phcStatus: z.string().optional(),
  phcClaimSettled: z.boolean().optional(),
});
type EditForm = z.infer<typeof editSchema>;

const ExpandableComment = ({ text }: { text: string }) => {
  if (!text || text.trim() === '') return <span className="text-slate-400">—</span>;
  if (text.length <= 60) return <span className="whitespace-normal break-words leading-relaxed block min-w-[150px] max-w-[250px]">{text}</span>;
  
  return (
    <div className="relative group flex flex-col items-start min-w-[150px] max-w-[250px]">
      <span className="line-clamp-2 whitespace-normal break-words leading-relaxed cursor-help border-b border-dashed border-slate-300">
        {text}
      </span>
      
      {/* Custom Hover Tooltip */}
      <div className="absolute z-[100] left-0 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-[300px] bg-slate-900 text-white text-xs rounded-xl p-3.5 shadow-2xl break-words whitespace-normal pointer-events-none border border-slate-700">
        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-900 rotate-45 border-l border-t border-slate-700" />
        <span className="relative z-10 leading-relaxed block">{text}</span>
      </div>
    </div>
  );
};

export default function Policies() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [emiSelectedMonth, setEmiSelectedMonth] = useState('August 2026');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [keepCreateOpen, setKeepCreateOpen] = useState(false);
  const [activePolicyTab, setActivePolicyTab] = useState<'personalProfile' | 'familyDetails' | 'existingPolicies' | 'nomineeDetails' | 'kycDocuments'>('personalProfile');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 5 Proposal Form Tabs State
  const [personalDetails, setPersonalDetails] = useState({
    fullName: '',
    phone: '',
    email: '',
    dob: '',
    birthPlace: '',
    education: '',
    occupation: '',
    weight: '',
    height: '',
    smokerStatus: 'NON_SMOKER' as 'NON_SMOKER' | 'SMOKER',
    smokerCount: '',
    nonSmokerCount: '',
  });

    const [familyMembersList, setFamilyMembersList] = useState<Array<{
    id: string;
    relation: string;
    name: string;
    ageDob: string;
    status: 'ALIVE' | 'DECEASED';
  }>>([
    { id: '1', relation: 'Brother', name: '', ageDob: '', status: 'ALIVE' },
    { id: '2', relation: 'Sister', name: '', ageDob: '', status: 'ALIVE' },
  ]);

  const [extraKycDocs, setExtraKycDocs] = useState<Array<{
    id: string;
    title: string;
    fileName: string;
  }>>([]);

  const [familyDetails, setFamilyDetails] = useState({
    fatherName: '',
    fatherAge: '',
    fatherStatus: 'ALIVE' as 'ALIVE' | 'DECEASED',
    motherName: '',
    motherAge: '',
    motherStatus: 'ALIVE' as 'ALIVE' | 'DECEASED',
    spouseName: '',
    spouseDob: '',
    brotherName: '',
    brotherAge: '',
    sisterName: '',
    sisterAge: '',
    childrenName: '',
    childrenDob: '',
  });

  const [existingPolicies, setExistingPolicies] = useState<Array<{
    id: string;
    policyNumber: string;
    insurerName: string;
    sumAssured?: string;
    annualPremium?: string;
    status?: string;
  }>>([
    { id: '1', policyNumber: '849201948', insurerName: 'LIC of India' },
    { id: '2', policyNumber: '920194812', insurerName: 'LIC of India' },
    { id: '3', policyNumber: '', insurerName: 'LIC of India' },
    { id: '4', policyNumber: '', insurerName: 'LIC of India' },
    { id: '5', policyNumber: '', insurerName: 'HDFC Life Insurance' },
    { id: '6', policyNumber: '', insurerName: 'ICICI Prudential' },
    { id: '7', policyNumber: '', insurerName: 'SBI Life Insurance' },
  ]);

  const [nominees, setNominees] = useState<Array<{
    id: number;
    name: string;
  }>>([
    { id: 1, name: '' },
    { id: 2, name: '' },
    { id: 3, name: '' },
    { id: 4, name: '' },
  ]);

  const [nomineePapers, setNomineePapers] = useState({
    aadhaarNumber: '',
    aadhaarFileName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    passbookFileName: '',
  });

  const [kycDocuments, setKycDocuments] = useState({
    aadhaarNumber: '',
    aadhaarFileName: '',
    panNumber: '',
    panFileName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    accountType: 'SAVINGS',
    passbookFileName: '',
    itr1FileName: '',
    itr2FileName: '',
    itr3FileName: '',
    salarySlip1FileName: '',
salarySlip2FileName: '',
    salarySlip3FileName: '',
  });

  const [isEmiDetailsCollapsed, setIsEmiDetailsCollapsed] = useState(true);
  const [isPaymentModeLoanCollapsed, setIsPaymentModeLoanCollapsed] = useState(true);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] = useState(true);
  const [isGstDetailsCollapsed, setIsGstDetailsCollapsed] = useState(true);
  const [isPhcCollapsed, setIsPhcCollapsed] = useState(true);
  const [isPhcBookingCollapsed, setIsPhcBookingCollapsed] = useState(true);
  const [isPhcSettlementCollapsed, setIsPhcSettlementCollapsed] = useState(true);
  const [isDocCollapsed, setIsDocCollapsed] = useState(true);
  const [isEndorsementDocCollapsed, setIsEndorsementDocCollapsed] = useState(true);
  const [isAddPolicyClaimOpen, setIsAddPolicyClaimOpen] = useState(false);
  const [policyClaimFields, setPolicyClaimFields] = useState({
    claimNumber: '',
    claimType: 'HEALTH',
    claimAmount: '',
    intimatedAt: format(new Date(), 'yyyy-MM-dd'),
    diagnosis: '',
    hospital: '',
    notes: '',
  });

  const createClaimMutation = useCreateClaim();
  const { data: allClaimsData } = useClaims({ page: 1, limit: 500 });
  const allClaimsList = allClaimsData?.data ?? [];

  // Tab 5: Preventive Health Checkup Extra Details State
  const [phcExtraDetails, setPhcExtraDetails] = useState({
    balanceAmount: '1500',
    eligibilityStartDate: '',
    frequency: 'ANNUAL',
    followUpDate: '',
    insuredPersonName: '',
    bookingDate: '',
    appointmentDate: '',
    centreName: '',
    centreCity: '',
    utilizedAmount: '',
    reimbursementCashless: 'CASHLESS',
    reportReceivedDate: '',
    reportBillReceivedDate: '',
    reportBillSubmittedDate: '',
    settlementDate: '',
    phcStage: 'INTIMATIONS',
  });

  const [isDocUploadModalOpen, setIsDocUploadModalOpen] = useState(false);
  const [docUploadFields, setDocUploadFields] = useState<{ type: string; title: string; description: string; file: File | null }>({
    type: 'POLICY',
    title: '',
    description: '',
    file: null,
  });
  const [pendingDocs, setPendingDocs] = useState<{ type: string; title: string; description: string; file: File }[]>([]);

  const handleDocUploadAdd = () => {
    if (!docUploadFields.file) return toast.error('Please select a file to upload.');
    if (!docUploadFields.title) return toast.error('Please provide a document title.');
    setPendingDocs(prev => [...prev, docUploadFields as any]);
    setIsDocUploadModalOpen(false);
    setDocUploadFields({ type: 'POLICY', title: '', description: '', file: null });
  };

  // Payment Account Details
  const [paymentAccount, setPaymentAccount] = useState({
    bankName: '',
    ifscCode: '',
    branch: '',
    accountNo: '',
    accountType: 'SAVINGS',
  });

  // GST No Details
  const [gstDetails, setGstDetails] = useState({
    firmName: '',
    firmPan: '',
    firmGst: '',
  });

  // Payment Mode & Loan Details
  const [paymentModeDetails, setPaymentModeDetails] = useState({
    paymentMode: 'ONLINE',
    paymentDate: '',
    transactionRef: '',
    isLoanCase: false,
    loanAmount: '',
    loanProvider: '',
    loanSanctionNo: '',
    loanEmi: '',
  });

  // Connected Persons State
  interface ConnectedPersonItem {
    id: string;
    name: string;
    relationship: string;
    contactNo: string;
    dob: string;
    gender: string;
    isCovered: boolean;
    isNominee: boolean;
    nomineeName: string;
    nomineeRelation: string;
    nomineeContact: string;
    nomineeDob: string;
    nomineePercentage: number;
  }

  const [connectedPersons, setConnectedPersons] = useState<ConnectedPersonItem[]>([]);

  const addConnectedPerson = () => {
    setConnectedPersons(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: '',
        relationship: 'Spouse',
        contactNo: '',
        dob: '',
        gender: 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: 100,
      },
    ]);
  };

  const removeConnectedPerson = (id: string) => {
    setConnectedPersons(prev => prev.filter(p => p.id !== id));
  };

  const updateConnectedPerson = (id: string, updates: Partial<ConnectedPersonItem>) => {
    setConnectedPersons(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const totalNomineePercentage = useMemo(() => {
    return connectedPersons
      .filter(p => p.isNominee)
      .reduce((sum, p) => sum + (Number(p.nomineePercentage) || 0), 0);
  }, [connectedPersons]);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      const contactId = searchParams.get('contactId');
      const keepOpen = searchParams.get('keepOpen') === '1';
      setKeepCreateOpen(keepOpen);
      setModalOpen(true);

      if (contactId) {
        contactsService.get(contactId)
          .then((res: any) => {
            const contact = res?.data ?? res;
            if (!contact?.id) return;
            setSelectedContact({
              id: contact.id,
              firstName: contact.firstName || '',
              lastName: contact.lastName || '',
              phone: contact.phone || '',
            });
            setValue('contactId', contact.id, { shouldValidate: true });
            setContactSearch('');
          })
          .catch((err: any) => console.error('Failed to preload contact for policy create', err));
      }
    }
  }, [searchParams]);

  const [editTarget, setEditTarget] = useState<Policy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('ALL');

  const defaultFilters = {
    agency: '',
    company: '',
    plan: '',
    sumInsuredMin: '',
    sumInsuredMax: '',
    startDateFrom: '',
    startDateTo: '',
    endDateFrom: '',
    endDateTo: '',
    status: '',
    premiumMin: '',
    premiumMax: '',
    policyType: '',
  };
  const [tempFilters, setTempFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const productFilterRef = useRef<HTMLDivElement>(null);
  const companyFilterRef = useRef<HTMLDivElement>(null);

  // Sorting
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Column Visibility Selection - Primary form fields visible by default
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    proposerName: true,
    proposerContact: true,
    dob: true,
    birthPlace: true,
    education: true,
    occupation: true,
    nomineeName: true,
    status: true,
    // Additional / Optional fields hidden by default on table view
    policyNumber: false,
    'plan.name': false,
    'plan.company.name': false,
    sumAssured: false,
    premiumAmount: false,
    email: false,
    aadhaarNumber: false,
    panNumber: false,
    bankDetails: false,
    comment: false,
  });
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Bulk assignment state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState('');
  const bulkAssignMutation = useBulkAssignPolicies();

  const { data: employeeResults } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeesService.list({ limit: 100 }),
    enabled: !!user,
  });

  const { data: agencyRes } = useQuery({
    queryKey: ['agency-details'],
    queryFn: () => agencyDetailsService.findAll(),
    enabled: !!user,
  });

  const handleBulkAssign = async () => {
    if (!assignTarget) return;
    const assignedEmployeeId = assignTarget === 'unassigned' ? null : assignTarget;
    try {
      await bulkAssignMutation.mutateAsync({
        ids: selectedIds,
        assignedEmployeeId,
      });
      setSelectedIds([]);
      setAssignTarget('');
    } catch (e) {
      console.error('[Bulk assign failed]', e);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const act = params.get('action');
    if (act === 'add' || act === 'new' || act === 'create') {
      reset();
      setSelectedContact(null);
      setContactSearch('');
      setSelectedPlan(null);
      setKeepCreateOpen(params.get('keepOpen') === '1');
      setModalOpen(true);
      navigate('/policies', { replace: true });
    }
  }, [location.search]);

  // Click outside handlers for filters
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (productFilterRef.current && !productFilterRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
      if (companyFilterRef.current && !companyFilterRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing policies...');
    try {
      const res = await policiesService.importCsv(file);
      toast.success(res.message || `Successfully imported policies!`, { id: toastId });
      qc.invalidateQueries({ queryKey: ['policies'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import policies', { id: toastId });
    }
  };

  // Contact picker state
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ id: string; firstName: string; lastName: string; phone: string; email?: string; dob?: string } | null>(null);
  const [contactDropdown, setContactDropdown] = useState(false);

  // Plan picker cascade states
  const [selectedType, setSelectedType] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const { data: contactResults } = useQuery({
    queryKey: ['contact-search', contactSearch],
    queryFn: () => contactsService.list({ search: contactSearch || undefined, limit: 8 }),
    enabled: contactDropdown,
  }) as any;

  const { data: allPlansRes } = useQuery({
    queryKey: ['all-plans-list-picker'],
    queryFn: () => policiesService.plans(),
  });
  const plansList = allPlansRes?.data ?? [];

  const availableTypes = useMemo(() => {
    return Array.from(new Set(plansList.map((p: any) => p.category))).filter(Boolean) as string[];
  }, [plansList]);

  const availableCompanies = useMemo(() => {
    if (!selectedType) return [];
    return Array.from(
      new Set(
        plansList
          .filter((p: any) => p.category === selectedType)
          .map((p: any) => p.company?.name)
          .filter(Boolean)
      )
    ) as string[];
  }, [plansList, selectedType]);

  const availablePlans = useMemo(() => {
    if (!selectedType || !selectedCompany) return [];
    return plansList.filter(
      (p: any) => p.category === selectedType && p.company?.name === selectedCompany
    );
  }, [plansList, selectedType, selectedCompany]);

  // Derived filter options
  const filterPlansOptions = useMemo(() => {
    return plansList;
  }, [plansList]);

  const filterCompaniesOptions = useMemo(() => {
    return Array.from(new Set(plansList.map((p: any) => p.company?.name))).filter(Boolean) as string[];
  }, [plansList]);

  const { data: claimsResults } = useQuery({
    queryKey: ['claims', 'all-for-policies-list'],
    queryFn: () => claimsService.list({ limit: 1000 }),
  });
  const allClaims = claimsResults?.data ?? [];

  // Fetch policies: get all in 1 query for client-side filtering (0 ops)
  const { data, isLoading } = usePolicies({ limit: 2000 });

  // Client-side Filter Logic
  const filteredPolicies = useMemo(() => {
    let list: Policy[] = Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : (Array.isArray((data as any)?.items) ? (data as any).items : []));

    // Quick Select filters
    if (selectedQuickFilter !== 'ALL') {
      if (['FRESH', 'PORT', 'RENEWAL'].includes(selectedQuickFilter)) {
        list = list.filter((p: any) => p.policyType === selectedQuickFilter);
      } else {
        list = list.filter((p: any) => p.plan?.category === selectedQuickFilter);
      }
    }

    // Local Search: Name, Mobile, Policy No
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((p: any) => {
        const clientName = `${p.contact?.firstName || ''} ${p.contact?.lastName || ''}`.toLowerCase();
        const clientPhone = (p.contact?.phone || '').toLowerCase();
        const policyNo = (p.policyNumber || '').toLowerCase();
        return clientName.includes(term) || clientPhone.includes(term) || policyNo.includes(term);
      });
    }

    // Agency Filter
    if (appliedFilters.agency) {
      list = list.filter((p: any) => p.agentCode === appliedFilters.agency);
    }

    // Company Filter
    if (appliedFilters.company) {
      list = list.filter((p: any) => p.plan?.company?.name === appliedFilters.company);
    }

    // Plan Filter
    if (appliedFilters.plan) {
      list = list.filter((p: any) => p.plan?.id === appliedFilters.plan || p.planId === appliedFilters.plan);
    }

    // Status Filter
    if (appliedFilters.status) {
      list = list.filter((p: any) => p.status === appliedFilters.status);
    }

    // Policy Type Filter
    if (appliedFilters.policyType) {
      list = list.filter((p: any) => p.policyType === appliedFilters.policyType);
    }

    // Sum Insured filter
    if (appliedFilters.sumInsuredMin) {
      list = list.filter((p: any) => (p.sumAssured ?? 0) >= Number(appliedFilters.sumInsuredMin));
    }
    if (appliedFilters.sumInsuredMax) {
      list = list.filter((p: any) => (p.sumAssured ?? 0) <= Number(appliedFilters.sumInsuredMax));
    }

    // Premium filter
    if (appliedFilters.premiumMin) {
      list = list.filter((p: any) => (p.premiumAmount ?? 0) >= Number(appliedFilters.premiumMin));
    }
    if (appliedFilters.premiumMax) {
      list = list.filter((p: any) => (p.premiumAmount ?? 0) <= Number(appliedFilters.premiumMax));
    }

    // Policy Duration Date Range
    if (appliedFilters.startDateFrom) {
      list = list.filter((p: any) => p.startDate && new Date(p.startDate) >= new Date(appliedFilters.startDateFrom));
    }
    if (appliedFilters.startDateTo) {
      list = list.filter((p: any) => p.startDate && new Date(p.startDate) <= new Date(appliedFilters.startDateTo));
    }
    if (appliedFilters.endDateFrom) {
      list = list.filter((p: any) => p.endDate && new Date(p.endDate) >= new Date(appliedFilters.endDateFrom));
    }
    if (appliedFilters.endDateTo) {
      list = list.filter((p: any) => p.endDate && new Date(p.endDate) <= new Date(appliedFilters.endDateTo));
    }

    return list;
  }, [data, selectedQuickFilter, search, appliedFilters]);

  // Client-side Sorting Logic
  const sortedPolicies = useMemo(() => {
    let key = sortBy;
    // Map specific table column keys to object paths for sorting
    if (key === 'renewAssign') key = 'assignedEmployee.employeeProfile.firstName';
    if (key === 'clientName') key = 'contact.firstName';
    if (key === 'proposerName') key = 'contact.firstName';
    if (key === 'proposerContact') key = 'contact.phone';
    if (key === 'city') key = 'contact.address.city';
    if (key === 'companyCategory') key = 'plan.company.category';
    return sortData(filteredPolicies, key, sortOrder);
  }, [filteredPolicies, sortBy, sortOrder]);

  // Client-side Pagination
  const paginatedPolicies = useMemo(() => {
    const start = (page - 1) * 20;
    return sortedPolicies.slice(start, start + 20);
  }, [sortedPolicies, page]);

  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();
  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { paymentFrequency: 'YEARLY' },
  });
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, setValue: setEditValue, watch: watchEdit } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });
  const watchEditEmiCase = watchEdit('emiCase');
  const watchEditPhcRequired = watchEdit('phcRequired');
  const watchEditEndDate = watchEdit('endDate');
  const watchEditNextDueDate = watchEdit('nextDueDate');
  const watchEditMaturityDate = watchEdit('maturityDate');

  const watchPremiumAmount = watch('premiumAmount');
  const watchSumAssured = watch('sumAssured');
  const watchFirstYearPremium = watch('firstYearPremium');
  const watchSecondYearPremium = watch('secondYearPremium');
  const watchStartDate = watch('startDate');
  const watchEndDate = watch('endDate');
  const watchEmiCase = watch('emiCase');
  const watchPhcRequired = watch('phcRequired');
  const [durationYears, setDurationYears] = useState<number>(1);

  useEffect(() => {
    if (watchStartDate) {
      const start = new Date(watchStartDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setFullYear(start.getFullYear() + durationYears);
        setValue('endDate', end.toISOString().split('T')[0]);
      }
    }
  }, [watchStartDate, durationYears, setValue]);

  const closeModal = (returnRoute?: string, returnPayload?: any) => {
    const returnState = location.state as any;
    const effectiveReturnRoute = returnRoute || returnState?.returnRoute;
    const effectiveReturnPayload = returnPayload || returnState?.returnPayload;
    setModalOpen(false);
    setIsViewMode(false);
    setEditTarget(null);
    reset();
    setSelectedContact(null);
    setPersonalDetails({
      fullName: '',
      phone: '',
      email: '',
      dob: '',
      birthPlace: '',
      education: '',
      occupation: '',
      weight: '',
      height: '',
      smokerStatus: 'NON_SMOKER',
      smokerCount: '',
      nonSmokerCount: '',
    });
    setFamilyDetails({
      fatherName: '',
      fatherAge: '',
      fatherStatus: 'ALIVE',
      motherName: '',
      motherAge: '',
      motherStatus: 'ALIVE',
      spouseName: '',
      spouseDob: '',
      brotherName: '',
      brotherAge: '',
      sisterName: '',
      sisterAge: '',
      childrenName: '',
      childrenDob: '',
    });
    setFamilyMembersList([
      { id: '1', relation: 'Brother', name: '', ageDob: '', status: 'ALIVE' },
      { id: '2', relation: 'Sister', name: '', ageDob: '', status: 'ALIVE' },
    ]);
    setExistingPolicies([
      { id: '1', policyNumber: '849201948', insurerName: 'LIC of India' },
      { id: '2', policyNumber: '920194812', insurerName: 'LIC of India' },
      { id: '3', policyNumber: '', insurerName: 'LIC of India' },
      { id: '4', policyNumber: '', insurerName: 'LIC of India' },
      { id: '5', policyNumber: '', insurerName: 'HDFC Life Insurance' },
      { id: '6', policyNumber: '', insurerName: 'ICICI Prudential' },
      { id: '7', policyNumber: '', insurerName: 'SBI Life Insurance' },
    ]);
    setNominees([
      { id: 1, name: '' },
      { id: 2, name: '' },
      { id: 3, name: '' },
      { id: 4, name: '' },
    ]);
    setNomineePapers({
      aadhaarNumber: '',
      aadhaarFileName: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      passbookFileName: '',
    });
    setKycDocuments({
      aadhaarNumber: '',
      aadhaarFileName: '',
      panNumber: '',
      panFileName: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
      accountType: 'SAVINGS',
      passbookFileName: '',
      itr1FileName: '',
      itr2FileName: '',
      itr3FileName: '',
      salarySlip1FileName: '',
      salarySlip2FileName: '',
      salarySlip3FileName: '',
    });
    setExtraKycDocs([]);
    setFormErrors({});
    setActivePolicyTab('personalProfile');
    setContactSearch('');
    setSelectedType('');
    setSelectedCompany('');
    setSelectedPlan(null);
    setPendingDocs([]);
    setKeepCreateOpen(false);
    if (effectiveReturnRoute) {
      navigate(effectiveReturnRoute, {
        replace: true,
        state: effectiveReturnPayload,
      });
    }
  };

  const openView = (p: Policy) => {
    setIsViewMode(true);
    openEdit(p);
  };

  const openEdit = (p: Policy) => {
    setIsViewMode(false);
    setFormErrors({});
    setEditTarget(p);
    const extra = parseExtraNotes(p.notes);

    setValue('contactId', p.contactId || '');
    const contactObj = p.contact as any;
    const contactFullName = (p as any).clientName || (contactObj ? `${contactObj.firstName || ''} ${contactObj.lastName || ''}`.trim() : '');
    const contactPhone = (p as any).phone || contactObj?.phone || contactObj?.mobile || '';
    const contactEmail = contactObj?.email || '';
    const contactDob = contactObj?.dob ? contactObj.dob.slice(0, 10) : contactObj?.dateOfBirth ? contactObj.dateOfBirth.slice(0, 10) : (extra.dob || '');

    if (p.contact || p.contactId || (p as any).clientName) {
      setSelectedContact({
        id: p.contactId || contactObj?.id || '',
        firstName: contactObj?.firstName || contactFullName.split(' ')[0] || '',
        lastName: contactObj?.lastName || contactFullName.split(' ').slice(1).join(' ') || '',
        phone: contactPhone,
        dob: contactDob,
      });
    }

    // Default Personal Details from direct/extra fields
    setPersonalDetails({
      fullName: contactFullName,
      phone: contactPhone,
      email: contactEmail,
      dob: contactDob,
      birthPlace: contactObj?.birthPlace || contactObj?.city || extra.birthPlace || '',
      education: contactObj?.education || extra.education || '',
      occupation: contactObj?.occupation || contactObj?.occupationType || extra.occupation || '',
      weight: contactObj?.weight || extra.weight || '',
      height: contactObj?.height || extra.height || '',
      smokerStatus: (extra.smokerStatus as any) || (contactObj?.smokerStatus as any) || 'NON_SMOKER',
      smokerCount: extra.smokerCount || '',
      nonSmokerCount: extra.nonSmokerCount || '',
    });

    // Populate all tabs if structured proposal data was saved
    if (extra.proposalData) {
      const pd = extra.proposalData;
      if (pd.personalDetails) {
        setPersonalDetails(prev => ({
          ...prev,
          ...pd.personalDetails,
          fullName: pd.personalDetails.fullName || contactFullName,
          phone: pd.personalDetails.phone || contactPhone,
          email: pd.personalDetails.email || contactEmail,
          dob: pd.personalDetails.dob || contactDob,
        }));
      }
      if (pd.familyDetails) {
        setFamilyDetails(prev => ({ ...prev, ...pd.familyDetails }));
      }
      if (pd.familyMembersList && Array.isArray(pd.familyMembersList)) {
        setFamilyMembersList(pd.familyMembersList);
      }
      if (pd.existingPolicies && Array.isArray(pd.existingPolicies)) {
        setExistingPolicies(pd.existingPolicies);
      }
      if (pd.nominees && Array.isArray(pd.nominees)) {
        setNominees(pd.nominees);
      }
      if (pd.nomineePapers) {
        setNomineePapers(prev => ({ ...prev, ...pd.nomineePapers }));
      }
      if (pd.kycDocuments) {
        setKycDocuments(prev => ({ ...prev, ...pd.kycDocuments }));
      }
      if (pd.extraKycDocs && Array.isArray(pd.extraKycDocs)) {
        setExtraKycDocs(pd.extraKycDocs);
      }
    }

    // Also enrich from contact record if available
    if (p.contactId) {
      contactsService.get(p.contactId).then((res: any) => {
        const fullContact = res?.data || res;
        if (fullContact) {
          const cDob = fullContact.dateOfBirth ? fullContact.dateOfBirth.slice(0, 10) : (fullContact.dob ? fullContact.dob.slice(0, 10) : '');
          const cName = `${fullContact.firstName || ''} ${fullContact.lastName || ''}`.trim();
          setPersonalDetails(prev => ({
            ...prev,
            fullName: prev.fullName || cName,
            phone: prev.phone || fullContact.phone || fullContact.alternatePhone || '',
            email: prev.email || fullContact.email || '',
            dob: prev.dob || cDob,
            birthPlace: prev.birthPlace || fullContact.birthPlace || fullContact.city || '',
            education: prev.education || fullContact.education || '',
            occupation: prev.occupation || fullContact.occupationType || fullContact.occupation || '',
            weight: prev.weight || fullContact.weight || '',
            height: prev.height || fullContact.height || '',
          }));

          setKycDocuments(prev => ({
            ...prev,
            aadhaarNumber: prev.aadhaarNumber || fullContact.aadhaarNumber || fullContact.aadharNumber || '',
            panNumber: prev.panNumber || fullContact.panNumber || fullContact.pan || '',
            bankName: prev.bankName || fullContact.bankName || '',
            accountNumber: prev.accountNumber || fullContact.accountNumber || fullContact.bankAccountNumber || '',
            ifscCode: prev.ifscCode || fullContact.ifscCode || fullContact.bankIfsc || '',
          }));
        }
      }).catch(err => console.warn('[Policy Edit] fetch contact error:', err));
    }

    if (p.plan) {
      setSelectedPlan(p.plan);
      if (p.plan.company) {
        setSelectedCompany(p.plan.company?.name || '');
      }
      if (p.plan.category) {
        setSelectedType(p.plan.category);
      }
      setValue('planId', p.planId || p.plan?.id || '');
    }

    setValue('policyNumber', p.policyNumber || '');
    setValue('status', (p.status as any) || 'ACTIVE');
    setValue('premiumAmount', p.premiumAmount || 0);
    setValue('sumAssured', (p.sumAssured as any) || undefined);
    setValue('startDate', p.startDate ? p.startDate.slice(0, 10) : '');
    setValue('endDate', p.endDate ? p.endDate.slice(0, 10) : '');
    setValue('nextDueDate', p.nextDueDate ? p.nextDueDate.slice(0, 10) : '');
    setValue('maturityDate', p.maturityDate ? p.maturityDate.slice(0, 10) : '');
    setValue('paymentFrequency', (p.paymentFrequency as any) ?? 'YEARLY');
    setValue('agentCode', p.agentCode ?? '');
    setValue('notes', extra.cleanNotes || '');
    setValue('deductible', extra.deductible || '');
    setValue('riders', extra.riders || []);
    setValue('assignedEmployeeId', p.assignedEmployeeId ?? '');
    setValue('firstPremiumDate', extra.firstPremiumDate || '');
    setValue('premiumPaymentPeriod', extra.premiumPaymentPeriod || undefined);
    setValue('lastPremiumDate', extra.lastPremiumDate || '');
    setValue('emiCase', extra.emiCase || false);
    setValue('emiGateway', extra.emiGateway || '');
    setValue('emiDate', extra.emiDate || '');
    setValue('emiPremium', extra.emiPremium || undefined);
    setValue('phcRequired', extra.phcRequired || false);
    setValue('phcAmount', extra.phcAmount || undefined);
    setValue('phcStatus', extra.phcStatus || '');
    setValue('phcClaimSettled', extra.phcClaimSettled || false);

    if (extra.phcAmount || extra.phcStatus) {
      setPhcExtraDetails(prev => ({
        ...prev,
        balanceAmount: '1500',
        frequency: 'ANNUAL',
      }));
    }

    if ((p as any).members && (p as any).members.length > 0) {
      setConnectedPersons((p as any).members.map((m: any) => ({
        id: m.id || String(Math.random()),
        name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        relationship: m.relationship || 'Spouse',
        contactNo: m.contactNo || m.phone || '',
        dob: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : '',
        gender: m.gender || 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: 100,
      })));
    }

    setModalOpen(true);
  };

  const handleShareWhatsApp = async (policy: Policy) => {
    try {
      if (policy.contactId) {
        contactsService.logInteraction(policy.contactId, {
          type: 'WHATSAPP_MESSAGE',
          notes: `Sent Policy Document (Policy #${policy.policyNumber}) via WhatsApp`,
          date: new Date().toISOString()
        }).catch(err => console.warn('[WhatsApp Log Interaction Error]:', err));
      }
      const rawPhone = policy.contact?.phone || (policy as any).phone || '';
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const clientName = policy.contact ? `${policy.contact.firstName || ''} ${policy.contact.lastName || ''}`.trim() : ((policy as any).clientName || 'Valued Customer');
      const planName = policy.plan?.name || 'Insurance Policy';
      const companyName = policy.plan?.company?.name || 'Insurance Company';
      const premium = policy.premiumAmount ? `₹${Number(policy.premiumAmount).toLocaleString('en-IN')}` : 'N/A';
      const sumAssured = policy.sumAssured ? `₹${Number(policy.sumAssured).toLocaleString('en-IN')}` : 'N/A';
      const startDate = policy.startDate ? policy.startDate.slice(0, 10) : 'N/A';
      const endDate = policy.endDate ? policy.endDate.slice(0, 10) : 'N/A';

      const message = `Hello *${clientName}*,\n\nHere are the details for your Policy:\n📄 *Policy Number:* ${policy.policyNumber || 'N/A'}\n🛡️ *Plan:* ${planName} (${companyName})\n💰 *Sum Insured:* ${sumAssured}\n💵 *Premium Amount:* ${premium} (${policy.paymentFrequency || 'YEARLY'})\n📅 *Period:* ${startDate} to ${endDate}\n\nThank you for choosing *Family First*!`;

      const text = encodeURIComponent(message);
      if (cleanPhone) {
        const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
      } else {
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    } catch (e) {
      console.error('[WhatsApp Share Error]:', e);
      toast.error('Failed to open WhatsApp');
    }
  };

  const handleDownloadPD = async (policy: Policy) => {
    const toastId = toast.loading('Preparing Policy Document...');
    try {
      if (policy.contactId) {
        contactsService.logInteraction(policy.contactId, {
          type: 'NOTE',
          notes: `Downloaded Policy Document (Policy #${policy.policyNumber})`,
          date: new Date().toISOString()
        }).catch(err => console.warn('[Download Log Interaction Error]:', err));
      }

      // 1. Try to fetch documents attached to this policy from document service
      try {
        if (policy.id) {
          const docRes = await documentsService.list({ policyId: policy.id });
          const docs = (docRes as any)?.data || docRes || [];
          if (Array.isArray(docs) && docs.length > 0 && docs[0]?.id) {
            const fileUrlRes = await documentsService.url(docs[0].id);
            if (fileUrlRes?.url) {
              window.open(fileUrlRes.url, '_blank');
              toast.success('Opening Policy Document', { id: toastId });
              return;
            }
          }
        }
      } catch (dErr) {
        console.warn('[Policy Doc fetch error, falling back to certificate generator]:', dErr);
      }

      // 2. Generate and download a formatted Policy Overview & Proposal Certificate Document
      const clientName = policy.contact ? `${policy.contact.firstName || ''} ${policy.contact.lastName || ''}`.trim() : ((policy as any).clientName || 'Client Profile');
      const planName = policy.plan?.name || 'Insurance Plan';
      const companyName = policy.plan?.company?.name || 'Insurance Provider';
      const extra = parseExtraNotes(policy.notes);
      const pd = extra.proposalData;

      const pName = pd?.personalDetails?.fullName || clientName;
      const pPhone = pd?.personalDetails?.phone || policy.contact?.phone || (policy as any).phone || '—';
      const pDob = pd?.personalDetails?.dob || (policy.contact as any)?.dob || extra.dob || '—';
      const pBirthPlace = pd?.personalDetails?.birthPlace || (policy.contact as any)?.birthPlace || extra.birthPlace || (policy.contact as any)?.address?.city || (policy.contact as any)?.city || '—';
      const pEducation = pd?.personalDetails?.education || (policy.contact as any)?.education || extra.education || '—';
      const pOccupation = pd?.personalDetails?.occupation || (policy.contact as any)?.occupation || (policy.contact as any)?.occupationType || extra.occupation || '—';
      const pEmail = pd?.personalDetails?.email || (policy.contact as any)?.email || '—';
      const pWeight = pd?.personalDetails?.weight ? `${pd.personalDetails.weight} kg` : (extra.weight ? `${extra.weight} kg` : '—');
      const pHeight = pd?.personalDetails?.height ? `${pd.personalDetails.height} cm` : (extra.height ? `${extra.height} cm` : '—');
      const pSmoker = pd?.personalDetails?.smokerStatus || extra.smokerStatus || 'NON_SMOKER';

      const nom = pd?.nominees?.[0];
      const nomName = nom?.name || '—';
      const nomRelation = nom?.relation || '—';
      const nomAadhaar = pd?.nomineePapers?.aadhaarNumber || '—';
      const nomBankName = pd?.nomineePapers?.bankName || '—';
      const nomAccNo = pd?.nomineePapers?.accountNumber || '—';
      const nomIfsc = pd?.nomineePapers?.ifscCode || '—';

      const aadhaarNo = pd?.kycDocuments?.aadhaarNumber || (policy.contact as any)?.aadhaarNumber || (policy.contact as any)?.aadharNumber || '—';
      const panNo = pd?.kycDocuments?.panNumber || (policy.contact as any)?.panNumber || (policy.contact as any)?.pan || '—';
      const kycBank = pd?.kycDocuments?.bankName || '—';
      const kycBranch = pd?.kycDocuments?.branch || '—';
      const kycAccNo = pd?.kycDocuments?.accountNumber || '—';
      const kycAccType = pd?.kycDocuments?.accountType || 'SAVINGS';
      const kycIfsc = pd?.kycDocuments?.ifscCode || '—';

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Policy & Proposal Document - ${policy.policyNumber || 'Document'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1e293b; background: #fff; margin: 0; line-height: 1.5; }
    .toolbar { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 20px; }
    .btn { background: #4f46e5; color: white; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; text-decoration: none; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); }
    .btn:hover { background: #4338ca; }
    .header { border-bottom: 3px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 24px; font-weight: 800; color: #3730a3; letter-spacing: -0.5px; }
    .badge { background: #e0e7ff; color: #4338ca; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; border: 1px solid #c7d2fe; }
    .section-title { font-size: 15px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; border-left: 4px solid #4f46e5; padding-left: 10px; margin: 24px 0 12px 0; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
    .item { margin-bottom: 8px; font-size: 13.5px; display: flex; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding-bottom: 4px; }
    .item:last-child { border-bottom: none; margin-bottom: 0; }
    .item strong { color: #64748b; font-weight: 600; }
    .item span { color: #0f172a; font-weight: 700; text-align: right; }
    .table-box { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    .table-box th, .table-box td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    .table-box th { background: #f1f5f9; font-weight: 700; color: #334155; }
    .notes-box { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px; margin: 20px 0; font-size: 13.5px; color: #581c87; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center; }
    .sig-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 40px; padding-top: 20px; }
    .sig-box { border-top: 1px solid #94a3b8; text-align: center; padding-top: 8px; font-size: 13px; font-weight: 700; color: #475569; }
    @media print {
      .toolbar { display: none; }
      body { padding: 0; font-size: 12px; }
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="brand">FAMILY FIRST INSURANCE CRM</div>
      <div style="color: #64748b; font-size: 13.5px; margin-top: 3px; font-weight: 600;">Official Policy Schedule & Proposal Form Record</div>
    </div>
    <div class="badge">${policy.status || 'ACTIVE'}</div>
  </div>

  <!-- SECTION 1: वैयक्तिक माहिती (Personal Information) -->
  <div class="section-title">१. वैयक्तिक माहिती (Personal & Profile Details)</div>
  <div class="grid">
    <div class="card">
      <div class="item"><strong>पूर्ण नाव (Full Name):</strong> <span>${pName}</span></div>
      <div class="item"><strong>मोबाईल नंबर (Mobile):</strong> <span>${pPhone}</span></div>
      <div class="item"><strong>ई-मेल (Email):</strong> <span>${pEmail}</span></div>
      <div class="item"><strong>जन्मतारीख (DOB):</strong> <span>${pDob}</span></div>
      <div class="item"><strong>जन्मस्थळ (Place of Birth):</strong> <span>${pBirthPlace}</span></div>
    </div>
    <div class="card">
      <div class="item"><strong>शिक्षण (Education):</strong> <span>${pEducation}</span></div>
      <div class="item"><strong>व्यवसाय / नोकरी (Occupation):</strong> <span>${pOccupation}</span></div>
      <div class="item"><strong>उंची (Height):</strong> <span>${pHeight}</span></div>
      <div class="item"><strong>वजन (Weight):</strong> <span>${pWeight}</span></div>
      <div class="item"><strong>धूम्रपान / तंबाखू (Smoker Status):</strong> <span>${pSmoker}</span></div>
    </div>
  </div>

  <!-- SECTION 2: कौटुंबिक माहिती व आधीच्या पॉलिसी (Family & Existing Policies) -->
  <div class="section-title">२. कौटुंबिक पार्श्वभूमी व आधीच्या विमा पॉलिसी (Family Background & Existing Policies)</div>
  <div class="grid">
    <div class="card">
      <div class="item"><strong>वडिलांचे नाव (Father's Name):</strong> <span>${pd?.familyDetails?.fatherName || '—'}</span></div>
      <div class="item"><strong>वडिलांचे वय / स्थिती:</strong> <span>${pd?.familyDetails?.fatherAge ? `${pd.familyDetails.fatherAge} yrs (${pd.familyDetails.fatherStatus || 'Alive'})` : '—'}</span></div>
      <div class="item"><strong>आईचे नाव (Mother's Name):</strong> <span>${pd?.familyDetails?.motherName || '—'}</span></div>
      <div class="item"><strong>आईचे वय / स्थिती:</strong> <span>${pd?.familyDetails?.motherAge ? `${pd.familyDetails.motherAge} yrs (${pd.familyDetails.motherStatus || 'Alive'})` : '—'}</span></div>
      <div class="item"><strong>पती / पत्नीचे नाव (Spouse Name):</strong> <span>${pd?.familyDetails?.spouseName || '—'}</span></div>
    </div>
    <div class="card">
      <div class="item"><strong>जोडीदाराची जन्मतारीख (Spouse DOB):</strong> <span>${pd?.familyDetails?.spouseDob || '—'}</span></div>
      <div class="item"><strong>भाऊ / बहिणींची संख्या:</strong> <span>${pd?.familyMembersList ? pd.familyMembersList.length : '0'} सदस्य</span></div>
      <div class="item"><strong>आधीच्या विमा पॉलिसी संख्या:</strong> <span>${pd?.existingPolicies ? pd.existingPolicies.length : '0'} पॉलिसी</span></div>
    </div>
  </div>

  ${pd?.familyMembersList && pd.familyMembersList.length > 0 ? `
  <table class="table-box" style="margin-bottom: 16px;">
    <thead>
      <tr><th>नाते (Relationship)</th><th>नाव (Full Name)</th><th>जन्मतारीख / वय (Age/DOB)</th><th>स्थिती (Status)</th></tr>
    </thead>
    <tbody>
      ${pd.familyMembersList.map((fm: any) => `
        <tr>
          <td>${fm.relation || 'Member'}</td>
          <td>${fm.name || '—'}</td>
          <td>${fm.ageOrDob || '—'}</td>
          <td>${fm.status || 'Alive'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${pd?.existingPolicies && pd.existingPolicies.length > 0 ? `
  <table class="table-box" style="margin-bottom: 16px;">
    <thead>
      <tr><th>आधीची पॉलिसी क्र. (Policy No.)</th><th>विमा कंपनीचे नाव (Insurance Company)</th></tr>
    </thead>
    <tbody>
      ${pd.existingPolicies.map((ep: any) => `
        <tr>
          <td>${ep.policyNo || '—'}</td>
          <td>${ep.companyName || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <!-- SECTION 3: वारसदार माहिती (Nominee Details) -->
  <div class="section-title">३. वारसदाराची माहिती व बँक तपशील (Nominee Details & Papers)</div>
  <div class="grid">
    <div class="card">
      <div class="item"><strong>वारसदाराचे नाव (Nominee Name):</strong> <span>${nomName}</span></div>
      <div class="item"><strong>नाते (Relationship):</strong> <span>${nomRelation}</span></div>
      <div class="item"><strong>वारसदार आधार क्र. (Nominee Aadhaar):</strong> <span>${nomAadhaar}</span></div>
    </div>
    <div class="card">
      <div class="item"><strong>बँक नाव (Bank Name):</strong> <span>${nomBankName}</span></div>
      <div class="item"><strong>खाते क्रमांक (Account Number):</strong> <span>${nomAccNo}</span></div>
      <div class="item"><strong>आयएफएससी कोड (IFSC Code):</strong> <span>${nomIfsc}</span></div>
    </div>
  </div>

  <!-- SECTION 4: केवायसी व बँक तपशील (KYC & Documents) -->
  <div class="section-title">४. केवायसी व बँक तपशील (KYC & Bank Accounts)</div>
  <div class="grid">
    <div class="card">
      <div class="item"><strong>आधार कार्ड क्रमांक (Aadhaar No):</strong> <span>${aadhaarNo}</span></div>
      <div class="item"><strong>पॅन कार्ड क्रमांक (PAN No):</strong> <span>${panNo}</span></div>
      <div class="item"><strong>बँक नाव व शाखा (Bank & Branch):</strong> <span>${kycBank}${kycBranch ? ` (${kycBranch})` : ''}</span></div>
    </div>
    <div class="card">
      <div class="item"><strong>बँक खाते क्रमांक (Account No):</strong> <span>${kycAccNo}</span></div>
      <div class="item"><strong>खाते प्रकार (Account Type):</strong> <span>${kycAccType}</span></div>
      <div class="item"><strong>आयएफएससी कोड (IFSC Code):</strong> <span>${kycIfsc}</span></div>
    </div>
  </div>

  <!-- SECTION 5: पॉलिसी व प्लॅन तपशील (Policy & Plan Schedule) -->
  <div class="section-title">५. पॉलिसी व प्लॅन तपशील (Policy & Plan Schedule)</div>
  <div class="grid">
    <div class="card">
      <div class="item"><strong>पॉलिसी क्रमांक (Policy Number):</strong> <span>${policy.policyNumber || '—'}</span></div>
      <div class="item"><strong>प्लॅनचे नाव (Plan Name):</strong> <span>${planName}</span></div>
      <div class="item"><strong>विमा कंपनी (Insurance Company):</strong> <span>${companyName}</span></div>
      <div class="item"><strong>कॅटेगरी (Plan Category):</strong> <span>${policy.plan?.category || 'General'}</span></div>
    </div>
    <div class="card">
      ${Number(policy.sumAssured || 0) > 0 ? `<div class="item"><strong>विमा रक्कम (Sum Insured):</strong> <span>₹${Number(policy.sumAssured).toLocaleString('en-IN')}</span></div>` : ''}
      ${Number(policy.premiumAmount || 0) > 0 ? `<div class="item"><strong>प्रीमियम रक्कम (Premium):</strong> <span>₹${Number(policy.premiumAmount).toLocaleString('en-IN')} (${policy.paymentFrequency || 'YEARLY'})</span></div>` : ''}
      <div class="item"><strong>कालावधी (Tenure):</strong> <span>${policy.startDate ? policy.startDate.slice(0, 10) : '—'} ते ${policy.endDate ? policy.endDate.slice(0, 10) : '—'}</span></div>
      <div class="item"><strong>एजंट कोड (Agent Code):</strong> <span>${policy.agentCode || 'Direct'}</span></div>
    </div>
  </div>

  ${extra.cleanNotes ? `<div class="notes-box"><strong>शेरा / टिप्पण्या (Notes & Remarks):</strong><br>${extra.cleanNotes}</div>` : ''}

  <div class="sig-grid">
    <div class="sig-box">प्रस्तावक / ग्राहकाची स्वाक्षरी (Proposer's Signature)</div>
    <div class="sig-box">अधिकृत विमा प्रतिनिधी / सल्लागार स्वाक्षरी (Authorized Signatory)</div>
  </div>

  <div class="footer">
    Generated from Family First Insurance CRM Portal &bull; Printed on ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Policy_${policy.policyNumber || 'Certificate'}.html`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);

      toast.success('Policy document downloaded successfully!', { id: toastId });
    } catch (e) {
      console.error('[Download Error]:', e);
      toast.error('Failed to download policy document', { id: toastId });
    }
  };

  const COLS: Column<Policy>[] = useMemo(() => {
    const cols: Column<Policy>[] = [];

    // Prepend checkbox selection column for OWNER
    if (user?.role === 'OWNER') {
      cols.push({
        key: 'select' as any,
        label: (
          <input
            type="checkbox"
            checked={selectedIds.length > 0 && selectedIds.length === (data?.data?.length || 0)}
            onChange={e => {
              if (e.target.checked) {
                const allPolicyIds = (data?.data || []).map((p: Policy) => p.id);
                setSelectedIds(allPolicyIds);
              } else {
                setSelectedIds([]);
              }
            }}
            onClick={e => e.stopPropagation()}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        ) as any,
        render: r => (
          <input
            type="checkbox"
            checked={selectedIds.includes(r.id)}
            onChange={e => {
              if (e.target.checked) {
                setSelectedIds(prev => [...prev, r.id]);
              } else {
                setSelectedIds(prev => prev.filter(id => id !== r.id));
              }
            }}
            onClick={e => e.stopPropagation()}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        ),
      });
    }

    const colConfigs: { key: string; label: string; sortable?: boolean; render?: (r: Policy) => React.ReactNode }[] = [
      {
        key: 'proposerName',
        label: 'Client Name (नाव)',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const name = r.contact ? `${r.contact.firstName} ${r.contact.lastName || ''}`.trim() : (extra.proposalData?.personalDetails?.fullName || (r as any).clientName || '—');
          return <span className="font-semibold text-slate-800">{name}</span>;
        }
      },
      {
        key: 'proposerContact',
        label: 'Mobile No. (मोबाईल)',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return r.contact?.phone || extra.proposalData?.personalDetails?.phone || (r as any).phone || '—';
        }
      },
      {
        key: 'dob',
        label: 'DOB (जन्मतारीख)',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const dob = extra.proposalData?.personalDetails?.dob || ((r.contact as any)?.dob ? (r.contact as any).dob.slice(0, 10) : '') || extra.dob || '';
          return dob || '—';
        }
      },
      {
        key: 'birthPlace',
        label: 'Birth Place (जन्मस्थळ)',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return extra.proposalData?.personalDetails?.birthPlace || (r.contact as any)?.birthPlace || extra.birthPlace || (r.contact as any)?.address?.city || (r.contact as any)?.city || '—';
        }
      },
      {
        key: 'education',
        label: 'Education (शिक्षण)',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return extra.proposalData?.personalDetails?.education || (r.contact as any)?.education || extra.education || '—';
        }
      },
      {
        key: 'occupation',
        label: 'Occupation (व्यवसाय)',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return extra.proposalData?.personalDetails?.occupation || (r.contact as any)?.occupation || (r.contact as any)?.occupationType || extra.occupation || '—';
        }
      },
      {
        key: 'nomineeName',
        label: 'Nominee (वारसदार)',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const nom = extra.proposalData?.nominees?.[0];
          if (!nom?.name) return '—';
          return `${nom.name}${nom.relation ? ` (${nom.relation})` : ''}`;
        }
      },
      {
        key: 'status',
        label: 'Status (स्थिती)',
        sortable: true,
        render: r => (
          <span className={clsx(
            'px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase',
            r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
          )}>
            {r.status || 'ACTIVE'}
          </span>
        )
      },
      {
        key: 'policyNumber',
        label: 'Policy No. (पॉलिसी क्र.)',
        sortable: true,
        render: r => <span className="font-mono font-bold text-indigo-700">{r.policyNumber || '—'}</span>
      },
      {
        key: 'plan.name',
        label: 'Plan Name (प्लॅन)',
        sortable: true,
        render: r => r.plan?.name || '—'
      },
      {
        key: 'plan.company.name',
        label: 'Insurance Company (कंपनी)',
        sortable: true,
        render: r => r.plan?.company?.name || '—'
      },
      {
        key: 'sumAssured',
        label: 'Sum Insured (विमा कव्हर)',
        sortable: true,
        render: r => (r.sumAssured && Number(r.sumAssured) > 0) ? `₹${Number(r.sumAssured).toLocaleString('en-IN')}` : '—'
      },
      {
        key: 'premiumAmount',
        label: 'Premium (हप्ता)',
        sortable: true,
        render: r => (r.premiumAmount && Number(r.premiumAmount) > 0) ? `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` : '—'
      },
      {
        key: 'email',
        label: 'Email (ई-मेल)',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return extra.proposalData?.personalDetails?.email || (r.contact as any)?.email || '—';
        }
      },
      {
        key: 'aadhaarNumber',
        label: 'Aadhaar Card No.',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return extra.proposalData?.kycDocuments?.aadhaarNumber || (r.contact as any)?.aadhaarNumber || (r.contact as any)?.aadharNumber || '—';
        }
      },
      {
        key: 'panNumber',
        label: 'PAN Card No.',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return extra.proposalData?.kycDocuments?.panNumber || (r.contact as any)?.panNumber || (r.contact as any)?.pan || '—';
        }
      },
      {
        key: 'bankDetails',
        label: 'Bank & A/C Details',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const kyc = extra.proposalData?.kycDocuments;
          if (!kyc?.bankName && !kyc?.accountNumber) return '—';
          return `${kyc.bankName || ''}${kyc.accountNumber ? ` (${kyc.accountNumber})` : ''}`.trim() || '—';
        }
      },
      {
        key: 'comment',
        label: 'Comment (शेरा)',
        render: r => <ExpandableComment text={r.notes ? parseExtraNotes(r.notes).cleanNotes : ''} />
      }
    ];

    colConfigs.forEach(col => {
      if (visibleColumns[col.key] !== false) {
        cols.push(col as any);
      }
    });

    // Append action column
    cols.push({
      key: 'actions' as any, label: 'ACTIONS',
      render: r => (
        <div className="flex flex-nowrap items-center gap-1.5 w-max" onClick={e => e.stopPropagation()}>
          <button
            title="Download Policy Document"
            className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => handleDownloadPD(r)}
          >
            <Download size={14} />
          </button>
          <button
            title="Share on WhatsApp"
            className="p-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-green-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => handleShareWhatsApp(r)}
          >
            <MessageCircle size={14} />
          </button>
          <button
            title="Edit Policy"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => openEdit(r)}
          >
            <Pencil size={14} />
          </button>
          <button
            title="Delete Policy"
            className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => setDeleteTarget(r)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    });

    return cols;
  }, [user?.role, data, selectedIds, allClaims, visibleColumns]);

  const submitEdit = async (body: EditForm) => {
    if (!editTarget) return;
    const assignedEmployeeId = body.assignedEmployeeId?.trim() ? body.assignedEmployeeId : undefined;

    // Format notes to include extra Excel fields
    let extraNotes = body.notes ? body.notes.trim() : '';
    if (body.deductible) extraNotes += `\nDeductible: ${body.deductible}`;
    if (body.riders && body.riders.length > 0) extraNotes += `\nRiders/Addons: ${body.riders.join(', ')}`;
    if (body.firstPremiumDate) extraNotes += `\nFirst Premium Date: ${body.firstPremiumDate}`;
    if (body.premiumPaymentPeriod) extraNotes += `\nPremium Payment Period: ${body.premiumPaymentPeriod} Years`;
    if (body.lastPremiumDate) extraNotes += `\nLast Premium Date: ${body.lastPremiumDate}`;
    if (body.emiCase) {
      extraNotes += `\nEMI Case: Yes (Gateway: ${body.emiGateway || 'N/A'}, Date: ${body.emiDate || 'N/A'}, Premium: ₹${body.emiPremium || '0'})`;
    }
    if (body.phcRequired) {
      extraNotes += `\nPreventive Health Checkup: Yes (Amount: ₹${body.phcAmount || '0'}, Status: ${body.phcStatus || 'N/A'}, Claim Settled: ${body.phcClaimSettled ? 'Yes' : 'No'})`;
    }

    const cleanedBody = {
      status: body.status,
      premiumAmount: Number(body.premiumAmount),
      sumAssured: body.sumAssured ? Number(body.sumAssured) : undefined,
      endDate: body.endDate,
      nextDueDate: body.nextDueDate || undefined,
      maturityDate: body.maturityDate || undefined,
      paymentFrequency: body.paymentFrequency,
      agentCode: body.agentCode || undefined,
      assignedEmployeeId,
      notes: extraNotes.trim(),
    };

    try {
      const res = await updatePolicy.mutateAsync({ id: editTarget.id, body: cleanedBody });
      const updatedPolicy = res?.data ?? res;
      if (updatedPolicy?.id) {
        setEditTarget(prev => prev ? { ...prev, ...updatedPolicy } : prev);
      }
    } catch (e) {
      // error already shown by useUpdatePolicy onError
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const toastId = toast.loading(`Deleting policy ${deleteTarget.policyNumber}...`);
    try {
      await deletePolicy.mutateAsync(deleteTarget.id);
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['workspace'] });
      toast.success(`Policy ${deleteTarget.policyNumber} deleted successfully!`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete policy', { id: toastId });
    } finally {
      setDeleteTarget(null);
    }
  };

  const validatePolicyForm = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. Full Name (Mandatory)
    const name = (personalDetails.fullName || '').trim();
    if (!name) {
      errors.fullName = 'नाव टाकणे आवश्यक आहे (Full Name is required)';
    }

    // 2. Mobile Number (Mandatory, exactly 10 digits)
    const cleanPhone = (personalDetails.phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      errors.phone = 'मोबाईल नंबर टाकणे आवश्यक आहे (Mobile number is required)';
    } else if (cleanPhone.length !== 10) {
      errors.phone = 'मोबाईल नंबर बरोबर १० अंकी असावा (Mobile must be exactly 10 digits)';
    }

    // 3. Date of Birth (If provided, cannot be in future)
    if (personalDetails.dob) {
      const dobDate = new Date(personalDetails.dob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dobDate > today) {
        errors.dob = 'जन्मतारीख आजच्या तारखेपेक्षा पुढे नसावी (DOB cannot be future)';
      }
    }

    // 4. Email (If provided, validate format)
    if (personalDetails.email?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalDetails.email.trim())) {
        errors.email = 'योग्य ई-मेल पत्ता टाका (Invalid email format)';
      }
    }

    // 5. KYC Aadhaar (If provided, must be 12 digits)
    const cleanAadhaar = (kycDocuments.aadhaarNumber || '').replace(/\D/g, '');
    if (cleanAadhaar && cleanAadhaar.length !== 12) {
      errors.aadhaarNumber = 'आधार कार्ड नंबर बरोबर १२ अंकी असावा (12 digits required)';
    }

    // 6. KYC PAN (If provided, must be PAN format)
    const cleanPan = (kycDocuments.panNumber || '').trim().toUpperCase();
    if (cleanPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      errors.panNumber = 'पॅन कार्ड नंबर फॉरमॅट चुकीचा आहे (उदा. ABCDE1234F)';
    }

    // 7. Nominee Aadhaar (If provided, must be 12 digits)
    const cleanNomAadhaar = (nomineePapers.aadhaarNumber || '').replace(/\D/g, '');
    if (cleanNomAadhaar && cleanNomAadhaar.length !== 12) {
      errors.nomineeAadhaar = 'वारसदार आधार नंबर बरोबर १२ अंकी असावा';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      if (errors.fullName || errors.phone || errors.dob || errors.email) {
        setActivePolicyTab('personalProfile');
      } else if (errors.nomineeAadhaar) {
        setActivePolicyTab('nomineeDetails');
      } else if (errors.aadhaarNumber || errors.panNumber) {
        setActivePolicyTab('kycDocuments');
      }

      const firstErrMsg = Object.values(errors)[0];
      toast.error(firstErrMsg, { duration: 4000 });
      return false;
    }

    return true;
  };

  const onSubmit = async (body: Form) => {
    if (!validatePolicyForm()) return;
    try {
      // 1. Resolve Contact ID (Existing contact or Auto-created contact from manually typed details)
      let effectiveContactId = body.contactId || selectedContact?.id;

      if (!effectiveContactId && personalDetails.fullName?.trim()) {
        try {
          const names = personalDetails.fullName.trim().split(' ');
          const firstName = names[0];
          const lastName = names.slice(1).join(' ') || undefined;
          const createdContactRes = await contactsService.create({
            firstName,
            lastName,
            phone: personalDetails.phone || undefined,
            email: personalDetails.email || undefined,
            dateOfBirth: personalDetails.dob ? new Date(personalDetails.dob).toISOString() : undefined,
          } as any);
          const createdContact = createdContactRes?.data ?? createdContactRes;
          if (createdContact?.id) {
            effectiveContactId = createdContact.id;
          }
        } catch (cErr) {
          console.warn('[Auto Contact Creation Warning]', cErr);
        }
      } else if (effectiveContactId && personalDetails.fullName?.trim()) {
        try {
          const names = personalDetails.fullName.trim().split(' ');
          const firstName = names[0];
          const lastName = names.slice(1).join(' ') || undefined;
          await contactsService.update(effectiveContactId, {
            firstName: firstName || undefined,
            lastName,
            phone: personalDetails.phone || undefined,
            email: personalDetails.email || undefined,
            dateOfBirth: personalDetails.dob ? new Date(personalDetails.dob).toISOString() : undefined,
          } as any);
        } catch (uErr) {
          console.warn('[Contact Update Warning]', uErr);
        }
      }

      // If still no contactId, fallback to first contact or default contact profile
      if (!effectiveContactId) {
        try {
          const firstContactRes = await contactsService.list({ limit: 1 });
          const firstContact = (firstContactRes?.data ?? firstContactRes)?.[0];
          if (firstContact?.id) {
            effectiveContactId = firstContact.id;
          } else {
            const defContact = await contactsService.create({ firstName: personalDetails.fullName || 'Client', lastName: 'Profile' } as any);
            effectiveContactId = (defContact?.data ?? defContact)?.id;
          }
        } catch (fErr) {
          console.warn('[Contact fallback failed]', fErr);
        }
      }

      // 2. Resolve Plan ID
      let effectivePlanId = body.planId || selectedPlan?.id;
      if (!effectivePlanId && plansList && plansList.length > 0) {
        effectivePlanId = plansList[0].id;
      }

      // 3. Resolve Policy Number
      const effectivePolicyNumber = body.policyNumber?.trim() || `POL-${Date.now().toString().slice(-6)}`;

      // 4. Resolve Dates
      const today = new Date();
      const defaultStartDate = today.toISOString().split('T')[0];
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      const defaultEndDate = nextYear.toISOString().split('T')[0];

      const startDate = body.startDate || defaultStartDate;
      const endDate = body.endDate || defaultEndDate;

      // 5. Resolve Sum Assured & Premium Amount
      const sumAssured = (body.sumAssured !== undefined && body.sumAssured !== null && String(body.sumAssured).trim() !== '') ? Number(body.sumAssured) : undefined;
      const premiumAmount = (body.premiumAmount !== undefined && body.premiumAmount !== null && String(body.premiumAmount).trim() !== '') ? Number(body.premiumAmount) : 0;

      // 6. Clean assignedEmployeeId
      const assignedEmployeeId = body.assignedEmployeeId?.trim() ? body.assignedEmployeeId : undefined;

      // 7. Format extra notes and structured proposal data
      const proposalPayload = {
        personalDetails,
        familyDetails,
        familyMembersList,
        existingPolicies,
        nominees,
        nomineePapers,
        kycDocuments,
        extraKycDocs,
      };

      let extraNotes = body.notes?.trim() ? `${body.notes.trim()}` : '';
      if (body.deductible) extraNotes += `\nDeductible: ${body.deductible}`;
      if (body.riders && body.riders.length > 0) extraNotes += `\nRiders/Addons: ${body.riders.join(', ')}`;
      if (body.firstPremiumDate) extraNotes += `\nFirst Premium Date: ${body.firstPremiumDate}`;
      if (body.premiumPaymentPeriod) extraNotes += `\nPremium Payment Period: ${body.premiumPaymentPeriod} Years`;
      if (body.lastPremiumDate) extraNotes += `\nLast Premium Date: ${body.lastPremiumDate}`;
      if (body.emiCase) {
        extraNotes += `\nEMI Case: Yes (Gateway: ${body.emiGateway || 'N/A'}, Date: ${body.emiDate || 'N/A'}, Premium: ₹${body.emiPremium || '0'})`;
      }
      if (body.phcRequired) {
        extraNotes += `\nPreventive Health Checkup: Yes (Amount: ₹${body.phcAmount || '0'}, Status: ${body.phcStatus || 'N/A'}, Claim Settled: ${body.phcClaimSettled ? 'Yes' : 'No'})`;
      }
      extraNotes += `\n\n<!-- PROPOSAL_DATA_START -->\n${JSON.stringify(proposalPayload)}\n<!-- PROPOSAL_DATA_END -->`;

      const cleanedBody = {
        policyNumber: effectivePolicyNumber,
        contactId: effectiveContactId,
        planId: effectivePlanId,
        assignedEmployeeId,
        status: body.status || 'ACTIVE',
        sumAssured,
        premiumAmount,
        paymentFrequency: body.paymentFrequency || 'YEARLY',
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 365 * 86400000).toISOString(),
        notes: extraNotes.trim(),
        clientName: personalDetails.fullName || 'Client Profile',
        phone: personalDetails.phone || '',
        contact: selectedContact ? {
          id: selectedContact.id,
          firstName: selectedContact.firstName,
          lastName: selectedContact.lastName,
          phone: selectedContact.phone
        } : {
          id: effectiveContactId || 'c_def',
          firstName: personalDetails.fullName?.split(' ')[0] || 'Client',
          lastName: personalDetails.fullName?.split(' ').slice(1).join(' ') || 'Profile',
          phone: personalDetails.phone || ''
        },
        plan: selectedPlan ? {
          id: selectedPlan.id,
          name: selectedPlan.name,
          category: selectedPlan.category || 'LIFE',
          company: { name: selectedCompany || 'Insurance Co', category: selectedType || 'LIFE' }
        } : {
          id: effectivePlanId || 'p_def',
          name: 'Comprehensive Insurance Policy',
          category: 'LIFE',
          company: { name: 'Insurance Provider', category: 'LIFE' }
        }
      };

      if (editTarget?.id) {
        await updatePolicy.mutateAsync({ id: editTarget.id, body: cleanedBody as any });
        for (const doc of pendingDocs) {
          try {
            await documentsService.upload(doc.file, {
              policyId: editTarget.id,
              tag: doc.type,
              title: doc.title,
              description: doc.description
            });
          } catch (uploadErr) {
            console.error('[Document Upload Error]', uploadErr);
          }
        }
        qc.invalidateQueries({ queryKey: ['contacts'] });
        await qc.invalidateQueries({ queryKey: ['policies'] });
        await qc.refetchQueries({ queryKey: ['policies'] });
        qc.invalidateQueries({ queryKey: ['policy', editTarget.id] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['workspace'] });
        toast.success('Policy updated successfully!');
        closeModal();
        return;
      }

      const res = await createPolicy.mutateAsync(cleanedBody as any);
      const createdPolicy = res?.data ?? res;
      for (const doc of pendingDocs) {
        if (createdPolicy?.id) {
          try {
            await documentsService.upload(doc.file, {
              policyId: createdPolicy.id,
              tag: doc.type,
              title: doc.title,
              description: doc.description
            });
          } catch (uploadErr) {
            console.error(`[Document Upload Error] ${doc.title}`, uploadErr);
          }
        }
      }
      qc.invalidateQueries({ queryKey: ['contacts'] });
      await qc.invalidateQueries({ queryKey: ['policies'] });
      await qc.refetchQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('पॉलिसी यशस्वीरित्या सबमिट केली!');
      setSelectedQuickFilter('ALL');
      setSearch('');
      setAppliedFilters(defaultFilters);
      closeModal();
      setPage(1);
      navigate('/policies', { replace: true });
    } catch (e: any) {
      const errs: string[] = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Error submitting policy');
      console.error('[Policy submit]', e?.response?.data);
      toast.error(`पॉलिसी सबमिट करताना त्रुटी आली: ${msg}`);
    }
  };

  const currentTab = searchParams.get('tab') || searchParams.get('view') || (location.pathname.includes('emi') ? 'emi' : 'list');

  return (
    <div className="space-y-4">
      {/* Floating Right Action Panel */}
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
      <div className="fixed right-2 sm:right-3.5 top-60 sm:top-64 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="Import Policy CSV"
        >
          <Upload size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            Import Policy CSV
          </span>
        </button>

        {/* Add New Policy */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="Add New Policy"
        >
          <Plus size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            Add New Policy
          </span>
        </button>
      </div>

      {/* Main Control Hub Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2.5 sm:p-3 shadow-sm mb-4">
        {/* Single Line Layout */}
        <div className="flex items-center gap-2.5 w-full overflow-x-auto custom-scrollbar py-0.5">
          {/* Left Side: Search Bar */}
          <div className="relative min-w-[200px] sm:min-w-[240px] max-w-xs shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search policy#, client name, phone..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all shadow-2xs"
            />
          </div>

          {/* Right Side: Quick Select Category Filters, Column Picker & Filters Toggle */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Quick Type Filters */}
            <button
              onClick={() => { setSelectedQuickFilter('ALL'); setPage(1); }}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap',
                selectedQuickFilter === 'ALL'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              All Types
            </button>
            {['HEALTH', 'LIFE', 'GENERAL', 'ACCIDENT', 'FRESH', 'PORT', 'RENEWAL'].map(cat => {
              const isSel = selectedQuickFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setSelectedQuickFilter(cat); setPage(1); }}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap',
                    isSel
                      ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  {cat === 'HEALTH' ? 'Health' : cat === 'LIFE' ? 'Life' : cat === 'ACCIDENT' ? 'Accident' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              );
            })}

            {/* Advanced Filters Toggle Button */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={clsx(
                "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all shrink-0",
                filtersOpen && "bg-purple-50 border-purple-200 text-purple-700"
              )}
              title="Advanced Filters"
            >
              <Filter size={14} />
            </button>
          </div>
        </div>
      </div>

          {selectedIds.length > 0 && user?.role === 'OWNER' && (
            <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm transition-all animate-fadeIn">
              <span className="font-medium text-blue-800">
                {selectedIds.length} policies selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={assignTarget}
                  onChange={e => setAssignTarget(e.target.value)}
                  className="input py-1.5 px-3 text-xs w-48 bg-white border-gray-300"
                >
                  <option value="">Select Assignee...</option>
                  <option value="unassigned">Unassign</option>
                  {employeeResults?.data?.map((emp: any) => (
                    <option key={emp.id} value={emp.userId}>
                      {emp.firstName || emp.employeeProfile?.firstName || 'Unknown'} {emp.lastName || emp.employeeProfile?.lastName || ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={!assignTarget || bulkAssignMutation.isPending}
                  className="btn-primary py-1.5 px-3 text-[10px] sm:text-xs cursor-pointer disabled:opacity-50"
                >
                  {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="p-1 rounded hover:bg-blue-100 text-blue-600"
                  title="Clear selection"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {filtersOpen && (
            <div className="card bg-gray-50/50 p-5 rounded-xl border border-slate-200 shadow-sm mt-2 mb-4 animate-fadeIn">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/70">
                <h3 className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-2">
                  <Filter size={16} className="text-blue-600" />
                  Advanced Filters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">

                {/* Agency */}
                <div>
                  <label className="label">Select Agency</label>
                  <select className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.agency} onChange={e => setTempFilters({ ...tempFilters, agency: e.target.value })}>
                    <option value="">All Agencies</option>
                    {agencyRes?.data?.map((ag: any) => (
                      <option key={ag.id} value={ag.agentCode}>{ag.name} ({ag.agentCode || 'N/A'})</option>
                    ))}
                  </select>
                </div>

                {/* Company */}
                <div>
                  <label className="label">Select Company</label>
                  <select className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.company} onChange={e => setTempFilters({ ...tempFilters, company: e.target.value })}>
                    <option value="">All Companies</option>
                    {filterCompaniesOptions.map(comp => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                </div>

                {/* Plan */}
                <div>
                  <label className="label">Select Plan</label>
                  <select className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.plan} onChange={e => setTempFilters({ ...tempFilters, plan: e.target.value })}>
                    <option value="">All Plans</option>
                    {filterPlansOptions.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="label">Policy Status</label>
                  <select className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.status} onChange={e => setTempFilters({ ...tempFilters, status: e.target.value })}>
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>

                {/* Policy Type */}
                <div>
                  <label className="label">Policy Type</label>
                  <select className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.policyType} onChange={e => setTempFilters({ ...tempFilters, policyType: e.target.value })}>
                    <option value="">All Types</option>
                    <option value="FRESH">Fresh</option>
                    <option value="PORT">Port</option>
                    <option value="RENEWAL">Renewal</option>
                  </select>
                </div>

                {/* Sum Insured Range */}
                <div>
                  <label className="label">Sum Insured Range</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" placeholder="Min" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.sumInsuredMin} onChange={e => setTempFilters({ ...tempFilters, sumInsuredMin: e.target.value })} />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="number" placeholder="Max" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.sumInsuredMax} onChange={e => setTempFilters({ ...tempFilters, sumInsuredMax: e.target.value })} />
                  </div>
                </div>

                {/* Premium Range */}
                <div>
                  <label className="label">Premium Range</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" placeholder="Min" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.premiumMin} onChange={e => setTempFilters({ ...tempFilters, premiumMin: e.target.value })} />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="number" placeholder="Max" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.premiumMax} onChange={e => setTempFilters({ ...tempFilters, premiumMax: e.target.value })} />
                  </div>
                </div>

                {/* Start Date Range */}
                <div>
                  <label className="label">Policy Start Date</label>
                  <div className="flex gap-2 items-center">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.startDateFrom} onChange={val => setTempFilters({ ...tempFilters, startDateFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.startDateTo} onChange={val => setTempFilters({ ...tempFilters, startDateTo: val })} title="To" />
                  </div>
                </div>

                {/* End Date Range */}
                <div>
                  <label className="label">Policy End Date</label>
                  <div className="flex gap-2 items-center">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.endDateFrom} onChange={val => setTempFilters({ ...tempFilters, endDateFrom: val })} title="From" />
                            <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.endDateTo} onChange={val => setTempFilters({ ...tempFilters, endDateTo: val })} title="To" />
                  </div>
                </div>

              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-3 mt-6 pt-4 border-t border-slate-200/70">
                <button
                  type="button"
                  onClick={() => { setTempFilters(defaultFilters); setAppliedFilters(defaultFilters); setPage(1); }}
                  className="px-6 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => { setAppliedFilters(tempFilters); setPage(1); }}
                  className="px-6 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-md shadow-blue-500/20 hover:scale-105"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <DataTable
              columns={COLS}
              data={paginatedPolicies}
              total={filteredPolicies.length}
              page={page}
              pageSize={20}
              loading={isLoading}
              rowKey={r => r.id}
              onPageChange={setPage}
              onRowClick={r => openView(r)}
              onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); setPage(1); }}
            />
          </div>


      <Modal
        open={modalOpen}
        onClose={() => {
          if (isDocUploadModalOpen) return;
          closeModal();
        }}
        title={isViewMode ? "View Policy Profile" : (editTarget ? "Edit Policy Profile" : "Add New Policy")}
        subtitle={isViewMode ? "View policy details and plan information." : (editTarget ? "Update policy details and plan information." : "Enter policy details matching client profile standards.")}
        size="2xl"
        footerActions={
          !isViewMode && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                <Info size={15} className="text-purple-600 shrink-0" />
                <span className="hidden sm:inline">Make sure all details are accurate before saving</span>
              </div>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="policy-proposal-form"
                  disabled={createPolicy.isPending || updatePolicy.isPending}
                  className="px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition-all hover:scale-[1.02] active:scale-98 cursor-pointer flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)',
                    boxShadow: '0 4px 14px rgba(91, 43, 168, 0.4)',
                  }}
                >
                  <Save size={16} />
                  {createPolicy.isPending || updatePolicy.isPending
                    ? (editTarget ? 'Updating Policy...' : 'Submitting Policy...')
                    : editTarget ? 'Update Policy (पॉलिसी अपडेट करा)' : 'Submit Policy (पॉलिसी सबमिट करा)'}
                </button>
              </div>
            </div>
          )
        }
      >
        <form id="policy-proposal-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Sub-navigation 5 Tabs Header */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs custom-scrollbar">
            <button
              type="button"
              onClick={() => setActivePolicyTab('personalProfile')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'personalProfile'
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
              style={activePolicyTab === 'personalProfile' ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
            >
              <User size={14} />
              Personal & Profile Details
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('familyDetails')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'familyDetails'
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
              style={activePolicyTab === 'familyDetails' ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
            >
              <Users size={14} />
              Family Background
            </button>

            <button
              type="button"
              onClick={() => setActivePolicyTab('nomineeDetails')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'nomineeDetails'
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
              style={activePolicyTab === 'nomineeDetails' ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
            >
              <Heart size={14} />
              Nominee Details & Papers
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('kycDocuments')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'kycDocuments'
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
              style={activePolicyTab === 'kycDocuments' ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
            >
              <FileText size={14} />
              KYC & Documents
            </button>
          </div>

          <div className="h-[520px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
            <fieldset disabled={isViewMode} className="min-w-0 border-0 p-0 m-0 w-full space-y-4">
              {/* ════════════════ TAB 1: Personal & Profile Details (Contains ONLY Personal Info) ════════════════ */}
              {activePolicyTab === 'personalProfile' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Personal Information (वैयक्तिक माहिती - Strict 10 Fields) */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-100/80 via-slate-50 to-slate-100/40 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <User size={16} className="text-indigo-600" />
                        Personal Information (वैयक्तिक माहिती)
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setPersonalDetails({
                            fullName: '',
                            phone: '',
                            email: '',
                            dob: '',
                            birthPlace: '',
                            education: '',
                            occupation: '',
                            weight: '',
                            height: '',
                            smokerStatus: 'NON_SMOKER',
                            smokerCount: '',
                            nonSmokerCount: '',
                          });
                          setSelectedContact(null);
                          setValue('contactId', '');
                          toast.success('Personal profile details reset.');
                        }}
                        className="px-2.5 py-1 text-[10px] font-extrabold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Clear Fields
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* 1. नाव (Full Name) */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          नाव (Full Name) <span className="text-red-500 font-black">*</span>
                        </label>
                        <input
                          type="text"
                          value={personalDetails.fullName}
                          onChange={e => {
                            setPersonalDetails(p => ({ ...p, fullName: e.target.value }));
                            if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: '' }));
                          }}
                          placeholder="Enter Client Full Name"
                          className={clsx(
                            "input w-full h-10 text-xs rounded-xl bg-white border focus:ring-2 text-slate-800 font-medium",
                            formErrors.fullName ? "border-rose-500 ring-1 ring-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-purple-500/20"
                          )}
                        />
                        {formErrors.fullName && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.fullName}</p>
                        )}
                      </div>

                      {/* 2. जन्मतारीख (Date of Birth) */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          जन्मतारीख (Date of Birth)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="date"
                            max={new Date().toISOString().split('T')[0]}
                            value={personalDetails.dob}
                            onChange={e => {
                              setPersonalDetails(p => ({ ...p, dob: e.target.value }));
                              if (formErrors.dob) setFormErrors(prev => ({ ...prev, dob: '' }));
                            }}
                            className={clsx(
                              "input w-full h-10 text-xs rounded-xl bg-white border focus:ring-2 cursor-pointer font-medium pr-8",
                              formErrors.dob ? "border-rose-500 ring-1 ring-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-purple-500/20"
                            )}
                          />
                          {personalDetails.dob && (
                            <button
                              type="button"
                              onClick={() => {
                                setPersonalDetails(p => ({ ...p, dob: '' }));
                                if (formErrors.dob) setFormErrors(prev => ({ ...prev, dob: '' }));
                              }}
                              className="absolute right-2.5 text-slate-400 hover:text-rose-500 p-1 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                              title="Clear / Delete Date"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {formErrors.dob && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.dob}</p>
                        )}
                      </div>

                      {/* 3. जन्मस्थळ (Place of Birth) */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          जन्मस्थळ (Place of Birth)
                        </label>
                        <input
                          type="text"
                          value={personalDetails.birthPlace}
                          onChange={e => setPersonalDetails(p => ({ ...p, birthPlace: e.target.value }))}
                          placeholder="e.g. Pune, Maharashtra"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>

                      {/* 4. शिक्षण (Education) - Dropdown & Manual Input */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          शिक्षण (Education)
                        </label>
                        <DatalistInput
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20 font-medium"
                          placeholder="e.g. Graduate, B.Com, MBA"
                          value={personalDetails.education || ''}
                          options={EDUCATION_OPTIONS}
                          onChange={val => setPersonalDetails(p => ({ ...p, education: val }))}
                        />
                      </div>

                      {/* 5. व्यवसाय / नोकरी (Occupation / Job) - Dropdown & Manual Input */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          व्यवसाय / नोकरी (Occupation / Job)
                        </label>
                        <DatalistInput
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20 font-medium"
                          placeholder="e.g. Business, Salaried, Engineer, Teacher"
                          value={personalDetails.occupation || ''}
                          options={OCCUPATION_OPTIONS}
                          onChange={val => setPersonalDetails(p => ({ ...p, occupation: val }))}
                        />
                      </div>

                      {/* 6. मोबाईल नंबर (Mobile Number) */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          मोबाईल नंबर (Mobile Number) <span className="text-red-500 font-black">*</span>
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          value={personalDetails.phone}
                          onChange={e => {
                            const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPersonalDetails(p => ({ ...p, phone: digitsOnly }));
                            if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                          }}
                          placeholder="Enter 10-digit mobile number"
                          className={clsx(
                            "input w-full h-10 text-xs rounded-xl bg-white border focus:ring-2 text-slate-800 font-mono tracking-wider",
                            formErrors.phone ? "border-rose-500 ring-1 ring-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-purple-500/20"
                          )}
                        />
                        {formErrors.phone && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.phone}</p>
                        )}
                      </div>

                      {/* 7. ई-मेल (Email Address) */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          ई-मेल (Email Address)
                        </label>
                        <input
                          type="email"
                          value={personalDetails.email}
                          onChange={e => {
                            setPersonalDetails(p => ({ ...p, email: e.target.value }));
                            if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                          }}
                          placeholder="client.name@example.com"
                          className={clsx(
                            "input w-full h-10 text-xs rounded-xl bg-white border focus:ring-2",
                            formErrors.email ? "border-rose-500 ring-1 ring-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-purple-500/20"
                          )}
                        />
                        {formErrors.email && (
                          <p className="text-[11px] text-rose-500 font-bold mt-1 animate-fadeIn">{formErrors.email}</p>
                        )}
                      </div>

                      {/* 8. वजन (Weight) */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          वजन (Weight in kg)
                        </label>
                        <input
                          type="number"
                          value={personalDetails.weight}
                          onChange={e => setPersonalDetails(p => ({ ...p, weight: e.target.value }))}
                          placeholder="e.g. 72 kg"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20 font-semibold"
                        />
                      </div>

                      {/* 9. उंची (Height) */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          उंची (Height in cm / ft)
                        </label>
                        <input
                          type="text"
                          value={personalDetails.height}
                          onChange={e => setPersonalDetails(p => ({ ...p, height: e.target.value }))}
                          placeholder="e.g. 175 cm (5 ft 9 in)"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20 font-semibold"
                        />
                      </div>

                      {/* 10. धूम्रपान करतात / करत नाहीत (Smoking Status) */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          धूम्रपान करतात / करत नाहीत (Smoking Status)
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setPersonalDetails(p => ({ ...p, smokerStatus: 'NON_SMOKER' }))}
                            className={clsx(
                              'py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5',
                              personalDetails.smokerStatus === 'NON_SMOKER'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            )}
                          >
                            🚭 धूम्रपान करत नाहीत (Non-Smoker)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPersonalDetails(p => ({ ...p, smokerStatus: 'SMOKER' }))}
                            className={clsx(
                              'py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5',
                              personalDetails.smokerStatus === 'SMOKER'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            )}
                          >
                            🚬 धूम्रपान करतात (Smoker)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════ TAB 2: Family Background (कौटुंबिक माहिती - Exact Fields) ════════════════ */}
              {activePolicyTab === 'familyDetails' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* 1. वडील (Father) */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-50/60 via-slate-50 to-slate-100/40 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <User size={15} className="text-blue-600" />
                          वडील (Father Details)
                        </h4>
                      </div>

                      <div className="p-3.5 space-y-2.5">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            नाव (Father Name)
                          </label>
                          <input
                            type="text"
                            value={familyDetails.fatherName}
                            onChange={e => setFamilyDetails(f => ({ ...f, fatherName: e.target.value }))}
                            placeholder="वडिलांचे नाव"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              वय (Age)
                            </label>
                            <input
                              type="number"
                              value={familyDetails.fatherAge}
                              onChange={e => setFamilyDetails(f => ({ ...f, fatherAge: e.target.value }))}
                              placeholder="वय"
                              className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              हयात आहेत / नाहीत
                            </label>
                            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setFamilyDetails(f => ({ ...f, fatherStatus: 'ALIVE' }))}
                                className={clsx(
                                  'py-1 px-1 rounded-lg text-[10px] font-extrabold transition-all text-center cursor-pointer',
                                  familyDetails.fatherStatus === 'ALIVE' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                                )}
                              >
                                हयात आहेत
                              </button>
                              <button
                                type="button"
                                onClick={() => setFamilyDetails(f => ({ ...f, fatherStatus: 'DECEASED' }))}
                                className={clsx(
                                  'py-1 px-1 rounded-lg text-[10px] font-extrabold transition-all text-center cursor-pointer',
                                  familyDetails.fatherStatus === 'DECEASED' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600'
                                )}
                              >
                                हयात नाहीत
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. आई (Mother) */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div className="bg-gradient-to-r from-pink-50/60 via-slate-50 to-slate-100/40 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Heart size={15} className="text-pink-600" />
                          आई (Mother Details)
                        </h4>
                      </div>

                      <div className="p-3.5 space-y-2.5">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            नाव (Mother Name)
                          </label>
                          <input
                            type="text"
                            value={familyDetails.motherName}
                            onChange={e => setFamilyDetails(f => ({ ...f, motherName: e.target.value }))}
                            placeholder="आईचे नाव"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              वय (Age)
                            </label>
                            <input
                              type="number"
                              value={familyDetails.motherAge}
                              onChange={e => setFamilyDetails(f => ({ ...f, motherAge: e.target.value }))}
                              placeholder="वय"
                              className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              हयात आहेत / नाहीत
                            </label>
                            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setFamilyDetails(f => ({ ...f, motherStatus: 'ALIVE' }))}
                                className={clsx(
                                  'py-1 px-1 rounded-lg text-[10px] font-extrabold transition-all text-center cursor-pointer',
                                  familyDetails.motherStatus === 'ALIVE' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                                )}
                              >
                                हयात आहेत
                              </button>
                              <button
                                type="button"
                                onClick={() => setFamilyDetails(f => ({ ...f, motherStatus: 'DECEASED' }))}
                                className={clsx(
                                  'py-1 px-1 rounded-lg text-[10px] font-extrabold transition-all text-center cursor-pointer',
                                  familyDetails.motherStatus === 'DECEASED' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600'
                                )}
                              >
                                हयात नाहीत
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. पत्नी (Wife / Spouse) */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-50/60 via-slate-50 to-slate-100/40 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Users size={15} className="text-purple-600" />
                          पत्नी (Wife Details)
                        </h4>
                      </div>

                      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            नाव (Spouse Name)
                          </label>
                          <input
                            type="text"
                            value={familyDetails.spouseName}
                            onChange={e => setFamilyDetails(f => ({ ...f, spouseName: e.target.value }))}
                            placeholder="पत्नीचे नाव"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            जन्मतारीख (Date of Birth)
                          </label>
                          <input
                            type="date"
                            value={familyDetails.spouseDob}
                            onChange={e => setFamilyDetails(f => ({ ...f, spouseDob: e.target.value }))}
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. भाऊ (Brother) */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-50/60 via-slate-50 to-slate-100/40 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <User size={15} className="text-indigo-600" />
                          भाऊ (Brother Details)
                        </h4>
                      </div>

                      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            नाव (Brother Name)
                          </label>
                          <input
                            type="text"
                            value={familyDetails.brotherName}
                            onChange={e => setFamilyDetails(f => ({ ...f, brotherName: e.target.value }))}
                            placeholder="भावाचे नाव"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            वय (Age)
                          </label>
                          <input
                            type="number"
                            value={familyDetails.brotherAge}
                            onChange={e => setFamilyDetails(f => ({ ...f, brotherAge: e.target.value }))}
                            placeholder="वय"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 5. बहिण (Sister) */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-50/60 via-slate-50 to-slate-100/40 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <User size={15} className="text-amber-600" />
                          बहिण (Sister Details)
                        </h4>
                      </div>

                      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            नाव (Sister Name)
                          </label>
                          <input
                            type="text"
                            value={familyDetails.sisterName}
                            onChange={e => setFamilyDetails(f => ({ ...f, sisterName: e.target.value }))}
                            placeholder="बहिणीचे नाव"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            वय (Age)
                          </label>
                          <input
                            type="number"
                            value={familyDetails.sisterAge}
                            onChange={e => setFamilyDetails(f => ({ ...f, sisterAge: e.target.value }))}
                            placeholder="वय"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 6. मुले (Children) */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div className="bg-gradient-to-r from-teal-50/60 via-slate-50 to-slate-100/40 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Users size={15} className="text-teal-600" />
                          मुले (Children Details)
                        </h4>
                      </div>

                      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            नाव (Child Name)
                          </label>
                          <input
                            type="text"
                            value={familyDetails.childrenName}
                            onChange={e => setFamilyDetails(f => ({ ...f, childrenName: e.target.value }))}
                            placeholder="मुलाचे नाव"
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            जन्मतारीख (Date of Birth)
                          </label>
                          <input
                            type="date"
                            value={familyDetails.childrenDob}
                            onChange={e => setFamilyDetails(f => ({ ...f, childrenDob: e.target.value }))}
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {/* ════════════════ TAB 4: Nominee Details & Papers ════════════════ */}
              {activePolicyTab === 'nomineeDetails' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Nominee Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-50/70 via-slate-50 to-pink-50/40 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Heart size={16} className="text-purple-600" />
                        Nominee Details (नॉमिनी तपशील)
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">नॉमिनी नाव (१ - ४)</span>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {[1, 2, 3, 4].map(num => (
                        <div key={num} className="p-3 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-1">
                          <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                            नाॉमिनी {num} नाव (Nominee #{num} Name)
                          </label>
                          <input
                            type="text"
                            value={nominees.find(n => n.id === num)?.name || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setNominees(prev => {
                                const exists = prev.some(n => n.id === num);
                                if (exists) return prev.map(n => n.id === num ? { ...n, name: val } : n);
                                return [...prev, { id: num, name: val }];
                              });
                            }}
                            placeholder={`Nominee ${num} Name`}
                            className="input w-full h-9 text-xs rounded-lg bg-white border border-slate-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nominee Verification Papers */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={16} className="text-blue-600" />
                        Nominee Documents (नाॉमिनी paper - आधार कार्ड, बँक डिटेल)
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Nominee KYC Proofs</span>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nominee Aadhaar */}
                      <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                        <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                          Nominee Aadhaar Card Number & Upload (नाॉमिनी आधार कार्ड)
                        </label>
                        <input
                          type="text"
                          maxLength={12}
                          value={nomineePapers.aadhaarNumber}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setNomineePapers(p => ({ ...p, aadhaarNumber: digits }));
                            if (formErrors.nomineeAadhaar) setFormErrors(prev => ({ ...prev, nomineeAadhaar: '' }));
                          }}
                          placeholder="12-digit Aadhaar No."
                          className={clsx(
                            "input w-full h-9 text-xs font-mono rounded-lg bg-white border mb-1",
                            formErrors.nomineeAadhaar ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-200"
                          )}
                        />
                        {formErrors.nomineeAadhaar && (
                          <p className="text-[11px] text-rose-500 font-bold mb-2">{formErrors.nomineeAadhaar}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs">
                            <Upload size={13} /> Select Aadhaar Card File
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) setNomineePapers(p => ({ ...p, aadhaarFileName: f.name }));
                              }}
                              className="hidden"
                            />
                          </label>
                          {nomineePapers.aadhaarFileName ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold truncate">
                              <span>{nomineePapers.aadhaarFileName}</span>
                              <button
                                type="button"
                                onClick={() => setNomineePapers(p => ({ ...p, aadhaarFileName: '' }))}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                title="Remove File"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">No file chosen</span>
                          )}
                        </div>
                      </div>

                      {/* Nominee Bank Details */}
                      <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                        <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                          Nominee Bank Details & Passbook Upload (नाॉमिनी बँक डिटेल)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={nomineePapers.bankName}
                            onChange={e => setNomineePapers(p => ({ ...p, bankName: e.target.value }))}
                            placeholder="Bank Name (e.g. HDFC Bank)"
                            className="input w-full h-8 text-xs rounded-lg bg-white border border-slate-200"
                          />
                          <input
                            type="text"
                            value={nomineePapers.accountNumber}
                            onChange={e => setNomineePapers(p => ({ ...p, accountNumber: e.target.value }))}
                            placeholder="Account Number"
                            className="input w-full h-8 text-xs font-mono rounded-lg bg-white border border-slate-200"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs">
                            <Upload size={13} /> Select Passbook/Cheque File
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) setNomineePapers(p => ({ ...p, passbookFileName: f.name }));
                              }}
                              className="hidden"
                            />
                          </label>
                          {nomineePapers.passbookFileName ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold truncate">
                              <span>{nomineePapers.passbookFileName}</span>
                              <button
                                type="button"
                                onClick={() => setNomineePapers(p => ({ ...p, passbookFileName: '' }))}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                title="Remove File"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">No file chosen</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════ TAB 4: KYC & Documents ════════════════ */}
              {activePolicyTab === 'kycDocuments' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Client ID Proofs: Aadhaar & PAN */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={16} className="text-blue-600" />
                        Client Identity Proofs (आधार कार्ड व पॅन कार्ड)
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">KYC Identification Documents</span>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Aadhaar Card */}
                      <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                        <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                          Client Aadhaar Card (आधार कार्ड)
                        </label>
                        <input
                          type="text"
                          maxLength={12}
                          value={kycDocuments.aadhaarNumber}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setKycDocuments(k => ({ ...k, aadhaarNumber: digits }));
                            if (formErrors.aadhaarNumber) setFormErrors(prev => ({ ...prev, aadhaarNumber: '' }));
                          }}
                          placeholder="12-digit Aadhaar No."
                          className={clsx(
                            "input w-full h-9 text-xs font-mono rounded-lg bg-white border",
                            formErrors.aadhaarNumber ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-200"
                          )}
                        />
                        {formErrors.aadhaarNumber && (
                          <p className="text-[11px] text-rose-500 font-bold">{formErrors.aadhaarNumber}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs">
                            <Upload size={13} /> Upload Aadhaar Card
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) setKycDocuments(k => ({ ...k, aadhaarFileName: f.name }));
                              }}
                              className="hidden"
                            />
                          </label>
                          {kycDocuments.aadhaarFileName ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold truncate">
                              <span>{kycDocuments.aadhaarFileName}</span>
                              <button
                                type="button"
                                onClick={() => setKycDocuments(k => ({ ...k, aadhaarFileName: '' }))}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                title="Remove File"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">No file chosen</span>
                          )}
                        </div>
                      </div>

                      {/* PAN Card */}
                      <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                        <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                          Client PAN Card (पॅन कार्ड)
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={kycDocuments.panNumber}
                          onChange={e => {
                            const upper = e.target.value.toUpperCase().slice(0, 10);
                            setKycDocuments(k => ({ ...k, panNumber: upper }));
                            if (formErrors.panNumber) setFormErrors(prev => ({ ...prev, panNumber: '' }));
                          }}
                          placeholder="PAN No. (e.g. ABCDE1234F)"
                          className={clsx(
                            "input w-full h-9 text-xs font-mono uppercase rounded-lg bg-white border",
                            formErrors.panNumber ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-200"
                          )}
                        />
                        {formErrors.panNumber && (
                          <p className="text-[11px] text-rose-500 font-bold">{formErrors.panNumber}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs">
                            <Upload size={13} /> Upload PAN Card
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) setKycDocuments(k => ({ ...k, panFileName: f.name }));
                              }}
                              className="hidden"
                            />
                          </label>
                          {kycDocuments.panFileName ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold truncate">
                              <span>{kycDocuments.panFileName}</span>
                              <button
                                type="button"
                                onClick={() => setKycDocuments(k => ({ ...k, panFileName: '' }))}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                title="Remove File"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">No file chosen</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Client Bank Account Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-50/60 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <CreditCard size={16} className="text-emerald-600" />
                        Client Bank Details (बँक डिटेल)
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Bank Account & Passbook</span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="label text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Bank Name
                          </label>
                          <input
                            type="text"
                            value={kycDocuments.bankName}
                            onChange={e => setKycDocuments(k => ({ ...k, bankName: e.target.value }))}
                            placeholder="e.g. State Bank of India"
                            className="input w-full h-9 text-xs rounded-lg bg-white border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="label text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={kycDocuments.accountNumber}
                            onChange={e => setKycDocuments(k => ({ ...k, accountNumber: e.target.value }))}
                            placeholder="e.g. 38492019481"
                            className="input w-full h-9 text-xs font-mono rounded-lg bg-white border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="label text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={kycDocuments.ifscCode}
                            onChange={e => setKycDocuments(k => ({ ...k, ifscCode: e.target.value.toUpperCase() }))}
                            placeholder="e.g. SBIN0001234"
                            className="input w-full h-9 text-xs font-mono uppercase rounded-lg bg-white border border-slate-200"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs">
                          <Upload size={13} /> Upload Bank Passbook / Cheque
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) setKycDocuments(k => ({ ...k, passbookFileName: f.name }));
                            }}
                            className="hidden"
                          />
                        </label>
                        {kycDocuments.passbookFileName ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold truncate">
                            <span>{kycDocuments.passbookFileName}</span>
                            <button
                              type="button"
                              onClick={() => setKycDocuments(k => ({ ...k, passbookFileName: '' }))}
                              className="text-rose-500 hover:bg-rose-50 p-1 rounded cursor-pointer"
                              title="Remove File"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">No file chosen</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Income Proofs: 3 Years ITR & 3 Months Salary Slips */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-50/60 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={16} className="text-purple-600" />
                        Income Proofs (3 वर्षाचे ITR व 3 महिन्याचे सॅलरी स्लिप)
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Income Verification Files</span>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 3 Years ITR */}
                      <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                        <label className="label text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                          3 Years Income Tax Returns (3 वर्षाचे ITR)
                        </label>
                        <div className="space-y-2">
                          {[
                            { lbl: 'ITR Year 1 (Latest FY)', key: 'itr1FileName' as const },
                            { lbl: 'ITR Year 2 (Previous FY)', key: 'itr2FileName' as const },
                            { lbl: 'ITR Year 3 (Prior FY)', key: 'itr3FileName' as const },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-2 border border-slate-200 rounded-lg">
                              <div>
                                <span className="text-[11px] font-bold text-slate-700 block">{item.lbl}</span>
                                {kycDocuments[item.key] ? (
                                  <span className="text-[10px] text-blue-600 font-semibold">{kycDocuments[item.key]}</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Not uploaded</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <label className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-extrabold rounded-md cursor-pointer flex items-center gap-1">
                                  <Upload size={12} /> {kycDocuments[item.key] ? 'Change' : 'Upload'}
                                  <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={e => {
                                      const f = e.target.files?.[0];
                                      if (f) setKycDocuments(k => ({ ...k, [item.key]: f.name }));
                                    }}
                                    className="hidden"
                                  />
                                </label>
                                {kycDocuments[item.key] && (
                                  <button
                                    type="button"
                                    onClick={() => setKycDocuments(k => ({ ...k, [item.key]: '' }))}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                    title="Delete File"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 3 Months Salary Slips */}
                      <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                        <label className="label text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                          3 Months Salary Slips (तीन महिन्याचे सॅलरी स्लिप)
                        </label>
                        <div className="space-y-2">
                          {[
                            { lbl: 'Salary Slip - Month 1', key: 'salarySlip1FileName' as const },
                            { lbl: 'Salary Slip - Month 2', key: 'salarySlip2FileName' as const },
                            { lbl: 'Salary Slip - Month 3', key: 'salarySlip3FileName' as const },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-2 border border-slate-200 rounded-lg">
                              <div>
                                <span className="text-[11px] font-bold text-slate-700 block">{item.lbl}</span>
                                {kycDocuments[item.key] ? (
                                  <span className="text-[10px] text-emerald-600 font-semibold">{kycDocuments[item.key]}</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Not uploaded</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <label className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-extrabold rounded-md cursor-pointer flex items-center gap-1">
                                  <Upload size={12} /> {kycDocuments[item.key] ? 'Change' : 'Upload'}
                                  <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={e => {
                                      const f = e.target.files?.[0];
                                      if (f) setKycDocuments(k => ({ ...k, [item.key]: f.name }));
                                    }}
                                    className="hidden"
                                  />
                                </label>
                                {kycDocuments[item.key] && (
                                  <button
                                    type="button"
                                    onClick={() => setKycDocuments(k => ({ ...k, [item.key]: '' }))}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                    title="Delete File"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>



                  {/* Previous Life & Private Insurance Policies (Simple Unified List 1 to 7) */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Shield size={16} className="text-blue-600" />
                        जुने जीवन विमा पाॅलीसी नंबर- (LIC व खाजगी विमा)
                      </h4>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7].map(num => {
                        const targetId = String(num);
                        const pol = existingPolicies.find(p => p.id === targetId) || { id: targetId, policyNumber: '', insurerName: num <= 4 ? 'LIC of India' : 'खाजगी विमा' };
                        return (
                          <div key={num} className="p-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-600 shrink-0 w-5">{num})</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                              <select
                                value={pol.insurerName}
                                onChange={e => {
                                  const val = e.target.value;
                                  setExistingPolicies(prev => {
                                    const exists = prev.some(p => p.id === targetId);
                                    if (exists) return prev.map(p => p.id === targetId ? { ...p, insurerName: val } : p);
                                    return [...prev, { id: targetId, insurerName: val, policyNumber: '' }];
                                  });
                                }}
                                className="input w-full h-8 text-xs font-mono rounded-lg bg-white border border-slate-200"
                              >
                                <option value="LIC of India">LIC of India</option>
                                <option value="खाजगी विमा">खाजगी विमा</option>
                              </select>
                              <input
                                type="text"
                                value={pol.policyNumber}
                                onChange={e => {
                                  const val = e.target.value;
                                  setExistingPolicies(prev => {
                                    const exists = prev.some(p => p.id === targetId);
                                    if (exists) return prev.map(p => p.id === targetId ? { ...p, policyNumber: val } : p);
                                    return [...prev, { id: targetId, insurerName: pol.insurerName || 'LIC of India', policyNumber: val }];
                                  });
                                }}
                                placeholder="पॉलसी नंबर"
                                className="input w-full h-8 text-xs font-mono rounded-lg bg-white border border-slate-200"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </fieldset>
          </div>




        </form>
      </Modal>


      {/* Document Upload Modal */}
      <Modal
        open={isDocUploadModalOpen}
        onClose={() => {
          setIsDocUploadModalOpen(false);
          setDocUploadFields({ type: 'POLICY', title: '', description: '', file: null });
        }}
        title="Upload Document"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Document Type <span className="text-red-500">*</span></label>
            <select
              value={docUploadFields.type}
              onChange={e => setDocUploadFields(p => ({ ...p, type: e.target.value }))}
              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
            >
              <option value="POLICY">Main Policy</option>
              <option value="ENDORSEMENT">Endorsement</option>
              <option value="KYC">KYC Document</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Document Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={docUploadFields.title}
              onChange={e => setDocUploadFields(p => ({ ...p, title: e.target.value }))}
              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              placeholder="e.g. Policy Schedule 2024"
            />
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
            <textarea
              rows={2}
              value={docUploadFields.description}
              onChange={e => setDocUploadFields(p => ({ ...p, description: e.target.value }))}
              className="input w-full p-2.5 text-xs rounded-xl bg-white border border-slate-200"
              placeholder="Optional notes about this document"
            />
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Choose File <span className="text-red-500">*</span></label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-colors">
              <input
                type="file"
                onChange={e => setDocUploadFields(p => ({ ...p, file: e.target.files?.[0] || null }))}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="btn-secondary px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDocUploadModalOpen(false);
                setDocUploadFields({ type: 'POLICY', title: '', description: '', file: null });
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDocUploadAdd();
              }}
            >
              Upload
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Policy" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete policy <strong>{deleteTarget?.policyNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete} disabled={deletePolicy.isPending}>
            {deletePolicy.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
