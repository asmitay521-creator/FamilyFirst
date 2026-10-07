import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useLeadKanban, useMoveLeadStage, useCreateLead, useUpdateLead, useDeleteLead } from '@hooks/useLeads';
import Modal from '@comps/common/Modal';
import {
  Plus, Search, Pencil, Trash2, Shield, Upload, Phone, Calendar,
  MessageCircle, LayoutGrid, List, Filter, X, UserPlus, Users,
  UserCircle2, Mail, ChevronDown, Flame, Thermometer, Snowflake,
  Columns, ArrowUpDown, ChevronUp, ChevronRight, Send, RefreshCw, Save, FileText, History, Lock, Settings, Check
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
import { replaceWhatsAppVariables, preloadWhatsAppTemplates, PRELOAD_TEMPLATES } from '../../utils/whatsappTemplates';

const DEFAULT_WA_TEMPLATES = (PRELOAD_TEMPLATES || [])
  .filter(t => t.category !== 'SEMINAR')
  .map((t, idx) => ({ id: `default_${idx}`, ...t }));

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

// ── Lead Name & Product Sanitizers ──────────────────────────────────────────
export function sanitizeLeadName(raw?: string): string {
  if (!raw) return '';
  let trimmed = String(raw).trim();
  if (!trimmed || trimmed.toLowerCase() === 'website lead' || trimmed.toLowerCase() === 'lead' || trimmed.toLowerCase() === 'web user' || trimmed.toLowerCase() === 'health checkup lead') return '';
  
  // 1. Remove repeated halves (e.g. "Abhishek Kore Abhishek Kore" -> "Abhishek Kore")
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      trimmed = firstHalf;
    }
  }

  // 2. Remove consecutive duplicate words (e.g. "Abhishek Abhishek" -> "Abhishek")
  const uniqueWords: string[] = [];
  const currentWords = trimmed.split(/\s+/).filter(Boolean);
  for (let i = 0; i < currentWords.length; i++) {
    if (i === 0 || currentWords[i].toLowerCase() !== currentWords[i - 1].toLowerCase()) {
      uniqueWords.push(currentWords[i]);
    }
  }
  return uniqueWords.join(' ').trim();
}

export function extractLeadProductName(lead: any): string {
  if (!lead) return '—';

  // 1. Direct plan object with meaningful name
  if (lead.plan && typeof lead.plan === 'object' && lead.plan.name && lead.plan.name !== 'Financial Planning' && lead.plan.name !== 'Financial Advisory') {
    return lead.plan.name;
  }

  // 2. Direct interests array
  if (Array.isArray(lead.interests) && lead.interests.length > 0) {
    const valid = lead.interests.filter((i: any) => i && typeof i === 'string' && i.trim() && i !== 'Financial Planning' && i !== 'Financial Advisory');
    if (valid.length > 0) return valid.join(', ');
  }

  // 3. Direct productInterests array
  if (Array.isArray(lead.productInterests) && lead.productInterests.length > 0) {
    const valid = lead.productInterests.map((p: any) => typeof p === 'object' ? (p.product || p.name || p.interest) : p).filter((p: any) => p && typeof p === 'string' && p.trim() && p !== 'Financial Planning');
    if (valid.length > 0) return valid.join(', ');
  }

  // 4. Dedicated product fields
  if (lead.product && lead.product !== 'Financial Planning') return lead.product;
  if (lead.planName && lead.planName !== 'Financial Planning') return lead.planName;
  if (lead.serviceRequired && lead.serviceRequired !== 'Financial Planning' && lead.serviceRequired !== 'Financial Advisory') return lead.serviceRequired;
  if (lead.service && lead.service !== 'Financial Planning' && lead.service !== 'Financial Advisory') return lead.service;
  if (lead.requirement && lead.requirement !== 'Financial Planning') return lead.requirement;

  // 5. Check notes for product names (e.g. "WhatsApp Lead: ...")
  if (typeof lead.notes === 'string') {
    const m = lead.notes.match(/WhatsApp Lead:\s*([^.\n\r]+?)\s*चौकशी/i) || lead.notes.match(/Customer Lead:\s*([^.\n\r]+)/i);
    if (m && m[1]) return m[1].trim();
  }

  if (lead.plan?.name) return lead.plan.name;
  if (Array.isArray(lead.interests) && lead.interests.length > 0) return lead.interests.join(', ');
  return '—';
}

// ── Robust Contact Details Extractor ──────────────────────────────────────────
export function getLeadContactDetails(leadOrContact: any, allLeadsList?: any[], allContactsList?: any[]) {
  if (!leadOrContact) {
    return {
      fullName: 'Lead',
      firstName: 'Lead',
      lastName: '',
      initials: 'L',
      singleInitial: 'L',
      phone: '',
      email: '',
      hasRealName: false,
      leadNumStr: '',
    };
  }

  const c = (typeof leadOrContact.contact === 'object' && leadOrContact.contact) ? leadOrContact.contact : (
    (typeof leadOrContact.client === 'object' && leadOrContact.client) ? leadOrContact.client : (
      (typeof leadOrContact.customer === 'object' && leadOrContact.customer) ? leadOrContact.customer : (
        (typeof leadOrContact.user === 'object' && leadOrContact.user) ? leadOrContact.user : (
          (typeof leadOrContact.formData === 'object' && leadOrContact.formData) ? leadOrContact.formData : (
            (typeof leadOrContact.applicant === 'object' && leadOrContact.applicant) ? leadOrContact.applicant : {}
          )
        )
      )
    )
  );

  let notesData: any = {};
  if (typeof leadOrContact.notes === 'string') {
    try {
      notesData = parseLeadNotes(leadOrContact.notes);
    } catch {}
  } else if (typeof leadOrContact.notes === 'object' && leadOrContact.notes) {
    notesData = leadOrContact.notes;
  }

  // 1. Phone extraction from all standard and custom fields
  let rawPhone =
    c.phone || c.mobile || c.phoneNumber || c.phone_number || c.contactNumber || c.contact_number || c.contactNo || c.contact_no || c.whatsappNumber || c.whatsapp_number || c.mobileNumber || c.mobile_no || c.callingNumber || c.tel || c.cell || c.number ||
    leadOrContact.phone || leadOrContact.mobile || leadOrContact.phoneNumber || leadOrContact.phone_number || leadOrContact.contactNumber || leadOrContact.contact_number || leadOrContact.contactNo || leadOrContact.contact_no ||
    leadOrContact.mobileNumber || leadOrContact.mobile_no || leadOrContact.whatsappNumber || leadOrContact.callingNumber || leadOrContact.tel || leadOrContact.cell || leadOrContact.number ||
    notesData.phone || notesData.mobile || notesData.contactNumber || notesData.phoneNumber || notesData.mobileNumber || notesData.contactNo || '';

  if (!rawPhone && typeof leadOrContact.notes === 'string') {
    const pMatch = leadOrContact.notes.match(/(?:Phone|Mobile|Contact|WhatsApp|Cell|Tel|Number|Call)[\s:=–-]+(\+?[0-9\s-]{10,14})/i) || leadOrContact.notes.match(/(?:\+91[\s-]?)?([6789]\d{9})/);
    if (pMatch && pMatch[1]) {
      rawPhone = pMatch[1].trim();
    }
  }
  if (!rawPhone && notesData.descriptionDetails) {
    const pMatch = String(notesData.descriptionDetails).match(/(?:Phone|Mobile|Contact|WhatsApp|Cell|Tel|Number|Call)[\s:=–-]+(\+?[0-9\s-]{10,14})/i) || String(notesData.descriptionDetails).match(/(?:\+91[\s-]?)?([6789]\d{9})/);
    if (pMatch && pMatch[1]) {
      rawPhone = pMatch[1].trim();
    }
  }

  const phone = String(rawPhone || '').trim();

  // 2. Email extraction
  let rawEmail = c.email || c.mail || c.emailAddress || leadOrContact.email || leadOrContact.mail || leadOrContact.emailAddress || notesData.email || '';
  if (!rawEmail && typeof leadOrContact.notes === 'string') {
    const eMatch = leadOrContact.notes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (eMatch) rawEmail = eMatch[0];
  }
  const email = String(rawEmail || '').trim();

  // 3. Name extraction with duplication prevention
  let rawName = '';

  const buildCleanName = (first?: string, last?: string) => {
    const f = (first || '').trim();
    const l = (last || '').trim();
    if (!f && !l) return '';
    if (!l) return f;
    if (!f) return l;
    if (f.toLowerCase() === l.toLowerCase()) return f;
    if (f.toLowerCase().includes(l.toLowerCase())) return f;
    return `${f} ${l}`.trim();
  };

  const allNameCandidates = [
    c.fullName, c.name,
    leadOrContact.fullName, leadOrContact.name,
    buildCleanName(c.firstName, c.lastName),
    buildCleanName(leadOrContact.firstName, leadOrContact.lastName),
    notesData.fullName, notesData.name,
    buildCleanName(notesData.firstName, notesData.lastName),
    notesData.contact?.fullName, notesData.contact?.name,
    buildCleanName(notesData.contact?.firstName, notesData.contact?.lastName),
    c.clientName, c.customerName, c.contactName, c.personName, c.displayName,
    leadOrContact.clientName, leadOrContact.customerName, leadOrContact.contactName, leadOrContact.personName,
    leadOrContact.userName, leadOrContact.leadName, leadOrContact.prospectName,
    leadOrContact.insuredName, leadOrContact.applicantName, leadOrContact.displayName,
    leadOrContact.user_name, leadOrContact.client_name, leadOrContact.customer_name,
    notesData.clientName, notesData.customerName, notesData.contactName,
    notesData.userName, notesData.displayName, notesData.leadName,
    notesData.user?.name,
  ];

  for (const cand of allNameCandidates) {
    if (cand && typeof cand === 'string') {
      const sanitized = sanitizeLeadName(cand);
      if (sanitized) {
        rawName = sanitized;
        break;
      }
    }
  }

  if (!rawName && typeof leadOrContact.notes === 'string') {
    const match = leadOrContact.notes.match(/(?:Client\s*Name|Customer\s*Name|Contact\s*Name|Contact\s*Person|Applicant\s*Name|Insured\s*Name|Full\s*Name|User\s*Name|Name|Client|Customer|Contact)\s*[:=–-]\s*([A-Za-z0-9\s.]+)(?:,|\n|;|$|\})/i);
    if (match && match[1]) {
      const parsed = sanitizeLeadName(match[1]);
      if (parsed) {
        rawName = parsed;
      }
    }
  }

  if (!rawName && notesData.descriptionDetails) {
    const match = String(notesData.descriptionDetails).match(/(?:Client\s*Name|Customer\s*Name|Contact\s*Name|Contact\s*Person|Name|Client|Customer|Contact)\s*[:=–-]\s*([A-Za-z0-9\s.]+)(?:,|\n|;|$|\})/i);
    if (match && match[1]) {
      const parsed = match[1].trim();
      if (parsed && parsed.toLowerCase() !== 'website lead' && parsed.toLowerCase() !== 'web user' && parsed.toLowerCase() !== 'lead') {
        rawName = parsed;
      }
    }
  }

  if (!rawName && typeof leadOrContact.contact === 'string' && !leadOrContact.contact.match(/^[0-9a-fA-F-]{20,}$/)) {
    const trimmed = leadOrContact.contact.trim();
    if (trimmed && trimmed.toLowerCase() !== 'website lead' && trimmed.toLowerCase() !== 'lead') {
      rawName = trimmed;
    }
  }

  // Cross-reference with allContactsList (contacts service) + local contacts
  const candidateContacts: any[] = [
    ...(allContactsList && Array.isArray(allContactsList) ? allContactsList : []),
    ...(() => {
      try {
        const loc = JSON.parse(localStorage.getItem('insumitra_contacts') || '[]');
        return Array.isArray(loc) ? loc : [];
      } catch { return []; }
    })()
  ];

  if (candidateContacts.length > 0) {
    const contactId = leadOrContact.contactId || (typeof leadOrContact.contact === 'object' ? (leadOrContact.contact?.id || leadOrContact.contact?._id) : null) || (typeof leadOrContact.contact === 'string' ? leadOrContact.contact : null);
    const phoneDigits = String(phone || rawPhone || leadOrContact.phone || leadOrContact.mobile || '').replace(/\D/g, '');
    const cleanLast10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
    const cleanLast8 = phoneDigits.length >= 8 ? phoneDigits.slice(-8) : phoneDigits;

    const matchedContact = candidateContacts.find((cnt: any) => {
      if (!cnt) return false;
      const cid = String(cnt.id || cnt._id || cnt.customId || '').toLowerCase();
      if (contactId && (cid === String(contactId).toLowerCase() || ('fs_contact_' + cid) === String(contactId).toLowerCase() || cid.includes(String(contactId).toLowerCase()))) return true;
      
      const phones = [
        cnt.phone, cnt.mobile, cnt.whatsappNumber, cnt.callingNumber,
        cnt.alternatePhone, cnt.phoneNumber, cnt.contactNumber, cnt.tel, cnt.cell
      ].map(p => String(p || '').replace(/\D/g, '')).filter(p => p.length >= 6);

      if (cleanLast10 && phones.some(p => p === phoneDigits || p.slice(-10) === cleanLast10 || p.includes(cleanLast10) || cleanLast10.includes(p))) return true;
      if (cleanLast8 && phones.some(p => p.slice(-8) === cleanLast8)) return true;

      if (email && cnt.email && String(cnt.email).trim().toLowerCase() === email.toLowerCase()) return true;
      return false;
    });

    if (matchedContact) {
      const fn = (matchedContact.firstName || matchedContact.first_name || '').trim();
      const ln = (matchedContact.lastName || matchedContact.last_name || '').trim();
      const cName = `${fn} ${ln}`.trim() || matchedContact.name || matchedContact.fullName || matchedContact.clientName || matchedContact.customerName;
      if (cName && cName.toLowerCase() !== 'website lead' && cName.toLowerCase() !== 'web user' && cName.toLowerCase() !== 'lead') {
        rawName = cName;
      }
      const cPhone = matchedContact.phone || matchedContact.mobile || matchedContact.whatsappNumber || matchedContact.callingNumber || matchedContact.contactNumber;
      if (cPhone) {
        rawPhone = cPhone;
      }
    }
  }

  // Cross-reference with allLeadsList or localStorage if still no name
  if (!rawName && allLeadsList && allLeadsList.length > 0) {
    const matched = allLeadsList.find((l: any) => {
      if (!l) return false;
      if (l.id && leadOrContact.id && l.id === leadOrContact.id) return true;
      if (phone && (l.phone === phone || l.contact?.phone === phone || l.mobile === phone)) return true;
      return false;
    });
    if (matched && matched !== leadOrContact) {
      const matchedInfo = getLeadContactDetails(matched, undefined, allContactsList);
      if (matchedInfo.hasRealName) {
        rawName = matchedInfo.fullName;
      }
      if (!rawPhone && matchedInfo.phone) {
        rawPhone = matchedInfo.phone;
      }
    }
  }

  const hasRealName = Boolean(
    rawName &&
    rawName.toLowerCase() !== 'website lead' &&
    rawName.toLowerCase() !== 'web user' &&
    rawName.toLowerCase() !== 'lead' &&
    rawName.toLowerCase() !== 'health checkup lead'
  );

  const cleanDigits = String(leadOrContact.id || '').replace(/\D/g, '');
  const leadNumStr = leadOrContact.leadNumber
    ? `L${leadOrContact.leadNumber}`
    : (leadOrContact.leadNo ? `L${leadOrContact.leadNo}` : (cleanDigits.length >= 2 ? `L${cleanDigits.slice(-3)}` : ''));

  const cleanName = hasRealName
    ? rawName
    : 'Website Lead';

  const parts = cleanName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || (hasRealName ? '' : 'Website');
  const lastName = parts.slice(1).join(' ') || (hasRealName ? '' : 'Lead');

  let initials = 'WL';
  let singleInitial = 'W';
  if (hasRealName && parts.length > 0) {
    singleInitial = parts[0][0]?.toUpperCase() || 'L';
    if (parts.length === 1) {
      initials = parts[0].slice(0, 2).toUpperCase();
    } else {
      initials = `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
  } else if (cleanName && cleanName.toLowerCase() !== 'website lead' && cleanName !== '?') {
    singleInitial = cleanName[0]?.toUpperCase() || 'L';
    initials = cleanName.slice(0, 2).toUpperCase();
  } else {
    initials = 'WL';
    singleInitial = 'W';
  }

  return {
    fullName: cleanName,
    firstName,
    lastName,
    initials,
    singleInitial,
    phone: String(rawPhone || phone).trim(),
    email,
    hasRealName,
    leadNumStr,
  };
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
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badgeColor === 'orange'
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
  const [viewMode, setViewMode] = useState<'board' | 'table'>(() =>
    searchParams.get('view') === 'table' ? 'table' : 'board'
  );
  const [showFilters, setShowFilters] = useState(false);
  const [createInitialStage, setCreateInitialStage] = useState<string>('TO_CONTACT');

  // WhatsApp Templates from Firebase & LocalStorage
  const [waTemplates, setWaTemplates] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('familyfirst_whatsapp_management_templates_v2');
      const mgmt = raw ? JSON.parse(raw) : [];
      const seen = new Set<string>();
      const list: any[] = [];
      (Array.isArray(mgmt) ? mgmt : []).forEach((t: any) => {
        if (t.isActive !== false) {
          const n = (t.name || t.title || '').trim().toLowerCase();
          if (n && !seen.has(n)) { seen.add(n); list.push(t); }
        }
      });
      (PRELOAD_TEMPLATES as any[]).forEach((t: any) => {
        const n = (t.name || t.title || '').trim().toLowerCase();
        if (n && !seen.has(n)) { seen.add(n); list.push(t); }
      });
      return list;
    } catch {
      return (PRELOAD_TEMPLATES as any[]) || [];
    }
  });

  useEffect(() => {
    preloadWhatsAppTemplates();
    const loadAllTemplates = (snapshotDocs?: any[]) => {
      const list: any[] = [];
      const seen = new Set<string>();

      // 1. Snapshot docs from Firestore
      if (snapshotDocs && snapshotDocs.length > 0) {
        snapshotDocs.forEach(docSnap => {
          const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
          if (data.isActive !== false) {
            const nameLower = (data.name || data.title || '').trim().toLowerCase();
            if (nameLower && !seen.has(nameLower)) {
              seen.add(nameLower);
              list.push({ id: docSnap.id || data.id, ...data });
            }
          }
        });
      }

      // 2. Templates from localStorage (Management page)
      try {
        const raw = localStorage.getItem('familyfirst_whatsapp_management_templates_v2');
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          parsed.forEach((t: any) => {
            if (t.isActive !== false) {
              const nameLower = (t.name || t.title || '').trim().toLowerCase();
              if (nameLower && !seen.has(nameLower)) {
                seen.add(nameLower);
                list.push(t);
              }
            }
          });
        }
      } catch {}

      // 3. Built-in preloaded templates
      (PRELOAD_TEMPLATES as any[]).forEach((t: any) => {
        const nameLower = (t.name || t.title || '').trim().toLowerCase();
        if (nameLower && !seen.has(nameLower)) {
          seen.add(nameLower);
          list.push(t);
        }
      });

      setWaTemplates(list);
    };

    let unsub = () => { };
    try {
      if (db) {
        unsub = onSnapshot(collection(db, 'whatsappTemplates'), (snapshot) => {
          loadAllTemplates(snapshot.docs);
        }, (err) => {
          console.warn('[WhatsApp Templates Notice]:', err);
          loadAllTemplates();
        });
      } else {
        loadAllTemplates();
      }
    } catch {
      loadAllTemplates();
    }
    return unsub;
  }, []);

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
  const [filterDate, setFilterDate] = useState('');
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
    const viewParam = searchParams.get('view');
    if (viewParam === 'table') {
      setViewMode('table');
    } else if (viewParam === 'board') {
      setViewMode('board');
    }
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
      .catch(() => { });
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

    if (plan.id || plan.name) {
      setPolicySelectedType(plan.category || '');
      setPolicySelectedCompany(plan.company?.name || '');
      setPolicySelectedPlanId(plan.name || plan.id || '');
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
      toast.error('Please enter an insurance plan');
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
        let desc = parsed.descriptionDetails || '';
        // If it got polluted by the old bug (nested JSON string)
        while (typeof desc === 'string' && desc.trim().startsWith('{') && (desc.includes('"leadStatus"') || desc.includes('"fullName"'))) {
          try {
            const inner = JSON.parse(desc);
            desc = inner.descriptionDetails || '';
          } catch {
            desc = '';
            break;
          }
        }
        res.descriptionDetails = desc;
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
    const currentUser = useAuthStore.getState().user;
    const currentUserName = currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : ((currentUser as any)?.name || currentUser?.email || 'User');
    const assignedEmp = employeesList.find((e: any) => e.id === card.assignedEmployeeId || e.userId === card.assignedEmployeeId || e.user?.id === card.assignedEmployeeId);
    const assignedEmpName = assignedEmp ? `${assignedEmp.firstName || assignedEmp.user?.firstName || ''} ${assignedEmp.lastName || assignedEmp.user?.lastName || ''}`.trim() : '';

    return JSON.stringify({
      leadStatus: card.leadStatus,
      leadType: card.leadType,
      dependencyType: card.dependencyType || 'SELF',
      dependentDetails: card.dependencyType === 'DEPENDENT' ? (card.dependentDetails || '') : '',
      descriptionDetails: card.descriptionDetails || '',
      cleanNotes: card.otherProduct ? `Other Product: ${card.otherProduct}` : '',
      assignedEmployeeId: card.assignedEmployeeId || '',
      assignedEmployeeName: assignedEmpName,
      assignedToName: assignedEmpName,
      assignedById: currentUser?.id,
      assignedByName: currentUserName,
      createdById: currentUser?.id,
      createdByName: currentUserName,
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
    const raw = (empRes as any)?.data?.data || (empRes as any)?.data || empRes || [];
    return Array.isArray(raw) ? raw : [];
  }, [empRes]);

  const { data: contactsRes } = useQuery({
    queryKey: ['contacts-for-leads-matching'],
    queryFn: () => contactsService.list({ limit: 1000 }),
    staleTime: 60_000,
  });
  const contactsList = useMemo(() => {
    const raw = (contactsRes as any)?.data?.data || (contactsRes as any)?.data || contactsRes || [];
    return Array.isArray(raw) ? raw : [];
  }, [contactsRes]);

  const { contactsById, contactsByPhone } = useMemo(() => {
    const byId = new Map<string, any>();
    const byPhone = new Map<string, any>();
    
    // Combine contactsList from query + local storage contacts
    const combinedContacts: any[] = [...contactsList];
    try {
      const local = JSON.parse(localStorage.getItem('insumitra_contacts') || '[]');
      if (Array.isArray(local)) {
        local.forEach((lc: any) => {
          if (!combinedContacts.some((c: any) => (c.id && c.id === lc.id) || (c._id && c._id === lc.id))) {
            combinedContacts.push(lc);
          }
        });
      }
    } catch {}

    combinedContacts.forEach((c: any) => {
      if (!c) return;
      if (c.id) byId.set(String(c.id).toLowerCase(), c);
      if (c._id) byId.set(String(c._id).toLowerCase(), c);
      if (c.customId) byId.set(String(c.customId).toLowerCase(), c);
      
      const phoneFields = [
        c.phone, c.mobile, c.whatsappNumber, c.callingNumber,
        c.alternatePhone, c.phoneNumber, c.contactNumber, c.tel, c.cell,
        c.whatsapp, c.phone_number, c.contact_number
      ];
      phoneFields.forEach(pf => {
        const digits = String(pf || '').replace(/\D/g, '');
        if (digits.length >= 10) {
          byPhone.set(digits.slice(-10), c);
        }
      });
    });
    return { contactsById: byId, contactsByPhone: byPhone };
  }, [contactsList]);

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

        const extractLocalItemDetails = (item: any) => {
          const clientObj = (typeof item.contact === 'object' && item.contact) ? item.contact : (
            (typeof item.client === 'object' && item.client) ? item.client : (
              (typeof item.customer === 'object' && item.customer) ? item.customer : (
                (typeof item.user === 'object' && item.user) ? item.user : (
                  (typeof item.formData === 'object' && item.formData) ? item.formData : {}
                )
              )
            )
          );

          let rawName = (
            item.fullName || item.name || item.clientName || item.customerName || item.contactName ||
            item.personName || item.userName || item.user_name || item.client_name || item.customer_name ||
            item.leadName || item.lead_name || item.prospectName || item.applicantName || item.insuredName ||
            clientObj.fullName || clientObj.name || clientObj.clientName || clientObj.customerName ||
            (clientObj.firstName ? `${clientObj.firstName} ${clientObj.lastName || ''}`.trim() : '') ||
            (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : '') ||
            ''
          ).trim();

          let rawPhone = (
            item.phone || item.mobile || item.phoneNumber || item.phone_number || item.contactNumber || item.contact_number ||
            item.contactNo || item.contact_no || item.mobileNumber || item.mobile_no || item.whatsappNumber || item.callingNumber ||
            clientObj.phone || clientObj.mobile || clientObj.phoneNumber || clientObj.contactNumber || clientObj.whatsappNumber ||
            ''
          ).trim();

          if (!rawName && typeof item.notes === 'string') {
            const match = item.notes.match(/(?:Client\s*Name|Customer\s*Name|Contact\s*Name|Contact\s*Person|Applicant\s*Name|Insured\s*Name|Full\s*Name|User\s*Name|Name|Client|Customer|Contact)\s*[:=–-]\s*([A-Za-z0-9\s.]+)(?:,|\n|;|$|\})/i);
            if (match && match[1]) {
              const parsed = match[1].trim();
              if (parsed && parsed.toLowerCase() !== 'website lead' && parsed.toLowerCase() !== 'web user' && parsed.toLowerCase() !== 'lead') {
                rawName = parsed;
              }
            }
          }

          if (!rawPhone && typeof item.notes === 'string') {
            const pMatch = item.notes.match(/(?:Phone|Mobile|Contact|WhatsApp|Cell|Tel|Number|Call)[\s:=–-]+(\+?[0-9\s-]{10,14})/i) || item.notes.match(/(?:\+91[\s-]?)?([6789]\d{9})/);
            if (pMatch && pMatch[1]) {
              rawPhone = pMatch[1].trim();
            }
          }

          const hasRealName = rawName && rawName.toLowerCase() !== 'website lead' && rawName.toLowerCase() !== 'lead';
          const fullName = hasRealName ? rawName : 'Website Lead';
          const parts = fullName.split(/\s+/).filter(Boolean);
          const firstName = clientObj.firstName || item.firstName || (hasRealName ? parts[0] : '');
          const lastName = clientObj.lastName || item.lastName || (hasRealName ? parts.slice(1).join(' ') : '');
          const email = (item.email || item.mail || clientObj.email || '').trim();

          return { fullName, firstName, lastName, phone: rawPhone, email, clientObj, hasRealName };
        };

        const mappedRahul = rahulLeads.map((item: any) => {
          const d = extractLocalItemDetails(item);

          return {
            id: 'local_lead_' + (item.id || item.timestamp || Date.now()),
            name: d.fullName,
            fullName: d.fullName,
            phone: d.phone,
            email: d.email,
            stage: item.stage || 'TO_CONTACT',
            uiStage: BACKEND_TO_UI[item.stage || 'TO_CONTACT'] || 'To Contact',
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
              firstName: d.firstName,
              lastName: d.lastName,
              phone: d.phone,
              email: d.email,
              tags: ['Website Consultation']
            },
            plan: {
              name: item.service || 'Financial Advisory',
              category: (item.service || '').toUpperCase().includes('HEALTH') ? 'HEALTH' : 'LIFE'
            }
          };
        });

        const mappedCheckups = rahulCheckups.map((item: any) => {
          const d = extractLocalItemDetails(item);

          return {
            id: 'checkup_lead_' + (item.id || item.timestamp || Date.now()),
            name: d.fullName,
            fullName: d.fullName,
            phone: d.phone,
            email: d.email,
            stage: item.stage || 'TO_CONTACT',
            uiStage: BACKEND_TO_UI[item.stage || 'TO_CONTACT'] || 'To Contact',
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
              firstName: d.firstName,
              lastName: d.lastName,
              phone: d.phone,
              email: d.email,
              tags: ['Financial Checkup']
            },
            plan: {
              name: `Financial Health Checkup (Score: ${item.score || 0}/100)`,
              category: 'HEALTH'
            }
          };
        });

        const combined = [...local, ...mappedRahul, ...mappedCheckups];
        return combined.filter(l => {
          const id = String(l.id || '');
          if (id.startsWith('contact_lead_') || id.startsWith('auto_')) return false;
          return !isDeletedItem(id);
        });
      } catch (e) {
        return [];
      }
    };

    setWebLeads(loadLocalWebLeads());

    const normalizeWebLeadItem = (item: any, idFallback: string) => {
      const clientObj = (typeof item.contact === 'object' && item.contact) ? item.contact : (
        (typeof item.client === 'object' && item.client) ? item.client : (
          (typeof item.customer === 'object' && item.customer) ? item.customer : (
            (typeof item.user === 'object' && item.user) ? item.user : (
              (typeof item.formData === 'object' && item.formData) ? item.formData : {}
            )
          )
        )
      );

      let rawName = (
        item.fullName || item.name || item.clientName || item.customerName || item.contactName ||
        item.personName || item.userName || item.user_name || item.client_name || item.customer_name ||
        item.leadName || item.lead_name || item.prospectName || item.applicantName || item.insuredName ||
        clientObj.fullName || clientObj.name || clientObj.clientName || clientObj.customerName ||
        (clientObj.firstName ? `${clientObj.firstName} ${clientObj.lastName || ''}`.trim() : '') ||
        (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : '') ||
        ''
      ).trim();

      let rawPhone = (
        item.phone || item.mobile || item.phoneNumber || item.phone_number || item.contactNumber || item.contact_number ||
        item.contactNo || item.contact_no || item.mobileNumber || item.mobile_no || item.whatsappNumber || item.callingNumber ||
        clientObj.phone || clientObj.mobile || clientObj.phoneNumber || clientObj.contactNumber || clientObj.whatsappNumber ||
        ''
      ).trim();

      if (!rawName && typeof item.notes === 'string') {
        const match = item.notes.match(/(?:Client\s*Name|Customer\s*Name|Contact\s*Name|Contact\s*Person|Applicant\s*Name|Insured\s*Name|Full\s*Name|User\s*Name|Name|Client|Customer|Contact)\s*[:=–-]\s*([A-Za-z0-9\s.]+)(?:,|\n|;|$|\})/i);
        if (match && match[1]) {
          const parsed = match[1].trim();
          if (parsed && parsed.toLowerCase() !== 'website lead' && parsed.toLowerCase() !== 'web user' && parsed.toLowerCase() !== 'lead') {
            rawName = parsed;
          }
        }
      }

      if (!rawPhone && typeof item.notes === 'string') {
        const pMatch = item.notes.match(/(?:Phone|Mobile|Contact|WhatsApp|Cell|Tel|Number|Call)[\s:=–-]+(\+?[0-9\s-]{10,14})/i) || item.notes.match(/(?:\+91[\s-]?)?([6789]\d{9})/);
        if (pMatch && pMatch[1]) {
          rawPhone = pMatch[1].trim();
        }
      }

      const hasRealName = rawName && rawName.toLowerCase() !== 'website lead' && rawName.toLowerCase() !== 'lead';
      const cleanRawName = sanitizeLeadName(rawName);
      const fullName = cleanRawName || (hasRealName ? rawName : 'Website Lead');
      const parts = fullName.split(/\s+/).filter(Boolean);
      const firstName = clientObj.firstName || item.firstName || (hasRealName ? parts[0] : '');
      const lastName = clientObj.lastName || item.lastName || (hasRealName ? parts.slice(1).join(' ') : '');
      
      let service = (Array.isArray(item.interests) && item.interests[0]) ||
        (Array.isArray(item.productInterests) && (typeof item.productInterests[0] === 'object' ? item.productInterests[0].name || item.productInterests[0].product : item.productInterests[0])) ||
        item.plan?.name ||
        item.product ||
        item.planName ||
        item.serviceRequired ||
        item.service ||
        item.requirement ||
        'Term Insurance';

      if (typeof item.notes === 'string') {
        const m = item.notes.match(/WhatsApp Lead:\s*([^.\n\r]+?)\s*चौकशी/i) || item.notes.match(/Customer Lead:\s*([^.\n\r]+)/i);
        if (m && m[1]) service = m[1].trim();
      }

      const phone = rawPhone;
      const email = (item.email || item.mail || clientObj.email || '').trim();
      const sUpper = (service || '').toUpperCase();
      const category = (sUpper.includes('HEALTH') || sUpper.includes('MEDICLAIM') || sUpper.includes('आरोग्य'))
        ? 'HEALTH'
        : (sUpper.includes('MUTUAL') || sUpper.includes('MF') || sUpper.includes('WEALTH') || sUpper.includes('SIP'))
          ? 'MUTUAL FUNDS'
          : (sUpper.includes('MOTOR') || sUpper.includes('CAR') || sUpper.includes('गाडी') || sUpper.includes('वाहन'))
            ? 'MOTOR'
            : (sUpper.includes('PENSION') || sUpper.includes('RETIREMENT') || sUpper.includes('पेन्शन') || sUpper.includes('निवृत्ती'))
              ? 'RETIREMENT'
              : 'LIFE';

      return {
        id: item.id || idFallback,
        name: fullName,
        fullName,
        phone,
        email,
        stage: item.stage === 'OPEN' || !item.stage ? 'TO_CONTACT' : item.stage,
        uiStage: 'To Contact',
        createdAt: item.createdAt || new Date().toISOString(),
        followUpDate: item.followUpDate || new Date().toISOString().split('T')[0],
        notes: typeof item.notes === 'string' ? item.notes : JSON.stringify({
          leadStatus: 'INTERESTED',
          leadSource: 'WhatsApp / Web Lead',
          leadType: 'FRESH',
          descriptionDetails: `Lead Inquiry: ${service}`
        }),
        interests: [service],
        productInterests: [service],
        contact: {
          id: 'contact_' + (item.id || idFallback),
          firstName,
          lastName,
          phone,
          email,
          tags: item.contact?.tags || ['Customer Lead', service]
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
    } catch (e) { }

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
      if (db) {
        const leadsCol = collection(db, 'leads');
        unsubscribeFirestore = onSnapshot(leadsCol, (snapshot) => {
          const firestoreList: any[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const clientObj = (typeof data.contact === 'object' && data.contact) ? data.contact : (
              (typeof data.client === 'object' && data.client) ? data.client : (
                (typeof data.customer === 'object' && data.customer) ? data.customer : (
                  (typeof data.user === 'object' && data.user) ? data.user : (
                    (typeof data.formData === 'object' && data.formData) ? data.formData : (
                      (typeof data.applicant === 'object' && data.applicant) ? data.applicant : {}
                    )
                  )
                )
              )
            );

            let rawName = (
              data.fullName || data.name || data.clientName || data.customerName || data.contactName ||
              data.personName || data.userName || data.user_name || data.client_name || data.customer_name ||
              data.leadName || data.lead_name || data.prospectName || data.applicantName || data.insuredName ||
              clientObj.fullName || clientObj.name || clientObj.clientName || clientObj.customerName ||
              (clientObj.firstName ? `${clientObj.firstName} ${clientObj.lastName || ''}`.trim() : '') ||
              (data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : '') ||
              ''
            ).trim();

            let rawPhone = (
              data.phone || data.mobile || data.phoneNumber || data.phone_number || data.contactNumber || data.contact_number ||
              data.contactNo || data.contact_no || data.mobileNumber || data.mobile_no || data.whatsappNumber || data.callingNumber ||
              clientObj.phone || clientObj.mobile || clientObj.phoneNumber || clientObj.contactNumber || clientObj.whatsappNumber ||
              ''
            ).trim();

            if (!rawName && typeof data.notes === 'string') {
              const match = data.notes.match(/(?:Client\s*Name|Customer\s*Name|Contact\s*Name|Contact\s*Person|Applicant\s*Name|Insured\s*Name|Full\s*Name|User\s*Name|Name|Client|Customer|Contact)\s*[:=–-]\s*([A-Za-z0-9\s.]+)(?:,|\n|;|$|\})/i);
              if (match && match[1]) {
                const parsed = match[1].trim();
                if (parsed && parsed.toLowerCase() !== 'website lead' && parsed.toLowerCase() !== 'web user' && parsed.toLowerCase() !== 'lead') {
                  rawName = parsed;
                }
              }
            }

            if (!rawPhone && typeof data.notes === 'string') {
              const pMatch = data.notes.match(/(?:Phone|Mobile|Contact|WhatsApp|Cell|Tel|Number|Call)[\s:=–-]+(\+?[0-9\s-]{10,14})/i) || data.notes.match(/(?:\+91[\s-]?)?([6789]\d{9})/);
              if (pMatch && pMatch[1]) {
                rawPhone = pMatch[1].trim();
              }
            }

            const hasRealName = rawName && rawName.toLowerCase() !== 'website lead' && rawName.toLowerCase() !== 'lead';
            const cleanRawName = sanitizeLeadName(rawName);
            const fullName = cleanRawName || (hasRealName ? rawName : 'Website Lead');
            const parts = fullName.split(/\s+/).filter(Boolean);
            const firstName = clientObj.firstName || data.firstName || (hasRealName ? parts[0] : '');
            const lastName = clientObj.lastName || data.lastName || (hasRealName ? parts.slice(1).join(' ') : '');
            
            let service = (Array.isArray(data.interests) && data.interests[0]) ||
              (Array.isArray(data.productInterests) && (typeof data.productInterests[0] === 'object' ? data.productInterests[0].name || data.productInterests[0].product : data.productInterests[0])) ||
              data.plan?.name ||
              data.product ||
              data.planName ||
              data.serviceRequired ||
              data.service ||
              data.requirement ||
              'Term Insurance';

            if (typeof data.notes === 'string') {
              const m = data.notes.match(/WhatsApp Lead:\s*([^.\n\r]+?)\s*चौकशी/i) || data.notes.match(/Customer Lead:\s*([^.\n\r]+)/i);
              if (m && m[1]) service = m[1].trim();
            }

            const phone = rawPhone;
            const email = (data.email || data.mail || clientObj.email || '').trim();
            const createdAtDate = data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : (data.createdAtIso || (data.timestamp ? new Date(Number(data.timestamp)).toISOString() : new Date().toISOString()));

            if (!isDeletedItem('fs_' + docSnap.id)) {
              const sUpper = (service || '').toUpperCase();
              const category = (sUpper.includes('HEALTH') || sUpper.includes('MEDICLAIM') || sUpper.includes('आरोग्य'))
                ? 'HEALTH'
                : (sUpper.includes('MUTUAL') || sUpper.includes('MF') || sUpper.includes('WEALTH') || sUpper.includes('SIP'))
                  ? 'MUTUAL FUNDS'
                  : (sUpper.includes('MOTOR') || sUpper.includes('CAR') || sUpper.includes('गाडी') || sUpper.includes('वाहन'))
                    ? 'MOTOR'
                    : (sUpper.includes('PENSION') || sUpper.includes('RETIREMENT') || sUpper.includes('पेन्शन') || sUpper.includes('निवृत्ती'))
                      ? 'RETIREMENT'
                      : 'LIFE';

              const descriptionDetails = data.notes || (
                data.age || data.income
                  ? `Financial Checkup (Age: ${data.age || 'N/A'}, Income: ${data.income || 'N/A'}, Requirement: ${service})`
                  : `Customer Lead: ${service}`
              );

              firestoreList.push({
                id: 'fs_' + docSnap.id,
                name: fullName,
                fullName,
                phone,
                email,
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
                notes: typeof data.notes === 'string' ? data.notes : JSON.stringify({
                  leadStatus: data.status || 'INTERESTED',
                  leadSource: data.leadSource || data.source || 'WhatsApp Lead',
                  leadType: data.leadType || 'FRESH',
                  assignedEmployeeId: data.assignedEmployeeId || data.assignedTo || '',
                  assignedEmployeeName: data.assignedToName || data.assignedEmployeeName || '',
                  descriptionDetails
                }),
                interests: [service],
                productInterests: [service],
                contact: {
                  id: 'fs_contact_' + docSnap.id,
                  firstName,
                  lastName,
                  phone,
                  email,
                  tags: ['Customer Lead', service]
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
        }, () => {
        });
      } // Closing if (isSuperAdmin)
    } catch (e) {
      console.warn('Firestore init error:', e);
    }

    const handleStorageOrLeadUpdate = (event?: any) => {
      const updatedDetail = event?.detail;
      if (updatedDetail && updatedDetail.id) {
        setWebLeads(prev => prev.map(l => {
          const lId = String(l.id || '');
          const tId = String(updatedDetail.id || '');
          if (lId === tId || lId === ('fs_' + tId) || ('fs_' + lId) === tId) {
            return { ...l, ...updatedDetail };
          }
          return l;
        }));
      } else {
        const locals = loadLocalWebLeads();
        setWebLeads(prev => {
          const fsLeads = prev.filter(p => String(p.id).startsWith('fs_'));
          const seenIds = new Set(locals.map((l: any) => String(l.id)));
          const filteredFs = fsLeads.filter(p => !seenIds.has(String(p.id)));
          return [...filteredFs, ...locals];
        });
      }
    };
    window.addEventListener('storage', handleStorageOrLeadUpdate);
    window.addEventListener('lead_updated', handleStorageOrLeadUpdate);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorageOrLeadUpdate);
      window.removeEventListener('lead_updated', handleStorageOrLeadUpdate);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [qc, user]);

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

    const enrichLeadWithContacts = (card: any) => {
      if (!card) return card;
      let contactObj = (typeof card.contact === 'object' && card.contact) ? { ...card.contact } : null;
      const contactId = card.contactId || (contactObj ? (contactObj.id || contactObj._id) : null) || (typeof card.contact === 'string' ? card.contact : null);

      let foundContact: any = null;
      if (contactId && contactsById.has(String(contactId).toLowerCase())) {
        foundContact = contactsById.get(String(contactId).toLowerCase());
      }
      
      const rawPhone = String(card.phone || card.mobile || contactObj?.phone || contactObj?.mobile || '').replace(/\D/g, '');
      if (!foundContact && rawPhone.length >= 6) {
        const last10 = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;
        const last8 = rawPhone.length >= 8 ? rawPhone.slice(-8) : rawPhone;
        if (contactsByPhone.has(last10)) {
          foundContact = contactsByPhone.get(last10);
        } else {
          for (const [pKey, cVal] of contactsByPhone.entries()) {
            if (pKey === last10 || pKey.slice(-8) === last8 || pKey.includes(rawPhone) || rawPhone.includes(pKey)) {
              foundContact = cVal;
              break;
            }
          }
        }
      }

      // Check notes JSON if still no contact
      if (!foundContact && typeof card.notes === 'string') {
        const extra: any = parseLeadNotes(card.notes);
        if (extra.phone) {
          const epDigits = String(extra.phone).replace(/\D/g, '').slice(-10);
          if (contactsByPhone.has(epDigits)) {
            foundContact = contactsByPhone.get(epDigits);
          }
        }
        if (!foundContact && extra.fullName) {
          const extraName = String(extra.fullName).trim();
          if (extraName && extraName.toLowerCase() !== 'website lead') {
            return {
              ...card,
              name: extraName,
              fullName: extraName,
              phone: extra.phone || card.phone,
              contact: { ...contactObj, name: extraName, fullName: extraName, firstName: extra.firstName || extraName.split(' ')[0], lastName: extra.lastName || extraName.split(' ').slice(1).join(' '), phone: extra.phone || card.phone },
            };
          }
        }
      }

      if (foundContact) {
        const fn = (foundContact.firstName || foundContact.first_name || '').trim();
        const ln = (foundContact.lastName || foundContact.last_name || '').trim();
        const fName = `${fn} ${ln}`.trim() || foundContact.name || foundContact.fullName || foundContact.clientName;
        const fPhone = foundContact.phone || foundContact.mobile || foundContact.whatsappNumber || foundContact.callingNumber || foundContact.contactNumber;

        contactObj = {
          ...contactObj,
          ...foundContact,
          firstName: fn || contactObj?.firstName,
          lastName: ln || contactObj?.lastName,
          name: fName || contactObj?.name,
          fullName: fName || contactObj?.fullName,
          phone: fPhone || contactObj?.phone || card.phone,
        };

        return {
          ...card,
          name: fName || card.name,
          fullName: fName || card.fullName,
          phone: fPhone || card.phone,
          contact: contactObj,
        };
      }

      return {
        ...card,
        contact: contactObj || card.contact,
      };
    };

    const rawData = kanbanRes?.data ?? {};
    const flat: any[] = [];
    Object.keys(rawData).forEach(backendStage => {
      (rawData[backendStage] || []).forEach((card: any) => {
        if (!isDeletedCard(card)) {
          const cidStr = String(card.id || '');
          if (cidStr.startsWith('contact_lead_') || cidStr.startsWith('auto_')) return;
          const enriched = enrichLeadWithContacts(card);
          flat.push({ ...enriched, uiStage: BACKEND_TO_UI[card.stage] || 'To Contact' });
        }
      });
    });

    // Merge webLeads without duplicates
    const seenIds = new Set(flat.map(l => String(l.id || '').replace('fs_', '').toLowerCase()));

    webLeads.forEach(wl => {
      if (!isDeletedCard(wl)) {
        const idStr = String(wl.id || '');
        const cleanId = idStr.replace('fs_', '').toLowerCase();
        if (idStr.startsWith('contact_lead_') || idStr.startsWith('auto_')) return;
        if (!seenIds.has(cleanId)) {
          seenIds.add(cleanId);
          const enriched = enrichLeadWithContacts(wl);
          flat.unshift({ ...enriched, uiStage: BACKEND_TO_UI[wl.stage] || 'To Contact' });
        }
      }
    });

    // Enrich existing genuine leads in flat with real contact names and phone numbers
    const combinedContactsForLeads: any[] = [...contactsList];
    try {
      const local = JSON.parse(localStorage.getItem('insumitra_contacts') || '[]');
      if (Array.isArray(local)) {
        local.forEach((lc: any) => {
          if (!combinedContactsForLeads.some((c: any) => (c.id && c.id === lc.id) || (c._id && c._id === lc.id))) {
            combinedContactsForLeads.push(lc);
          }
        });
      }
    } catch {}

    combinedContactsForLeads.forEach(cnt => {
      if (!cnt) return;
      const cId = String(cnt.id || cnt._id || cnt.customId || '');
      const fn = (cnt.firstName || cnt.first_name || '').trim();
      const ln = (cnt.lastName || cnt.last_name || '').trim();
      const fullName = `${fn} ${ln}`.trim() || cnt.name || cnt.fullName || cnt.clientName || '';
      const phone = cnt.phone || cnt.mobile || cnt.whatsappNumber || cnt.callingNumber || cnt.alternatePhone || cnt.contactNumber || '';
      const cleanP10 = String(phone).replace(/\D/g, '').slice(-10);

      // 1. If an existing lead in flat matches by contactId, phone, or follow-up date, update that lead with the real contact name & phone!
      const matchedExisting = flat.find(l => {
        const lCid = String(l.contactId || l.contact?.id || l.contact?._id || '').toLowerCase();
        if (cId && lCid && (lCid === cId.toLowerCase() || lCid.includes(cId.toLowerCase()) || cId.toLowerCase().includes(lCid))) return true;
        const lPhones = [l.phone, l.mobile, l.contact?.phone, l.contact?.mobile, l.contact?.whatsappNumber].map(p => String(p || '').replace(/\D/g, '')).filter(p => p.length >= 6);
        if (cleanP10 && lPhones.some(lp => lp === cleanP10 || lp.slice(-10) === cleanP10 || lp.slice(-8) === cleanP10.slice(-8) || lp.includes(cleanP10) || cleanP10.includes(lp))) return true;
        const lFDate = String(l.followUpDate || '').split('T')[0];
        const cntFDate = String(cnt.followUpDate || cnt.nextFollowUp || '').split('T')[0];
        if (cntFDate && lFDate && cntFDate === lFDate && (l.name === 'Website Lead' || !l.name || String(l.name).startsWith('Lead ('))) return true;
        return false;
      });

      if (matchedExisting) {
        if (fullName && (!matchedExisting.name || matchedExisting.name === 'Website Lead' || String(matchedExisting.name).startsWith('Lead ('))) {
          matchedExisting.name = fullName;
          matchedExisting.fullName = fullName;
        }
        if (phone && !matchedExisting.phone) {
          matchedExisting.phone = phone;
        }
        matchedExisting.contact = {
          ...(typeof matchedExisting.contact === 'object' ? matchedExisting.contact : {}),
          id: cId || matchedExisting.contact?.id,
          firstName: fn || matchedExisting.contact?.firstName,
          lastName: ln || matchedExisting.contact?.lastName,
          name: fullName || matchedExisting.contact?.name,
          fullName: fullName || matchedExisting.contact?.fullName,
          phone: phone || matchedExisting.phone,
          email: cnt.email || matchedExisting.email,
        };
      }
      // Note: We do NOT create synthetic lead cards for existing directory contacts!
      // Existing directory contacts belong in Contacts & Customers, not in the Leads pipeline.
    });

    // Ensure newest leads appear at the top
    flat.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return flat;
  }, [kanbanRes, webLeads, deletedKeys, contactsById, contactsByPhone, contactsList]);

  // Client-side filter
  const filteredLeads = useMemo(() => {
    const sTerm = search.toLowerCase();
    return leadsFlat.filter(lead => {
      // Filter ONLY for EMPLOYEE role if not owner/admin: Show only leads assigned by, created by, or assigned to this employee
      const userRole = String(user?.role || '').toUpperCase().trim();
      const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN' || userRole === 'ADMIN' || userRole === 'MANAGER';
      const isEmployeeRole = userRole === 'EMPLOYEE' || !isOwnerOrAdmin;

      if (isEmployeeRole && !isOwnerOrAdmin) {
        const currentUserId = String(user?.id || '').toLowerCase().trim();
        const currentUserEmail = String(user?.email || '').toLowerCase().trim();
        const myEmp = employeesList.find((e: any) => {
          const eUid = String(e.userId || e.user?.id || e.id || '').toLowerCase().trim();
          const eEmail = String(e.email || e.user?.email || '').toLowerCase().trim();
          return (eUid && eUid === currentUserId) || (eEmail && eEmail === currentUserEmail);
        });

        const validMyIds = new Set(
          [
            currentUserId,
            (user as any)?._id,
            (user as any)?.employeeId,
            myEmp?.id,
            myEmp?._id,
            myEmp?.userId,
            myEmp?.user?.id,
            myEmp?.employeeId,
          ]
            .filter(Boolean)
            .map(id => String(id).toLowerCase().trim())
        );

        const myFirst = String(user?.firstName || '').toLowerCase().trim();
        const myLast = String(user?.lastName || '').toLowerCase().trim();
        const myFullName = `${myFirst} ${myLast}`.trim();
        const myEmpName = String(myEmp?.name || `${myEmp?.firstName || ''} ${myEmp?.lastName || ''}`).toLowerCase().trim();

        const myNames = [
          myFullName,
          myEmpName,
          myFirst,
          (user as any)?.name ? String((user as any).name).toLowerCase().trim() : '',
          myEmp?.name ? String(myEmp.name).toLowerCase().trim() : '',
          myEmp?.firstName ? String(myEmp.firstName).toLowerCase().trim() : '',
          currentUserEmail,
          String(myEmp?.email || '').toLowerCase().trim()
        ].filter(n => n && n.length >= 3);

        const extra: any = parseLeadNotes(lead.notes);

        // 1. Check Assignee
        const assignedEmpId = String(
          lead.assignedEmployeeId ||
          lead.assignedTo ||
          lead.employeeId ||
          lead.assignedEmployee?.id ||
          lead.assignedEmployee?.userId ||
          lead.assignedEmployee?._id ||
          extra?.assignedEmployeeId ||
          extra?.assignedTo ||
          ''
        ).toLowerCase().trim();

        const assignedToName = String(
          lead.assignedToName ||
          lead.assignedEmployeeName ||
          lead.assignedEmployee?.name ||
          extra?.assignedToName ||
          extra?.assignedEmployeeName ||
          ''
        ).toLowerCase().trim();

        const assignedEmail = String(
          lead.assignedEmployee?.email ||
          lead.assignedEmail ||
          extra?.assignedEmail ||
          ''
        ).toLowerCase().trim();

        const isAssignedToMe = (assignedEmpId && validMyIds.has(assignedEmpId)) ||
          (currentUserEmail && (assignedEmpId === currentUserEmail || assignedEmail === currentUserEmail)) ||
          (assignedToName && myNames.some(mn => mn.length >= 3 && (assignedToName === mn || assignedToName.includes(mn) || mn.includes(assignedToName))));

        // 2. Check Assigner
        const assignedById = String(lead.assignedById || extra?.assignedById || '').toLowerCase().trim();
        const assignedByName = String(lead.assignedByName || extra?.assignedByName || '').toLowerCase().trim();

        const isAssignedByMe = (assignedById && validMyIds.has(assignedById)) ||
          (assignedByName && myNames.some(mn => mn.length >= 3 && (assignedByName === mn || assignedByName.includes(mn) || mn.includes(assignedByName))));

        // 3. Check Creator
        const createdById = String(lead.createdById || lead.creatorId || lead.userId || extra?.createdById || '').toLowerCase().trim();
        const createdByName = String(lead.createdByName || extra?.createdByName || '').toLowerCase().trim();

        const isCreatedByMe = (createdById && validMyIds.has(createdById)) ||
          (createdByName && myNames.some(mn => mn.length >= 3 && (createdByName === mn || createdByName.includes(mn) || mn.includes(createdByName))));

        const isUnassigned = !assignedEmpId && !assignedToName && !assignedById && !createdById;

        if (!isAssignedToMe && !isAssignedByMe && !isCreatedByMe && !isUnassigned) {
          return false;
        }
      }

      const searchName = (lead.fullName || lead.name || `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}` || lead.contact?.name || '').toLowerCase();
      const searchPhone = String(lead.contact?.phone || lead.phone || lead.mobile || '').toLowerCase();
      if (sTerm && !searchName.includes(sTerm) && !searchPhone.includes(sTerm)) return false;

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

      if (filterDate) {
        const targetDate = new Date(filterDate);
        targetDate.setHours(0, 0, 0, 0);
        const lDate = lead.followUpDate ? new Date(lead.followUpDate) : (lead.createdAt ? new Date(lead.createdAt) : null);
        if (lDate) {
          lDate.setHours(0, 0, 0, 0);
          if (lDate.getTime() !== targetDate.getTime()) return false;
        } else {
          return false;
        }
      }
      return true;
    });
  }, [leadsFlat, search, selectedFilters, filterProducts, excludeProduct, filterPlans, filterEmployee, filterStatuses, filterStages, filterTypes, filterDate, user, employeesList]);

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

  // ── WhatsApp Direct & Template Handlers ─────────────────────────────────────
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waTargetPhone, setWaTargetPhone] = useState('');
  const [waTargetLead, setWaTargetLead] = useState<any>(null);
  const [waCustomMessage, setWaCustomMessage] = useState('');
  const [waModalCategoryFilter, setWaModalCategoryFilter] = useState<'ALL' | 'LEAD' | 'SEMINAR'>('ALL');

  // Extract and format clean 10-digit / international phone number
  const getNormalizedPhone = (lead: any, phone?: string) => {
    let raw = phone || '';
    if (!raw && lead) {
      raw = lead?.contact?.phone || lead?.phone || lead?.mobile || lead?.whatsappNumber || lead?.callingNumber || lead?.phoneNumber || lead?.contactNumber || lead?.contact?.mobile || lead?.contact?.whatsappNumber || lead?.client?.phone || lead?.applicant?.phone || '';
      if (!raw && typeof lead.notes === 'string') {
        const pMatch = lead.notes.match(/(?:Phone|Mobile|Contact|WhatsApp|Cell|Tel|Number|Call)[\s:=–-]+(\+?[0-9\s-]{10,14})/i) ||
          lead.notes.match(/(?:\+91[\s-]?)?([6789]\d{9})/);
        if (pMatch && pMatch[1]) raw = pMatch[1].trim();
      }
      if (!raw) {
        try {
          const info = getLeadContactDetails(lead, undefined, contactsList);
          if (info.phone) raw = info.phone;
        } catch {}
      }
    }
    const cleanDigits = String(raw || '').replace(/\D/g, '');
    if (!cleanDigits) return { fullPhone: '', rawPhone: raw };

    // Standard 10 digits Indian mobile -> 91 + 10 digits
    if (cleanDigits.length === 10) {
      return { fullPhone: `91${cleanDigits}`, rawPhone: raw };
    }
    // Already has 91 prefix (12 digits, e.g. 919876543210)
    if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
      return { fullPhone: cleanDigits, rawPhone: raw };
    }
    // Leading 0 (11 digits, e.g. 09876543210)
    if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
      return { fullPhone: `91${cleanDigits.slice(1)}`, rawPhone: raw };
    }
    // More than 10 digits and ends with an Indian 10-digit number
    if (cleanDigits.length > 10) {
      const last10 = cleanDigits.slice(-10);
      if (/^[6789]\d{9}$/.test(last10)) {
        return { fullPhone: `91${last10}`, rawPhone: raw };
      }
    }
    return { fullPhone: cleanDigits, rawPhone: raw };
  };

  const getLeadDisplayName = (lead: any) => {
    if (!lead) return '';
    try {
      const info = getLeadContactDetails(lead, undefined, contactsList);
      if (info.hasRealName && info.fullName) return info.fullName;
    } catch {}
    const cName = lead?.contact ? `${lead.contact.firstName || ''} ${lead.contact.lastName || ''}`.trim() : '';
    if (cName) return cName;
    const lName = `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim();
    if (lName) return lName;
    if (lead?.name && !['website lead', 'lead', 'web user'].includes(lead.name.toLowerCase())) return lead.name;
    return lead?.clientName || '';
  };

  const buildDefaultWhatsAppMessage = (lead: any) => {
    const leadName = getLeadDisplayName(lead);
    let consultantName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
    if (!consultantName || ['agency owner', 'owner admin', 'owner', 'admin', 'super admin', 'superadmin', 'agency'].includes(consultantName.toLowerCase())) {
      consultantName = 'Family Welfare Consultant';
    }
    const planInfo = lead?.planName || lead?.insuranceType || lead?.policyType || '';

    let text = `नमस्कार / Hello${leadName ? ` *${leadName}*` : ''},\n\n`;
    text += `Greetings from *Family First*! I am *${consultantName}*, your insurance advisor.\n`;
    if (planInfo) {
      text += `Regarding your interest in *${planInfo}* insurance,\n`;
    }
    text += `How can we assist you today? Please feel free to reply or let us know a convenient time to discuss.\n\nThank you! 🙏`;
    return text;
  };

  // Reliable cross-platform direct WhatsApp launcher
  const triggerWhatsAppChat = (fullPhone: string, message?: string) => {
    if (!fullPhone) return;
    const cleanNumber = fullPhone.replace(/\D/g, '');
    if (!cleanNumber) return;
    const encoded = message ? encodeURIComponent(message) : '';

    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // On Desktop, web.whatsapp.com/send directly opens the chat in WhatsApp Web without the intermediate "Continue to chat" prompt
    // On Mobile, api.whatsapp.com/send opens the native WhatsApp application directly
    const waUrl = isMobile
      ? (encoded ? `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encoded}` : `https://api.whatsapp.com/send?phone=${cleanNumber}`)
      : (encoded ? `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encoded}` : `https://web.whatsapp.com/send?phone=${cleanNumber}`);

    try {
      const anchor = document.createElement('a');
      anchor.href = waUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (e) {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // DIRECT WhatsApp Action: Open Template Modal so user can choose any template or send custom/default message
  const handleWhatsApp = (lead: any, phone?: string) => {
    handleOpenWaModal(lead, phone);
  };

  // Open Template Modal (for selecting specific templates or custom message)
  const handleOpenWaModal = (lead: any, phone?: string) => {
    const { fullPhone } = getNormalizedPhone(lead, phone);
    if (!fullPhone) {
      toast.error('No valid phone number found for this lead (मोबाईल नंबर सापडला नाही)');
      return;
    }
    try {
      const raw = localStorage.getItem('familyfirst_whatsapp_management_templates_v2');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setWaTemplates(prev => {
          const seen = new Set(prev.map(p => (p.name || p.title || '').trim().toLowerCase()));
          const toAdd = parsed.filter(t => t.isActive !== false && !seen.has((t.name || t.title || '').trim().toLowerCase()));
          return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
        });
      }
    } catch {}
    setWaTargetLead(lead);
    setWaTargetPhone(fullPhone);
    setWaCustomMessage(buildDefaultWhatsAppMessage(lead));
    setWaModalOpen(true);
  };

  const handleDeleteWaTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this template permanently? (हे टेम्पलेट डिलीट करायचे आहे का?)')) return;

    // 1. Update state
    setWaTemplates(prev => prev.filter(t => t.id !== templateId));

    // 2. Remove from localStorage
    try {
      const raw = localStorage.getItem('familyfirst_whatsapp_management_templates_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((t: any) => t.id !== templateId);
          localStorage.setItem('familyfirst_whatsapp_management_templates_v2', JSON.stringify(filtered));
        }
      }
    } catch {}

    // 3. Delete from Firestore
    try {
      if (db && templateId && !templateId.startsWith('default_')) {
        await deleteDoc(doc(db, 'whatsappTemplates', templateId)).catch(() => {});
      }
    } catch {}

    toast.success('Template deleted successfully (टेम्पलेट डिलीट झाले)');
  };

  // Derived filtered templates based on selected category in the modal
  const displayedWaTemplates = useMemo(() => {
    if (waModalCategoryFilter === 'ALL') return waTemplates;
    if (waModalCategoryFilter === 'SEMINAR') {
      return waTemplates.filter(t => t.category?.toUpperCase() === 'SEMINAR' || (t.category || '').toLowerCase().includes('seminar'));
    }
    return waTemplates.filter(t => t.category?.toUpperCase() !== 'SEMINAR' && !(t.category || '').toLowerCase().includes('seminar'));
  }, [waTemplates, waModalCategoryFilter]);

  const handleWhatsAppSelectTemplate = (msg: string) => {
    const leadName = getLeadDisplayName(waTargetLead);
    let cName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
    if (!cName || ['agency owner', 'owner admin', 'owner', 'admin', 'super admin', 'superadmin', 'agency'].includes(cName.toLowerCase())) {
      cName = 'Family Welfare Consultant';
    }
    const todayStr = format(new Date(), 'dd MMM yyyy');
    const todayDay = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'][new Date().getDay()];
    const customized = replaceWhatsAppVariables(msg, {
      name: leadName || waTargetLead?.contact?.firstName || waTargetLead?.firstName || waTargetLead?.name || 'Customer',
      customerName: leadName || waTargetLead?.contact?.firstName || waTargetLead?.firstName || waTargetLead?.name || 'Customer',
      consultantName: cName,
      consultant: cName,
      date: todayStr,
      day: todayDay,
      time: '11:00 AM',
      topic: waTargetLead?.planName || waTargetLead?.insuranceType || 'Financial & Insurance Planning Seminar',
      venue: 'Family First Main Office / Online',
      speaker: cName,
    });
    if (!waTargetPhone || !customized.trim()) return;
    triggerWhatsAppChat(waTargetPhone, customized);
    setWaModalOpen(false);
  };

  const handleSendCustomWhatsApp = () => {
    if (!waTargetPhone) return;
    triggerWhatsAppChat(waTargetPhone, waCustomMessage || '');
    setWaModalOpen(false);
  };

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
      if (!mergedTags.includes('lead_only')) {
        mergedTags.push('lead_only');
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
        if (contactId) {
          try {
            await contactsService.update(contactId, {
              firstName,
              lastName,
              middleName: personalFields.middleName || undefined,
              phone: targetPhone,
              email: personalFields.email || undefined,
              dateOfBirth: personalFields.dateOfBirth ? new Date(personalFields.dateOfBirth).toISOString() : undefined,
              bankName: personalFields.bankName || '',
              bankAccountNumber: personalFields.bankAccountNumber || '',
              bankIfsc: personalFields.bankIfsc || '',
              bankBranch: personalFields.bankBranch || '',
              bankDetails: {
                bankName: personalFields.bankName || '',
                accountNumber: personalFields.bankAccountNumber || '',
                ifscCode: personalFields.bankIfsc || '',
                branchName: personalFields.bankBranch || '',
              },
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
        } catch (e) { }

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
      const currentUser = useAuthStore.getState().user;
      const curEmp = employeesList.find((e: any) => e.userId === currentUser?.id || e.id === currentUser?.id || e.user?.id === currentUser?.id);
      const curEmpId = curEmp?.userId || curEmp?.id || currentUser?.id;
      const curEmpName = currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : (currentUser?.email || '');
      const validEmpId = (id?: string) => (id && /^[0-9a-fA-F]{24}$/.test(id.trim())) ? id.trim() : undefined;
      const chosenEmpId = validEmpId(leadInfoFields?.assignedEmployeeId) || validEmpId(productInterests[0]?.assignedEmployeeId) || (currentUser?.role === 'EMPLOYEE' ? curEmpId : undefined);

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
        bankName: personalFields.bankName || '',
        bankAccountNumber: personalFields.bankAccountNumber || '',
        bankIfsc: personalFields.bankIfsc || '',
        bankBranch: personalFields.bankBranch || '',
        bankDetails: {
          bankName: personalFields.bankName || '',
          accountNumber: personalFields.bankAccountNumber || '',
          ifscCode: personalFields.bankIfsc || '',
          branchName: personalFields.bankBranch || '',
        },
        assignedEmployeeId: chosenEmpId || undefined,
        createdById: currentUser?.id,
        createdByName: curEmpName,
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
          }).catch((err: any) => console.error('Failed to add address:', err));
        }

        const firstCard = productInterests[0] || {};
        const product = firstCard.interestedIn?.[0] || 'Health';
        const interests = [product === 'Other' && firstCard.otherProduct ? firstCard.otherProduct : product];
        const stage = firstCard.leadStage && firstCard.leadStage !== 'OPEN' ? firstCard.leadStage : 'TO_CONTACT';

        await leadsService.create({
          contactId,
          interests,
          stage,
          source: firstCard.leadSource || 'Social Media',
          assignedEmployeeId: validEmpId(firstCard.assignedEmployeeId) || chosenEmpId,
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
      bankName: '',
      bankAccountNumber: '',
      bankIfsc: '',
      bankBranch: '',
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
    const contactId = card.contactId || card.contact?.id || (typeof card.contact === 'string' ? card.contact : null);

    const contactInfo = getLeadContactDetails(card, leadsFlat, contactsList);
    const matchedContact = (contactId && contactsById.get(String(contactId).toLowerCase())) ||
      (contactId && contactsList.find((c: any) => String(c.id || c._id).toLowerCase() === String(contactId).toLowerCase())) ||
      (contactInfo.phone && contactsByPhone.get(contactInfo.phone.replace(/\D/g, '').slice(-10))) ||
      null;

    const cObj = matchedContact || (typeof card.contact === 'object' && card.contact ? card.contact : null) || {};

    const firstName = cObj.firstName || (contactInfo.hasRealName ? contactInfo.firstName : '') || '';
    const lastName = cObj.lastName || (contactInfo.hasRealName ? contactInfo.lastName : '') || '';
    const fullName = contactInfo.hasRealName ? contactInfo.fullName : (`${firstName} ${lastName}`.trim() || cObj.name || '');
    const phone = cObj.phone || cObj.mobile || contactInfo.phone || card.phone || card.mobile || '';
    const email = cObj.email || contactInfo.email || card.email || '';
    const dob = cObj.dateOfBirth ? String(cObj.dateOfBirth).split('T')[0] : (card.dob ? String(card.dob).split('T')[0] : '');

    const initialPersonal = {
      firstName: firstName,
      middleName: cObj.middleName || card.middleName || '',
      lastName: lastName,
      fullName: fullName,
      gender: cObj.gender || card.gender || '',
      maritalStatus: cObj.maritalStatus || card.maritalStatus || '',
      dateOfBirth: dob,
      email: email,
      aadhaarNumber: cObj.aadhaarNumber || card.aadhaarNumber || '',
      whatsappNumber: phone,
      sameAsWhatsapp: true,
      callingNumber: cObj.alternatePhone || phone,
      education: cObj.education || card.education || '',
      annualIncome: cObj.annualIncome ? String(cObj.annualIncome) : (card.annualIncome ? String(card.annualIncome) : ''),
      occupationType: cObj.occupationType || card.occupation || '',
      companyName: cObj.companyName || '',
      state: cObj.state || card.state || '',
      district: cObj.district || card.district || '',
      city: cObj.city || card.city || '',
      pincode: cObj.pincode || card.pincode || '',
      streetAddress: cObj.streetAddress || cObj.notes || card.address || '',
      bankName: cObj.bankName || card.bankName || cObj.bankDetails?.bankName || '',
      bankAccountNumber: cObj.bankAccountNumber || card.bankAccountNumber || cObj.bankDetails?.accountNumber || cObj.bankDetails?.bankAccountNumber || '',
      bankIfsc: cObj.bankIfsc || card.bankIfsc || cObj.bankDetails?.ifscCode || cObj.bankDetails?.bankIfsc || '',
      bankBranch: cObj.bankBranch || card.bankBranch || cObj.bankDetails?.branchName || cObj.bankDetails?.bankBranch || '',
      declaredMedicalHistory: cObj.declaredMedicalHistory || card.declaredMedicalHistory || [],
      notDeclaredMedicalHistory: cObj.notDeclaredMedicalHistory || card.notDeclaredMedicalHistory || [],
      medicalHistoryDetails: cObj.medicalHistoryDetails || card.medicalHistoryDetails || ''
    };

    setPersonalFields(initialPersonal);

    // Prepare default Product Interests from card
    const cardInterests = (card.interests && card.interests.length > 0)
      ? card.interests
      : (card.plan?.name ? [card.plan.name] : ['Health']);
    const cardStage = card.stage || 'TO_CONTACT';
    const cardPremium = card.premiumBudget ? String(card.premiumBudget) : (card.expectedPremium ? String(card.expectedPremium) : '');
    const cardFollowUp = card.followUpDate ? card.followUpDate.split('T')[0] : '';
    
    const parsedNotes = parseLeadNotes(card.notes);

    setProductInterests([
      {
        id: card.id || `lead-${Date.now()}`,
        collapsed: false,
        interestedIn: cardInterests,
        otherProduct: '',
        descriptionDetails: parsedNotes.descriptionDetails || '',
        leadStage: cardStage,
        leadStatus: parsedNotes.leadStatus || 'ACTIVE_LEAD',
        dependencyType: parsedNotes.dependencyType || 'SELF',
        dependentDetails: parsedNotes.dependentDetails || '',
        leadType: parsedNotes.leadType || 'FRESH',
        leadSource: card.source || 'Social Media',
        assignedEmployeeId: card.assignedEmployeeId || '',
        followUpDate: cardFollowUp,
        expectedPremium: cardPremium,
        comments: [],
        newComment: '',
      }
    ]);

    // 2. If contactId exists, attempt to enrich with full profile
    if (contactId) {
      try {
        const res = await contactsService.get(contactId);
        const contact = res?.data ?? res;
        if (contact) {
          setLoadedContact(contact);
          setEditContactId(contact.id || contact._id || contactId);
          const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
          const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];
          setPersonalFields(prev => ({
            ...prev,
            firstName: contact.firstName || prev.firstName,
            middleName: contact.middleName || prev.middleName,
            lastName: contact.lastName || prev.lastName,
            fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || prev.fullName,
            gender: contact.gender || prev.gender,
            maritalStatus: contact.maritalStatus || prev.maritalStatus,
            dateOfBirth: contact.dateOfBirth ? String(contact.dateOfBirth).split('T')[0] : prev.dateOfBirth,
            email: contact.email || prev.email,
            aadhaarNumber: contact.aadhaarNumber || prev.aadhaarNumber,
            whatsappNumber: contact.phone || prev.whatsappNumber,
            sameAsWhatsapp: contact.phone === contact.alternatePhone,
            callingNumber: contact.alternatePhone || contact.phone || prev.callingNumber,
            education: contact.education || prev.education,
            annualIncome: contact.annualIncome ? String(contact.annualIncome) : prev.annualIncome,
            occupationType: primaryOcc?.type || contact.occupationType || prev.occupationType,
            companyName: primaryOcc?.companyName || contact.companyName || prev.companyName,
            state: primaryAddr?.state || contact.state || prev.state,
            district: primaryAddr?.district || contact.district || prev.district,
            city: primaryAddr?.city || contact.city || prev.city,
            pincode: primaryAddr?.pincode || contact.pincode || prev.pincode,
            streetAddress: primaryAddr?.line1 || contact.streetAddress || contact.notes || prev.streetAddress,
            bankName: contact.bankName || contact.bankDetails?.bankName || prev.bankName,
            bankAccountNumber: contact.bankAccountNumber || contact.accountNumber || contact.bankDetails?.accountNumber || contact.bankDetails?.bankAccountNumber || prev.bankAccountNumber,
            bankIfsc: contact.bankIfsc || contact.ifscCode || contact.bankDetails?.ifscCode || contact.bankDetails?.bankIfsc || prev.bankIfsc,
            bankBranch: contact.bankBranch || contact.branchName || contact.bankDetails?.branchName || contact.bankDetails?.bankBranch || prev.bankBranch,
            declaredMedicalHistory: contact.declaredMedicalHistory || prev.declaredMedicalHistory,
            notDeclaredMedicalHistory: contact.notDeclaredMedicalHistory || prev.notDeclaredMedicalHistory,
            medicalHistoryDetails: contact.medicalHistoryDetails || prev.medicalHistoryDetails
          }));
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
    } catch (err: any) {
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
      } catch (e) { }

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
            } catch (e) { }
          }
        });
      } catch (lsErr) { }

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

  const handleLeadDetailUpdated = (updatedLead: any) => {
    if (!updatedLead) return;
    setDetailTarget((prev: any) => prev ? { ...prev, ...updatedLead } : updatedLead);
    setWebLeads((prev: any[]) => prev.map(l => {
      const lId = String(l.id || '');
      const tId = String(updatedLead.id || '');
      if (lId === tId || lId === ('fs_' + tId) || ('fs_' + lId) === tId) {
        return { ...l, ...updatedLead };
      }
      return l;
    }));
    qc.invalidateQueries({ queryKey: ['leads'] });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const activeFilterCount =
    filterPlans.length + filterStatuses.length + filterStages.length + filterTypes.length +
    (filterEmployee ? 1 : 0) + (filterDate ? 1 : 0);

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading pipeline…</div>;

  return (
    <div className="space-y-4 font-sans text-slate-800">
      <Modal open={waModalOpen} onClose={() => setWaModalOpen(false)} title="WhatsApp Message & Templates" size="lg">
        <div className="space-y-4 p-1">
          {/* Recipient info & direct action */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-green-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <h4 className="text-sm font-bold text-slate-800">
                  {getLeadDisplayName(waTargetLead) || 'Lead Contact'}
                </h4>
                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                  +{waTargetPhone}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Direct WhatsApp chat किंवा खालील टेम्पलेट निवडून मेसेज पाठवा
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  triggerWhatsAppChat(waTargetPhone, '');
                  setWaModalOpen(false);
                }}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                title="Open WhatsApp chat without pre-filled text"
              >
                <span>Direct Chat</span>
              </button>
              <button
                type="button"
                onClick={handleSendCustomWhatsApp}
                className="flex-1 sm:flex-initial px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send size={13} />
                <span>Send Now</span>
              </button>
            </div>
          </div>

          {/* Custom Message Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageCircle size={13} className="text-emerald-600" />
                Direct Message Text (थेट संदेश)
              </label>
              <span className="text-[11px] text-slate-400">Edit before sending</span>
            </div>
            <textarea
              rows={3}
              value={waCustomMessage}
              onChange={e => setWaCustomMessage(e.target.value)}
              placeholder="Type your WhatsApp message here..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all shadow-2xs font-sans leading-relaxed resize-none"
            />
          </div>

          {/* Quick Templates Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText size={13} className="text-purple-600" />
                Pre-defined Templates (टेम्पलेट निवडून थेट पाठवा)
              </h5>
              
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 text-[11px] font-medium self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setWaModalCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    waModalCategoryFilter === 'ALL'
                      ? 'bg-white text-emerald-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 font-semibold">{waTemplates.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWaModalCategoryFilter('LEAD')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    waModalCategoryFilter === 'LEAD'
                      ? 'bg-white text-emerald-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Leads</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    {waTemplates.filter(t => t.category?.toUpperCase() !== 'SEMINAR' && !(t.category || '').toLowerCase().includes('seminar')).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setWaModalCategoryFilter('SEMINAR')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    waModalCategoryFilter === 'SEMINAR'
                      ? 'bg-white text-purple-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Seminars</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-semibold">
                    {waTemplates.filter(t => t.category?.toUpperCase() === 'SEMINAR' || (t.category || '').toLowerCase().includes('seminar')).length}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto p-1 custom-scrollbar">
              {displayedWaTemplates.length === 0 ? (
                <div className="col-span-full py-8 flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
                  <span>या कॅटेगरीमध्ये कोणतेही ॲक्टिव्ह टेम्पलेट सापडले नाहीत.</span>
                  <span className="text-[10px] text-slate-400">Management पेजवरून नवीन टेम्पलेट जोडू शकता.</span>
                </div>
              ) : (
                displayedWaTemplates.map(t => {
                  const isSem = t.category?.toUpperCase() === 'SEMINAR' || (t.category || '').toLowerCase().includes('seminar');
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleWhatsAppSelectTemplate(t.message)}
                      className="bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 hover:shadow-md transition-all rounded-xl p-3 cursor-pointer group flex flex-col gap-1.5 justify-between"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 truncate">
                          {t.name || t.title}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          {t.category && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              isSem
                                ? 'text-purple-700 bg-purple-50 border-purple-200'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            }`}>
                              {t.category}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteWaTemplate(t.id, e)}
                            title="Delete Template (टेम्पलेट हटवा)"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {t.message && (
                        <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {t.message}
                        </p>
                      )}
                      <div className="flex items-center justify-end text-[10px] font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform pt-1">
                        <span>Send Template →</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Floating Right Action Panel */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      <div className="fixed right-3 sm:right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
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

          {/* Right Side: Active/Inactive Badges, Date Range Selector, Filters & View Mode Toggle */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
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

            {/* Single Date Selector */}
            <div className="flex flex-nowrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs shrink-0">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <DatePicker
                value={filterDate}
                onChange={val => { setFilterDate(val); }}
                className="bg-transparent border-0 outline-none text-[11px] font-semibold text-slate-700 w-24 focus:ring-0 p-0 cursor-pointer"
                title="Filter Date"
              />
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate('')}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs px-0.5 cursor-pointer"
                  title="Clear Date Filter"
                >
                  ×
                </button>
              )}
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

            {/* View Mode Toggle: Table / Kanban Board (Moved to end) */}
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
                const empEmail = emp.email || emp.user?.email || '';
                const label = empEmail && !empName.toLowerCase().includes(empEmail.toLowerCase())
                  ? `${empName} (${empEmail})`
                  : (empName || empEmail || 'Employee');
                return (
                  <option key={emp.id || empUserId} value={empUserId}>
                    {label}
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
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedOverStage !== stage) setDraggedOverStage(stage);
                    }}
                    onDragLeave={() => {
                      if (draggedOverStage === stage) setDraggedOverStage(null);
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      setDraggedOverStage(null);
                      const cardId = e.dataTransfer.getData('cardId') || e.dataTransfer.getData('text/plain');
                      if (cardId && backendStage) {
                        const draggedLead = filteredLeads.find(l => String(l.id) === String(cardId));
                        if (draggedLead && draggedLead.stage !== backendStage) {
                          // 1. Optimistic instant local state update for super smooth UI
                          setWebLeads(prev =>
                            prev.map(l =>
                              String(l.id) === String(cardId) || String(l.id) === String(cardId).replace('fs_', '')
                                ? { ...l, stage: backendStage, uiStage: stage }
                                : l
                            )
                          );

                          // Policy creation is no longer triggered automatically
                          // if (backendStage === 'PROCESS_COMPLETED') {
                          //   triggerPolicyCreationForLead(draggedLead);
                          // }

                          // 3. Move stage in backend, Firestore, and localStorage
                          moveStage.mutate(
                            { id: cardId, stage: backendStage },
                            {
                              onSuccess: () => {
                                toast.success(`Lead moved to "${stage}"`);
                                qc.invalidateQueries({ queryKey: ['leads'] });
                                qc.invalidateQueries({ queryKey: ['leads', 'kanban'] });
                              },
                              onError: () => {
                                toast.error('Failed to move lead stage');
                              }
                            }
                          );
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
                          allLeadsList={leadsFlat}
                          contactsList={contactsList}
                          onEdit={openEdit}
                          onDelete={c => setDeleteTarget(c)}
                          onOpen={openDetail}
                          onCall={handleCall}
                          onWhatsApp={handleWhatsApp}
                          onOpenTemplate={handleOpenWaModal}
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
            allLeadsList={leadsFlat}
            contactsList={contactsList}
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
            onOpenTemplate={handleOpenWaModal}
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
            {['Product Interest', 'Personal', 'Family'].map(tab => (
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
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeProductInterest(card.id); }}
                            className="p-1 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-all cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
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
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting', 'Other'].map(prod => {
                                const isSel = card.interestedIn.includes(prod);
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
                                    onClick={() => {
                                      const next = isSel ? [] : [prod];
                                      updateProductInterest(card.id, 'interestedIn', next);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all select-none cursor-pointer ${btnStyle}`}
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
                                  Specify Other Product Name <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                  type="text"
                                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none shadow-xs"
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
                                Lead Status <span className="text-red-500">*</span>
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
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Type <span className="text-red-500">*</span></label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadType}
                                onChange={e => updateProductInterest(card.id, 'leadType', e.target.value)}
                              >
                                <option value="FRESH">Fresh</option>
                                <option value="RENEWAL">Renewal</option>
                                <option value="PORTING">Porting</option>
                              </select>
                            </div>
                          </div>

                          {/* Row 2: Source, Assigned Employee, Follow-up Date, Expected Premium */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Source <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                list={`lead-source-list-${card.id}`}
                                className="input w-full text-xs"
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
                                  const empEmail = emp.email || emp.user?.email || '';
                                  const label = empEmail && !empName.toLowerCase().includes(empEmail.toLowerCase())
                                    ? `${empName} (${empEmail})`
                                    : (empName || empEmail || 'Employee');
                                  return (
                                    <option key={emp.id || empUserId} value={empUserId}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Follow-up Date <span className="text-red-500">*</span></label>
                              <DatePicker
                                className="input w-full text-xs"
                                value={card.followUpDate}
                                onChange={val => updateProductInterest(card.id, 'followUpDate', val)}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expected Premium / Budget (₹) <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                className="input w-full text-xs"
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3 pb-4">
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
                      </div>
                    ))}

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
        title={(() => {
          if (!detailTarget) return 'Lead Details';
          const info = getLeadContactDetails(detailTarget, leadsFlat, contactsList);
          return info.fullName || 'Lead Details';
        })()}
        subtitle={(() => {
          if (!detailTarget) return undefined;
          const info = getLeadContactDetails(detailTarget, leadsFlat, contactsList);
          return info.phone ? `Contact: ${info.phone}` : undefined;
        })()}
        size="xl"
        heightClass="h-[88vh] max-h-[760px] min-h-[580px]"
      >
        {detailTarget && (
          <div className="h-full flex flex-col min-h-0">
            <LeadDetailPopup
              lead={detailTarget}
              tab={detailTab}
              onTabChange={setDetailTab}
              employees={employeesList}
              allLeads={leadsFlat}
              contactsList={contactsList}
              isOwner={isOwner}
              onEdit={() => { setDetailOpen(false); openEdit(detailTarget); }}
              onTriggerPolicyCreation={triggerPolicyCreationForLead}
              onUpdateLead={handleLeadDetailUpdated}
              onCall={handleCall}
              onWhatsApp={handleWhatsApp}
              onWhatsAppTemplate={handleOpenWaModal}
            />
          </div>
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

            {/* Policy Type (Text Input) */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Type *</label>
              <input
                type="text"
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedType}
                onChange={e => setPolicySelectedType(e.target.value)}
                placeholder="e.g. Life Insurance, Health Insurance"
                required
              />
            </div>

            {/* Insurance Company (Text Input) */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Company *</label>
              <input
                type="text"
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedCompany}
                onChange={e => setPolicySelectedCompany(e.target.value)}
                placeholder="e.g. LIC, HDFC Life"
                required
              />
            </div>

            {/* Insurance Plan (Text Input) */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Plan *</label>
              <input
                type="text"
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedPlanId}
                onChange={e => setPolicySelectedPlanId(e.target.value)}
                placeholder="e.g. Jeevan Anand"
                required
              />
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

export function getAssignableEmployees(empList: any[] = [], currentLeadOrContact?: any, otherLeadsOrContacts: any[] = []): any[] {
  const rawList = Array.isArray(empList) ? [...empList] : [];
  const contactsPool = Array.isArray(otherLeadsOrContacts) ? otherLeadsOrContacts : [];

  // Add current logged in user / owner if available
  try {
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      const curId = currentUser.id || (currentUser as any)._id;
      const curEmail = currentUser.email || '';
      const curFn = currentUser.firstName || '';
      const curLn = currentUser.lastName || '';
      const curFullName = `${curFn} ${curLn}`.trim() || curEmail || 'Owner';
      if (!rawList.some((e: any) => String(e.userId || e.id || e.user?.id) === String(curId) || (curEmail && (e.email || e.user?.email) === curEmail))) {
        rawList.unshift({
          id: curId,
          userId: curId,
          firstName: curFn,
          lastName: curLn,
          email: curEmail,
          name: curFullName,
          role: currentUser.role || 'OWNER'
        });
      }
    }
  } catch (e) {}

  // Add other client/lead names from the system so they can be assigned if needed
  contactsPool.forEach((item: any) => {
    if (!item) return;
    const c = item.contact || item;
    const fn = (c.firstName || item.firstName || '').trim();
    const ln = (c.lastName || item.lastName || '').trim();
    const rawName = (item.fullName || item.name || c.fullName || c.name || `${fn} ${ln}`).trim();
    const nameParts = rawName.split(/\s+/);
    const parsedFn = fn || nameParts[0] || '';
    const parsedLn = ln || nameParts.slice(1).join(' ') || '';
    const full = `${parsedFn} ${parsedLn}`.trim();
    if (!full || full.toLowerCase() === 'website lead' || full.toLowerCase() === 'lead') return;

    const id = String(item.id || item._id || c.id || `lead_contact_${parsedFn}_${parsedLn}`);
    const phone = c.phone || item.phone || item.mobile || '';
    const email = c.email || item.email || '';

    rawList.push({
      id,
      userId: id,
      firstName: parsedFn,
      lastName: parsedLn,
      phone,
      email,
      name: full,
      role: 'CONTACT'
    });
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

  const currentLeadId = String(currentLeadOrContact?.id || currentLeadOrContact?._id || currentLeadOrContact?.contactId || '').toLowerCase().trim();

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  return rawList.filter((emp: any) => {
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

    // Exclude the current Lead / Client themselves (match ID, first name, last name, normalized name, phone, or email)
    if (currentLeadId && (id.toLowerCase() === currentLeadId || (currentLeadId.startsWith('fs_') && id.toLowerCase() === currentLeadId.replace('fs_', '')))) {
      return false;
    }
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

  const isInvalidAssigneeName = (name?: string) => {
    if (!name) return true;
    const n = name.trim().toLowerCase();
    if (!n || n === 'unassigned' || n === 'super admin' || n === 'superadmin' || n === 'owner' || n === 'administrator') return true;
    if (n.startsWith('fs_') || n.startsWith('local_') || n.startsWith('checkup_') || n.startsWith('usr_') || n.startsWith('lead_') || n.startsWith('temp-') || /^[0-9a-fA-F]{24}$/.test(n)) return true;
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

  // 2. Direct name on assignedTo / assignedEmployeeId if it's already a text name (not an ID)
  if (typeof item.assignedTo === 'string' && item.assignedTo && !isInvalidAssigneeName(item.assignedTo)) {
    return item.assignedTo.trim();
  }
  if (typeof item.assignedEmployeeId === 'string' && item.assignedEmployeeId && !isInvalidAssigneeName(item.assignedEmployeeId)) {
    return item.assignedEmployeeId.trim();
  }

  // 3. Check notes JSON
  try {
    if (item.notes && typeof item.notes === 'string') {
      const parsed = JSON.parse(item.notes);
      if (parsed.assignedToName && !isInvalidAssigneeName(parsed.assignedToName)) {
        return String(parsed.assignedToName).trim();
      }
      if (parsed.assignedEmployeeName && !isInvalidAssigneeName(parsed.assignedEmployeeName)) {
        return String(parsed.assignedEmployeeName).trim();
      }
    }
  } catch { }

  // 4. Lookup across empList and local storage by ID
  const empId = item.assignedEmployeeId || item.assignedEmployee?.id || item.assignedEmployee?.userId || item.assignedTo;
  if (empId) {
    const strEmpId = String(empId).trim().toLowerCase();

    if (empList && empList.length > 0) {
      const found = empList.find((e: any) => {
        const eId = String(e.id || '').toLowerCase();
        const eUid = String(e.userId || '').toLowerCase();
        const eUserDocId = String(e.user?.id || e.user?._id || '').toLowerCase();
        const eRawId = String(e._id || '').toLowerCase();
        const eEmail = String(e.email || e.user?.email || '').toLowerCase();

        const p = e.employeeProfile || e;
        const fn = String(p.firstName || e.firstName || e.user?.firstName || '').toLowerCase().trim();
        const ln = String(p.lastName || e.lastName || e.user?.lastName || '').toLowerCase().trim();
        const fullName = `${fn} ${ln}`.trim();
        const empName = String(e.name || '').toLowerCase().trim();

        return (eId && (eId === strEmpId || strEmpId === eId || ('fs_' + eId) === strEmpId || eId === strEmpId.replace('fs_', ''))) ||
          (eUid && (eUid === strEmpId || strEmpId === eUid)) ||
          (eUserDocId && (eUserDocId === strEmpId || strEmpId === eUserDocId)) ||
          (eRawId && (eRawId === strEmpId || strEmpId === eRawId)) ||
          (eEmail && eEmail === strEmpId) ||
          (fullName && (fullName === strEmpId || strEmpId.includes(fullName))) ||
          (empName && (empName === strEmpId || strEmpId.includes(empName)));
      });

      if (found) {
        const p = found.employeeProfile || found;
        const fn = p.firstName || found.firstName || found.user?.firstName || '';
        const ln = p.lastName || found.lastName || found.user?.lastName || '';
        const name = `${fn} ${ln}`.trim() || found.name || '';
        if (name && !isInvalidAssigneeName(name)) return name;
      }
    }

    // Lookup across local storage leads
    try {
      const localLeads = JSON.parse(localStorage.getItem('insumitra_local_leads') || '[]');
      const localMatch = localLeads.find((l: any) => {
        const lid = String(l.id || '').toLowerCase();
        const lcid = String(l.contact?.id || '').toLowerCase();
        return lid === strEmpId || ('fs_' + lid) === strEmpId || lid === strEmpId.replace('fs_', '') || lcid === strEmpId;
      });
      if (localMatch) {
        const c = localMatch.contact || localMatch;
        const fn = c.firstName || localMatch.firstName || '';
        const ln = c.lastName || localMatch.lastName || '';
        const name = `${fn} ${ln}`.trim() || localMatch.name || localMatch.fullName;
        if (name && !isInvalidAssigneeName(name)) return name;
      }
    } catch { }
  }

  return 'Unassigned';
}

export function getAssignerDisplayName(item: any, empList?: any[]): string | null {
  if (!item) return null;

  // 1. Direct assigner properties
  if (item.assignedByName) return String(item.assignedByName).trim();
  if (item.assignedBy?.name) return String(item.assignedBy.name).trim();
  if (item.assignedBy?.firstName || item.assignedBy?.lastName) {
    const full = `${item.assignedBy.firstName || ''} ${item.assignedBy.lastName || ''}`.trim();
    if (full) return full;
  }
  if (item.createdByName) return String(item.createdByName).trim();
  if (item.createdBy?.name) return String(item.createdBy.name).trim();

  // 2. From parsed notes
  try {
    if (item.notes && typeof item.notes === 'string') {
      const parsed = JSON.parse(item.notes);
      if (parsed.assignedByName) return String(parsed.assignedByName).trim();
      if (parsed.createdByName) return String(parsed.createdByName).trim();
      if (parsed.assignedById && empList) {
        const found = empList.find((e: any) =>
          String(e.id) === String(parsed.assignedById) ||
          String(e.userId) === String(parsed.assignedById) ||
          String(e.user?.id) === String(parsed.assignedById)
        );
        if (found) {
          const fn = found.firstName || found.user?.firstName || '';
          const ln = found.lastName || found.user?.lastName || '';
          const name = `${fn} ${ln}`.trim();
          if (name) return name;
        }
      }
    }
  } catch { }

  // 3. Lookup by assignedById in empList
  const assignerId = item.assignedById || item.createdById;
  if (assignerId && empList && empList.length > 0) {
    const found = empList.find((e: any) =>
      String(e.id) === String(assignerId) ||
      String(e.userId) === String(assignerId) ||
      String(e.user?.id) === String(assignerId)
    );
    if (found) {
      const fn = found.firstName || found.user?.firstName || '';
      const ln = found.lastName || found.user?.lastName || '';
      const name = `${fn} ${ln}`.trim();
      if (name) return name;
    }
  }

  return null;
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ card, employeesList, allLeadsList, contactsList, onEdit, onDelete, onOpen, onCall, onWhatsApp, onOpenTemplate }: {
  card: any;
  employeesList?: any[];
  allLeadsList?: any[];
  contactsList?: any[];
  onEdit: (c: any) => void;
  onDelete: (c: any) => void;
  onOpen: (c: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (lead: any, phone?: string) => void;
  onOpenTemplate?: (lead: any, phone?: string) => void;
}) {
  let formattedDate = '';
  try {
    if (card.createdAt) {
      const raw = typeof card.createdAt === 'object' && card.createdAt?.seconds ? card.createdAt.seconds * 1000 : card.createdAt;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) formattedDate = format(d, 'dd/MM/yyyy');
    }
  } catch {}

  let followUp: string | null = null;
  try {
    if (card.followUpDate) {
      const raw = typeof card.followUpDate === 'object' && card.followUpDate?.seconds ? card.followUpDate.seconds * 1000 : card.followUpDate;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) followUp = format(d, 'dd/MM/yyyy');
    }
  } catch {}
  const assigneeName = getAssigneeDisplayName(card, employeesList);
  const assignerName = getAssignerDisplayName(card, employeesList);
  const hotness = deriveHotness(card);
  const hotnessConf = HOTNESS_CONFIG[hotness];
  const contactInfo = getLeadContactDetails(card, allLeadsList, contactsList);
  const isGeneric = (n?: string) => !n || n === 'Website Lead' || n === 'Contact Lead' || n === 'Lead' || String(n).startsWith('Lead (');
  const rawClientName = !isGeneric(card.fullName)
    ? card.fullName
    : (!isGeneric(card.name)
      ? card.name
      : (!isGeneric(card.contact?.fullName)
        ? card.contact.fullName
        : (!isGeneric(card.contact?.name)
          ? card.contact.name
          : (!isGeneric(contactInfo.fullName)
            ? contactInfo.fullName
            : (card.contact?.firstName ? `${card.contact.firstName} ${card.contact.lastName || ''}`.trim() : 'Website Lead')))));
  const clientFullName = sanitizeLeadName(rawClientName) || rawClientName;
  const phoneNum = card.phone || card.mobile || card.contact?.phone || card.contact?.mobile || contactInfo.phone || '';
  const productName = extractLeadProductName(card);
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
      onDragStart={e => {
        e.dataTransfer.setData('cardId', String(card.id));
        e.dataTransfer.setData('text/plain', String(card.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
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
        {phoneNum ? (
          <span className="text-slate-700 font-bold flex items-center gap-1 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded-md">
            <Phone size={9} className="text-purple-600" />
            {phoneNum}
          </span>
        ) : (
          <span className="text-slate-300 font-medium text-[9px]">—</span>
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
        <div className="flex items-center gap-1 text-[10px] text-slate-600 font-bold truncate max-w-[55%]" title={`Assigned to: ${assigneeName}`}>
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
          <button
            onClick={() => onWhatsApp(card, phoneNum)}
            className="p-1 rounded bg-green-50 border border-green-200 hover:bg-green-100 text-green-600 cursor-pointer"
            title="WhatsApp Message & Templates"
          >
            <MessageCircle size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table Component ───────────────────────────────────────────────────────────
function LeadsTable({ data, employeesList, allLeadsList, contactsList, loading, visibleColumns, sortKey, sortDir, onSort, onRowClick, onEdit, onDelete, onCall, onWhatsApp, onOpenTemplate, onCreate }: {
  data: any[];
  employeesList?: any[];
  allLeadsList?: any[];
  contactsList?: any[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  onRowClick: (r: any) => void;
  onEdit: (r: any) => void;
  onDelete: (r: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (lead: any, phone?: string) => void;
  onOpenTemplate?: (lead: any, phone?: string) => void;
  onCreate?: () => void;
}) {
  const sortableKeys = ['name', 'plan', 'premiumBudget', 'followUpDate', 'stage'];

  const colDefs = [
    {
      key: 'name', label: 'Client Name',
      render: (r: any) => {
        const contactInfo = getLeadContactDetails(r, allLeadsList, contactsList);
        const isGeneric = (n?: string) => !n || n === 'Website Lead' || n === 'Contact Lead' || n === 'Lead';
        const rawClientName = !isGeneric(r.fullName)
          ? r.fullName
          : (!isGeneric(r.name)
            ? r.name
            : (!isGeneric(r.contact?.fullName)
              ? r.contact.fullName
              : (!isGeneric(r.contact?.name)
                ? r.contact.name
                : (!isGeneric(contactInfo.fullName)
                  ? contactInfo.fullName
                  : (contactInfo.phone ? `Lead (${contactInfo.phone})` : 'Website Lead')))));
        const clientFullName = sanitizeLeadName(rawClientName) || rawClientName;
        const phoneNum = r.phone || r.mobile || r.contact?.phone || r.contact?.mobile || contactInfo.phone || '';

        return (
          <div className="flex items-center gap-2">
            <div>
              <p className="font-bold text-gray-900 text-[13px]">{clientFullName}</p>
              {phoneNum && <p className="text-[11px] text-gray-500 font-medium">{phoneNum}</p>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'plan', label: 'Product',
      render: (r: any) => {
        const prodName = extractLeadProductName(r);
        const prodCat = r.plan?.category || '';
        return (
          <div>
            <p className="text-[13px] font-semibold text-gray-800">{prodName}</p>
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
          <span className={clsx("text-[12.5px]", name === 'Unassigned' || name === '—' ? 'text-slate-400' : 'text-slate-800 font-semibold')}>
            {name}
          </span>
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
          {format(new Date(r.followUpDate), 'dd/MM/yyyy')}
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
            title="WhatsApp Message & Templates"
            className="p-1.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-green-500/20 hover:shadow-md hover:scale-105 transition-all"
            onClick={() => {
              const contactInfo = getLeadContactDetails(r, allLeadsList, contactsList);
              const phoneToUse = r.phone || r.mobile || r.contact?.phone || r.contact?.mobile || r.whatsappNumber || r.callingNumber || contactInfo.phone || '';
              onWhatsApp(r, phoneToUse);
            }}
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
function LeadDetailPopup({ lead, tab, onTabChange, employees, allLeads, contactsList, isOwner, onEdit, onTriggerPolicyCreation, onUpdateLead, onCall, onWhatsApp, onWhatsAppTemplate }: {
  lead: any;
  tab: 'overview' | 'comments' | 'stage';
  onTabChange: (t: 'overview' | 'comments' | 'stage') => void;
  employees: any[];
  allLeads?: any[];
  contactsList?: any[];
  isOwner: boolean;
  onEdit: () => void;
  onTriggerPolicyCreation?: (lead: any) => void;
  onUpdateLead?: (lead: any) => void;
  onCall?: (phone?: string) => void;
  onWhatsApp?: (lead: any, phone?: string) => void;
  onWhatsAppTemplate?: (lead: any, phone?: string) => void;
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
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

  const assignableEmployeesList = useMemo(() => {
    return getAssignableEmployees(employees, fullLead || lead, allLeads || []);
  }, [employees, fullLead, lead, allLeads]);

  const currentAssigneeObj = useMemo(() => {
    if (!editAssignee) return null;
    const targetId = String(editAssignee).toLowerCase().trim();
    const searchLists = [assignableEmployeesList, employees, allLeads || []];
    for (const list of searchLists) {
      const found = list.find((e: any) => {
        const uid = String(e.userId || e.user?.id || e.id || e._id || e.user?._id || '').toLowerCase().trim();
        return uid && uid === targetId;
      });
      if (found) return found;
    }
    return null;
  }, [assignableEmployeesList, employees, allLeads, editAssignee]);

  const currentAssigneeName = useMemo(() => {
    if (currentAssigneeObj) {
      const p = currentAssigneeObj.employeeProfile || currentAssigneeObj;
      const fn = p.firstName || currentAssigneeObj.firstName || currentAssigneeObj.user?.firstName || '';
      const ln = p.lastName || currentAssigneeObj.lastName || currentAssigneeObj.user?.lastName || '';
      const name = `${fn} ${ln}`.trim() || currentAssigneeObj.name || currentAssigneeObj.email;
      if (name && !/^[0-9a-fA-F]{24}$/.test(name)) return name;
    }

    if (editAssignee) {
      const targetId = String(editAssignee).toLowerCase().trim();
      const allEmp = [...(assignableEmployeesList || []), ...(employees || [])];
      const match = allEmp.find((e: any) => {
        const eId = String(e.id || '').toLowerCase();
        const eUid = String(e.userId || '').toLowerCase();
        const eUserDocId = String(e.user?.id || e.user?._id || '').toLowerCase();
        const eRawId = String(e._id || '').toLowerCase();
        const p = e.employeeProfile || e;
        const fn = String(p.firstName || e.firstName || e.user?.firstName || '').toLowerCase().trim();
        const ln = String(p.lastName || e.lastName || e.user?.lastName || '').toLowerCase().trim();
        const fullName = `${fn} ${ln}`.trim();
        const empName = String(e.name || '').toLowerCase().trim();
        return eId === targetId || eUid === targetId || eUserDocId === targetId || eRawId === targetId || fullName === targetId || empName === targetId;
      });
      if (match) {
        const p = match.employeeProfile || match;
        const fn = p.firstName || match.firstName || match.user?.firstName || '';
        const ln = p.lastName || match.lastName || match.user?.lastName || '';
        const name = `${fn} ${ln}`.trim() || match.name || match.email;
        if (name && !/^[0-9a-fA-F]{24}$/.test(name)) return name;
      }
      if (!/^[0-9a-fA-F]{24}$/.test(editAssignee) && !editAssignee.startsWith('fs_') && !editAssignee.startsWith('usr_')) {
        return editAssignee;
      }
    }

    // Try resolving from getAssigneeDisplayName
    const fromAssigneeHelper = getAssigneeDisplayName({ ...(fullLead || lead), assignedEmployeeId: editAssignee }, employees);
    if (fromAssigneeHelper && fromAssigneeHelper !== 'Unassigned' && !/^[0-9a-fA-F]{24}$/.test(fromAssigneeHelper)) {
      return fromAssigneeHelper;
    }

    // Try parsed lead notes
    const parsedNotes = parseLeadNotes(fullLead?.notes || lead?.notes);
    if (parsedNotes.assignedEmployeeName && !/^[0-9a-fA-F]{24}$/.test(parsedNotes.assignedEmployeeName)) {
      return parsedNotes.assignedEmployeeName;
    }
    if (parsedNotes.assignedToName && !/^[0-9a-fA-F]{24}$/.test(parsedNotes.assignedToName)) {
      return parsedNotes.assignedToName;
    }
    if (fullLead?.assignedToName && !/^[0-9a-fA-F]{24}$/.test(fullLead.assignedToName)) {
      return fullLead.assignedToName;
    }

    if (!editAssignee) return 'Unassigned';
    return 'Unassigned';
  }, [currentAssigneeObj, editAssignee, fullLead, lead, employees, assignableEmployeesList]);

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

      const currentUser = useAuthStore.getState().user;
      const currentUserName = currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : ((currentUser as any)?.name || currentUser?.email || 'Admin');

      // Find assignee display name from employees and all contacts list
      const availableList = assignableEmployeesList || getAssignableEmployees(employees, fullLead || lead, allLeads || []);
      const strAssignedEmp = String(assignedEmp || '').toLowerCase().trim();
      const foundEmp = availableList.find((e: any) => {
        const eId = String(e.id || '').toLowerCase();
        const eUid = String(e.userId || '').toLowerCase();
        const eUserDocId = String(e.user?.id || e.user?._id || '').toLowerCase();
        const eRawId = String(e._id || '').toLowerCase();
        const eEmail = String(e.email || e.user?.email || '').toLowerCase();
        const p = e.employeeProfile || e;
        const fn = String(p.firstName || e.firstName || e.user?.firstName || '').toLowerCase().trim();
        const ln = String(p.lastName || e.lastName || e.user?.lastName || '').toLowerCase().trim();
        const fullName = `${fn} ${ln}`.trim();
        const empName = String(e.name || '').toLowerCase().trim();
        return (eId && (eId === strAssignedEmp || strAssignedEmp === eId || ('fs_' + eId) === strAssignedEmp || eId === strAssignedEmp.replace('fs_', ''))) ||
          (eUid && (eUid === strAssignedEmp || strAssignedEmp === eUid)) ||
          (eUserDocId && (eUserDocId === strAssignedEmp || strAssignedEmp === eUserDocId)) ||
          (eRawId && (eRawId === strAssignedEmp || strAssignedEmp === eRawId)) ||
          (eEmail && eEmail === strAssignedEmp) ||
          (fullName && (fullName === strAssignedEmp || strAssignedEmp.includes(fullName))) ||
          (empName && (empName === strAssignedEmp || strAssignedEmp.includes(empName)));
      }) ||
        employees.find((e: any) => {
          const eId = String(e.id || '').toLowerCase();
          const eUid = String(e.userId || '').toLowerCase();
          const eUserDocId = String(e.user?.id || e.user?._id || '').toLowerCase();
          const eRawId = String(e._id || '').toLowerCase();
          const p = e.employeeProfile || e;
          const fn = String(p.firstName || e.firstName || e.user?.firstName || '').toLowerCase().trim();
          const ln = String(p.lastName || e.lastName || e.user?.lastName || '').toLowerCase().trim();
          const fullName = `${fn} ${ln}`.trim();
          const empName = String(e.name || '').toLowerCase().trim();
          return eId === strAssignedEmp || eUid === strAssignedEmp || eUserDocId === strAssignedEmp || eRawId === strAssignedEmp || fullName === strAssignedEmp || empName === strAssignedEmp;
        });

      let foundEmpName = '';
      if (foundEmp) {
        const p = foundEmp.employeeProfile || foundEmp;
        const fn = p.firstName || foundEmp.firstName || foundEmp.user?.firstName || '';
        const ln = p.lastName || foundEmp.lastName || foundEmp.user?.lastName || '';
        foundEmpName = `${fn} ${ln}`.trim() || foundEmp.name || '';
      }

      const assignedToName = (foundEmpName && !foundEmpName.startsWith('fs_') && !foundEmpName.startsWith('usr_'))
        ? foundEmpName
        : (currentAssigneeName && currentAssigneeName !== 'Unassigned' && !currentAssigneeName.startsWith('fs_')
          ? currentAssigneeName
          : (assignedEmp && !/^[0-9a-fA-F]{24}$/.test(assignedEmp) && !assignedEmp.startsWith('fs_') ? assignedEmp : ''));

      const newParsedNotes = {
        ...currentParsed,
        leadStatus: updatedStatus,
        leadType: updatedType,
        leadSource: updatedSource,
        descriptionDetails: currentParsed.descriptionDetails || '',
        assignedEmployeeId: assignedEmp,
        assignedEmployeeName: assignedToName,
        assignedToName: assignedToName,
        assignedById: currentUser?.id,
        assignedByName: currentUserName,
        createdById: currentParsed.createdById || currentUser?.id,
        createdByName: currentParsed.createdByName || currentUserName,
      };
      const notesJsonStr = JSON.stringify(newParsedNotes);

      const baseLead = { ...(lead || {}), ...(fullLead || {}) };
      const updatedLeadObject: any = {
        ...baseLead,
        id: targetId,
        stage: updatedStage,
        status: updatedStatus,
        type: updatedType,
        source: updatedSource,
        contact: baseLead.contact || {
          firstName: baseLead.firstName || baseLead.name?.split(' ')[0] || '',
          lastName: baseLead.lastName || baseLead.name?.split(' ').slice(1).join(' ') || '',
          phone: baseLead.phone || baseLead.mobile || '',
          email: baseLead.email || '',
        },
        interests: baseLead.interests || (baseLead.plan?.name ? [baseLead.plan.name] : ['Mutual Funds']),
        plan: baseLead.plan || { name: (baseLead.interests && baseLead.interests[0]) || 'Mutual Funds', category: 'MUTUAL FUNDS' },
        assignedEmployeeId: assignedEmp || '',
        assignedTo: assignedEmp || '',
        assignedToName: assignedToName || '',
        assignedEmployee: assignedToName ? { name: assignedToName, id: assignedEmp } : undefined,
        followUpDate: validFollowUpStr || validFollowUpIso || '',
        premiumBudget: rawPremium || '',
        expectedPremium: rawPremium || '',
        notes: notesJsonStr,
      };

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
            try { await leadsService.updateAssignee(targetId, assignedEmp); } catch { }
          }
        } catch (apiErr) {
          console.warn('[Backend Lead Update Warning]:', apiErr);
        }
      }

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
            } catch { }
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
          } catch { }
        });

        // Dispatch storage event & custom lead_updated event
        try {
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('lead_updated', { detail: updatedLeadObject }));
        } catch { }
      } catch (lsErr) { }

      // Notify parent immediately
      if (onUpdateLead) {
        onUpdateLead(updatedLeadObject);
      }

      // Invalidate queries & refetch
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-detail-popup', targetId] });
      try { refetch(); } catch { }

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
    // Policy creation is no longer triggered automatically here
    // if (newStage === 'PROCESS_COMPLETED') {
    //   if (onTriggerPolicyCreation) {
    //     onTriggerPolicyCreation(fullLead || lead);
    //     return;
    //   }
    // }
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

  const matchedFromList = useMemo(() => {
    if (!contactsList || !contactsList.length) return null;
    const cid = String(contactId || '').trim();
    const cPhone = String(fullLead?.phone || lead?.phone || fullLead?.mobile || lead?.mobile || '').replace(/\D/g, '').slice(-10);
    const cEmail = String(fullLead?.email || lead?.email || '').trim().toLowerCase();
    return contactsList.find((c: any) => {
      const idMatches = cid && (c.id === cid || c._id === cid);
      if (idMatches) return true;
      const phoneMatches = cPhone && String(c.phone || c.mobile || '').replace(/\D/g, '').slice(-10) === cPhone;
      if (phoneMatches) return true;
      const emailMatches = cEmail && String(c.email || '').trim().toLowerCase() === cEmail;
      if (emailMatches) return true;
      return false;
    });
  }, [contactsList, contactId, fullLead, lead]);

  const leadContactObj = typeof lead?.contact === 'object' && lead?.contact ? lead.contact : {};
  const fullLeadContactObj = typeof fullLead?.contact === 'object' && fullLead?.contact ? fullLead.contact : {};
  const fetchedContactObj = typeof contactData?.data === 'object' && contactData?.data ? contactData.data : (typeof contactData === 'object' && contactData ? contactData : {});

  const mergedContact = {
    ...matchedFromList,
    ...leadContactObj,
    ...fullLeadContactObj,
    ...fetchedContactObj,
    firstName: fetchedContactObj?.firstName || fullLeadContactObj?.firstName || leadContactObj?.firstName || matchedFromList?.firstName || '',
    lastName: fetchedContactObj?.lastName || fullLeadContactObj?.lastName || leadContactObj?.lastName || matchedFromList?.lastName || '',
    name: fetchedContactObj?.name || fullLeadContactObj?.name || leadContactObj?.name || matchedFromList?.name || '',
    phone: fetchedContactObj?.phone || fetchedContactObj?.mobile || fullLeadContactObj?.phone || fullLeadContactObj?.mobile || leadContactObj?.phone || leadContactObj?.mobile || matchedFromList?.phone || matchedFromList?.mobile || fullLead?.phone || lead?.phone || '',
    email: fetchedContactObj?.email || fullLeadContactObj?.email || leadContactObj?.email || matchedFromList?.email || fullLead?.email || lead?.email || '',
  };

  const mergedLead = {
    ...lead,
    ...fullLead,
    contact: mergedContact,
    name: fullLead?.name || lead?.name || mergedContact?.fullName || `${mergedContact?.firstName || ''} ${mergedContact?.lastName || ''}`.trim() || fullLead?.clientName || lead?.clientName || fullLead?.customerName || lead?.customerName,
    fullName: fullLead?.fullName || lead?.fullName || mergedContact?.fullName || `${mergedContact?.firstName || ''} ${mergedContact?.lastName || ''}`.trim() || fullLead?.clientName || lead?.clientName || fullLead?.customerName || lead?.customerName,
    clientName: fullLead?.clientName || lead?.clientName || mergedContact?.fullName || `${mergedContact?.firstName || ''} ${mergedContact?.lastName || ''}`.trim(),
    customerName: fullLead?.customerName || lead?.customerName || mergedContact?.fullName || `${mergedContact?.firstName || ''} ${mergedContact?.lastName || ''}`.trim(),
    phone: fullLead?.phone || lead?.phone || fullLead?.mobile || lead?.mobile || mergedContact?.phone || mergedContact?.mobile || mergedContact?.contactNumber,
    email: fullLead?.email || lead?.email || mergedContact?.email,
  };

  const contactInfo = getLeadContactDetails(mergedLead, allLeads, contactsList);
  const hotness = deriveHotness(mergedLead);
  const hotnessConf = HOTNESS_CONFIG[hotness];
  const assigneeName = getAssigneeDisplayName(mergedLead, employees);
  const assignerName = getAssignerDisplayName(mergedLead, employees);

  const tabs: { id: 'overview' | 'comments' | 'stage'; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'comments', label: `Consultation Comments (${consultations.length})` },
    { id: 'stage', label: 'Stage & Actions' },
  ];

  return (
    <div className="h-full flex flex-col space-y-3 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-blue-50/20 to-indigo-50/20 rounded-2xl p-3.5 border border-slate-200/80 shadow-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shadow-xs shrink-0 ring-1 ring-blue-200">
            {contactInfo.singleInitial || contactInfo.initials?.[0] || 'L'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 truncate" title={contactInfo.fullName}>
                {contactInfo.fullName}
              </h3>
              {contactInfo.phone && (
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg transition-colors shadow-2xs"
                >
                  <Phone size={11} className="text-blue-600" />
                  {contactInfo.phone}
                </a>
              )}
              {contactInfo.email && (
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 rounded-lg transition-colors"
                >
                  <Mail size={11} className="text-slate-500" />
                  {contactInfo.email}
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {contactInfo.leadNumStr && (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs">
                  {contactInfo.leadNumStr}
                </span>
              )}
              <span className={clsx('text-[10px] px-2 py-0.5 rounded font-bold border uppercase tracking-wider shadow-2xs', BADGE_STYLES[mergedLead.stage] ?? 'bg-blue-50 text-blue-700 border-blue-200')}>
                {STAGE_LABELS[mergedLead.stage] ?? mergedLead.stage}
              </span>
              <span className={clsx('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-bold shadow-2xs', hotnessConf.cls)}>
                <HotnessIcon level={hotness} /> {hotnessConf.label}
              </span>
              {extractLeadProductName(mergedLead) !== '—' && (
                <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                  • {extractLeadProductName(mergedLead)}
                </span>
              )}
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                <UserCircle2 size={11} className="text-purple-600" /> {assigneeName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          {contactInfo.phone && (
            <>
              <button
                type="button"
                onClick={() => onCall?.(contactInfo.phone)}
                className="p-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                title="Call"
              >
                <Phone size={13} className="text-blue-600" />
              </button>
              <button
                type="button"
                onClick={() => onWhatsApp?.(fullLead || lead, contactInfo.phone)}
                className="px-2 py-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                title="Direct WhatsApp"
              >
                <MessageCircle size={13} className="text-green-600" />
                <span className="text-[10px] font-bold text-green-700 hidden sm:inline">Direct WA</span>
              </button>
              <button
                type="button"
                onClick={() => onWhatsAppTemplate?.(fullLead || lead, contactInfo.phone)}
                className="px-2 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                title="Select WhatsApp Template"
              >
                <FileText size={13} className="text-purple-600" />
                <span className="text-[10px] font-bold text-purple-700 hidden sm:inline">Templates</span>
              </button>
            </>
          )}
          <button onClick={onEdit} className="btn-secondary text-[10px] sm:text-xs flex items-center gap-1 font-bold">
            <Pencil size={12} /> Contact
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className={clsx('px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Compact tab content container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-2 min-h-0">
        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-3 pb-2">
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
                <div className="relative">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Assigned Employee</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAssigneeDropdownOpen(prev => !prev)}
                      className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white w-full flex items-center justify-between text-left cursor-pointer transition-all shadow-2xs hover:border-slate-300"
                    >
                      <span className={currentAssigneeName ? 'text-slate-900 font-semibold truncate' : 'text-slate-400'}>
                        {currentAssigneeName || 'Unassigned'}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isAssigneeDropdownOpen ? 'rotate-180 text-purple-600' : ''}`} />
                    </button>

                    {isAssigneeDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsAssigneeDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1 max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-50 animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => {
                              setEditAssignee('');
                              setIsAssigneeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${!editAssignee ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            <span>Unassigned</span>
                            {!editAssignee && <Check size={13} className="text-purple-600 shrink-0" />}
                          </button>
                          {assignableEmployeesList.map((emp: any) => {
                            const empUserId = emp.userId || emp.user?.id || emp.id || emp._id;
                            const p = emp.employeeProfile || emp;
                            const empName = `${p.firstName || emp.firstName || emp.user?.firstName || ''} ${p.lastName || emp.lastName || emp.user?.lastName || ''}`.trim() || emp.name || emp.email || 'Employee';
                            const isSelected = String(editAssignee).toLowerCase() === String(empUserId).toLowerCase() ||
                              String(editAssignee).toLowerCase() === String(emp.id).toLowerCase() ||
                              String(editAssignee).toLowerCase() === String(emp._id || '').toLowerCase() ||
                              String(editAssignee).toLowerCase() === String(emp.userId || '').toLowerCase();
                            return (
                              <button
                                key={emp.id || empUserId}
                                type="button"
                                onClick={() => {
                                  setEditAssignee(empUserId);
                                  setIsAssigneeDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${isSelected ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {empName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="truncate">{empName}</span>
                                </div>
                                {isSelected && <Check size={13} className="text-purple-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
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
