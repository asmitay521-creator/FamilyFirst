import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Plus, X, User, FileText, Pencil, Trash2, Upload, Search, Filter,
  MessageCircle, Calendar, Shield, Heart, MapPin, Briefcase, UserCircle2,
  FileCheck2, ShieldCheck, Clock, ChevronDown, LayoutGrid, List
} from 'lucide-react';
import { useClaims, useCreateClaim, useUpdateClaimStatus, useDeleteClaim } from '@hooks/useClaims';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, claimsService, documentsService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';

import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { DatePicker } from '@comps/common/DatePicker';
import { useLookupStore } from '@store/lookup.store';
import clsx from 'clsx';
import { useAuthStore } from '@store/auth.store';
import { deletionRequestsService } from '@api/deletionRequestsService';
import { sortData } from '../../utils/sortUtils';
import { insuranceService } from '@api/index';

interface Claim {
  id: string; claimNumber: string; status: string; claimType: string;
  claimAmount: number; intimatedAt: string;
  approvedAmount?: number; rejectionReason?: string;
  contact?: { id: string; firstName: string; lastName: string; phone: string; email?: string };
  policy?: { id: string; policyNumber: string; plan?: { name: string } };
  assignedEmployeeId?: string | null;
  notes?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  INTIMATED: 'bg-blue-50 text-blue-700 border-blue-200',
  DOC_COLLECTION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FILED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SETTLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const UI_STATUSES = ["Pending", "In Progress", "Approved", "Rejected", "Settled"];

const BACKEND_TO_UI: Record<string, string> = {
  INTIMATED: 'Pending',
  DOC_COLLECTION: 'Pending',
  FILED: 'Pending',
  IN_REVIEW: 'In Progress',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SETTLED: 'Settled',
};

const UI_TO_BACKEND: Record<string, string> = {
  Pending: 'FILED',
  'In Progress': 'IN_REVIEW',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Settled: 'SETTLED',
};

export function getClaimNotesData(notesField?: string | null) {
  const defaultNotes = { 
    diagnosis: '', hospital: '', hospitalAddress: '', patientName: '', deductionsNotes: '', admissionAt: '', dischargeAt: '', notes: '', statusOverride: '', amtHospital: 0, amtMedicine: 0, amtLab: 0, amtPreHosp: 0, amtPostHosp: 0, amtOthers: 0, subClaimNo: '', uiClaimStatus: '', comment: '', insuranceCompanyCategory: '', insuranceCompany: '', insuranceProductName: '', agentName: '',
    deathAdmissionDate: '', causeOfDeath: '', dateOfOccurance: '', dateOfDeath: '', wasInComa: '', deathSumInsured: '', deathTotalClaimedAmount: '', deathComment: '', nominees: '[]',
    hospitalName: '', hospitalState: '', hospitalCity: '', hospitalPincode: '', hospitalContactNo: '', hospitalRating: '', hospitalType: '', claimsPerson1Name: '', claimsPerson1Contact: '', claimsPerson2Name: '', claimsPerson2Contact: '', hospitalComment: '', hospitalDoctors: '[]',
    diagnosisSimple: '', roomCategory: '', typeOfManagement: '', typeOfAdmission: '', isMedicoLegalCase: '', hospitalisationComment: '', amtAnesthesia: 0, billingComment: '',
    amtFinalBill: 0, amtNonPayables: 0, amtCopay: 0, amtDeductible: 0, amtBalanceEMIs: 0, amtNcdRecovery: 0, amtExcessSumInsured: 0, amtExcessAilmentLimit: 0, amtHigherRoomRent: 0, amtReasonableCost: 0, amtOtherRecoveries: 0, amtPatientToPay: 0, amtExcessAgreedPackage: 0, amtNetworkDiscount: 0, amtNotCollected: 0, amtPayableToInsured: 0, approvalComment: '', fileUploadComment: ''
  };
  if (!notesField) return defaultNotes;
  try {
    if (notesField.trim().startsWith('{')) {
      const parsed = JSON.parse(notesField);
      return {
        ...defaultNotes,
        diagnosis: parsed.diagnosis || '',
        hospital: parsed.hospital || '',
        hospitalAddress: parsed.hospitalAddress || '',
        patientName: parsed.patientName || '',
        deductionsNotes: parsed.deductionsNotes || '',
        admissionAt: parsed.admissionAt || '',
        dischargeAt: parsed.dischargeAt || '',
        notes: parsed.notes || '',
        statusOverride: parsed.statusOverride || '',
        amtHospital: Number(parsed.amtHospital || 0),
        amtMedicine: Number(parsed.amtMedicine || 0),
        amtLab: Number(parsed.amtLab || 0),
        amtPreHosp: Number(parsed.amtPreHosp || 0),
        amtPostHosp: Number(parsed.amtPostHosp || 0),
        amtOthers: Number(parsed.amtOthers || 0),
        subClaimNo: parsed.subClaimNo || '',
        uiClaimStatus: parsed.uiClaimStatus || '',
        comment: parsed.comment || '',
        insuranceCompanyCategory: parsed.insuranceCompanyCategory || '',
        insuranceCompany: parsed.insuranceCompany || '',
        insuranceProductName: parsed.insuranceProductName || '',
        agentName: parsed.agentName || '',
        deathAdmissionDate: parsed.deathAdmissionDate || '',
        causeOfDeath: parsed.causeOfDeath || '',
        dateOfOccurance: parsed.dateOfOccurance || '',
        dateOfDeath: parsed.dateOfDeath || '',
        wasInComa: parsed.wasInComa || '',
        deathSumInsured: parsed.deathSumInsured || '',
        deathTotalClaimedAmount: parsed.deathTotalClaimedAmount || '',
        deathComment: parsed.deathComment || '',
        nominees: Array.isArray(parsed.nominees) ? JSON.stringify(parsed.nominees) : (typeof parsed.nominees === 'string' ? parsed.nominees : '[]'),
        hospitalName: parsed.hospitalName || '',
        hospitalState: parsed.hospitalState || '',
        hospitalCity: parsed.hospitalCity || '',
        hospitalPincode: parsed.hospitalPincode || '',
        hospitalContactNo: parsed.hospitalContactNo || '',
        hospitalRating: parsed.hospitalRating || '',
        hospitalType: parsed.hospitalType || '',
        claimsPerson1Name: parsed.claimsPerson1Name || '',
        claimsPerson1Contact: parsed.claimsPerson1Contact || '',
        claimsPerson2Name: parsed.claimsPerson2Name || '',
        claimsPerson2Contact: parsed.claimsPerson2Contact || '',
        hospitalComment: parsed.hospitalComment || '',
        hospitalDoctors: Array.isArray(parsed.hospitalDoctors) ? JSON.stringify(parsed.hospitalDoctors) : (typeof parsed.hospitalDoctors === 'string' ? parsed.hospitalDoctors : '[]'),
        diagnosisSimple: parsed.diagnosisSimple || '',
        roomCategory: parsed.roomCategory || '',
        typeOfManagement: parsed.typeOfManagement || '',
        typeOfAdmission: parsed.typeOfAdmission || '',
        isMedicoLegalCase: parsed.isMedicoLegalCase || '',
        hospitalisationComment: parsed.hospitalisationComment || '',
        amtAnesthesia: Number(parsed.amtAnesthesia || 0),
        billingComment: parsed.billingComment || '',
        amtFinalBill: Number(parsed.amtFinalBill || 0),
        amtNonPayables: Number(parsed.amtNonPayables || 0),
        amtCopay: Number(parsed.amtCopay || 0),
        amtDeductible: Number(parsed.amtDeductible || 0),
        amtBalanceEMIs: Number(parsed.amtBalanceEMIs || 0),
        amtNcdRecovery: Number(parsed.amtNcdRecovery || 0),
        amtExcessSumInsured: Number(parsed.amtExcessSumInsured || 0),
        amtExcessAilmentLimit: Number(parsed.amtExcessAilmentLimit || 0),
        amtHigherRoomRent: Number(parsed.amtHigherRoomRent || 0),
        amtReasonableCost: Number(parsed.amtReasonableCost || 0),
        amtOtherRecoveries: Number(parsed.amtOtherRecoveries || 0),
        amtPatientToPay: Number(parsed.amtPatientToPay || 0),
        amtExcessAgreedPackage: Number(parsed.amtExcessAgreedPackage || 0),
        amtNetworkDiscount: Number(parsed.amtNetworkDiscount || 0),
        amtNotCollected: Number(parsed.amtNotCollected || 0),
        amtPayableToInsured: Number(parsed.amtPayableToInsured || 0),
        approvalComment: parsed.approvalComment || '',
        fileUploadComment: parsed.fileUploadComment || ''
      };
    }
  } catch (e) {
    // ignore
  }
  return { ...defaultNotes, notes: notesField };
}

export function serializeNotes(data: any) {
  return JSON.stringify(data);
}

const schema = z.object({
  policyId: z.string().optional().or(z.literal('')),
  contactId: z.string().optional().or(z.literal('')),
  claimNumber: z.string().optional().or(z.literal('')),
  claimType: z.string().optional().or(z.literal('')).default('Cashless'),
  claimAmount: z.union([z.number(), z.string()]).optional(),
  intimatedAt: z.string().optional().or(z.literal('')),
  assignedEmployeeId: z.string().optional().or(z.literal('')),
  diagnosis: z.string().optional(),
  hospital: z.string().optional(),
  hospitalAddress: z.string().optional(),
  patientName: z.string().optional(),
  admissionAt: z.string().optional(),
  dischargeAt: z.string().optional(),
  amtHospital: z.union([z.number(), z.string()]).optional().default(0),
  amtMedicine: z.union([z.number(), z.string()]).optional().default(0),
  amtLab: z.union([z.number(), z.string()]).optional().default(0),
  amtPreHosp: z.union([z.number(), z.string()]).optional().default(0),
  amtPostHosp: z.union([z.number(), z.string()]).optional().default(0),
  amtOthers: z.union([z.number(), z.string()]).optional().default(0),
  notes: z.string().optional(),
  approvedAmount: z.union([z.number(), z.string()]).optional().default(0),
  deductionsNotes: z.string().optional(),
  subClaimNo: z.string().optional(),
  uiClaimStatus: z.string().optional(),
  comment: z.string().optional(),
  insuranceCompanyCategory: z.string().optional(),
  insuranceCompany: z.string().optional(),
  insuranceProductName: z.string().optional(),
  agentName: z.string().optional(),
  deathAdmissionDate: z.string().optional(),
  causeOfDeath: z.string().optional(),
  dateOfOccurance: z.string().optional(),
  dateOfDeath: z.string().optional(),
  wasInComa: z.string().optional(),
  deathSumInsured: z.string().optional(),
  deathTotalClaimedAmount: z.string().optional(),
  deathComment: z.string().optional(),
  hospitalName: z.string().optional(),
  hospitalState: z.string().optional(),
  hospitalCity: z.string().optional(),
  hospitalPincode: z.string().optional(),
  hospitalContactNo: z.string().optional(),
  hospitalRating: z.string().optional(),
  hospitalType: z.string().optional(),
  claimsPerson1Name: z.string().optional(),
  claimsPerson1Contact: z.string().optional(),
  claimsPerson2Name: z.string().optional(),
  claimsPerson2Contact: z.string().optional(),
  hospitalComment: z.string().optional(),
  diagnosisSimple: z.string().optional(),
  roomCategory: z.string().optional(),
  typeOfManagement: z.string().optional(),
  typeOfAdmission: z.string().optional(),
  isMedicoLegalCase: z.string().optional(),
  hospitalisationComment: z.string().optional(),
  amtAnesthesia: z.union([z.number(), z.string()]).optional().default(0),
  billingComment: z.string().optional(),
  amtFinalBill: z.union([z.number(), z.string()]).optional().default(0),
  amtNonPayables: z.union([z.number(), z.string()]).optional().default(0),
  amtCopay: z.union([z.number(), z.string()]).optional().default(0),
  amtDeductible: z.union([z.number(), z.string()]).optional().default(0),
  amtBalanceEMIs: z.union([z.number(), z.string()]).optional().default(0),
  amtNcdRecovery: z.union([z.number(), z.string()]).optional().default(0),
  amtExcessSumInsured: z.union([z.number(), z.string()]).optional().default(0),
  amtExcessAilmentLimit: z.union([z.number(), z.string()]).optional().default(0),
  amtHigherRoomRent: z.union([z.number(), z.string()]).optional().default(0),
  amtReasonableCost: z.union([z.number(), z.string()]).optional().default(0),
  amtOtherRecoveries: z.union([z.number(), z.string()]).optional().default(0),
  amtPatientToPay: z.union([z.number(), z.string()]).optional().default(0),
  amtExcessAgreedPackage: z.union([z.number(), z.string()]).optional().default(0),
  amtNetworkDiscount: z.union([z.number(), z.string()]).optional().default(0),
  amtNotCollected: z.union([z.number(), z.string()]).optional().default(0),
  amtPayableToInsured: z.union([z.number(), z.string()]).optional().default(0),
  approvalComment: z.string().optional(),
  fileUploadComment: z.string().optional()
});
type Form = z.infer<typeof schema>;

// ── Custom File Upload Display Component (Distinct Highlighted Badge) ────────────
function FileUploadCard({
  label,
  file,
  onFileChange,
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx"
}: {
  label: string;
  file: File | null;
  onFileChange: (f: File | null) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
        {label}
      </label>
      <input
        type="file"
        ref={inputRef}
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        accept={accept}
        className="hidden"
      />

      {file ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50/80 to-emerald-50 border-2 border-emerald-400 shadow-sm transition-all animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-emerald-950 truncate" title={file.name}>
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                  {formatBytes(file.size)}
                </span>
                <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">
                  ✓ Ready to upload
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-2 py-1 text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => {
                onFileChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Remove File"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-between p-2.5 rounded-xl border border-dashed border-slate-300 hover:border-purple-500 bg-slate-50/70 hover:bg-purple-50/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-2">
            <Upload size={14} className="text-slate-400 group-hover:text-purple-600 transition-colors" />
            <span className="text-xs font-semibold text-slate-600 group-hover:text-purple-700">
              Choose File (PDF, Images)
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 group-hover:text-purple-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
            Browse
          </span>
        </div>
      )}
    </div>
  );
}

// Aligned edit form with automatic calculations
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

function ClaimEditForm({ initial, isPending, onSave, onCancel, employees }: {
  initial: Claim; isPending: boolean;
  onSave: (body: any, files?: any) => void; onCancel: () => void;
  employees: any[];
}) {
  const user = useAuthStore(s => s.user);
  const notesData = getClaimNotesData(initial.notes);
  const [claimType, setClaimType] = useState((initial as any).claimType ?? 'HEALTH');
  const [claimAmount, setClaimAmount] = useState(String((initial as any).claimAmount ?? ''));
  const [approvedAmount, setApprovedAmount] = useState(String((initial as any).approvedAmount ?? ''));
  const [rejectionReason, setRejectionReason] = useState((initial as any).rejectionReason ?? '');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState((initial as any).assignedEmployeeId ?? '');
  const [activeClaimTab, setActiveClaimTab] = useState('Claim Details');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ proposer: true, claim: true, death: true, nominee: true, amounts: true, documents: true });
  const toggleCollapse = (sec: string) => setCollapsedSections(prev => ({ ...prev, [sec]: !prev[sec] }));

  // Nominee array state for edit form
  const [nominees, setNominees] = useState<any[]>(() => {
    if (Array.isArray(notesData.nominees)) return notesData.nominees;
    if (typeof notesData.nominees === 'string') {
      try {
        const parsed = JSON.parse(notesData.nominees);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'string') {
          const doubleParsed = JSON.parse(parsed);
          if (Array.isArray(doubleParsed)) return doubleParsed;
        }
      } catch {}
    }
    const polNominees = (initial as any).policy?.nominees;
    if (Array.isArray(polNominees) && polNominees.length > 0) {
      return polNominees;
    }
    return [];
  });
  const addNewNomineeRow = () => setNominees(prev => [...prev, { name: '', relationship: '', phone: '', dob: '', percentage: '', comment: '' }]);
  const removeNominee = (index: number) => setNominees(prev => prev.filter((_, i) => i !== index));
  const handleNomineeChange = (index: number, field: string, val: string) => {
    setNominees(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Doctors array state for edit form
  const [doctors, setDoctors] = useState<any[]>(() => {
    if (Array.isArray(notesData.hospitalDoctors)) return notesData.hospitalDoctors;
    if (typeof notesData.hospitalDoctors === 'string') {
      try {
        const parsed = JSON.parse(notesData.hospitalDoctors);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });
  const addNewDoctorRow = () => setDoctors(prev => [...prev, { name: '', degree: '', contactNo: '', speciality: '' }]);
  const removeDoctor = (index: number) => setDoctors(prev => prev.filter((_, i) => i !== index));
  const handleDoctorChange = (index: number, field: string, val: string) => {
    setDoctors(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Document files state
  const [claimFormFile, setClaimFormFile] = useState<File | null>(null);
  const [dischargeSummaryFile, setDischargeSummaryFile] = useState<File | null>(null);
  const [otNotesFile, setOtNotesFile] = useState<File | null>(null);
  const [hospitalBillFile, setHospitalBillFile] = useState<File | null>(null);
  const [pharmacyBillFile, setPharmacyBillFile] = useState<File | null>(null);
  const [investigationBillFile, setInvestigationBillFile] = useState<File | null>(null);
  const [bloodBagsBillFile, setBloodBagsBillFile] = useState<File | null>(null);
  const [labReportsFile, setLabReportsFile] = useState<File | null>(null);
  const [billsFile, setBillsFile] = useState<File | null>(null);
  const [otherImpDocsFile, setOtherImpDocsFile] = useState<File | null>(null);
  const [queryLetterFile, setQueryLetterFile] = useState<File | null>(null);
  const [replyDocsFile, setReplyDocsFile] = useState<File | null>(null);
  const [settlementLetterFile, setSettlementLetterFile] = useState<File | null>(null);
  const [rejectionLetterFile, setRejectionLetterFile] = useState<File | null>(null);
  const [fileUploadComment, setFileUploadComment] = useState(notesData.fileUploadComment || '');
  const [uploading, setUploading] = useState(false);

  // Split expense charges
  const [amtHospital, setAmtHospital] = useState(notesData.amtHospital || 0);
  const [amtMedicine, setAmtMedicine] = useState(notesData.amtMedicine || 0);
  const [amtLab, setAmtLab] = useState(notesData.amtLab || 0);
  const [amtPreHosp, setAmtPreHosp] = useState(notesData.amtPreHosp || 0);
  const [amtPostHosp, setAmtPostHosp] = useState(notesData.amtPostHosp || 0);
  const [amtOthers, setAmtOthers] = useState(notesData.amtOthers || 0);

  const [diagnosis, setDiagnosis] = useState(notesData.diagnosis);
  const [patientName, setPatientName] = useState(notesData.patientName || '');
  const [hospital, setHospital] = useState(notesData.hospital);
  const [admissionAt, setAdmissionAt] = useState(notesData.admissionAt ? notesData.admissionAt.slice(0, 10) : '');
  const [dischargeAt, setDischargeAt] = useState(notesData.dischargeAt ? notesData.dischargeAt.slice(0, 10) : '');
  const [notesText, setNotesText] = useState(notesData.notes);
  const [subClaimNo, setSubClaimNo] = useState(notesData.subClaimNo || '');
  const [uiClaimStatus, setUiClaimStatus] = useState(notesData.uiClaimStatus || '');
  const [comment, setComment] = useState(notesData.comment || '');
  const [insuranceCompanyCategory, setInsuranceCompanyCategory] = useState(notesData.insuranceCompanyCategory || '');
  const [insuranceCompany, setInsuranceCompany] = useState(notesData.insuranceCompany || '');
  const [insuranceProductName, setInsuranceProductName] = useState(notesData.insuranceProductName || '');
  const [agentName, setAgentName] = useState(notesData.agentName || '');

  // Death claim state
  const [deathAdmissionDate, setDeathAdmissionDate] = useState(notesData.deathAdmissionDate || '');
  const [causeOfDeath, setCauseOfDeath] = useState(notesData.causeOfDeath || '');
  const [dateOfOccurance, setDateOfOccurance] = useState(notesData.dateOfOccurance || '');
  const [dateOfDeath, setDateOfDeath] = useState(notesData.dateOfDeath || '');
  const [wasInComa, setWasInComa] = useState(notesData.wasInComa || '');
  const [deathSumInsured, setDeathSumInsured] = useState(notesData.deathSumInsured || '');
  const [deathTotalClaimedAmount, setDeathTotalClaimedAmount] = useState(notesData.deathTotalClaimedAmount || '');
  const [deathComment, setDeathComment] = useState(notesData.deathComment || '');

  // Hospital Details state
  const [hospitalName, setHospitalName] = useState(notesData.hospitalName || '');
  const [hospitalAddress, setHospitalAddress] = useState(notesData.hospitalAddress || '');
  const [hospitalState, setHospitalState] = useState(notesData.hospitalState || '');
  const [hospitalCity, setHospitalCity] = useState(notesData.hospitalCity || '');
  const [hospitalPincode, setHospitalPincode] = useState(notesData.hospitalPincode || '');
  const [hospitalContactNo, setHospitalContactNo] = useState(notesData.hospitalContactNo || '');
  const [hospitalRating, setHospitalRating] = useState(notesData.hospitalRating || '');
  const [hospitalType, setHospitalType] = useState(notesData.hospitalType || '');
  const [claimsPerson1Name, setClaimsPerson1Name] = useState(notesData.claimsPerson1Name || '');
  const [claimsPerson1Contact, setClaimsPerson1Contact] = useState(notesData.claimsPerson1Contact || '');
  const [claimsPerson2Name, setClaimsPerson2Name] = useState(notesData.claimsPerson2Name || '');
  const [claimsPerson2Contact, setClaimsPerson2Contact] = useState(notesData.claimsPerson2Contact || '');
  const [hospitalComment, setHospitalComment] = useState(notesData.hospitalComment || '');
  
  // Hospitalisation Details
  const [diagnosisSimple, setDiagnosisSimple] = useState(notesData.diagnosisSimple || '');
  const [roomCategory, setRoomCategory] = useState(notesData.roomCategory || '');
  const [typeOfManagement, setTypeOfManagement] = useState(notesData.typeOfManagement || '');
  const [typeOfAdmission, setTypeOfAdmission] = useState(notesData.typeOfAdmission || '');
  const [isMedicoLegalCase, setIsMedicoLegalCase] = useState(notesData.isMedicoLegalCase || '');
  const [hospitalisationComment, setHospitalisationComment] = useState(notesData.hospitalisationComment || '');

  // Billing Details (Anesthesia and Comment)
  const [amtAnesthesia, setAmtAnesthesia] = useState(notesData.amtAnesthesia || 0);
  const [billingComment, setBillingComment] = useState(notesData.billingComment || '');

  // Claim Approval Details
  const [amtFinalBill, setAmtFinalBill] = useState(notesData.amtFinalBill || 0);
  const [amtNonPayables, setAmtNonPayables] = useState(notesData.amtNonPayables || 0);
  const [amtCopay, setAmtCopay] = useState(notesData.amtCopay || 0);
  const [amtDeductible, setAmtDeductible] = useState(notesData.amtDeductible || 0);
  const [amtBalanceEMIs, setAmtBalanceEMIs] = useState(notesData.amtBalanceEMIs || 0);
  const [amtNcdRecovery, setAmtNcdRecovery] = useState(notesData.amtNcdRecovery || 0);
  const [amtExcessSumInsured, setAmtExcessSumInsured] = useState(notesData.amtExcessSumInsured || 0);
  const [amtExcessAilmentLimit, setAmtExcessAilmentLimit] = useState(notesData.amtExcessAilmentLimit || 0);
  const [amtHigherRoomRent, setAmtHigherRoomRent] = useState(notesData.amtHigherRoomRent || 0);
  const [amtReasonableCost, setAmtReasonableCost] = useState(notesData.amtReasonableCost || 0);
  const [amtOtherRecoveries, setAmtOtherRecoveries] = useState(notesData.amtOtherRecoveries || 0);
  const [amtPatientToPay, setAmtPatientToPay] = useState(notesData.amtPatientToPay || 0);
  const [amtExcessAgreedPackage, setAmtExcessAgreedPackage] = useState(notesData.amtExcessAgreedPackage || 0);
  const [amtNetworkDiscount, setAmtNetworkDiscount] = useState(notesData.amtNetworkDiscount || 0);
  const [amtNotCollected, setAmtNotCollected] = useState(notesData.amtNotCollected || 0);
  const [amtPayableToInsured, setAmtPayableToInsured] = useState(notesData.amtPayableToInsured || 0);
  const [approvalComment, setApprovalComment] = useState(notesData.approvalComment || '');

  // Auto calculate sum for Claim Approval Details
  useEffect(() => {
    const totalPatientToPay = Number(amtNonPayables) + Number(amtCopay) + Number(amtDeductible) + Number(amtBalanceEMIs) + Number(amtNcdRecovery) + Number(amtExcessSumInsured) + Number(amtExcessAilmentLimit) + Number(amtHigherRoomRent) + Number(amtReasonableCost) + Number(amtOtherRecoveries);
    setAmtPatientToPay(totalPatientToPay);
    const totalNotCollected = Number(amtExcessAgreedPackage) + Number(amtNetworkDiscount);
    setAmtNotCollected(totalNotCollected);
    const payable = Number(amtFinalBill) - totalPatientToPay - totalNotCollected;
    setAmtPayableToInsured(payable);
  }, [amtFinalBill, amtNonPayables, amtCopay, amtDeductible, amtBalanceEMIs, amtNcdRecovery, amtExcessSumInsured, amtExcessAilmentLimit, amtHigherRoomRent, amtReasonableCost, amtOtherRecoveries, amtExcessAgreedPackage, amtNetworkDiscount]);



  // Auto calculate sum
  useEffect(() => {
    const total = Number(amtHospital) + Number(amtMedicine) + Number(amtLab) + Number(amtPreHosp) + Number(amtPostHosp) + Number(amtOthers) + Number(amtAnesthesia);
    setClaimAmount(String(total));
  }, [amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers, amtAnesthesia]);

  const handleSave = async () => {
    setUploading(true);
    try {
      const uploadPromises: Promise<any>[] = [];
      const contactId = initial.contact?.id;
      const policyId = initial.policy?.id;
      const claimId = initial.id;

      const getMeta = (type: string) => {
        const meta: any = { claimId, type };
        if (contactId) meta.contactId = contactId;
        if (policyId) meta.policyId = policyId;
        return meta;
      };

      if (claimFormFile) {
        uploadPromises.push(documentsService.upload(claimFormFile, getMeta('CLAIM_FORM')).catch(e => console.error(e)));
      }
      if (dischargeSummaryFile) {
        uploadPromises.push(documentsService.upload(dischargeSummaryFile, getMeta('DISCHARGE_SUMMARY')).catch(e => console.error(e)));
      }
      if (otNotesFile) {
        uploadPromises.push(documentsService.upload(otNotesFile, getMeta('OT_NOTES_IPD_PAPERS')).catch(e => console.error(e)));
      }
      if (hospitalBillFile) {
        uploadPromises.push(documentsService.upload(hospitalBillFile, getMeta('HOSPITAL_BILL')).catch(e => console.error(e)));
      }
      if (pharmacyBillFile) {
        uploadPromises.push(documentsService.upload(pharmacyBillFile, getMeta('PHARMACY_MEDICINES_BILL')).catch(e => console.error(e)));
      }
      if (investigationBillFile) {
        uploadPromises.push(documentsService.upload(investigationBillFile, getMeta('INVESTIGATION_LAB_BILL')).catch(e => console.error(e)));
      }
      if (bloodBagsBillFile) {
        uploadPromises.push(documentsService.upload(bloodBagsBillFile, getMeta('BLOOD_ANESTHESIA_BILL')).catch(e => console.error(e)));
      }
      if (labReportsFile) {
        uploadPromises.push(documentsService.upload(labReportsFile, getMeta('IMPORTANT_LAB_REPORTS')).catch(e => console.error(e)));
      }
      if (billsFile) {
        uploadPromises.push(documentsService.upload(billsFile, getMeta('IMP_BILLS')).catch(e => console.error(e)));
      }
      if (otherImpDocsFile) {
        uploadPromises.push(documentsService.upload(otherImpDocsFile, getMeta('OTHER_IMP_DOCUMENTS')).catch(e => console.error(e)));
      }
      if (queryLetterFile) {
        uploadPromises.push(documentsService.upload(queryLetterFile, getMeta('CLAIM_QUERY_LETTER')).catch(e => console.error(e)));
      }
      if (replyDocsFile) {
        uploadPromises.push(documentsService.upload(replyDocsFile, getMeta('REPLY_DOCUMENTS')).catch(e => console.error(e)));
      }
      if (settlementLetterFile) {
        uploadPromises.push(documentsService.upload(settlementLetterFile, getMeta('CLAIM_SETTLEMENT_LETTER')).catch(e => console.error(e)));
      }
      if (rejectionLetterFile) {
        uploadPromises.push(documentsService.upload(rejectionLetterFile, getMeta('REJECTION_LETTER')).catch(e => console.error(e)));
      }


      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
        toast.success('Attached documents uploaded');
      }

      onSave({
        claimType,
        claimAmount: Number(claimAmount),
        approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
        rejectionReason: rejectionReason || undefined,
        assignedEmployeeId: assignedEmployeeId || null,
        notes: serializeNotes({
          diagnosis,
          hospital,
          admissionAt,
          dischargeAt,
          amtHospital,
          amtMedicine,
          amtLab,
          amtPreHosp,
          amtPostHosp,
          amtOthers,
          notes: notesText,
          subClaimNo,
          uiClaimStatus,
          comment,
          insuranceCompanyCategory,
          insuranceCompany,
          insuranceProductName,
          agentName,
          deathAdmissionDate,
          causeOfDeath,
          dateOfOccurance,
          dateOfDeath,
          wasInComa,
          deathSumInsured,
          deathTotalClaimedAmount,
          deathComment,
          patientName,
          nominees: JSON.stringify(nominees),
          hospitalName, hospitalAddress, hospitalState, hospitalCity, hospitalPincode,
          hospitalContactNo, hospitalRating, hospitalType, claimsPerson1Name,
          claimsPerson1Contact, claimsPerson2Name, claimsPerson2Contact, hospitalComment,
          hospitalDoctors: JSON.stringify(doctors),
          diagnosisSimple, roomCategory, typeOfManagement, typeOfAdmission, isMedicoLegalCase, hospitalisationComment, amtAnesthesia, billingComment,
          amtFinalBill, amtNonPayables, amtCopay, amtDeductible, amtBalanceEMIs, amtNcdRecovery, amtExcessSumInsured, amtExcessAilmentLimit, amtHigherRoomRent, amtReasonableCost, amtOtherRecoveries, amtPatientToPay, amtExcessAgreedPackage, amtNetworkDiscount, amtNotCollected, amtPayableToInsured, approvalComment, fileUploadComment

        })
      });
    } catch (err: any) {
      toast.error('Failed to save claim details');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal 
      open 
      onClose={onCancel} 
      title="Edit Claim" 
      size="2xl"
      actions={
        <button
          type="button"
          className="btn-primary py-1.5 px-5 text-xs shadow-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0"
          disabled={isPending || uploading}
          onClick={handleSave}
        >
          {uploading ? 'Uploading Files...' : isPending ? 'Saving...' : 'Save Changes'}
        </button>
      }
    >
      <div className="space-y-3">
      {/* Modal sub-navigation tabs */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mt-0 mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
        {['Claim Details', 'Hospital Details', 'Claim Approval Details', 'File Uploads'].map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveClaimTab(tab)}
            className={clsx(
              'px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap',
              activeClaimTab === tab
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="h-[430px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
        {activeClaimTab === 'Claim Details' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Proposer Details Collapsible */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('proposer')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                  Proposer & Policy Details
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Policy Data</span>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['proposer'] ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {!collapsedSections['proposer'] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="label text-gray-500">Insurance Company Category</label>
                    <input value={insuranceCompanyCategory} onChange={e => setInsuranceCompanyCategory(e.target.value)} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="label text-gray-500">Insurance Company</label>
                    <input value={insuranceCompany} onChange={e => setInsuranceCompany(e.target.value)} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="label text-gray-500">Product Name</label>
                    <input value={insuranceProductName} onChange={e => setInsuranceProductName(e.target.value)} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="label text-gray-500">Agent Name</label>
                    <input value={agentName} onChange={e => setAgentName(e.target.value)} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="label text-gray-500">Patient / Insured Person</label>
                    <input value={patientName} onChange={e => setPatientName(e.target.value)} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                </div>
              )}
            </div>

            {/* Claim Details Collapsible */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('claim')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                  Claim Details
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Diagnosis & Status</span>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['claim'] ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {!collapsedSections['claim'] && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Claim Type</label>
          <select className="input" value={claimType} onChange={e => setClaimType(e.target.value)}>
            <option value="Cashless">Cashless</option>
            <option value="Reimbursement">Reimbursement</option>
            <option value="Pre-Post Hospitalization">Pre-Post Hospitalization</option>
            <option value="Accident">Accident</option>
            <option value="Death Claim">Death Claim</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Sub Claim No</label>
          <input className="input" value={subClaimNo} onChange={e => setSubClaimNo(e.target.value)} placeholder="Optional" />
        </div>
        {user?.role !== 'EMPLOYEE' && (
          <div>
            <label className="label">Assignee</label>
            <select className="input" value={assignedEmployeeId} onChange={e => setAssignedEmployeeId(e.target.value)}>
              <option value="">Unassigned</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.userId}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Diagnosis</label>
          <input className="input" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
        </div>
        <div>
          <label className="label">Claim Status</label>
          <select className="input" value={uiClaimStatus} onChange={e => setUiClaimStatus(e.target.value)}>
            <option value="">Select Status</option>
            <option value="Intimated">Intimated</option>
            <option value="Discharge Done">Discharge Done</option>
            <option value="Pending Documents from Hospital/Customer">Pending Documents from Hospital/Customer</option>
            <option value="Documents Collected from Hospital/Customer">Documents Collected from Hospital/Customer</option>
            <option value="Submitted to Company">Submitted to Company</option>
            <option value="Pending for approval">Pending for approval</option>
            <option value="Query Raised">Query Raised</option>
            <option value="Query Resolved">Query Resolved</option>
            <option value="Partially Approved">Partially Approved</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="No Response from Customer">No Response from Customer</option>
            <option value="Pre-Authorisation Approved">Pre-Authorisation Approved</option>
            <option value="Pre-Authorisation Rejected">Pre-Authorisation Rejected</option>
            <option value="Enhancement Approved">Enhancement Approved</option>
            <option value="Enhancement Rejected">Enhancement Rejected</option>
            <option value="Interim Authorisation Approved">Interim Authorisation Approved</option>
            <option value="Interim Authorisation Rejected">Interim Authorisation Rejected</option>
            <option value="Final Authorisation Approved">Final Authorisation Approved</option>
            <option value="Final Authorisation Rejected">Final Authorisation Rejected</option>
            <option value="Advised to go for Reimbursement">Advised to go for Reimbursement</option>
            <option value="Treatment Cancelled/Changed">Treatment Cancelled/Changed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
        <div>
          <label className="label">Comment / Notes</label>
          <textarea className="input" rows={1} value={comment} onChange={e => setComment(e.target.value)} />
        </div>
      </div>
                </div>
              )}
            </div>

      {claimType === 'Death Claim' && (
        <div className="border border-red-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
          <div
            className="bg-gradient-to-r from-red-50/80 via-white to-orange-50/30 px-4 py-2.5 border-b border-red-100 flex items-center justify-between cursor-pointer select-none"
            onClick={() => toggleCollapse('death')}
          >
            <h4 className="text-xs font-extrabold text-red-600 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">!</span>
              Death Claim Details
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 font-semibold">Incident Info</span>
              <ChevronDown size={16} className={`text-red-500 transition-transform duration-200 ${collapsedSections['death'] ? 'rotate-180' : ''}`} />
            </div>
          </div>
          {!collapsedSections['death'] && (
            <div className="p-4 bg-red-50/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label text-gray-500">Date of Admission <br/><span className="text-[10px] font-normal">(In case of hosp.)</span></label>
              <input type="date" className="input mt-1" value={deathAdmissionDate} onChange={e => setDeathAdmissionDate(e.target.value)} />
            </div>
            <div>
              <label className="label text-gray-500">Cause of Death</label>
              <select className="input mt-1" value={causeOfDeath} onChange={e => setCauseOfDeath(e.target.value)}>
                <option value="">Select Cause</option>
                <option value="Accidental">Accidental</option>
                <option value="Non-Accidental">Non-Accidental</option>
                <option value="Murder">Murder</option>
                <option value="Natural">Natural</option>
                <option value="Suicide">Suicide</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label text-gray-500">Date of Occurance <br/><span className="text-[10px] font-normal">(Accident, Attack, etc)</span></label>
              <input type="date" className="input mt-1" value={dateOfOccurance} onChange={e => setDateOfOccurance(e.target.value)} />
            </div>
            <div>
              <label className="label text-gray-500">Date of Death</label>
              <input type="date" className="input mt-1" value={dateOfDeath} onChange={e => setDateOfDeath(e.target.value)} />
            </div>
            <div>
              <label className="label text-gray-500">Was in Coma?</label>
              <select className="input mt-1" value={wasInComa} onChange={e => setWasInComa(e.target.value)}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="label text-gray-500">Sum Insured</label>
              <input className="input mt-1 bg-white" value={deathSumInsured} onChange={e => setDeathSumInsured(e.target.value)} placeholder="Auto-fetch or manual" />
            </div>
            <div>
              <label className="label text-gray-500">Total Claimed Amount</label>
              <input className="input mt-1 bg-white" value={deathTotalClaimedAmount} onChange={e => setDeathTotalClaimedAmount(e.target.value)} placeholder="₹0" />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="label text-gray-500">Comment</label>
              <textarea className="input mt-1" rows={1} value={deathComment} onChange={e => setDeathComment(e.target.value)} />
            </div>
          </div>
          )}
        </div>
      )}

        {/* Nominee Details Collapsible */}
        <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
          <div
            className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
            onClick={() => toggleCollapse('nominee')}
          >
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
              Nominee Details
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-semibold">Multiple allowed</span>
              <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['nominee'] ? 'rotate-180' : ''}`} />
            </div>
          </div>
          {!collapsedSections['nominee'] && (
            <div className="p-4 space-y-4">
              {nominees.map((nom, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end border-b border-gray-100 pb-4 mb-2">
                  <div>
                    <label className="label text-[10px]">Nominee Name <span className="text-red-500">*</span></label>
                    <input 
                      value={nom.name} 
                      placeholder="Full name"
                      onChange={e => handleNomineeChange(index, 'name', e.target.value)} 
                      className="input mt-1 py-1 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="label text-[10px]">Relationship <span className="text-red-500">*</span></label>
                    <input 
                      value={nom.relationship} 
                      placeholder="e.g. Spouse, Son"
                      onChange={e => handleNomineeChange(index, 'relationship', e.target.value)} 
                      className="input mt-1 py-1 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="label text-[10px]">Contact No. <span className="text-red-500">*</span></label>
                    <input 
                      type="tel"
                      maxLength={10}
                      value={nom.phone} 
                      placeholder="10-digit mobile"
                      onChange={e => handleNomineeChange(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))} 
                      className="input mt-1 py-1 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="label text-[10px]">DoB</label>
                    <input type="date" value={nom.dob} onChange={e => handleNomineeChange(index, 'dob', e.target.value)} className="input mt-1 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="label text-[10px]">Percentage (%)</label>
                    <input 
                      type="number" 
                      min={0}
                      max={100}
                      value={nom.percentage} 
                      placeholder="100"
                      onChange={e => handleNomineeChange(index, 'percentage', e.target.value)} 
                      className="input mt-1 py-1 text-xs" 
                    />
                  </div>
                  <div className="flex gap-2">
                    <input value={nom.comment} onChange={e => handleNomineeChange(index, 'comment', e.target.value)} placeholder="Comment" className="input mt-1 py-1 text-xs flex-1" />
                    <button type="button" onClick={() => removeNominee(index)} className="mt-1 bg-red-50 text-red-500 hover:bg-red-100 px-2 rounded-lg text-xs font-bold transition-colors">X</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addNewNomineeRow} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                + Add Nominee
              </button>
            </div>
          )}
        </div>
      </div>
    )}

      {activeClaimTab === 'Hospital Details' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleCollapse('newHospital')}
            >
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">H</span>
                Hospital Details
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold">Location & Contact</span>
                <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newHospital'] ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {!collapsedSections['newHospital'] && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-[10px]">Hospital Name</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalName} onChange={e => setHospitalName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Address</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalAddress} onChange={e => setHospitalAddress(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital State</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalState} onChange={e => setHospitalState(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital City</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalCity} onChange={e => setHospitalCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Pincode</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="6 digit pincode"
                      className="input mt-1 py-1 text-xs" 
                      value={hospitalPincode} 
                      onChange={e => setHospitalPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Contact No</label>
                    <input 
                      type="tel" 
                      maxLength={10}
                      placeholder="10 digit mobile"
                      className="input mt-1 py-1 text-xs" 
                      value={hospitalContactNo} 
                      onChange={e => setHospitalContactNo(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                    />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Rating</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalRating} onChange={e => setHospitalRating(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Type</label>
                    <select className="input mt-1 py-1 text-xs" value={hospitalType} onChange={e => setHospitalType(e.target.value)}>
                      <option value="">Select Type</option>
                      <option value="Network">Network</option>
                      <option value="Non-Network">Non-Network</option>
                      <option value="Blacklisted">Blacklisted</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold text-slate-700 mb-2">Doctors / Consulting Providers</h5>
                  {doctors.map((doc, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end border-b border-gray-100 pb-4 mb-2">
                      <div>
                        <label className="label text-[10px]">Doctor Name</label>
                        <input value={doc.name} onChange={e => handleDoctorChange(index, 'name', e.target.value)} className="input mt-1 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Doctor Degree</label>
                        <input value={doc.degree} onChange={e => handleDoctorChange(index, 'degree', e.target.value)} className="input mt-1 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Doctor Contact No</label>
                        <input 
                          type="tel"
                          maxLength={10}
                          placeholder="10 digit mobile"
                          value={doc.contactNo} 
                          onChange={e => handleDoctorChange(index, 'contactNo', e.target.value.replace(/\D/g, '').slice(0, 10))} 
                          className="input mt-1 py-1 text-xs" 
                        />
                      </div>
                      <div>
                        <label className="label text-[10px]">Doctor Speciality</label>
                        <input value={doc.speciality} onChange={e => handleDoctorChange(index, 'speciality', e.target.value)} className="input mt-1 py-1 text-xs" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => removeDoctor(index)} className="mt-1 bg-red-50 text-red-500 hover:bg-red-100 px-2 rounded-lg text-xs font-bold transition-colors">X</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addNewDoctorRow} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                    + Add Doctor
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold text-slate-700 mb-2">Claims Department Contact</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="label text-[10px]">Person 1 Name</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={claimsPerson1Name} onChange={e => setClaimsPerson1Name(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Person 1 Contact No</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={claimsPerson1Contact} onChange={e => setClaimsPerson1Contact(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Person 2 Name</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={claimsPerson2Name} onChange={e => setClaimsPerson2Name(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Person 2 Contact No</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={claimsPerson2Contact} onChange={e => setClaimsPerson2Contact(e.target.value)} />
                    </div>
                    <div className="md:col-span-4">
                      <label className="label text-[10px]">Comment</label>
                      <textarea className="input mt-1 py-1 text-xs" rows={2} value={hospitalComment} onChange={e => setHospitalComment(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold text-slate-700 mb-2">Hospitalisation Details</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="label text-[10px]">Date of Admission</label>
                      <input type="date" className="input mt-1 py-1 text-xs" value={admissionAt} onChange={e => setAdmissionAt(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Date of Discharge</label>
                      <input type="date" className="input mt-1 py-1 text-xs" value={dischargeAt} onChange={e => setDischargeAt(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Diagnosis / Ailment (Exact as written on DS)</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Diagnosis in simple words</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={diagnosisSimple} onChange={e => setDiagnosisSimple(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Room Category</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={roomCategory} onChange={e => setRoomCategory(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Type of Management</label>
                      <select className="input mt-1 py-1 text-xs" value={typeOfManagement} onChange={e => setTypeOfManagement(e.target.value)}>
                        <option value="">Select Option</option>
                        <option value="Surgical">Surgical</option>
                        <option value="Medicinal">Medicinal</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-[10px]">Type of Admission</label>
                      <select className="input mt-1 py-1 text-xs" value={typeOfAdmission} onChange={e => setTypeOfAdmission(e.target.value)}>
                        <option value="">Select Option</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Planned">Planned</option>
                        <option value="Day-Care">Day-Care</option>
                        <option value="Maternity">Maternity</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-[10px]">Is Medico Legal Case?</label>
                      <select className="input mt-1 py-1 text-xs" value={isMedicoLegalCase} onChange={e => setIsMedicoLegalCase(e.target.value)}>
                        <option value="">Select Option</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-[10px]">Comment</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={hospitalisationComment} onChange={e => setHospitalisationComment(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold text-slate-700 mb-2">Billing Details</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="label text-[10px]">Pre Hospitalisation Bill</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtPreHosp} onChange={e => setAmtPreHosp(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Hospital Final Bill</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtHospital} onChange={e => setAmtHospital(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Anesthesia Bill</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtAnesthesia} onChange={e => setAmtAnesthesia(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Medicine Bill Total</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtMedicine} onChange={e => setAmtMedicine(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Lab Bill Total</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtLab} onChange={e => setAmtLab(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Post Hospitalisation Bill</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtPostHosp} onChange={e => setAmtPostHosp(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Others (Amount)</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtOthers} onChange={e => setAmtOthers(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Total Claimed Amount</label>
                      <input type="number" className="input mt-1 py-1 text-xs bg-slate-50 cursor-not-allowed" value={claimAmount} readOnly />
                    </div>
                    <div>
                      <label className="label text-[10px]">Comment</label>
                      <input type="text" className="input mt-1 py-1 text-xs" value={billingComment} onChange={e => setBillingComment(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hospitalisation Details Collapsible */}
          <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
            <div
              className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleCollapse('hospitalisation')}
            >
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">H</span>
                Hospitalisation Details
              </h4>
              <div className="flex items-center gap-2">
                <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['hospitalisation'] ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {!collapsedSections['hospitalisation'] && (
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-[10px]">Date of Admission</label>
                    <input type="date" className="input mt-1 py-1 text-xs" value={admissionAt} onChange={e => setAdmissionAt(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Date of Discharge</label>
                    <input type="date" className="input mt-1 py-1 text-xs" value={dischargeAt} onChange={e => setDischargeAt(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Diagnosis / Ailment (Exact as written on DS)</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Diagnosis in simple words</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={diagnosisSimple} onChange={e => setDiagnosisSimple(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Room Category</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={roomCategory} onChange={e => setRoomCategory(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Type of Management</label>
                    <select className="input mt-1 py-1 text-xs" value={typeOfManagement} onChange={e => setTypeOfManagement(e.target.value)}>
                      <option value="">Select Option</option>
                      <option value="Surgical">Surgical</option>
                      <option value="Medicinal">Medicinal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px]">Type of Admission</label>
                    <select className="input mt-1 py-1 text-xs" value={typeOfAdmission} onChange={e => setTypeOfAdmission(e.target.value)}>
                      <option value="">Select Option</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Planned">Planned</option>
                      <option value="Day-Care">Day-Care</option>
                      <option value="Maternity">Maternity</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px]">Is Medico Legal Case?</label>
                    <select className="input mt-1 py-1 text-xs" value={isMedicoLegalCase} onChange={e => setIsMedicoLegalCase(e.target.value)}>
                      <option value="">Select Option</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px]">Comment</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={hospitalisationComment} onChange={e => setHospitalisationComment(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Billing Details Collapsible */}
          <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
            <div
              className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleCollapse('billing')}
            >
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">B</span>
                Billing Details
              </h4>
              <div className="flex items-center gap-2">
                <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['billing'] ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {!collapsedSections['billing'] && (
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-[10px]">Pre Hospitalisation Bill</label>
                    <input type="number" className="input mt-1 py-1 text-xs" value={amtPreHosp} onChange={e => setAmtPreHosp(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Hospital Final Bill</label>
                    <input type="number" className="input mt-1 py-1 text-xs" value={amtHospital} onChange={e => setAmtHospital(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Anesthesia Bill</label>
                    <input type="number" className="input mt-1 py-1 text-xs" value={amtAnesthesia} onChange={e => setAmtAnesthesia(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Medicine Bill Total</label>
                    <input type="number" className="input mt-1 py-1 text-xs" value={amtMedicine} onChange={e => setAmtMedicine(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Lab Bill Total</label>
                    <input type="number" className="input mt-1 py-1 text-xs" value={amtLab} onChange={e => setAmtLab(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Post Hospitalisation Bill</label>
                    <input type="number" className="input mt-1 py-1 text-xs" value={amtPostHosp} onChange={e => setAmtPostHosp(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Others (Amount)</label>
                    <input type="number" className="input mt-1 py-1 text-xs" value={amtOthers} onChange={e => setAmtOthers(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label text-[10px]">Total Claimed Amount</label>
                    <input type="number" className="input mt-1 py-1 text-xs bg-slate-50 cursor-not-allowed" value={claimAmount} readOnly />
                  </div>
                  <div>
                    <label className="label text-[10px]">Comment</label>
                    <input type="text" className="input mt-1 py-1 text-xs" value={billingComment} onChange={e => setBillingComment(e.target.value)} />
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeClaimTab === 'Claim Approval Details' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('claimApproval')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">CA</span>
                  Claim Approval Details
                </h4>
                <div className="flex items-center gap-2">
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['claimApproval'] ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {!collapsedSections['claimApproval'] && (
                <div className="p-4 space-y-4">
                  {/* Final Bill Amount */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="label text-[10px]">Final Bill Amount</label>
                      <input type="number" className="input mt-1 py-1 text-xs" value={amtFinalBill} onChange={e => setAmtFinalBill(Number(e.target.value))} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <h5 className="text-[11px] font-bold text-slate-700 mb-2">Less: To be Paid by the Patient / Insured</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="label text-[10px]">Non-Payables as per policy terms</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtNonPayables} onChange={e => setAmtNonPayables(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Co-pay, if applicable as per policy</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtCopay} onChange={e => setAmtCopay(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Policy Deductible / Defined Limits / Voluntary Deductible</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtDeductible} onChange={e => setAmtDeductible(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Balance EMIs to be paid by the insured (if applicable)</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtBalanceEMIs} onChange={e => setAmtBalanceEMIs(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Recovery towards No Claim Discount in the renewed policy</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtNcdRecovery} onChange={e => setAmtNcdRecovery(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Excess Over Sum Insured / Sublimit</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtExcessSumInsured} onChange={e => setAmtExcessSumInsured(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Excess Over Defined ailment / procedure Sub-limit</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtExcessAilmentLimit} onChange={e => setAmtExcessAilmentLimit(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Higher room rent occupancy and related medical services</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtHigherRoomRent} onChange={e => setAmtHigherRoomRent(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Reasonable cost</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtReasonableCost} onChange={e => setAmtReasonableCost(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Other recoveries, if any</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtOtherRecoveries} onChange={e => setAmtOtherRecoveries(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px] font-semibold text-blue-600">Total amount to be paid by the patient / insured</label>
                        <input type="number" className="input mt-1 py-1 text-xs bg-blue-50 cursor-not-allowed font-semibold text-blue-700" value={amtPatientToPay} readOnly />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <h5 className="text-[11px] font-bold text-slate-700 mb-2">Less: Amounts NOT to be Collected from the Patient</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="label text-[10px]">Excess amount charged over the agreed package / SOC</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtExcessAgreedPackage} onChange={e => setAmtExcessAgreedPackage(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px]">Network hospital discount (not to be collected from the patient)</label>
                        <input type="number" className="input mt-1 py-1 text-xs" value={amtNetworkDiscount} onChange={e => setAmtNetworkDiscount(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[10px] font-semibold text-green-600">Total Amount NOT to be collected from the patient</label>
                        <input type="number" className="input mt-1 py-1 text-xs bg-green-50 cursor-not-allowed font-semibold text-green-700" value={amtNotCollected} readOnly />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label text-[10px] font-bold text-indigo-700">Amount payable by Insurance Company to the Insured/Hospital</label>
                        <input type="number" className="input mt-1 py-1 text-xs bg-indigo-50 border-indigo-200 cursor-not-allowed font-bold text-indigo-700" value={amtPayableToInsured} readOnly />
                      </div>
                      <div>
                        <label className="label text-[10px]">Comment</label>
                        <input type="text" className="input mt-1 py-1 text-xs" value={approvalComment} onChange={e => setApprovalComment(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeClaimTab === 'File Uploads' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('documents')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">F</span>
                  File Uploads
                </h4>
                <div className="flex items-center gap-2">
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['documents'] ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {!collapsedSections['documents'] && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <FileUploadCard label="Claim Form" file={claimFormFile} onFileChange={setClaimFormFile} />
                    <FileUploadCard label="Discharge Summary" file={dischargeSummaryFile} onFileChange={setDischargeSummaryFile} />
                    <FileUploadCard label="Operation Theatre Notes / IPD Papers" file={otNotesFile} onFileChange={setOtNotesFile} />
                    <FileUploadCard label="Bill - Hospital Bill, Breakup Bill" file={hospitalBillFile} onFileChange={setHospitalBillFile} />
                    <FileUploadCard label="Bill - Pharmacy, Medicines" file={pharmacyBillFile} onFileChange={setPharmacyBillFile} />
                    <FileUploadCard label="Bill - Investigation, Lab Reports" file={investigationBillFile} onFileChange={setInvestigationBillFile} />
                    <FileUploadCard label="Bill - Blood Bags, Anesthesia, Other" file={bloodBagsBillFile} onFileChange={setBloodBagsBillFile} />
                    <FileUploadCard label="Reports - Important Lab Reports" file={labReportsFile} onFileChange={setLabReportsFile} />
                    <FileUploadCard label="Imp Bills" file={billsFile} onFileChange={setBillsFile} />
                    <FileUploadCard label="Other IMP Documents" file={otherImpDocsFile} onFileChange={setOtherImpDocsFile} />
                    <FileUploadCard label="Claim Query Letter" file={queryLetterFile} onFileChange={setQueryLetterFile} />
                    <FileUploadCard label="Reply Documents" file={replyDocsFile} onFileChange={setReplyDocsFile} />
                    <FileUploadCard label="Claim Settlement Letter" file={settlementLetterFile} onFileChange={setSettlementLetterFile} />
                    <FileUploadCard label="Rejection Letter" file={rejectionLetterFile} onFileChange={setRejectionLetterFile} />
                    <div className="col-span-1 sm:col-span-2">
                      <label className="label text-[11px]">Comment</label>
                      <input type="text" value={fileUploadComment} onChange={e => setFileUploadComment(e.target.value)} className="input w-full bg-white mt-1 text-xs py-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
  </div>


      </div>
    </Modal>
  );
}

export default function Claims() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { user: authUser } = useAuthStore();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setModalOpen(true);
    }
  }, [searchParams]);
  const [editTarget, setEditTarget] = useState<Claim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Claim | null>(null);
  
  // Claim Detail sheet
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ newProposer: true, newClaim: true, newDeath: true, newNominee: true, newHospital: true });
  const toggleCollapse = (sec: string) => setCollapsedSections(prev => ({ ...prev, [sec]: !prev[sec] }));

  // Doctor array state for new claim
  const [newDoctors, setNewDoctors] = useState<any[]>([]);
  const addNewDoctorRow = () => setNewDoctors(prev => [...prev, { name: '', degree: '', contactNo: '', speciality: '' }]);
  const removeNewDoctor = (index: number) => setNewDoctors(prev => prev.filter((_, i) => i !== index));
  const handleNewDoctorChange = (index: number, field: string, val: string) => {
    setNewDoctors(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Nominee array state for new claim
  const [newNominees, setNewNominees] = useState<any[]>([]);
  const addNewNomineeRow = () => setNewNominees(prev => [...prev, { name: '', relationship: '', phone: '', dob: '', percentage: '', comment: '' }]);
  const removeNewNominee = (index: number) => setNewNominees(prev => prev.filter((_, i) => i !== index));
  const handleNewNomineeChange = (index: number, field: string, val: string) => {
    setNewNominees(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const employees = useLookupStore(s => s.employees);

  // Fetch all claims for client side filtering matching reference app
  const { data: claimsRes, isLoading } = useClaims({ page: 1, limit: 500 });
  const rawClaims = claimsRes?.data ?? [];

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'In Progress' | 'Approved' | 'Rejected' | 'Settled'>('All');

  // Advanced Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [filterClaimType, setFilterClaimType] = useState('ALL');
  const [filterAgent, setFilterAgent] = useState('');
  const [analyticsDuration, setAnalyticsDuration] = useState('ALL');
  const [showAnalytics, setShowAnalytics] = useState(false);

  // View Mode
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Sorting
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Unified Filtered Claims Selector
  const filteredClaims = useMemo(() => {
    const sTerm = search.toLowerCase();
    return rawClaims.filter((c: any) => {
      const notes = getClaimNotesData(c.notes);

      // 1. Text Search (Client Name or Claim Number)
      const clientName = `${c.contact?.firstName || ''} ${c.contact?.lastName || ''}`.toLowerCase();
      const claimNo = (c.claimNumber || '').toLowerCase();
      if (search && !clientName.includes(sTerm) && !claimNo.includes(sTerm)) return false;

      // 2. Status Filter
      if (filterStatus !== 'All') {
        const uStatus = BACKEND_TO_UI[c.status] || 'Pending';
        if (uStatus !== filterStatus) return false;
      }

      // 3. Claim Type Filter
      if (filterClaimType !== 'ALL') {
        if (c.claimType?.toLowerCase() !== filterClaimType.toLowerCase()) return false;
      }

      // 4. Company Filter
      if (filterCompany) {
        const companyName = (c.policy?.plan?.company?.name || '').toLowerCase();
        if (!companyName.includes(filterCompany.toLowerCase())) return false;
      }

      // 5. Hospital Filter
      if (filterHospital) {
        const hospitalName = (notes.hospital || '').toLowerCase();
        if (!hospitalName.includes(filterHospital.toLowerCase())) return false;
      }

      // 6. Date range Filter
      if (filterStartDate) {
        const start = new Date(filterStartDate).getTime();
        const date = new Date(c.intimatedAt).getTime();
        if (date < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate).getTime() + 86400000;
        const date = new Date(c.intimatedAt).getTime();
        if (date > end) return false;
      }

      // 7. Duration shortcut filter
      if (analyticsDuration === '30_DAYS') {
        const diff = (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000;
        if (diff > 30) return false;
      } else if (analyticsDuration === '90_DAYS') {
        const diff = (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000;
        if (diff > 90) return false;
      } else if (analyticsDuration === 'THIS_YEAR') {
        const year = new Date(c.intimatedAt).getFullYear();
        if (year !== new Date().getFullYear()) return false;
      }

      // 8. Agent Filter
      if (filterAgent && c.assignedEmployeeId !== filterAgent) return false;

      return true;
    });
  }, [rawClaims, search, filterStatus, filterStartDate, filterEndDate, filterCompany, filterHospital, filterClaimType, analyticsDuration, filterAgent]);

  // Client-side Sorting
  const sortedClaims = useMemo(() => {
    return sortData(filteredClaims, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'contact') return `${row.contact?.firstName ?? ''} ${row.contact?.lastName ?? ''}`;
      
      const parts = key.split('.');
      let val = row;
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      return val !== undefined ? val : row[key];
    });
  }, [filteredClaims, sortKey, sortDir]);

  // Calculations for Advanced Analytics Dashboard
  const stats = useMemo(() => {
    let totalClaimed = 0;
    let totalSettled = 0;
    const companyMap: Record<string, { count: number; claimed: number; settled: number }> = {};
    const hospitalMap: Record<string, { count: number; claimed: number; settled: number }> = {};
    const typeMap: Record<string, { count: number; claimed: number; settled: number }> = {};
    const statusMap: Record<string, { count: number; claimed: number; settled: number }> = {};

    filteredClaims.forEach((c: any) => {
      const notes = getClaimNotesData(c.notes);
      const claimed = Number(c.claimAmount || 0);
      const settled = Number(c.approvedAmount || 0);
      const company = c.policy?.plan?.company?.name || 'Unknown Company';
      const hospital = notes.hospital || 'Outpatient / Other';
      const type = c.claimType || 'Other';
      const statusStr = BACKEND_TO_UI[c.status] || 'Pending';

      totalClaimed += claimed;
      totalSettled += settled;

      // Company
      if (!companyMap[company]) companyMap[company] = { count: 0, claimed: 0, settled: 0 };
      companyMap[company].count++;
      companyMap[company].claimed += claimed;
      companyMap[company].settled += settled;

      // Hospital
      if (!hospitalMap[hospital]) hospitalMap[hospital] = { count: 0, claimed: 0, settled: 0 };
      hospitalMap[hospital].count++;
      hospitalMap[hospital].claimed += claimed;
      hospitalMap[hospital].settled += settled;

      // Type
      if (!typeMap[type]) typeMap[type] = { count: 0, claimed: 0, settled: 0 };
      typeMap[type].count++;
      typeMap[type].claimed += claimed;
      typeMap[type].settled += settled;

      // Status
      if (!statusMap[statusStr]) statusMap[statusStr] = { count: 0, claimed: 0, settled: 0 };
      statusMap[statusStr].count++;
      statusMap[statusStr].claimed += claimed;
      statusMap[statusStr].settled += settled;
    });

    const pendingClaimed = totalClaimed - totalSettled;
    const settlementRatio = totalClaimed > 0 ? (totalSettled / totalClaimed) * 100 : 0;
    const avgClaim = filteredClaims.length > 0 ? totalClaimed / filteredClaims.length : 0;

    return {
      totalClaims: filteredClaims.length,
      totalClaimed,
      totalSettled,
      pendingClaimed,
      settlementRatio,
      avgClaim,
      companies: Object.entries(companyMap).map(([name, v]) => ({ name, ...v })),
      hospitals: Object.entries(hospitalMap).map(([name, v]) => ({ name, ...v })),
      types: Object.entries(typeMap).map(([name, v]) => ({ name, ...v })),
      statuses: Object.entries(statusMap).map(([name, v]) => ({ name, ...v })),
    };
  }, [filteredClaims]);

  // Group claims by Month for Visual Line Chart
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const values = months.map(() => 0);
    filteredClaims.forEach((c: any) => {
      const m = new Date(c.intimatedAt).getMonth();
      if (m >= 0 && m < 12) {
        values[m] += Number(c.claimAmount || 0);
      }
    });
    return { months, values };
  }, [filteredClaims]);

  // Export Analytics function
  const exportAnalytics = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Category,Name,Total Claims,Claimed Amount,Settled Amount\n";

    // Summary
    csvContent += `Summary,All Filtered Claims,${stats.totalClaims},${stats.totalClaimed},${stats.totalSettled}\n\n`;

    // Company wise
    csvContent += "Company-wise Breakdown,,,\n";
    stats.companies.forEach(item => {
      csvContent += `Company,${item.name},${item.count},${item.claimed},${item.settled}\n`;
    });
    csvContent += "\n";

    // Hospital wise
    csvContent += "Hospital-wise Breakdown,,,\n";
    stats.hospitals.forEach(item => {
      csvContent += `Hospital,${item.name},${item.count},${item.claimed},${item.settled}\n`;
    });
    csvContent += "\n";

    // Type wise
    csvContent += "Type Breakdown,,,\n";
    stats.types.forEach(item => {
      csvContent += `Claim Type,${item.name},${item.count},${item.claimed},${item.settled}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `claims_analytics_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Contact picker state
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropdown, setContactDropdown] = useState(false);
  const [activeClaimTab, setActiveClaimTab] = useState('Claim Details');
  const [selectedContact, setSelectedContact] = useState<{ id: string; firstName: string; lastName: string; phone: string } | null>(null);

  // Policy picker
  const [selectedPolicy, setSelectedPolicy] = useState<{ id: string; policyNumber: string; plan?: { name: string } } | null>(null);
  const [policyDropdown, setPolicyDropdown] = useState(false);

  // Selected document files
  const [claimFormFile, setClaimFormFile] = useState<File | null>(null);
  const [dischargeSummaryFile, setDischargeSummaryFile] = useState<File | null>(null);
  const [otNotesFile, setOtNotesFile] = useState<File | null>(null);
  const [hospitalBillFile, setHospitalBillFile] = useState<File | null>(null);
  const [pharmacyBillFile, setPharmacyBillFile] = useState<File | null>(null);
  const [investigationBillFile, setInvestigationBillFile] = useState<File | null>(null);
  const [bloodBagsBillFile, setBloodBagsBillFile] = useState<File | null>(null);
  const [labReportsFile, setLabReportsFile] = useState<File | null>(null);
  const [billsFile, setBillsFile] = useState<File | null>(null);
  const [otherImpDocsFile, setOtherImpDocsFile] = useState<File | null>(null);
  const [queryLetterFile, setQueryLetterFile] = useState<File | null>(null);
  const [replyDocsFile, setReplyDocsFile] = useState<File | null>(null);
  const [settlementLetterFile, setSettlementLetterFile] = useState<File | null>(null);
  const [rejectionLetterFile, setRejectionLetterFile] = useState<File | null>(null);

  const { data: contactResults } = useQuery({
    queryKey: ['contact-search-claim', contactSearch],
    queryFn: () => contactsService.list({ search: contactSearch || undefined, limit: 8 }),
    enabled: contactDropdown,
  });

  const { data: contactDetail } = useQuery({
    queryKey: ['contact-detail-claims-picker', selectedContact?.id],
    queryFn: () => contactsService.get(selectedContact!.id),
    enabled: !!selectedContact,
  });

  const activeContactPolicies = contactDetail?.data?.policies ?? [];


  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaimStatus();
  const deleteClaim = useDeleteClaim();
  
  const { data: companiesRes } = useQuery({
    queryKey: ['insurance-companies-for-hospitals'],
    queryFn: () => insuranceService.listCompanies(),
  });
  const hospitals = useMemo(() => {
    if (!companiesRes?.data) return [];
    return companiesRes.data.flatMap((c: any) => {
      if (c.notes && c.notes.trim().startsWith('{')) {
        try {
          return JSON.parse(c.notes).hospitals || [];
        } catch { return []; }
      }
      return [];
    });
  }, [companiesRes?.data]);
  const qcClaims = useQueryClient();
  const updateClaimMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => claimsService.update(id, body),
    onSuccess: () => {
      qcClaims.invalidateQueries({ queryKey: ['claims'] });
      qcClaims.invalidateQueries({ queryKey: ['claims', 'summary'] });
      toast.success('Claim updated successfully');
      setEditTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update claim');
    }
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { claimType: 'Cashless', intimatedAt: new Date().toISOString().split('T')[0] },
  });

  // Watch calculations for create form
  const amtHospital = watch('amtHospital');
  const amtMedicine = watch('amtMedicine');
  const amtLab = watch('amtLab');
  const amtPreHosp = watch('amtPreHosp');
  const amtPostHosp = watch('amtPostHosp');
  const amtOthers = watch('amtOthers');
  const amtAnesthesia = watch('amtAnesthesia');

  const amtFinalBill = watch('amtFinalBill');
  const amtNonPayables = watch('amtNonPayables');
  const amtCopay = watch('amtCopay');
  const amtDeductible = watch('amtDeductible');
  const amtBalanceEMIs = watch('amtBalanceEMIs');
  const amtNcdRecovery = watch('amtNcdRecovery');
  const amtExcessSumInsured = watch('amtExcessSumInsured');
  const amtExcessAilmentLimit = watch('amtExcessAilmentLimit');
  const amtHigherRoomRent = watch('amtHigherRoomRent');
  const amtReasonableCost = watch('amtReasonableCost');
  const amtOtherRecoveries = watch('amtOtherRecoveries');
  const amtExcessAgreedPackage = watch('amtExcessAgreedPackage');
  const amtNetworkDiscount = watch('amtNetworkDiscount');

  const watchClaimNumber = watch('claimNumber');
  const watchPolicyId = watch('policyId');
  const watchAdmissionAt = watch('admissionAt');
  const watchDischargeAt = watch('dischargeAt');
  const watchIntimatedAt = watch('intimatedAt');
  const watchClaimType = watch('claimType');
  const watchHospitalCity = watch('hospitalCity');
  const watchHospitalName = watch('hospitalName');

  useEffect(() => {
    const tot = Number(amtHospital || 0) + Number(amtMedicine || 0) + Number(amtLab || 0) + Number(amtPreHosp || 0) + Number(amtPostHosp || 0) + Number(amtOthers || 0) + Number(amtAnesthesia || 0);
    setValue('claimAmount', tot);
  }, [amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers, amtAnesthesia]);

  useEffect(() => {
    const totalPatientToPay = Number(amtNonPayables || 0) + Number(amtCopay || 0) + Number(amtDeductible || 0) + Number(amtBalanceEMIs || 0) + Number(amtNcdRecovery || 0) + Number(amtExcessSumInsured || 0) + Number(amtExcessAilmentLimit || 0) + Number(amtHigherRoomRent || 0) + Number(amtReasonableCost || 0) + Number(amtOtherRecoveries || 0);
    setValue('amtPatientToPay', totalPatientToPay);
    const totalNotCollected = Number(amtExcessAgreedPackage || 0) + Number(amtNetworkDiscount || 0);
    setValue('amtNotCollected', totalNotCollected);
    const payable = Number(amtFinalBill || 0) - totalPatientToPay - totalNotCollected;
    setValue('amtPayableToInsured', payable);
  }, [amtFinalBill, amtNonPayables, amtCopay, amtDeductible, amtBalanceEMIs, amtNcdRecovery, amtExcessSumInsured, amtExcessAilmentLimit, amtHigherRoomRent, amtReasonableCost, amtOtherRecoveries, amtExcessAgreedPackage, amtNetworkDiscount]);

  // Auto-fill from existing claim entries with same claim number
  useEffect(() => {
    if (watchClaimNumber && rawClaims) {
      const match = rawClaims.find((c: any) => c.claimNumber?.trim().toLowerCase() === watchClaimNumber.trim().toLowerCase());
      if (match) {
        const extra = getClaimNotesData(match.notes);
        if (extra.patientName) setValue('patientName', extra.patientName);
        if (extra.diagnosis) setValue('diagnosis', extra.diagnosis);
        if (extra.hospital) setValue('hospital', extra.hospital);
        if (extra.hospitalAddress) setValue('hospitalAddress', extra.hospitalAddress);
        if (extra.admissionAt) setValue('admissionAt', extra.admissionAt);
        if (extra.dischargeAt) setValue('dischargeAt', extra.dischargeAt);
        if (match.intimatedAt) setValue('intimatedAt', match.intimatedAt.slice(0, 10));
      }
    }
  }, [watchClaimNumber, rawClaims, setValue]);

  // Auto-fill patient name when policy is selected
  useEffect(() => {
    if (watchPolicyId && selectedContact) {
      setValue('patientName', `${selectedContact.firstName} ${selectedContact.lastName}`);
    }
  }, [watchPolicyId, selectedContact, setValue]);

  const closeModal = () => {
    setModalOpen(false);
    reset();
    setSelectedContact(null); setContactSearch('');
    setSelectedPolicy(null);
    setClaimFormFile(null);
    setDischargeSummaryFile(null);
    setOtNotesFile(null);
    setHospitalBillFile(null);
    setPharmacyBillFile(null);
    setInvestigationBillFile(null);
    setBloodBagsBillFile(null);
    setLabReportsFile(null);
    setBillsFile(null);
    setOtherImpDocsFile(null);
    setQueryLetterFile(null);
    setReplyDocsFile(null);
    setSettlementLetterFile(null);
    setRejectionLetterFile(null);
  };

  const onSubmit = async (body: Form) => {
    try {
      if (!body.contactId) {
        toast.error('कृपया ग्राहक निवडा (Please select a customer)');
        return;
      }
      if (!body.policyId) {
        toast.error('कृपया पॉलिसी निवडा (Please select a policy)');
        return;
      }
      for (let i = 0; i < newNominees.length; i++) {
        const nom = newNominees[i];
        if (!nom.name?.trim()) {
          toast.error(`नॉमिनी #${i + 1} चे नाव आवश्यक आहे (Nominee name is required)`);
          return;
        }
        if (!nom.relationship?.trim()) {
          toast.error(`नॉमिनी #${i + 1} चे नाते आवश्यक आहे (Nominee relationship is required)`);
          return;
        }
        if (nom.phone && nom.phone.replace(/\D/g, '').length !== 10) {
          toast.error(`नॉमिनी #${i + 1} चा मोबाईल नंबर बरोबर १० अंकी असावा (Nominee contact must be 10 digits)`);
          return;
        }
      }

      const { diagnosis, hospital, hospitalAddress, patientName, deductionsNotes, admissionAt, dischargeAt, notes, assignedEmployeeId, amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers, subClaimNo, uiClaimStatus, comment, insuranceCompanyCategory, insuranceCompany, insuranceProductName, agentName, deathAdmissionDate, causeOfDeath, dateOfOccurance, dateOfDeath, wasInComa, deathSumInsured, deathTotalClaimedAmount, deathComment, hospitalName, hospitalState, hospitalCity, hospitalPincode, hospitalContactNo, hospitalRating, hospitalType, claimsPerson1Name, claimsPerson1Contact, claimsPerson2Name, claimsPerson2Contact, hospitalComment, diagnosisSimple, roomCategory, typeOfManagement, typeOfAdmission, isMedicoLegalCase, hospitalisationComment, amtAnesthesia, billingComment, amtFinalBill, amtNonPayables, amtCopay, amtDeductible, amtBalanceEMIs, amtNcdRecovery, amtExcessSumInsured, amtExcessAilmentLimit, amtHigherRoomRent, amtReasonableCost, amtOtherRecoveries, amtPatientToPay, amtExcessAgreedPackage, amtNetworkDiscount, amtNotCollected, amtPayableToInsured, approvalComment, ...rest } = body;
      const notesJson = serializeNotes({
        diagnosis, hospital, hospitalAddress, patientName, deductionsNotes, admissionAt, dischargeAt, notes,
        amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers,
        subClaimNo, uiClaimStatus, comment, insuranceCompanyCategory, insuranceCompany, insuranceProductName, agentName,
        deathAdmissionDate, causeOfDeath, dateOfOccurance, dateOfDeath, wasInComa, deathSumInsured, deathTotalClaimedAmount, deathComment,
        nominees: JSON.stringify(newNominees),
        hospitalName, hospitalState, hospitalCity, hospitalPincode, hospitalContactNo, hospitalRating, hospitalType, claimsPerson1Name, claimsPerson1Contact, claimsPerson2Name, claimsPerson2Contact, hospitalComment,
        hospitalDoctors: JSON.stringify(newDoctors),
        diagnosisSimple, roomCategory, typeOfManagement, typeOfAdmission, isMedicoLegalCase, hospitalisationComment, amtAnesthesia, billingComment,
        amtFinalBill, amtNonPayables, amtCopay, amtDeductible, amtBalanceEMIs, amtNcdRecovery, amtExcessSumInsured, amtExcessAilmentLimit, amtHigherRoomRent, amtReasonableCost, amtOtherRecoveries, amtPatientToPay, amtExcessAgreedPackage, amtNetworkDiscount, amtNotCollected, amtPayableToInsured, approvalComment
      });

      const calcClaimAmount = Number(rest.claimAmount) || (Number(amtHospital || 0) + Number(amtMedicine || 0) + Number(amtLab || 0) + Number(amtPreHosp || 0) + Number(amtPostHosp || 0) + Number(amtOthers || 0) + Number(amtAnesthesia || 0));

      const res = await createClaim.mutateAsync({
        ...rest,
        claimNumber: rest.claimNumber?.trim() || `CLM-${Date.now().toString().slice(-6)}`,
        claimAmount: calcClaimAmount,
        intimatedAt: rest.intimatedAt || new Date().toISOString().split('T')[0],
        patientName: patientName || (selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName}` : 'Insured Person'),
        assignedEmployeeId: assignedEmployeeId || undefined,
        notes: notesJson,
      });
      const claimId = res.data?.id;

      if (claimId) {
        const uploadPromises: Promise<any>[] = [];
        const cId = rest.contactId || '';
        const pId = rest.policyId || '';
        if (claimFormFile) uploadPromises.push(documentsService.upload(claimFormFile, { claimId, contactId: cId, policyId: pId, type: 'CLAIM_FORM' }).catch(err => console.error(err)));
        if (dischargeSummaryFile) uploadPromises.push(documentsService.upload(dischargeSummaryFile, { claimId, contactId: cId, policyId: pId, type: 'DISCHARGE_SUMMARY' }).catch(err => console.error(err)));
        if (otNotesFile) uploadPromises.push(documentsService.upload(otNotesFile, { claimId, contactId: cId, policyId: pId, type: 'OT_NOTES_IPD_PAPERS' }).catch(err => console.error(err)));
        if (hospitalBillFile) uploadPromises.push(documentsService.upload(hospitalBillFile, { claimId, contactId: cId, policyId: pId, type: 'HOSPITAL_BILL' }).catch(err => console.error(err)));
        if (pharmacyBillFile) uploadPromises.push(documentsService.upload(pharmacyBillFile, { claimId, contactId: cId, policyId: pId, type: 'PHARMACY_MEDICINES_BILL' }).catch(err => console.error(err)));
        if (investigationBillFile) uploadPromises.push(documentsService.upload(investigationBillFile, { claimId, contactId: cId, policyId: pId, type: 'INVESTIGATION_LAB_BILL' }).catch(err => console.error(err)));
        if (bloodBagsBillFile) uploadPromises.push(documentsService.upload(bloodBagsBillFile, { claimId, contactId: cId, policyId: pId, type: 'BLOOD_ANESTHESIA_BILL' }).catch(err => console.error(err)));
        if (labReportsFile) uploadPromises.push(documentsService.upload(labReportsFile, { claimId, contactId: cId, policyId: pId, type: 'IMPORTANT_LAB_REPORTS' }).catch(err => console.error(err)));
        if (billsFile) uploadPromises.push(documentsService.upload(billsFile, { claimId, contactId: cId, policyId: pId, type: 'IMP_BILLS' }).catch(err => console.error(err)));
        if (otherImpDocsFile) uploadPromises.push(documentsService.upload(otherImpDocsFile, { claimId, contactId: cId, policyId: pId, type: 'OTHER_IMP_DOCUMENTS' }).catch(err => console.error(err)));
        if (queryLetterFile) uploadPromises.push(documentsService.upload(queryLetterFile, { claimId, contactId: cId, policyId: pId, type: 'CLAIM_QUERY_LETTER' }).catch(err => console.error(err)));
        if (replyDocsFile) uploadPromises.push(documentsService.upload(replyDocsFile, { claimId, contactId: cId, policyId: pId, type: 'REPLY_DOCUMENTS' }).catch(err => console.error(err)));
        if (settlementLetterFile) uploadPromises.push(documentsService.upload(settlementLetterFile, { claimId, contactId: cId, policyId: pId, type: 'CLAIM_SETTLEMENT_LETTER' }).catch(err => console.error(err)));
        if (rejectionLetterFile) uploadPromises.push(documentsService.upload(rejectionLetterFile, { claimId, contactId: cId, policyId: pId, type: 'REJECTION_LETTER' }).catch(err => console.error(err)));
        if (uploadPromises.length > 0) {
          await Promise.all(uploadPromises);
        }
      }

      closeModal();
      qcClaims.invalidateQueries({ queryKey: ['claims'] });
      qcClaims.invalidateQueries({ queryKey: ['claims', 'summary'] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || 'Failed to save claim');
    }
  };

  const onFormError = (errors: any) => {
    console.warn('Claim form validation errors:', errors);
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      toast.error(`Please check required fields: ${errorKeys.join(', ')}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing claims...');
    try {
      const res = await claimsService.importCsv(file);
      toast.success(res.message || `Successfully imported claims!`, { id: toastId });
      qcClaims.invalidateQueries();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import claims', { id: toastId });
    }
  };



  const COLS: Column<Claim>[] = [
    {
      key: 'claimNumber',
      label: 'Claim ID',
      render: r => <span className="font-bold text-gray-900">{r.claimNumber}</span>
    },
    {
      key: 'contact',
      label: 'Client & Policy',
      render: r => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900">{r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : '—'}</span>
          <span className="text-xs text-gray-500">Policy: {r.policy?.policyNumber ?? '—'}</span>
        </div>
      )
    },
    {
      key: 'claimAmount',
      label: 'Claimed Amt',
      render: r => <span className="font-semibold text-gray-900">₹{Number(r.claimAmount).toLocaleString('en-IN')}</span>
    },
    {
      key: 'approvedAmount',
      label: 'Settled Amt',
      render: r => r.approvedAmount ? <span className="font-semibold text-emerald-600">₹{Number(r.approvedAmount).toLocaleString('en-IN')}</span> : <span className="text-gray-400">—</span>
    },
    {
      key: 'intimatedAt',
      label: 'Date Filed',
      render: r => r.intimatedAt ? format(new Date(r.intimatedAt), 'dd/MMM/yyyy') : '—'
    },
    {
      key: 'status',
      label: 'Status',
      render: r => {
        const display = BACKEND_TO_UI[r.status] || 'Pending';
        return (
          <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider', STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600')}>
            {display}
          </span>
        );
      }
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex flex-wrap items-center gap-1.5 justify-start" onClick={e => e.stopPropagation()}>
          <button
            title="Edit Claim"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => setEditTarget(r)}
          >
            <Pencil size={14} />
          </button>
          <button
            title="Delete Claim"
            className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => setDeleteTarget(r)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const genClaimNumber = () => `CLM-${Date.now().toString().slice(-8)}`;

  return (
    <>
    <div className="space-y-4">
      {/* Floating Right Action Panel */}
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
      <div className="fixed right-2 sm:right-3.5 top-60 sm:top-64 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="Import Claims CSV"
        >
          <Upload size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            Import CSV
          </span>
        </button>

        {/* New Claim */}
        <button
          type="button"
          onClick={() => { setModalOpen(true); setValue('claimNumber', genClaimNumber()); }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="New Claim"
        >
          <Plus size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            New Claim
          </span>
        </button>
      </div>

      {/* Unified Search & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-sm">
        {/* Left: Search Bar */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search claims by ID or customer..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all font-medium text-slate-800"
          />
        </div>

        {/* Right: View toggle and controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Kanban / Table Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/50">
            <button
              onClick={() => setViewMode('kanban')}
              className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none',
                viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
            >
              <LayoutGrid size={13} /> <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none',
                viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
            >
              <List size={13} /> <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={clsx('btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg',
              showAnalytics && 'bg-purple-50 border-purple-200 text-purple-700')}
          >
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
          </button>
        </div>
      </div>

      {/* Analytics & Reports Collapsible Card */}
      {showAnalytics && (
        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header & Main Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex flex-wrap items-center gap-1.5">
                <FileCheck2 size={16} className="text-blue-600" />
                Claims Analytics Dashboard
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time statistics, graphs, and filtered reports</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={exportAnalytics}
                className="btn-primary h-8 py-0 px-3 text-[10px] sm:text-xs bg-emerald-600 hover:bg-emerald-700 font-bold flex flex-wrap items-center gap-1.5 shadow-sm rounded-lg"
              >
                <FileCheck2 size={13} /> Export Report (CSV)
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
              <DatePicker
                value={filterStartDate}
                onDateChange={setFilterStartDate}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</label>
              <DatePicker
                value={filterEndDate}
                onDateChange={setFilterEndDate}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</label>
              <input
                type="text"
                placeholder="Search company..."
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hospital</label>
              <input
                type="text"
                placeholder="Search hospital..."
                value={filterHospital}
                onChange={e => setFilterHospital(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Claim Type</label>
              <select
                value={filterClaimType}
                onChange={e => setFilterClaimType(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              >
                <option value="ALL">All Types</option>
                <option value="Cashless">Cashless</option>
                <option value="Reimbursement">Reimbursement</option>
                <option value="DEATH">Death</option>
                <option value="ACCIDENTAL">Accidental</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agent</label>
              <select
                value={filterAgent}
                onChange={e => setFilterAgent(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              >
                <option value="">All Agents</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Claim Stage Count Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {['Pending', 'In Progress', 'Approved', 'Settled', 'Rejected'].map(status => {
              const statusData = stats.statuses.find(s => s.name === status);
              const count = statusData ? statusData.count : 0;
              return (
                <div key={status} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{status}</span>
                  <span className="text-xl font-bold text-indigo-600 mt-1">{count}</span>
                </div>
              );
            })}
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Claims</span>
              <span className="text-xl font-bold text-slate-800 mt-1">{stats.totalClaims}</span>
            </div>
          </div>

          {/* 6 KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Claims</span>
              <span className="text-xl font-bold text-slate-800 mt-1">{stats.totalClaims}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Claimed Amt</span>
              <span className="text-xl font-bold text-slate-800 mt-1">₹{Math.round(stats.totalClaimed).toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settled Amt</span>
              <span className="text-xl font-bold text-emerald-600 mt-1">₹{Math.round(stats.totalSettled).toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Amt</span>
              <span className="text-xl font-bold text-amber-600 mt-1">₹{Math.round(stats.pendingClaimed).toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settlement %</span>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xl font-bold text-slate-800">{stats.settlementRatio.toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Claim</span>
              <span className="text-xl font-bold text-slate-800 mt-1">₹{Math.round(stats.avgClaim).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Interactive SVG Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Chart 1: Claims Trend (SVG Line Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Claims Trend (Monthly)</h4>
                <p className="text-[10px] text-slate-400">Total claimed amount in ₹</p>
              </div>
              <div className="relative h-44 flex items-end justify-center">
                <svg viewBox="0 0 240 120" className="w-full h-full">
                  {/* Grid Lines */}
                  <line x1="10" y1="20" x2="230" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="60" x2="230" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="100" x2="230" y2="100" stroke="#e2e8f0" strokeWidth="1" />
                  
                  {/* Polyline */}
                  {(() => {
                    const maxVal = Math.max(...monthlyData.values, 1);
                    const points = monthlyData.values.map((val, idx) => {
                      const x = 10 + idx * 20;
                      const y = 100 - (val / maxVal) * 80;
                      return `${x},${y}`;
                    }).join(' ');
                    return (
                      <>
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={points} />
                        {monthlyData.values.map((val, idx) => {
                          const x = 10 + idx * 20;
                          const y = 100 - (val / maxVal) * 80;
                          if (val === 0) return null;
                          return (
                            <circle key={idx} cx={x} cy={y} r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                          );
                        })}
                      </>
                    );
                  })()}
                  
                  {/* X Axis Labels */}
                  {monthlyData.months.map((m, idx) => (
                    <text key={m} x={10 + idx * 20} y="115" fontSize="6.5" fill="#94a3b8" textAnchor="middle">{m}</text>
                  ))}
                </svg>
              </div>
            </div>

            {/* Chart 2: Claim Type Share (SVG Doughnut Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Claim Type Share</h4>
                <p className="text-[10px] text-slate-400">Cashless vs Reimbursement distribution</p>
              </div>
              <div className="h-44 flex items-center justify-between gap-2">
                <div className="w-1/2 relative flex items-center justify-center">
                  <svg width="100" height="100" viewBox="0 0 36 36" className="w-24 h-24">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    {(() => {
                      let accumulatedPercent = 0;
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
                      return stats.types.map((type, idx) => {
                        const pct = stats.totalClaims > 0 ? (type.count / stats.totalClaims) * 100 : 0;
                        const dashArray = `${pct} ${100 - pct}`;
                        const dashOffset = 100 - accumulatedPercent + 25;
                        accumulatedPercent += pct;
                        return (
                          <circle
                            key={type.name}
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="none"
                            stroke={colors[idx % colors.length]}
                            strokeWidth="3.5"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                    <span className="text-base font-bold text-slate-800">{stats.totalClaims}</span>
                  </div>
                </div>
                <div className="w-1/2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {stats.types.map((t, idx) => {
                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];
                    const pct = stats.totalClaims > 0 ? (t.count / stats.totalClaims) * 100 : 0;
                    return (
                      <div key={t.name} className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-600">
                        <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                        <span className="truncate font-medium flex-1">{t.name}</span>
                        <span className="font-bold text-slate-800">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart 3: Status Distribution (SVG Bar Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Status Distribution</h4>
                <p className="text-[10px] text-slate-400">Total claims per status stage</p>
              </div>
              <div className="relative h-44 flex items-end justify-center">
                <svg viewBox="0 0 200 120" className="w-full h-full">
                  <line x1="10" y1="20" x2="190" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="60" x2="190" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="100" x2="190" y2="100" stroke="#e2e8f0" strokeWidth="1" />

                  {(() => {
                    const counts = stats.statuses.map(s => s.count);
                    const maxCount = Math.max(...counts, 1);
                    const colors: Record<string, string> = {
                      Pending: '#3b82f6',
                      'In Progress': '#f59e0b',
                      Approved: '#10b981',
                      Rejected: '#ef4444',
                      Settled: '#059669',
                    };
                    return stats.statuses.map((s, idx) => {
                      const barWidth = 18;
                      const x = 20 + idx * 35;
                      const barHeight = (s.count / maxCount) * 80;
                      const y = 100 - barHeight;
                      return (
                        <g key={s.name}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx="2"
                            fill={colors[s.name] || '#64748b'}
                          />
                          <text x={x + 9} y={y - 4} fontSize="7" fontWeight="bold" fill="#475569" textAnchor="middle">{s.count}</text>
                          <text x={x + 9} y="113" fontSize="6" fill="#64748b" textAnchor="middle" transform={`rotate(0, ${x + 9}, 113)`}>{s.name}</text>
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>
            </div>

          </div>

          {/* Breakdown Tables Grid (2x2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Company wise */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company-wise Breakdown & Share</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Company</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.companies.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-4 text-slate-400">No data found</td></tr>
                    ) : (
                      stats.companies.map(c => {
                        const pct = stats.totalClaimed > 0 ? (c.claimed / stats.totalClaimed) * 100 : 0;
                        return (
                          <tr key={c.name} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2">
                              <span className="font-medium block">{c.name}</span>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold">{c.count}</td>
                            <td className="px-3 py-2 text-right">₹{c.claimed.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{c.settled.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hospital wise */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital-wise Breakdown & Share</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Hospital</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.hospitals.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-4 text-slate-400">No data found</td></tr>
                    ) : (
                      stats.hospitals.map(h => {
                        const pct = stats.totalClaimed > 0 ? (h.claimed / stats.totalClaimed) * 100 : 0;
                        return (
                          <tr key={h.name} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2">
                              <span className="font-medium block truncate max-w-[150px]" title={h.name}>{h.name}</span>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold">{h.count}</td>
                            <td className="px-3 py-2 text-right">₹{h.claimed.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{h.settled.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Claim Type Breakdown (Cashless/Reimburse) */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claim Type Breakdown (Cashless / Reimbursement)</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.types.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-4 text-slate-400">No data found</td></tr>
                    ) : (
                      stats.types.map(t => {
                        const pct = stats.totalClaimed > 0 ? (t.claimed / stats.totalClaimed) * 100 : 0;
                        return (
                          <tr key={t.name} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2">
                              <span className="font-medium block">{t.name}</span>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold">{t.count}</td>
                            <td className="px-3 py-2 text-right">₹{t.claimed.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{t.settled.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Duration Breakdown */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration-wise Breakdown</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Time Range</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {[
                      { name: 'Last 30 Days', filter: (c: any) => (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000 <= 30 },
                      { name: '31 to 90 Days', filter: (c: any) => { const diff = (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000; return diff > 30 && diff <= 90; } },
                      { name: 'Older (90+ Days)', filter: (c: any) => (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000 > 90 },
                    ].map(range => {
                      const matched = filteredClaims.filter(range.filter);
                      const claimed = matched.reduce((sum: number, c: any) => sum + Number(c.claimAmount || 0), 0);
                      const settled = matched.reduce((sum: number, c: any) => sum + Number(c.approvedAmount || 0), 0);
                      const pct = stats.totalClaimed > 0 ? (claimed / stats.totalClaimed) * 100 : 0;
                      return (
                        <tr key={range.name} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <span className="font-medium block">{range.name}</span>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">{matched.length}</td>
                          <td className="px-3 py-2 text-right">₹{claimed.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{settled.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Tabs Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Right Side: Status Tabs */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="bg-slate-100/80 p-1 rounded-xl flex flex-wrap gap-1 border border-slate-200/50">
            <button
              type="button"
              onClick={() => setFilterStatus('All')}
              className={clsx(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none',
                filterStatus === 'All' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              All
            </button>
            {UI_STATUSES.map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st as any)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none',
                  filterStatus === st ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <DataTable
            columns={COLS.map(c => ({ ...c, sortable: c.key !== 'actions' }))}
            data={sortedClaims}
            total={sortedClaims.length}
            page={page}
            pageSize={20}
            loading={isLoading}
            rowKey={r => r.id}
            onPageChange={setPage}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(k) => {
              if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
              else { setSortKey(k); setSortDir('asc'); }
            }}
            onRowClick={r => {
              setSelectedClaim(r);
              setDetailOpen(true);
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 pb-4 flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {['Pending', 'In Progress', 'Approved', 'Rejected', 'Settled'].map(stage => {
            const stageClaims = sortedClaims.filter(c => (BACKEND_TO_UI[c.status] || 'Pending') === stage);
            const totalClaimed = stageClaims.reduce((sum, curr) => sum + Number(curr.claimAmount || 0), 0);
            const AVATAR_BG: Record<string, string> = {
              'Pending': 'bg-slate-500', 'In Progress': 'bg-blue-500', 'Approved': 'bg-purple-500',
              'Rejected': 'bg-red-500', 'Settled': 'bg-emerald-500',
            };
            const BORDER_TOP: Record<string, string> = {
              'Pending': 'border-t-4 border-t-slate-400', 'In Progress': 'border-t-4 border-t-blue-500',
              'Approved': 'border-t-4 border-t-purple-500', 'Rejected': 'border-t-4 border-t-red-500',
              'Settled': 'border-t-4 border-t-emerald-500',
            };
            const SHADOW_HOVER: Record<string, string> = {
              'Pending': 'hover:shadow-md hover:shadow-slate-500/10 hover:border-slate-400',
              'In Progress': 'hover:shadow-md hover:shadow-blue-500/10 hover:border-blue-400',
              'Approved': 'hover:shadow-md hover:shadow-purple-500/10 hover:border-purple-400',
              'Rejected': 'hover:shadow-md hover:shadow-red-500/10 hover:border-red-400',
              'Settled': 'hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-400',
            };
            const RING_COLOR: Record<string, string> = {
              'Pending': 'ring-slate-500/20', 'In Progress': 'ring-blue-500/20', 'Approved': 'ring-purple-500/20',
              'Rejected': 'ring-red-500/20', 'Settled': 'ring-emerald-500/20',
            };
            return (
              <div
                key={stage}
                className="flex flex-col min-w-0"
              >
                <div className="flex items-center justify-between mb-2 px-1.5 py-1 select-none">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className={clsx('h-2 w-2 rounded-full shrink-0',
                      stage === 'Pending' && 'bg-slate-500',
                      stage === 'In Progress' && 'bg-blue-500',
                      stage === 'Approved' && 'bg-purple-500',
                      stage === 'Rejected' && 'bg-red-500',
                      stage === 'Settled' && 'bg-emerald-500'
                    )} />
                    <span className="text-xs font-bold text-slate-800 truncate">{stage}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/50 px-1 py-0.5 rounded-md shrink-0">{stageClaims.length}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[9px] text-slate-400 font-bold shrink-0">
                      ₹{totalClaimed >= 100000 ? `${(totalClaimed / 100000).toFixed(1)}L` : `${(totalClaimed / 1000).toFixed(1)}K`}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-h-[350px] rounded-xl border p-1.5 space-y-1.5 transition-all duration-200 overflow-y-auto custom-scrollbar bg-slate-50/50">
                  {stageClaims.map(c => {
                    const notes = getClaimNotesData(c.notes);
                    const emp = employees.find((e: any) => e.id === c.assignedEmployeeId);
                    const assigneeName = emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedClaim(c);
                          setDetailOpen(true);
                        }}
                        className={clsx(
                          'bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-150 flex flex-col gap-3 group relative overflow-hidden',
                          BORDER_TOP[stage] ?? 'border-t-4 border-t-slate-300',
                          SHADOW_HOVER[stage] ?? 'hover:shadow-slate-500/10'
                        )}
                      >
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <div className={clsx('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ring-4',
                              AVATAR_BG[stage] ?? 'bg-slate-500', RING_COLOR[stage] ?? 'ring-slate-500/20')}>
                              {`${c.contact?.firstName?.[0] ?? ''}${c.contact?.lastName?.[0] ?? ''}`.toUpperCase() || 'CL'}
                            </div>
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-[9px] font-bold text-slate-600 bg-slate-50 tracking-wider">
                              {c.claimNumber || 'NO-ID'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-1.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setEditTarget(c)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-slate-50 transition-colors" title="Edit Claim">
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => setDeleteTarget(c)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-slate-50 transition-colors" title="Delete Claim">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-[13px] font-bold text-slate-900 leading-snug hover:text-blue-600 transition-colors truncate">
                            {c.contact?.firstName} {c.contact?.lastName}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Filed {c.intimatedAt ? format(new Date(c.intimatedAt), 'dd/MMM/yyyy') : ''}</p>
                        </div>

                        <div className="border-t border-slate-100/80 my-0.5" />

                        <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <MapPin size={12} className="text-slate-500 shrink-0" />
                            <span className="truncate">{notes.hospital || 'Unknown Hospital'}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <Shield size={12} className="text-slate-500 shrink-0" />
                            <span className="truncate font-semibold text-slate-800">{c.policy?.plan?.name || c.claimType || 'No Plan'}</span>
                          </div>

                          <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-900 mt-1">
                            <span className="text-[11px] text-emerald-700 font-medium">Claimed</span>
                            <span className="font-bold text-emerald-800 text-xs">
                              ₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-900 mt-1">
                            <span className="text-[11px] text-blue-700 font-medium">Settled</span>
                            <span className="font-bold text-blue-800 text-xs">
                              {c.approvedAmount ? `₹${Number(c.approvedAmount).toLocaleString('en-IN')}` : '—'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5 gap-2" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-1 text-slate-500 text-[9px] font-semibold truncate">
                            <UserCircle2 size={10} className="text-slate-400 shrink-0" />
                            <span className="truncate">{assigneeName}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {stageClaims.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                      <LayoutGrid size={32} className="opacity-20 mb-2" />
                      <p className="text-xs font-medium">No claims</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal 
        open={modalOpen} 
        onClose={closeModal} 
        title="Add New Claim" 
        size="2xl"
        actions={
          <button type="submit" form="add-claim-form" className="btn-primary py-1.5 px-5 text-xs shadow-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0" disabled={createClaim.isPending}>
            {createClaim.isPending ? 'Saving...' : 'Save Claim'}
          </button>
        }
      >
        <>
          <div className="pb-3 text-xs text-slate-400 font-semibold -mt-1 mb-4 border-b border-slate-100">
            Enter details for the new insurance claim.
          </div>
          <form id="add-claim-form" onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-3">
            
            {/* Modal sub-navigation tabs */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mt-0 mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
            {['Claim Details', 'Hospital Details', 'Claim Approval Details', 'File Uploads'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveClaimTab(tab)}
                className={clsx(
                  'px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap',
                  activeClaimTab === tab
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="h-[430px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {activeClaimTab === 'Claim Details' && (
              <div className="space-y-4 animate-fadeIn">
                
                {/* Proposer Details Collapsible */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('newProposer')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                      Proposer & Policy Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Customer & Policy Data</span>
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newProposer'] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {!collapsedSections['newProposer'] && (
                    <div className="p-4 space-y-4">
                      {/* Select Customer */}
                  <div className="relative">
                    <label className="label">Select Customer <span className="text-red-500">*</span></label>
                    <input type="hidden" {...register('contactId')} />
                    <div className="relative mt-1">
                      <input
                        value={selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName} (${selectedContact.phone})` : contactSearch}
                        onChange={e => {
                          if (selectedContact) {
                            setSelectedContact(null);
                            setValue('contactId', '');
                            setSelectedPolicy(null);
                            setValue('policyId', '');
                            setContactSearch(e.target.value);
                          }
                          setContactSearch(e.target.value);
                          setContactDropdown(true);
                        }}
                        onFocus={() => setContactDropdown(true)}
                        onBlur={() => setTimeout(() => setContactDropdown(false), 200)}
                        placeholder="Choose a customer..."
                        className="input w-full pl-10 pr-10 bg-white"
                      />
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▼</span>
                    </div>
                    {contactDropdown && !selectedContact && (
                      <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                        {(contactResults?.data ?? []).length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-400">No contacts found</li>
                        ) : (
                          (contactResults?.data ?? []).map((c: any) => (
                            <li key={c.id} onMouseDown={() => {
                              setSelectedContact(c);
                              setValue('contactId', c.id, { shouldValidate: true });
                              setContactDropdown(false);
                              setContactSearch('');
                            }} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                              <span className="font-semibold">{c.firstName} {c.lastName}</span>
                              <span className="text-gray-400 text-xs ml-auto">{c.phone}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Select Policy & Patient / Insured Person */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Select Policy */}
                    <div className="relative">
                      <label className="label">Select Policy <span className="text-red-500">*</span></label>
                      <input type="hidden" {...register('policyId')} />
                      <button
                        type="button"
                        onClick={() => setPolicyDropdown(v => !v)}
                        className="input w-full text-left text-gray-700 bg-white mt-1 flex justify-between items-center"
                      >
                        <span className={!selectedPolicy ? "text-gray-400" : ""}>
                          {selectedPolicy ? selectedPolicy.policyNumber : 'Select Policy'}
                        </span>
                        <span className="text-gray-400">▼</span>
                      </button>
                      {policyDropdown && (
                        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                          {activeContactPolicies.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-gray-400">No active policies</li>
                          ) : (
                            activeContactPolicies.map((p: any) => (
                              <li key={p.id} onMouseDown={() => {
                                setSelectedPolicy(p);
                                setValue('policyId', p.id, { shouldValidate: true });
                                setValue('insuranceCompany', p.plan?.company?.name || '');
                                setValue('insuranceCompanyCategory', p.plan?.company?.category || 'Health');
                                setValue('insuranceProductName', p.plan?.name || '');
                                setValue('agentName', p.agent?.firstName ? `${p.agent.firstName} ${p.agent.lastName}` : '');
                                setValue('deathSumInsured', String(p.sumInsured || p.plan?.sumInsured || ''));
                                setPolicyDropdown(false);
                                
                                const pNominees = Array.isArray(p.nominees) ? p.nominees : [];
                                setNewNominees(pNominees.map((n: any) => ({
                                  name: n.name || '',
                                  relationship: n.relationship || '',
                                  phone: n.phone || '',
                                  dob: n.dob ? n.dob.substring(0, 10) : '',
                                  percentage: n.percentage || '',
                                  comment: n.comment || ''
                                })));
                              }} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                                <span className="font-medium">{p.policyNumber}</span>
                                {p.plan && <span className="text-gray-400 text-xs ml-auto">{p.plan.name}</span>}
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>

                    {/* Patient / Insured Person */}
                    <div>
                      <label className="label">Patient / Insured Person</label>
                      <select
                        disabled={!selectedContact}
                        className="input w-full bg-white mt-1"
                        {...register('patientName')}
                      >
                        <option value="">Select Patient</option>
                        {selectedContact && (
                          <>
                            <option value={`${selectedContact.firstName} ${selectedContact.lastName}`}>
                              SELF - {selectedContact.firstName} {selectedContact.lastName}
                            </option>
                            {(contactDetail?.data?.relationships || []).map((r: any) => {
                              const c = r.relatedContact;
                              if (!c) return null;
                              const fullName = `${c.firstName} ${c.lastName}`;
                              return (
                                <option key={c.id} value={fullName}>
                                  {r.relationshipType} - {fullName}
                                </option>
                              );
                            })}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Auto-Fetched Policy Details & Assigned Employee */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label text-gray-500">Insurance Company Category</label>
                      <input {...register('insuranceCompanyCategory')} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="label text-gray-500">Insurance Company</label>
                      <input {...register('insuranceCompany')} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="label text-gray-500">Product Name</label>
                      <input {...register('insuranceProductName')} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="label text-gray-500">Agent Name</label>
                      <input {...register('agentName')} readOnly className="input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="label">Assigned Employee</label>
                      <select {...register('assignedEmployeeId')} className="input mt-1 bg-white">
                        <option value="">Unassigned</option>
                        {employees.map((e: any) => (
                          <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                        ))}
                      </select>
                    </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Claim Details Collapsible */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('newClaim')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                      Claim Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Diagnosis & Status</span>
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newClaim'] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {!collapsedSections['newClaim'] && (
                    <div className="p-4 space-y-4">
                      {/* Row: Claim Type | Claim Number | Sub Claim No */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Claim Type <span className="text-red-500">*</span></label>
                      <select {...register('claimType')} className="input mt-1">
                        <option value="Cashless">Cashless</option>
                        <option value="Reimbursement">Reimbursement</option>
                        <option value="Pre-Post Hospitalization">Pre-Post Hospitalization</option>
                        <option value="Accident">Accident</option>
                        <option value="Death Claim">Death Claim</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Claim Number <span className="text-red-500">*</span></label>
                      <input {...register('claimNumber')} className="input mt-1" placeholder="CLM-XXXXXXXX" />
                    </div>
                    <div>
                      <label className="label">Sub Claim No</label>
                      <input {...register('subClaimNo')} className="input mt-1" placeholder="Optional" />
                    </div>
                  </div>

                  {/* Row: Status | Intimation Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Claim Status</label>
                      <select {...register('uiClaimStatus')} className="input mt-1">
                        <option value="">Select Status</option>
                        <option value="Intimated">Intimated</option>
                        <option value="Discharge Done">Discharge Done</option>
                        <option value="Pending Documents from Hospital/Customer">Pending Documents from Hospital/Customer</option>
                        <option value="Documents Collected from Hospital/Customer">Documents Collected from Hospital/Customer</option>
                        <option value="Submitted to Company">Submitted to Company</option>
                        <option value="Pending for approval">Pending for approval</option>
                        <option value="Query Raised">Query Raised</option>
                        <option value="Query Resolved">Query Resolved</option>
                        <option value="Partially Approved">Partially Approved</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="No Response from Customer">No Response from Customer</option>
                        <option value="Pre-Authorisation Approved">Pre-Authorisation Approved</option>
                        <option value="Pre-Authorisation Rejected">Pre-Authorisation Rejected</option>
                        <option value="Enhancement Approved">Enhancement Approved</option>
                        <option value="Enhancement Rejected">Enhancement Rejected</option>
                        <option value="Interim Authorisation Approved">Interim Authorisation Approved</option>
                        <option value="Interim Authorisation Rejected">Interim Authorisation Rejected</option>
                        <option value="Final Authorisation Approved">Final Authorisation Approved</option>
                        <option value="Final Authorisation Rejected">Final Authorisation Rejected</option>
                        <option value="Advised to go for Reimbursement">Advised to go for Reimbursement</option>
                        <option value="Treatment Cancelled/Changed">Treatment Cancelled/Changed</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Intimation Date <span className="text-red-500">*</span></label>
                      <DatePicker {...register('intimatedAt')} className="input mt-1" />
                    </div>
                  </div>

                  {/* Row: Diagnosis | Comment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Diagnosis / Ailment</label>
                      <input {...register('diagnosis')} className="input mt-1" placeholder="e.g. Dengue Fever" />
                    </div>
                    <div>
                      <label className="label">Comment</label>
                      <textarea {...register('comment')} className="input mt-1" rows={2} placeholder="Add a comment..." />
                    </div>
                  </div>
                    </div>
                  )}
                </div>

                {watchClaimType === 'Death Claim' && (
                  <div className="border border-red-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-50/80 via-white to-orange-50/30 px-4 py-2.5 border-b border-red-100 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleCollapse('newDeath')}
                    >
                      <h4 className="text-xs font-extrabold text-red-600 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">!</span>
                        Death Claim Details
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-red-400 font-semibold">Incident Info</span>
                        <ChevronDown size={16} className={`text-red-500 transition-transform duration-200 ${collapsedSections['newDeath'] ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {!collapsedSections['newDeath'] && (
                      <div className="p-4 bg-red-50/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="label text-gray-500">Date of Admission <br/><span className="text-[10px] font-normal">(In case of hosp.)</span></label>
                        <input type="date" {...register('deathAdmissionDate')} className="input mt-1" />
                      </div>
                      <div>
                        <label className="label text-gray-500">Cause of Death</label>
                        <select {...register('causeOfDeath')} className="input mt-1">
                          <option value="">Select Cause</option>
                          <option value="Accidental">Accidental</option>
                          <option value="Non-Accidental">Non-Accidental</option>
                          <option value="Murder">Murder</option>
                          <option value="Natural">Natural</option>
                          <option value="Suicide">Suicide</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-gray-500">Date of Occurance <br/><span className="text-[10px] font-normal">(Accident, Attack, etc)</span></label>
                        <input type="date" {...register('dateOfOccurance')} className="input mt-1" />
                      </div>
                      <div>
                        <label className="label text-gray-500">Date of Death</label>
                        <input type="date" {...register('dateOfDeath')} className="input mt-1" />
                      </div>
                      <div>
                        <label className="label text-gray-500">Was in Coma?</label>
                        <select {...register('wasInComa')} className="input mt-1">
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-gray-500">Sum Insured</label>
                        <input {...register('deathSumInsured')} className="input mt-1 bg-white" placeholder="Auto-fetch or manual" />
                      </div>
                      <div>
                        <label className="label text-gray-500">Total Claimed Amount</label>
                        <input {...register('deathTotalClaimedAmount')} className="input mt-1 bg-white" placeholder="₹0" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="label text-gray-500">Comment</label>
                        <textarea {...register('deathComment')} className="input mt-1" rows={1} />
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Nominee Details Collapsible */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('newNominee')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                      Nominee Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Multiple allowed</span>
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newNominee'] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {!collapsedSections['newNominee'] && (
                    <div className="p-4 space-y-4">
                      {newNominees.map((nom, index) => (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end border-b border-gray-100 pb-4 mb-2">
                          <div>
                            <label className="label text-[10px]">Nominee Name <span className="text-red-500">*</span></label>
                            <input 
                              value={nom.name} 
                              placeholder="Full name"
                              onChange={e => handleNewNomineeChange(index, 'name', e.target.value)} 
                              className="input mt-1 py-1 text-xs" 
                            />
                          </div>
                          <div>
                            <label className="label text-[10px]">Relationship <span className="text-red-500">*</span></label>
                            <input 
                              value={nom.relationship} 
                              placeholder="e.g. Spouse, Son"
                              onChange={e => handleNewNomineeChange(index, 'relationship', e.target.value)} 
                              className="input mt-1 py-1 text-xs" 
                            />
                          </div>
                          <div>
                            <label className="label text-[10px]">Contact No. <span className="text-red-500">*</span></label>
                            <input 
                              type="tel"
                              maxLength={10}
                              value={nom.phone} 
                              placeholder="10-digit mobile"
                              onChange={e => handleNewNomineeChange(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))} 
                              className="input mt-1 py-1 text-xs" 
                            />
                          </div>
                          <div>
                            <label className="label text-[10px]">DoB</label>
                            <input type="date" value={nom.dob} onChange={e => handleNewNomineeChange(index, 'dob', e.target.value)} className="input mt-1 py-1 text-xs" />
                          </div>
                          <div>
                            <label className="label text-[10px]">Percentage (%)</label>
                            <input 
                              type="number" 
                              min={0}
                              max={100}
                              value={nom.percentage} 
                              placeholder="100"
                              onChange={e => handleNewNomineeChange(index, 'percentage', e.target.value)} 
                              className="input mt-1 py-1 text-xs" 
                            />
                          </div>
                          <div className="flex gap-2">
                            <input value={nom.comment} onChange={e => handleNewNomineeChange(index, 'comment', e.target.value)} placeholder="Comment" className="input mt-1 py-1 text-xs flex-1" />
                            <button type="button" onClick={() => removeNewNominee(index)} className="mt-1 bg-red-50 text-red-500 hover:bg-red-100 px-2 rounded-lg text-xs font-bold transition-colors">X</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={addNewNomineeRow} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                        + Add Nominee
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeClaimTab === 'Hospital Details' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('newHospital')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">H</span>
                      Hospital Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Location & Contact</span>
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newHospital'] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {!collapsedSections['newHospital'] && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="label text-[10px]">Hospital City</label>
                          <select 
                            className="input mt-1 py-1 text-xs" 
                            {...register('hospitalCity')}
                            onChange={(e) => {
                              setValue('hospitalCity', e.target.value);
                              setValue('hospitalName', '');
                              setValue('hospitalAddress', '');
                              setValue('hospitalState', '');
                              setValue('hospitalPincode', '');
                              setValue('hospitalContactNo', '');
                              setValue('hospitalRating', '');
                              setValue('hospitalType', '');
                            }}
                          >
                            <option value="">Select City</option>
                            {Array.from<string>(new Set(hospitals.map((h: any) => h.hospitalCity as string).filter(Boolean))).map((c: string) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label text-[10px]">Hospital Name</label>
                          <select 
                            className="input mt-1 py-1 text-xs" 
                            {...register('hospitalName')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setValue('hospitalName', val);
                              const hosp = hospitals.find((h: any) => h.hospitalName === val);
                              if (hosp) {
                                if (!watchHospitalCity) setValue('hospitalCity', hosp.hospitalCity);
                                setValue('hospitalAddress', ''); // Store doesn't have precise address line, leave blank or we could map from city
                                setValue('hospitalState', hosp.hospitalState);
                                setValue('hospitalPincode', hosp.hospitalPincode);
                                setValue('hospitalContactNo', hosp.hospitalContactNo);
                                setValue('hospitalRating', hosp.hospitalRating);
                                setValue('hospitalType', hosp.hospitalType);
                              }
                            }}
                          >
                            <option value="">Select Hospital</option>
                            {hospitals.filter((h: any) => !watchHospitalCity || h.hospitalCity === watchHospitalCity).map((h: any) => (
                              <option key={h.id} value={h.hospitalName}>{h.hospitalName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label text-[10px]">Hospital Pincode</label>
                          <input
                            type="text"
                            maxLength={6}
                            className="input mt-1 py-1 text-xs"
                            {...register('hospitalPincode', {
                              onChange: (e) => setValue('hospitalPincode', e.target.value.replace(/\D/g, '').slice(0, 6))
                            })}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px]">Hospital Contact No</label>
                          <input
                            type="tel"
                            maxLength={10}
                            className="input mt-1 py-1 text-xs"
                            placeholder="10-digit mobile"
                            {...register('hospitalContactNo', {
                              onChange: (e) => setValue('hospitalContactNo', e.target.value.replace(/\D/g, '').slice(0, 10))
                            })}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px]">Hospital Rating</label>
                          <input type="text" className="input mt-1 py-1 text-xs" {...register('hospitalRating')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Hospital Type</label>
                          <select className="input mt-1 py-1 text-xs" {...register('hospitalType')}>
                            <option value="">Select Type</option>
                            <option value="Network">Network</option>
                            <option value="Non-Network">Non-Network</option>
                            <option value="Blacklisted">Blacklisted</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-[11px] font-bold text-slate-700">Doctors / Consulting Providers</h5>
                          {watchHospitalName && hospitals.find((h: any) => h.hospitalName === watchHospitalName)?.hospitalDoctors?.length > 0 && (
                            <select 
                              className="input py-0.5 text-[10px] w-auto h-auto"
                              onChange={(e) => {
                                if (e.target.value) {
                                  setNewDoctors([...newDoctors, { name: e.target.value, degree: '', registrationNo: '', contactNo: '', charges: '' }]);
                                  e.target.value = '';
                                }
                              }}
                            >
                              <option value="">+ Add from Hospital</option>
                              {hospitals.find((h: any) => h.hospitalName === watchHospitalName)?.hospitalDoctors.map((d: any) => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        {newDoctors.map((doc, index) => (
                          <div key={index} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end border-b border-gray-100 pb-4 mb-2">
                            <div>
                              <label className="label text-[10px]">Doctor Name</label>
                              <input value={doc.name} onChange={e => handleNewDoctorChange(index, 'name', e.target.value)} className="input mt-1 py-1 text-xs" list={`doc-list-${index}`} />
                              <datalist id={`doc-list-${index}`}>
                                {watchHospitalName && hospitals.find((h: any) => h.hospitalName === watchHospitalName)?.hospitalDoctors.map((d: any) => (
                                  <option key={d.id} value={d.name} />
                                ))}
                              </datalist>
                            </div>
                            <div>
                              <label className="label text-[10px]">Doctor Degree</label>
                              <input value={doc.degree} onChange={e => handleNewDoctorChange(index, 'degree', e.target.value)} className="input mt-1 py-1 text-xs" />
                            </div>
                            <div>
                              <label className="label text-[10px]">Doctor Contact No</label>
                              <input
                                type="tel"
                                maxLength={10}
                                placeholder="10-digit mobile"
                                value={doc.contactNo}
                                onChange={e => handleNewDoctorChange(index, 'contactNo', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                className="input mt-1 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="label text-[10px]">Doctor Speciality</label>
                              <input value={doc.speciality} onChange={e => handleNewDoctorChange(index, 'speciality', e.target.value)} className="input mt-1 py-1 text-xs" />
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => removeNewDoctor(index)} className="mt-1 bg-red-50 text-red-500 hover:bg-red-100 px-2 rounded-lg text-xs font-bold transition-colors">X</button>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={addNewDoctorRow} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                          + Add Doctor
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <h5 className="text-[11px] font-bold text-slate-700 mb-2">Claims Department Contact</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="label text-[10px]">Person 1 Name</label>
                            <input type="text" className="input mt-1 py-1 text-xs" {...register('claimsPerson1Name')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Person 1 Contact No</label>
                            <input
                              type="tel"
                              maxLength={10}
                              placeholder="10-digit mobile"
                              className="input mt-1 py-1 text-xs"
                              {...register('claimsPerson1Contact', {
                                onChange: (e) => setValue('claimsPerson1Contact', e.target.value.replace(/\D/g, '').slice(0, 10))
                              })}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px]">Person 2 Name</label>
                            <input type="text" className="input mt-1 py-1 text-xs" {...register('claimsPerson2Name')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Person 2 Contact No</label>
                            <input
                              type="tel"
                              maxLength={10}
                              placeholder="10-digit mobile"
                              className="input mt-1 py-1 text-xs"
                              {...register('claimsPerson2Contact', {
                                onChange: (e) => setValue('claimsPerson2Contact', e.target.value.replace(/\D/g, '').slice(0, 10))
                              })}
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="label text-[10px]">Comment</label>
                            <textarea className="input mt-1 py-1 text-xs" rows={2} {...register('hospitalComment')} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hospitalisation Details Collapsible */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('newHospitalisation')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">H</span>
                      Hospitalisation Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newHospitalisation'] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {!collapsedSections['newHospitalisation'] && (
                    <div className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="label text-[10px]">Date of Admission</label>
                          <input type="date" className="input mt-1 py-1 text-xs" {...register('admissionAt')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Date of Discharge</label>
                          <input type="date" className="input mt-1 py-1 text-xs" {...register('dischargeAt')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Diagnosis / Ailment (Exact as written on DS)</label>
                          <input type="text" className="input mt-1 py-1 text-xs" {...register('diagnosis')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Diagnosis in simple words</label>
                          <input type="text" className="input mt-1 py-1 text-xs" {...register('diagnosisSimple')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Room Category</label>
                          <input type="text" className="input mt-1 py-1 text-xs" {...register('roomCategory')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Type of Management</label>
                          <select className="input mt-1 py-1 text-xs" {...register('typeOfManagement')}>
                            <option value="">Select Option</option>
                            <option value="Surgical">Surgical</option>
                            <option value="Medicinal">Medicinal</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-[10px]">Type of Admission</label>
                          <select className="input mt-1 py-1 text-xs" {...register('typeOfAdmission')}>
                            <option value="">Select Option</option>
                            <option value="Emergency">Emergency</option>
                            <option value="Planned">Planned</option>
                            <option value="Day-Care">Day-Care</option>
                            <option value="Maternity">Maternity</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-[10px]">Is Medico Legal Case?</label>
                          <select className="input mt-1 py-1 text-xs" {...register('isMedicoLegalCase')}>
                            <option value="">Select Option</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="label text-[10px]">Comment</label>
                          <input type="text" className="input mt-1 py-1 text-xs" {...register('hospitalisationComment')} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Billing Details Collapsible */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('newBilling')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">B</span>
                      Billing Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newBilling'] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {!collapsedSections['newBilling'] && (
                    <div className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="label text-[10px]">Pre Hospitalisation Bill</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtPreHosp')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Hospital Final Bill</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtHospital')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Anesthesia Bill</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtAnesthesia')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Medicine Bill Total</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtMedicine')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Lab Bill Total</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtLab')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Post Hospitalisation Bill</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtPostHosp')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Others (Amount)</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtOthers')} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Total Claimed Amount</label>
                          <input type="number" className="input mt-1 py-1 text-xs bg-slate-50 cursor-not-allowed" {...register('claimAmount')} readOnly />
                        </div>
                        <div>
                          <label className="label text-[10px]">Comment</label>
                          <input type="text" className="input mt-1 py-1 text-xs" {...register('billingComment')} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeClaimTab === 'Claim Approval Details' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleCollapse('newClaimApproval')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">CA</span>
                      Claim Approval Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newClaimApproval'] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {!collapsedSections['newClaimApproval'] && (
                    <div className="p-4 space-y-4">
                      {/* Final Bill Amount */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="label text-[10px]">Final Bill Amount</label>
                          <input type="number" className="input mt-1 py-1 text-xs" {...register('amtFinalBill')} />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <h5 className="text-[11px] font-bold text-slate-700 mb-2">Less: To be Paid by the Patient / Insured</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <label className="label text-[10px]">Non-Payables as per policy terms</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtNonPayables')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Co-pay, if applicable as per policy</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtCopay')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Policy Deductible / Defined Limits / Voluntary Deductible</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtDeductible')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Balance EMIs to be paid by the insured (if applicable)</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtBalanceEMIs')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Recovery towards No Claim Discount in the renewed policy</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtNcdRecovery')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Excess Over Sum Insured / Sublimit</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtExcessSumInsured')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Excess Over Defined ailment / procedure Sub-limit</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtExcessAilmentLimit')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Higher room rent occupancy and related medical services</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtHigherRoomRent')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Reasonable cost</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtReasonableCost')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Other recoveries, if any</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtOtherRecoveries')} />
                          </div>
                          <div>
                            <label className="label text-[10px] font-semibold text-blue-600">Total amount to be paid by the patient / insured</label>
                            <input type="number" className="input mt-1 py-1 text-xs bg-blue-50 cursor-not-allowed font-semibold text-blue-700" {...register('amtPatientToPay')} readOnly />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <h5 className="text-[11px] font-bold text-slate-700 mb-2">Less: Amounts NOT to be Collected from the Patient</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <label className="label text-[10px]">Excess amount charged over the agreed package / SOC</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtExcessAgreedPackage')} />
                          </div>
                          <div>
                            <label className="label text-[10px]">Network hospital discount (not to be collected from the patient)</label>
                            <input type="number" className="input mt-1 py-1 text-xs" {...register('amtNetworkDiscount')} />
                          </div>
                          <div>
                            <label className="label text-[10px] font-semibold text-green-600">Total Amount NOT to be collected from the patient</label>
                            <input type="number" className="input mt-1 py-1 text-xs bg-green-50 cursor-not-allowed font-semibold text-green-700" {...register('amtNotCollected')} readOnly />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label text-[10px] font-bold text-indigo-700">Amount payable by Insurance Company to the Insured/Hospital</label>
                            <input type="number" className="input mt-1 py-1 text-xs bg-indigo-50 border-indigo-200 cursor-not-allowed font-bold text-indigo-700" {...register('amtPayableToInsured')} readOnly />
                          </div>
                          <div>
                            <label className="label text-[10px]">Comment</label>
                            <input type="text" className="input mt-1 py-1 text-xs" {...register('approvalComment')} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeClaimTab === 'Amounts' && (
              <div className="space-y-4 animate-fadeIn">
                {/* CLAIMED AMOUNT BREAKDOWN Card */}
                <div className="bg-emerald-50/20 border border-emerald-100/50 p-5 rounded-2xl space-y-4">
                  <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest block">Claimed Amount Breakdown</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">Hospital Amount</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input {...register('amtHospital')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Medicine Amount</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input {...register('amtMedicine')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Lab Amount</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input {...register('amtLab')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Pre Hospitalisation Bill</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input {...register('amtPreHosp')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Post Hospitalisation Bill</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input {...register('amtPostHosp')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Others</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                        <input {...register('amtOthers')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                      </div>
                    </div>
                  </div>

                  {/* Total Amount Green Banner */}
                  <div className="bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-lg flex items-center justify-between text-sm font-bold text-emerald-800">
                    <span>Total Amount</span>
                    <span>₹{Number(watch('claimAmount') || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Approved Amount & Other/Deductions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Approved Amount</label>
                    <input {...register('approvedAmount')} type="number" className="input mt-1" placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Other/Deductions</label>
                    <input {...register('deductionsNotes')} className="input mt-1" placeholder="Notes on deductions..." />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes / Remarks</label>
                  <textarea {...register('notes')} className="input mt-1" rows={2} placeholder="Timeline logs details..." />
                </div>
              </div>
            )}

        {activeClaimTab === 'File Uploads' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden mt-4">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('newDocuments')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">F</span>
                  File Uploads
                </h4>
                <div className="flex items-center gap-2">
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsedSections['newDocuments'] ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {!collapsedSections['newDocuments'] && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <FileUploadCard label="Claim Form" file={claimFormFile} onFileChange={setClaimFormFile} />
                    <FileUploadCard label="Discharge Summary" file={dischargeSummaryFile} onFileChange={setDischargeSummaryFile} />
                    <FileUploadCard label="Operation Theatre Notes / IPD Papers" file={otNotesFile} onFileChange={setOtNotesFile} />
                    <FileUploadCard label="Bill - Hospital Bill, Breakup Bill" file={hospitalBillFile} onFileChange={setHospitalBillFile} />
                    <FileUploadCard label="Bill - Pharmacy, Medicines" file={pharmacyBillFile} onFileChange={setPharmacyBillFile} />
                    <FileUploadCard label="Bill - Investigation, Lab Reports" file={investigationBillFile} onFileChange={setInvestigationBillFile} />
                    <FileUploadCard label="Bill - Blood Bags, Anesthesia, Other" file={bloodBagsBillFile} onFileChange={setBloodBagsBillFile} />
                    <FileUploadCard label="Reports - Important Lab Reports" file={labReportsFile} onFileChange={setLabReportsFile} />
                    <FileUploadCard label="Imp Bills" file={billsFile} onFileChange={setBillsFile} />
                    <FileUploadCard label="Other IMP Documents" file={otherImpDocsFile} onFileChange={setOtherImpDocsFile} />
                    <FileUploadCard label="Claim Query Letter" file={queryLetterFile} onFileChange={setQueryLetterFile} />
                    <FileUploadCard label="Reply Documents" file={replyDocsFile} onFileChange={setReplyDocsFile} />
                    <FileUploadCard label="Claim Settlement Letter" file={settlementLetterFile} onFileChange={setSettlementLetterFile} />
                    <FileUploadCard label="Rejection Letter" file={rejectionLetterFile} onFileChange={setRejectionLetterFile} />
                    <div className="col-span-1 sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Comment</label>
                      <input type="text" {...register('fileUploadComment')} placeholder="Add notes for uploaded documents..." className="input w-full bg-white mt-1 text-xs py-1.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
          </div>

          </form>
        </>
      </Modal>

      {/* Edit Claim */}
      {editTarget && (
        <ClaimEditForm
          key={editTarget.id}
          initial={editTarget}
          isPending={updateClaimMutation.isPending}
          onSave={body => updateClaimMutation.mutate({ id: editTarget.id, body })}
          onCancel={() => setEditTarget(null)}
          employees={employees}
        />
      )}

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Claim" size="sm">
        <p className="text-sm text-gray-600 mb-4">Delete claim <strong>{deleteTarget?.claimNumber}</strong>?</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={async () => {
            const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
            if (isAdmin) {
              await deleteClaim.mutateAsync(deleteTarget!.id);
            } else {
              const toastId = toast.loading('Submitting delete request to admin...');
              try {
                await deletionRequestsService.requestDeletion('Claim', deleteTarget!.id, `Employee requested deletion of claim ${deleteTarget?.claimNumber}`);
                toast.success('Deletion request submitted to admin successfully!', { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
              }
            }
            setDeleteTarget(null);
          }}>
            Delete
          </button>
        </div>
      </Modal>

      {/* Claim Detail Sheet */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Claim Details" size="2xl">
        {selectedClaim ? (
          <ClaimDetailView claim={selectedClaim} onEdit={() => { setDetailOpen(false); setEditTarget(selectedClaim); }} />
        ) : null}
      </Modal>

    </div>
    </>
  );
}

// Subcomponent showing custom Claim Detail View (Jh details layout)
export function ClaimDetailView({ claim, onEdit }: { claim: any; onEdit?: () => void }) {
  const notesData = getClaimNotesData(claim.notes);
  const displayStatus = BACKEND_TO_UI[claim.status] || 'Pending';

  const statusIcons: Record<string, any> = {
    Settled: <ShieldCheck className="text-green-600" />,
    Approved: <FileCheck2 className="text-emerald-600" />,
    Rejected: <X className="text-red-600" />,
    'In Progress': <Clock className="text-amber-600" />,
    Pending: <Clock className="text-blue-600" />,
  };

  const statusColors: Record<string, string> = {
    Settled: 'bg-green-100 text-green-800 border-green-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
    Pending: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className="space-y-6">
      {/* Header card matching Jh details card */}
      <div className="flex justify-between items-start bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border shadow-sm">
            {statusIcons[displayStatus] || <Clock/>}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">₹{Number(claim.claimAmount).toLocaleString('en-IN')}</h2>
            <div className="flex gap-2 items-center mt-1">
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border', statusColors[displayStatus])}>
                {displayStatus}
              </span>
              <span className="text-xs text-gray-500">• {claim.claimType}</span>
            </div>
          </div>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="btn-secondary text-[10px] sm:text-xs flex flex-wrap items-center gap-1">
            <Pencil size={12}/> Update Claim
          </button>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Patient / Client</label>
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-gray-800">
            <UserCircle2 size={14} className="text-gray-400" />
            <span>{claim.contact ? `${claim.contact.firstName} ${claim.contact.lastName}` : 'Unknown'}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Policy Reference</label>
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-gray-800">
            <FileText size={14} className="text-gray-400" />
            <span>{claim.policy?.policyNumber || 'N/A'}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Hospital / Location</label>
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-gray-800">
            <MapPin size={14} className="text-gray-400" />
            <span>{notesData.hospital || 'N/A'}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Date Filed</label>
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-gray-800">
            <Calendar size={14} className="text-gray-400" />
            <span>{claim.intimatedAt ? format(new Date(claim.intimatedAt), 'dd/MMM/yyyy') : '—'}</span>
          </div>
        </div>
      </div>

      {/* Expense breakdown calculator sums */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Expense Breakdown Calculator Sums</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50/50 border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Hospital Room / Bed:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtHospital || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Medicines / Consumables:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtMedicine || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Lab tests / Radiology:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtLab || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Pre-hospitalization:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtPreHosp || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Post-hospitalization:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtPostHosp || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Others / Misc:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtOthers || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between col-span-2 pt-2 border-t font-semibold text-sm text-blue-800">
            <span>Total Claim Amount:</span>
            <span>₹{Number(claim.claimAmount).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Claim Summary notes */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Diagnosis & Summary</label>
        <div className="text-sm bg-gray-50 border border-gray-100 rounded-xl p-4 text-gray-700">
          <div className="font-semibold text-gray-900 mb-1">Diagnosis: {notesData.diagnosis || 'General Treatment'}</div>
          <div>{notesData.notes || 'No treatment summary or claims details recorded.'}</div>
        </div>
      </div>
    </div>
  );
}
