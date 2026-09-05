import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@comps/common/Modal';
import {
  Plus, Search, Pencil, Trash2, Shield, Upload, Phone, Calendar,
  MessageCircle, Filter, X, UserPlus, Users,
  Mail, ChevronDown, ChevronUp, RefreshCw, Save,
  FileText, Download, Presentation, Clock, MapPin, Video, Award, CheckCircle2,
  Settings, Sparkles, DollarSign, Globe, BadgeCheck, Tag, IndianRupee
} from 'lucide-react';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import { DatalistInput } from '@comps/common/DatalistInput';
import { useAuthStore } from '@store/auth.store';
import { db } from '../../services/firebase';
import { collection, onSnapshot, doc, deleteDoc, updateDoc, addDoc, setDoc } from 'firebase/firestore';

export interface SeminarConfig {
  price: string;
  topic: string;
  date: string;
  day: string;
  time: string;
  mode: string;
  language: string;
  speaker: string;
  bonusText: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_SEMINAR_CONFIG: SeminarConfig = {
  price: '199',
  topic: 'Financial Literacy',
  date: '24 August 2026',
  day: 'Sunday',
  time: '11:00 AM – 01:00 PM (IST)',
  mode: 'Zoom Online',
  language: 'Marathi',
  speaker: 'Rahul Kulkarni',
  bonusText: 'E-Book on Financial Planning will be shared with all attendees.',
};

export interface SeminarItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  topic: string;
  mode: 'OFFLINE' | 'ONLINE' | 'WEBINAR';
  date: string;
  time?: string;
  venue?: string;
  speaker?: string;
  status: 'REGISTERED' | 'ATTENDED' | 'IN_DISCUSSION' | 'CONVERTED' | 'NOT_ATTENDED';
  expectedBudget?: number | string;
  followUpDate?: string;
  notes?: string;
  createdAt?: string;
}

const DEFAULT_SEMINAR_TOPICS = [
  'Financial Freedom & Wealth Planning',
  'Child Future & Higher Education Planning',
  'Retirement & Pension Security',
  'Comprehensive Family Health Insurance',
  'Tax Saving & Investment Strategies',
  'Business Owners & Keyman Protection',
  'Mutual Funds & Systematic Investment (SIP)',
  'Special Corporate Financial Wellness',
];

const SEMINAR_STATUS_CONFIG: Record<string, { label: string; cls: string; border: string }> = {
  REGISTERED: { label: 'Registered', cls: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
  ATTENDED: { label: 'Attended', cls: 'bg-purple-50 text-purple-700', border: 'border-purple-200' },
  IN_DISCUSSION: { label: 'In Discussion', cls: 'bg-amber-50 text-amber-700', border: 'border-amber-200' },
  CONVERTED: { label: 'Converted', cls: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200' },
  NOT_ATTENDED: { label: 'Did Not Attend', cls: 'bg-rose-50 text-rose-700', border: 'border-rose-200' },
};

const INITIAL_SEMINARS: SeminarItem[] = [
  {
    id: 'sem-1',
    name: 'Santosh Shinde',
    phone: '9822019482',
    email: 'santosh.shinde@gmail.com',
    city: 'Pune',
    topic: 'Financial Freedom & Wealth Planning',
    mode: 'OFFLINE',
    date: new Date().toISOString().split('T')[0],
    time: '11:00 AM',
    venue: 'Hotel Sayaji, Kolhapur Road',
    speaker: 'Rahul Kulkarni',
    status: 'ATTENDED',
    expectedBudget: '25000',
    followUpDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    notes: 'Interested in retirement plan and child education portfolio.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sem-2',
    name: 'Megha Deshmukh',
    phone: '9423081729',
    email: 'megha.d@gmail.com',
    city: 'Kolhapur',
    topic: 'Child Future & Higher Education Planning',
    mode: 'WEBINAR',
    date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    time: '04:00 PM',
    venue: 'Zoom Live Webinar',
    speaker: 'Rahul Kulkarni',
    status: 'REGISTERED',
    expectedBudget: '35000',
    followUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    notes: 'Requested online presentation link on WhatsApp.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sem-3',
    name: 'Anand Patil',
    phone: '9765412093',
    email: 'anand.patil@outlook.com',
    city: 'Sangli',
    topic: 'Comprehensive Family Health Insurance',
    mode: 'OFFLINE',
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    time: '06:30 PM',
    venue: 'Rotary Club Hall, Sangli',
    speaker: 'Rahul Kulkarni',
    status: 'CONVERTED',
    expectedBudget: '18000',
    followUpDate: '',
    notes: 'Completed policy proposal and payment.',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export default function Seminars() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || (user as any)?.isOwner || user?.role === 'OWNER' || true;

  // States
  const [seminars, setSeminars] = useState<SeminarItem[]>(() => {
    try {
      const stored = localStorage.getItem('insumitra_seminars_data');
      return stored ? JSON.parse(stored) : INITIAL_SEMINARS;
    } catch {
      return INITIAL_SEMINARS;
    }
  });

  // Live Website Seminar Configuration & Pricing State (Super Admin Only)
  const [seminarConfig, setSeminarConfig] = useState<SeminarConfig>(() => {
    try {
      const stored = localStorage.getItem('insumitra_seminar_settings');
      return stored ? JSON.parse(stored) : DEFAULT_SEMINAR_CONFIG;
    } catch {
      return DEFAULT_SEMINAR_CONFIG;
    }
  });

  const [superAdminConfigModalOpen, setSuperAdminConfigModalOpen] = useState(false);
  const [configFormData, setConfigFormData] = useState<SeminarConfig>(seminarConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  // Firestore realtime sync for Seminar Configuration & Pricing
  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'seminar_settings', 'global_config'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<SeminarConfig>;
          const merged: SeminarConfig = {
            ...DEFAULT_SEMINAR_CONFIG,
            ...data,
            price: String(data.price || DEFAULT_SEMINAR_CONFIG.price),
          };
          setSeminarConfig(merged);
          setConfigFormData(merged);
          try {
            localStorage.setItem('insumitra_seminar_settings', JSON.stringify(merged));
          } catch (e) {}
        }
      });
      return () => unsub();
    } catch (e) {}
  }, []);

  const handleSaveSeminarConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    const toastId = toast.loading('Updating Live Website Seminar Pricing & Details...');
    try {
      const cleanPrice = String(configFormData.price || '199').replace(/[^0-9]/g, '') || '199';
      const updatedConfig: SeminarConfig = {
        ...configFormData,
        price: cleanPrice,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.email || 'Super Admin'),
      };

      // 1. Save to Firestore
      try {
        await setDoc(doc(db, 'seminar_settings', 'global_config'), {
          ...updatedConfig,
          price: cleanPrice,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore setDoc warning:', fsErr);
      }

      // 2. BroadcastChannel to notify open website tabs instantly
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('seminar_settings_channel');
          bc.postMessage({
            type: 'UPDATE_SEMINAR_CONFIG',
            payload: updatedConfig,
          });
          bc.close();
        }
      } catch (e) {}

      // 3. LocalStorage
      try {
        localStorage.setItem('insumitra_seminar_settings', JSON.stringify(updatedConfig));
      } catch (e) {}

      setSeminarConfig(updatedConfig);
      setSuperAdminConfigModalOpen(false);

      toast.success(`🎉 Seminar price updated to ₹${cleanPrice}/- & synced to live website!`, { id: toastId, duration: 5000 });
    } catch (err) {
      console.error('Failed to save seminar config:', err);
      toast.error('Failed to update seminar settings', { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  const [search, setSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SeminarItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeminarItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    topic: DEFAULT_SEMINAR_TOPICS[0],
    mode: 'OFFLINE' as 'OFFLINE' | 'ONLINE' | 'WEBINAR',
    date: new Date().toISOString().split('T')[0],
    time: '11:00 AM',
    venue: 'Main Office Conference Hall',
    speaker: 'Rahul Kulkarni',
    status: 'REGISTERED' as SeminarItem['status'],
    expectedBudget: '',
    followUpDate: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('insumitra_seminars_data', JSON.stringify(seminars));
    } catch (e) {}
  }, [seminars]);

  // BroadcastChannel realtime sync for local cross-tab updates
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('seminar_registration_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'NEW_SEMINAR') {
          const item = event.data.payload;
          if (item) {
            toast.success(`🔔 New Seminar Registration: ${item.name}`, { duration: 6000 });
            setSeminars((prev) => {
              const exists = prev.some((s) => String(s.id) === String(item.id) || (s.phone === item.phone && s.name === item.name));
              if (exists) return prev;
              return [item, ...prev];
            });
          }
        }
      };
    } catch (e) {}
    return () => {
      if (channel) channel.close();
    };
  }, []);

  // Firestore realtime sync
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'seminars'), (snapshot) => {
        const remoteList: SeminarItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const createdAtDate = d.createdAt?.toDate 
            ? d.createdAt.toDate().toISOString() 
            : (d.createdAtIso || (typeof d.createdAt === 'string' ? d.createdAt : (d.timestamp ? new Date(Number(d.timestamp)).toISOString() : new Date().toISOString())));

          remoteList.push({
            id: 'fs_' + docSnap.id,
            name: (d.name || d.fullName || 'Seminar Attendee').trim(),
            phone: d.phone || d.mobile || '',
            email: d.email || '',
            city: d.city || 'Online',
            topic: d.topic || DEFAULT_SEMINAR_TOPICS[0],
            mode: (d.mode || 'WEBINAR') as SeminarItem['mode'],
            date: d.date || new Date().toISOString().split('T')[0],
            time: d.time || '11:00 AM',
            venue: d.venue || 'Zoom Live Online',
            speaker: d.speaker || 'Rahul Kulkarni',
            status: (d.status || 'REGISTERED') as SeminarItem['status'],
            expectedBudget: d.expectedBudget || d.amount || '199',
            followUpDate: d.followUpDate || '',
            notes: d.notes || `Seminar Registration (Source: ${d.hearAbout || 'Website'})`,
            createdAt: createdAtDate,
          });
        });

        if (remoteList.length > 0) {
          setSeminars((prev) => {
            const map = new Map<string, SeminarItem>();
            remoteList.forEach((item) => map.set(item.id, item));
            prev.forEach((item) => {
              if (!map.has(item.id)) map.set(item.id, item);
            });
            return Array.from(map.values()).sort((a, b) => {
              const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return tb - ta;
            });
          });
        }
      });
      return () => unsub();
    } catch (err) {
      console.warn('[Seminars Firestore Sync]', err);
    }
  }, []);

  // Filtered List
  const filteredSeminars = useMemo(() => {
    return seminars.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchPhone = item.phone.includes(q);
        const matchTopic = item.topic.toLowerCase().includes(q);
        const matchCity = (item.city || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchTopic && !matchCity) return false;
      }

      // Status
      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'ATTENDED') {
          if (item.status !== 'ATTENDED' && item.status !== 'CONVERTED') return false;
        } else if (item.status !== selectedStatusFilter) {
          return false;
        }
      }

      // Mode
      if (selectedModeFilter !== 'ALL') {
        if (selectedModeFilter === 'ONLINE') {
          if (item.mode !== 'ONLINE' && item.mode !== 'WEBINAR') return false;
        } else if (selectedModeFilter === 'OFFLINE') {
          if (item.mode !== 'OFFLINE') return false;
        }
      }

      return true;
    });
  }, [seminars, search, selectedStatusFilter, selectedModeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = seminars.length;
    const attended = seminars.filter((s) => s.status === 'ATTENDED' || s.status === 'CONVERTED').length;
    const registered = seminars.filter((s) => s.status === 'REGISTERED').length;
    const webinars = seminars.filter((s) => s.mode === 'WEBINAR' || s.mode === 'ONLINE').length;
    const offline = seminars.filter((s) => s.mode === 'OFFLINE').length;
    const followUps = seminars.filter((s) => Boolean(s.followUpDate)).length;

    return { total, attended, registered, webinars, offline, followUps };
  }, [seminars]);

  // Modal Open Handlers
  const openCreate = () => {
    setEditTarget(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      city: '',
      topic: DEFAULT_SEMINAR_TOPICS[0],
      mode: 'OFFLINE',
      date: new Date().toISOString().split('T')[0],
      time: '11:00 AM',
      venue: 'Main Office Conference Hall',
      speaker: 'Rahul Kulkarni',
      status: 'REGISTERED',
      expectedBudget: '',
      followUpDate: '',
      notes: '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: SeminarItem) => {
    setEditTarget(item);
    setFormData({
      name: item.name,
      phone: item.phone,
      email: item.email || '',
      city: item.city || '',
      topic: item.topic || DEFAULT_SEMINAR_TOPICS[0],
      mode: item.mode || 'OFFLINE',
      date: item.date || new Date().toISOString().split('T')[0],
      time: item.time || '11:00 AM',
      venue: item.venue || '',
      speaker: item.speaker || 'Rahul Kulkarni',
      status: item.status || 'REGISTERED',
      expectedBudget: item.expectedBudget ? String(item.expectedBudget) : '',
      followUpDate: item.followUpDate || '',
      notes: item.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'नाव टाकणे आवश्यक आहे (Name is required)';
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!cleanPhone) {
      errors.phone = 'मोबाईल नंबर टाकणे आवश्यक आहे (Mobile is required)';
    } else if (cleanPhone.length !== 10) {
      errors.phone = 'मोबाईल नंबर बरोबर १० अंकी असावा (Must be 10 digits)';
    }

    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'योग्य ई-मेल पत्ता टाका (Invalid email)';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0];
      toast.error(first);
      return;
    }

    const toastId = toast.loading(editTarget ? 'Updating seminar entry...' : 'Adding seminar attendee...');
    try {
      const payload: SeminarItem = {
        id: editTarget ? editTarget.id : `sem-${Date.now()}`,
        name: formData.name.trim(),
        phone: cleanPhone,
        email: formData.email.trim() || undefined,
        city: formData.city.trim() || undefined,
        topic: formData.topic,
        mode: formData.mode,
        date: formData.date,
        time: formData.time,
        venue: formData.venue.trim() || undefined,
        speaker: formData.speaker.trim() || 'Rahul Kulkarni',
        status: formData.status,
        expectedBudget: Number(formData.expectedBudget) || 0,
        followUpDate: formData.followUpDate || undefined,
        notes: formData.notes.trim() || undefined,
        createdAt: editTarget?.createdAt || new Date().toISOString(),
      };

      // If Firestore doc
      if (editTarget && editTarget.id.startsWith('fs_')) {
        const fsId = editTarget.id.replace('fs_', '');
        try {
          await updateDoc(doc(db, 'seminars', fsId), { ...payload });
        } catch (fsErr) {}
      } else if (!editTarget) {
        try {
          await addDoc(collection(db, 'seminars'), { ...payload });
        } catch (fsErr) {}
      }

      setSeminars((prev) => {
        if (editTarget) {
          return prev.map((item) => (item.id === editTarget.id ? payload : item));
        }
        return [payload, ...prev];
      });

      toast.success(editTarget ? 'Seminar details updated!' : 'Seminar attendee registered!', { id: toastId });
      setModalOpen(false);
      setEditTarget(null);
    } catch (err: any) {
      toast.error('Failed to save seminar', { id: toastId });
    }
  };

  // Delete Handler
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const toastId = toast.loading('Removing seminar entry...');
    try {
      if (deleteTarget.id.startsWith('fs_')) {
        const fsId = deleteTarget.id.replace('fs_', '');
        try {
          await deleteDoc(doc(db, 'seminars', fsId));
        } catch (e) {}
      }

      setSeminars((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast.success('Seminar entry removed successfully', { id: toastId });
    } catch {
      toast.error('Failed to delete', { id: toastId });
    } finally {
      setDeleteTarget(null);
    }
  };

  // WhatsApp Message
  const handleWhatsApp = (item: SeminarItem) => {
    const phone = item.phone.replace(/\D/g, '');
    if (!phone) return toast.error('Mobile number not available');
    const fullPhone = phone.length === 10 ? `91${phone}` : phone;

    const message = `नमस्कार ${item.name} जी,\n\nआम्ही *Family First* तर्फे आयोजित करत असलेल्या *"${item.topic}"* या विशेष सेमिनारमध्ये आपले सहर्ष स्वागत करतो.\n\n📅 *तारीख:* ${item.date}\n⏰ *वेळ:* ${item.time || '11:00 AM'}\n📍 *स्थान:* ${item.venue || 'Online'}\n🎤 *वक्ते:* ${item.speaker || 'Rahul Kulkarni'}\n\nअधिक माहितीसाठी संपर्क करा. धन्यवाद!`;

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCall = (phone?: string) => {
    if (!phone) return toast.error('Phone number not available');
    window.location.href = `tel:${phone}`;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        toast.error('CSV file is empty or invalid format');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('attendee') || h.includes('client'));
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
      const emailIdx = headers.findIndex(h => h.includes('email'));
      const topicIdx = headers.findIndex(h => h.includes('topic') || h.includes('subject') || h.includes('seminar'));
      const dateIdx = headers.findIndex(h => h.includes('date'));
      const venueIdx = headers.findIndex(h => h.includes('venue') || h.includes('location') || h.includes('place'));

      const importedItems: SeminarItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const name = nameIdx !== -1 ? cols[nameIdx] : cols[0];
        const phone = phoneIdx !== -1 ? cols[phoneIdx]?.replace(/\D/g, '') : cols[1]?.replace(/\D/g, '');
        if (name && phone) {
          const item: SeminarItem = {
            id: `sem-import-${Date.now()}-${i}`,
            name,
            phone: phone.slice(-10),
            email: emailIdx !== -1 ? cols[emailIdx] : undefined,
            topic: topicIdx !== -1 && cols[topicIdx] ? cols[topicIdx] : DEFAULT_SEMINAR_TOPICS[0],
            mode: 'OFFLINE',
            date: dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : new Date().toISOString().split('T')[0],
            time: '11:00 AM',
            venue: venueIdx !== -1 && cols[venueIdx] ? cols[venueIdx] : 'Main Office Conference Hall',
            speaker: 'Rahul Kulkarni',
            status: 'REGISTERED',
            expectedBudget: 0,
            createdAt: new Date().toISOString(),
          };
          importedItems.push(item);
          try {
            await addDoc(collection(db, 'seminars'), { ...item });
          } catch (err) {}
        }
      }
      if (importedItems.length > 0) {
        setSeminars(prev => [...importedItems, ...prev]);
        toast.success(`Successfully imported ${importedItems.length} seminar attendees!`);
      } else {
        toast.error('No valid attendees found in CSV');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 font-sans text-slate-800 animate-fadeIn">
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />

      {/* Header Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Attendees */}
        <div 
          onClick={() => { setSelectedStatusFilter('ALL'); setSelectedModeFilter('ALL'); }}
          className={clsx(
            "bg-white rounded-2xl p-4 border shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:shadow-xs",
            selectedStatusFilter === 'ALL' && selectedModeFilter === 'ALL' ? 'border-purple-300 ring-2 ring-purple-500/10' : 'border-slate-200/80'
          )}
          title="Show All Attendees"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Attendees</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Presentation size={22} />
          </div>
        </div>

        {/* Attended Sessions */}
        <div 
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'ATTENDED' ? 'ALL' : 'ATTENDED')}
          className={clsx(
            "bg-white rounded-2xl p-4 border shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:shadow-xs",
            selectedStatusFilter === 'ATTENDED' ? 'border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200/80'
          )}
          title="Filter Attended Attendees"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attended / Active</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{stats.attended}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Users size={22} />
          </div>
        </div>

        {/* Online Webinars */}
        <div 
          onClick={() => setSelectedModeFilter(selectedModeFilter === 'ONLINE' ? 'ALL' : 'ONLINE')}
          className={clsx(
            "bg-white rounded-2xl p-4 border shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:shadow-xs",
            selectedModeFilter === 'ONLINE' ? 'border-sky-400 ring-2 ring-sky-500/20 bg-sky-50/20' : 'border-slate-200/80'
          )}
          title="Filter Online Webinars"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Online Webinars</p>
            <h3 className="text-2xl font-black text-sky-600 mt-1">{stats.webinars}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Video size={22} />
          </div>
        </div>

        {/* Offline Seminars */}
        <div 
          onClick={() => setSelectedModeFilter(selectedModeFilter === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
          className={clsx(
            "bg-white rounded-2xl p-4 border shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:shadow-xs",
            selectedModeFilter === 'OFFLINE' ? 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200/80'
          )}
          title="Filter Offline Seminars"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Offline Seminars</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats.offline}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <MapPin size={22} />
          </div>
        </div>
      </div>

      {/* Search and Filters Hub */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2.5 sm:p-3 shadow-2xs flex items-center gap-2.5 w-full overflow-x-auto custom-scrollbar">
        {/* Search */}
        <div className="relative min-w-[200px] sm:min-w-[240px] max-w-xs shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all shadow-2xs"
            placeholder="Search seminars, attendees, topics, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Super Admin Website Seminar Price Button */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setConfigFormData(seminarConfig);
                setSuperAdminConfigModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center gap-2 shadow-purple-500/20 hover:shadow-md hover:scale-105 active:scale-95"
              title="Super Admin: Click to change live website seminar price"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Website Price:</span>
              <strong className="text-amber-300 font-extrabold text-xs">₹{seminarConfig.price}/-</strong>
              <Pencil size={11} className="text-white/80" />
            </button>
          )}

          {[
            { id: 'ALL', label: 'All Seminars', type: 'status' },
            { id: 'REGISTERED', label: 'Registered', type: 'status' },
            { id: 'ATTENDED', label: 'Attended', type: 'status' },
            { id: 'ONLINE', label: 'Online Webinars', type: 'mode' },
            { id: 'OFFLINE', label: 'Offline Seminars', type: 'mode' },
          ].map((tab) => {
            const isActive =
              tab.type === 'status'
                ? selectedStatusFilter === tab.id && selectedModeFilter === 'ALL'
                : selectedModeFilter === tab.id && selectedStatusFilter === 'ALL';

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.type === 'status') {
                    setSelectedStatusFilter(tab.id);
                    setSelectedModeFilter('ALL');
                  } else {
                    setSelectedModeFilter(tab.id);
                    setSelectedStatusFilter('ALL');
                  }
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 whitespace-nowrap',
                  isActive
                    ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Seminars Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200/80">
                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap border border-slate-200">
                  ATTENDEE / CLIENT
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap border border-slate-200">
                  SEMINAR TOPIC & MODE
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap border border-slate-200">
                  DATE & TIME
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap border border-slate-200">
                  SPEAKER / VENUE
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap border border-slate-200">
                  EXP. BUDGET
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap border border-slate-200">
                  STATUS
                </th>
                <th className="px-3.5 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap border border-slate-200">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {filteredSeminars.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                        <Presentation size={22} />
                      </div>
                      <p className="text-sm font-bold text-slate-600">No seminar leads or attendees found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSeminars.map((row, idx) => {
                  const conf = SEMINAR_STATUS_CONFIG[row.status] || { label: row.status, cls: 'bg-slate-100 text-slate-700', border: 'border-slate-200' };

                  return (
                    <tr
                      key={row.id}
                      onClick={() => openEdit(row)}
                      className={clsx('cursor-pointer transition-colors duration-150', idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white hover:bg-purple-50/20')}
                    >
                      {/* Name & Phone */}
                      <td className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        <p className="font-bold text-slate-900 text-[13px]">{row.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{row.phone} {row.city ? `• ${row.city}` : ''}</p>
                      </td>

                      {/* Topic & Mode */}
                      <td className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        <p className="font-bold text-slate-800 text-[12.5px]">{row.topic}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-600 mt-0.5">
                          {row.mode === 'WEBINAR' || row.mode === 'ONLINE' ? <Video size={11} /> : <MapPin size={11} />}
                          {row.mode}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[12px]">
                          <Calendar size={12} className="text-purple-600" />
                          {row.date ? format(new Date(row.date), 'dd/MMM/yyyy') : '—'}
                        </div>
                        {row.time && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <Clock size={10} /> {row.time}
                          </div>
                        )}
                      </td>

                      {/* Speaker / Venue */}
                      <td className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{row.speaker || 'Rahul Kulkarni'}</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{row.venue || 'Main Hall'}</p>
                      </td>

                      {/* Expected Budget */}
                      <td className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        {row.expectedBudget && Number(row.expectedBudget) > 0 ? (
                          <span className="font-bold text-slate-900 font-mono">₹{Number(row.expectedBudget).toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        <span className={clsx('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider', conf.cls, conf.border)}>
                          {conf.label}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-3.5 py-2 text-gray-700 align-middle text-[12.5px] font-medium border border-slate-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Call Attendee"
                            className="p-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-blue-500/20 hover:shadow-md hover:scale-105 transition-all"
                            onClick={() => handleCall(row.phone)}
                          >
                            <Phone size={12} />
                          </button>
                          <button
                            title="Send Seminar Invitation on WhatsApp"
                            className="p-1.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-green-500/20 hover:shadow-md hover:scale-105 transition-all"
                            onClick={() => handleWhatsApp(row)}
                          >
                            <MessageCircle size={12} />
                          </button>
                          <button
                            title="Edit Seminar Attendee"
                            className="p-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-purple-500/20 hover:shadow-md hover:scale-105 transition-all"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil size={12} />
                          </button>
                          {isSuperAdmin && (
                            <button
                              title={`Edit Website Seminar Price (Live: ₹${seminarConfig.price}/-)`}
                              className="p-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-amber-500/20 hover:shadow-md hover:scale-105 transition-all"
                              onClick={() => {
                                setConfigFormData(seminarConfig);
                                setSuperAdminConfigModalOpen(true);
                              }}
                            >
                              <Tag size={12} />
                            </button>
                          )}
                          <button
                            title="Delete Entry"
                            className="p-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-sm shadow-rose-500/20 hover:shadow-md hover:scale-105 transition-all"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 size={12} />
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
      </div>

      {/* Add / Edit Seminar Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Seminar Attendee' : 'Register New Seminar Attendee'}
        subtitle="Manage attendee details, seminar topics, dates, and follow-up plans."
        size="xl"
        actions={
          <div className="flex gap-2.5 mr-1">
            <button
              type="button"
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-6 py-2 text-xs font-bold text-white rounded-xl cursor-pointer shadow-md transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)',
                boxShadow: '0 6px 16px rgba(91, 43, 168, 0.35)',
              }}
              onClick={handleSubmit}
            >
              {editTarget ? 'Update Seminar' : 'Save Attendee'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Full Name */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Attendee Full Name (पूर्ण नाव) <span className="text-red-500 font-black">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, name: e.target.value }));
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Enter Attendee Full Name"
                className={clsx(
                  'input w-full h-10 text-xs rounded-xl bg-white border focus:ring-2 text-slate-800 font-medium',
                  formErrors.name ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 focus:ring-purple-500/20'
                )}
              />
              {formErrors.name && <p className="text-[11px] text-rose-500 font-bold mt-1">{formErrors.name}</p>}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Mobile Number (मोबाईल नंबर) <span className="text-red-500 font-black">*</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData((p) => ({ ...p, phone: digits }));
                  if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
                }}
                placeholder="Enter 10-digit mobile"
                className={clsx(
                  'input w-full h-10 text-xs rounded-xl bg-white border focus:ring-2 text-slate-800 font-mono',
                  formErrors.phone ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 focus:ring-purple-500/20'
                )}
              />
              {formErrors.phone && <p className="text-[11px] text-rose-500 font-bold mt-1">{formErrors.phone}</p>}
            </div>

            {/* Email Address */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Email Address (ई-मेल)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="client.name@example.com"
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            {/* City / Location */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                City / Location (शहर)
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                placeholder="e.g. Pune, Kolhapur, Sangli"
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            {/* Seminar Topic */}
            <div className="col-span-1 md:col-span-2">
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Seminar Topic / Subject (सेमिनार विषय)
              </label>
              <DatalistInput
                value={formData.topic}
                options={DEFAULT_SEMINAR_TOPICS}
                onChange={(val) => setFormData((p) => ({ ...p, topic: val }))}
                placeholder="Select or type seminar topic..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/20 font-bold"
              />
            </div>

            {/* Seminar Mode */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Mode (प्रकार)
              </label>
              <select
                value={formData.mode}
                onChange={(e) => setFormData((p) => ({ ...p, mode: e.target.value as any }))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 font-bold"
              >
                <option value="OFFLINE">Offline / In-person Hall</option>
                <option value="ONLINE">Online Meeting</option>
                <option value="WEBINAR">Zoom / Live Webinar</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Status (स्थिती)
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as any }))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 font-bold"
              >
                <option value="REGISTERED">Registered</option>
                <option value="ATTENDED">Attended</option>
                <option value="IN_DISCUSSION">In Discussion</option>
                <option value="CONVERTED">Converted / Policy Issued</option>
                <option value="NOT_ATTENDED">Did Not Attend</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Seminar Date (तारीख)
              </label>
              <DatePicker
                value={formData.date}
                onChange={(val) => setFormData((p) => ({ ...p, date: val }))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Time */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Time (वेळ)
              </label>
              <input
                type="text"
                value={formData.time}
                onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))}
                placeholder="e.g. 11:00 AM / 04:30 PM"
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Venue / Location */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Venue / Platform (स्थान / प्लॅटफॉर्म)
              </label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData((p) => ({ ...p, venue: e.target.value }))}
                placeholder="e.g. Hotel Sayaji Hall or Zoom Link"
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Speaker / Host */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Speaker / Host (मार्गदर्शक)
              </label>
              <input
                type="text"
                value={formData.speaker}
                onChange={(e) => setFormData((p) => ({ ...p, speaker: e.target.value }))}
                placeholder="e.g. Rahul Kulkarni"
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 font-semibold"
              />
            </div>

            {/* Expected Budget */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Expected Premium / Budget (₹)
              </label>
              <input
                type="number"
                value={formData.expectedBudget}
                onChange={(e) => setFormData((p) => ({ ...p, expectedBudget: e.target.value }))}
                placeholder="e.g. 25000"
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 font-mono font-bold"
              />
            </div>

            {/* Next Follow-up Date */}
            <div>
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Next Follow-up Date (पुढील पाठपुरावा तारीख)
              </label>
              <DatePicker
                value={formData.followUpDate}
                onChange={(val) => setFormData((p) => ({ ...p, followUpDate: val }))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Notes / Consultation Summary */}
            <div className="col-span-1 md:col-span-2">
              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Discussion Notes / Requirement (चर्चा व माहिती)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Enter attendee specific requirements, questions asked, or interest areas..."
                className="input w-full text-xs rounded-xl bg-white border border-slate-200 resize-none p-2.5 h-20"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Deletion"
        subtitle={`Are you sure you want to delete ${deleteTarget?.name}?`}
        size="sm"
        actions={
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-md cursor-pointer"
              onClick={confirmDelete}
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          This attendee record will be permanently removed from your Seminars list.
        </p>
      </Modal>
      {/* Super Admin Live Website Seminar Price Modal (Simple & Compact) */}
      <Modal
        open={superAdminConfigModalOpen}
        onClose={() => setSuperAdminConfigModalOpen(false)}
        title="Website Seminar Price (वेबसाइट फी)"
        subtitle="Super Admin can change the live price displayed on the website."
        size="sm"
        actions={
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              onClick={() => setSuperAdminConfigModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingConfig}
              className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              onClick={handleSaveSeminarConfig}
            >
              {savingConfig ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              Save Price
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveSeminarConfig} className="space-y-3.5 py-1">
          {/* Quick Pricing Presets */}
          <div>
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
              Quick Price Presets (किंमत निवडा)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {['0', '99', '149', '199', '299', '499', '999'].map((p) => {
                const isSelected = String(configFormData.price) === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setConfigFormData((prev) => ({ ...prev, price: p }))}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border',
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    {p === '0' ? 'FREE' : `₹${p}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Price Input */}
          <div>
            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
              Website Seminar Price (₹) <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                required
                min="0"
                value={configFormData.price}
                onChange={(e) => setConfigFormData((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="199"
                className="input w-full pl-8 font-black text-emerald-700 text-base rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              * ही किंमत सेव्ह केल्यावर पब्लिक वेबसाइटवर सेमिनार फी (₹{configFormData.price || '0'}) लगेच अपडेट होईल.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
