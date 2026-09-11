import { useState, useMemo, useEffect } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Presentation, Plus, Pencil, Trash2,
  Copy, Check, Send, Search
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { db } from '../../services/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '@store/auth.store';
import { preloadWhatsAppTemplates } from '../../utils/whatsappTemplates';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  title: string;
  category: string;
  triggerEvent: string;
  message: string;
  mediaUrl?: string;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt?: string;
}

const DEFAULT_LEAD_TEMPLATES: WhatsAppTemplate[] = [];
const DEFAULT_SEMINAR_TEMPLATES: WhatsAppTemplate[] = [];

const STORAGE_KEY = 'familyfirst_whatsapp_management_templates_v2';

const getStoredTemplates = (): WhatsAppTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out any dummy sample templates from earlier versions
      return parsed.filter((t: any) => !t.id.startsWith('lead-tmpl-') && !t.id.startsWith('sem-tmpl-'));
    }
    return [];
  } catch {
    return [];
  }
};

const saveStoredTemplates = (list: WhatsAppTemplate[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save templates', e);
  }
};

export default function Management() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useAuthStore(s => s.user);
  
  // Trigger preload safely
  useEffect(() => {
    preloadWhatsAppTemplates();
  }, []);
  
  // Determine if on Seminars or Leads page from URL path or param
  const isSeminars = location.pathname.includes('seminar') || searchParams.get('tab') === 'seminars';

  useEffect(() => {
    if (user?.role === 'EMPLOYEE' && isSeminars) {
      navigate('/management/leads', { replace: true });
    }
  }, [user, isSeminars, navigate]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(getStoredTemplates);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WhatsAppTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State for Add / Edit Modal
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'LEAD' | 'SEMINAR'>(isSeminars ? 'SEMINAR' : 'LEAD');
  const [triggerEvent, setTriggerEvent] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Filters for templates
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Sync category when tab/location changes
  useEffect(() => {
    setCategory(isSeminars ? 'SEMINAR' : 'LEAD');
  }, [isSeminars]);

  // Firestore Sync Listener
  useEffect(() => {
    const isSuperAdmin = Boolean((user?.role === 'SUPER_ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'ADMIN' || user?.role === 'OWNER'));
    let unsub: (() => void) | null = null;
    try {
      if (db && isSuperAdmin) {
        unsub = onSnapshot(collection(db, 'whatsappTemplates'), (snapshot) => {
          const fsList: WhatsAppTemplate[] = [];
          const seenNames = new Set<string>();
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const n = (d.name || d.title || 'Untitled').trim().toLowerCase();
            if (!seenNames.has(n)) {
              seenNames.add(n);
              fsList.push({ 
                id: docSnap.id, 
                title: d.name || d.title || 'Untitled', 
                ...d 
              } as any);
            }
          });
          if (fsList.length > 0) {
            setTemplates(fsList); // Overwrite entirely with secure Firestore list to naturally dump duplicates
            saveStoredTemplates(fsList);
          }
        }, () => {});
      }
    } catch (e) {}

    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  const activeCategory = isSeminars ? 'SEMINAR' : 'LEAD';

  const filteredTemplates = useMemo(() => {
    return templates.filter((tmpl) => {
      // For backwards compatibility, LEAD/SEMINAR mode toggle
      if (activeCategory === 'SEMINAR' && tmpl.category !== 'SEMINAR') return false;
      if (activeCategory === 'LEAD' && tmpl.category === 'SEMINAR') return false; 
      
      if (statusFilter === 'ACTIVE' && !tmpl.isActive) return false;
      if (statusFilter === 'INACTIVE' && tmpl.isActive) return false;
      
      if (categoryFilter !== 'ALL' && categoryFilter !== tmpl.category) return false;

      if (searchFilter) {
        const tgt = (tmpl.name || tmpl.title || '').toLowerCase();
        if (!tgt.includes(searchFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [templates, activeCategory, statusFilter, categoryFilter, searchFilter]);

  const openAddModal = () => {
    setEditTarget(null);
    setTitle('');
    setCategory(isSeminars ? 'SEMINAR' : 'LEAD');
    setTriggerEvent(isSeminars ? 'Registration Confirmed' : 'New Lead Created');
    setMessage('');
    setMediaUrl('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (tmpl: WhatsAppTemplate) => {
    setEditTarget(tmpl);
    setTitle(tmpl.name || tmpl.title || '');
    setCategory(tmpl.category as any);
    setTriggerEvent(tmpl.triggerEvent || '');
    setMessage(tmpl.message);
    setMediaUrl(tmpl.mediaUrl || '');
    setIsActive(tmpl.isActive ?? true);
    setModalOpen(true);
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this WhatsApp template?')) return;

    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveStoredTemplates(updated);

    try {
      if (db) {
        deleteDoc(doc(db, 'whatsappTemplates', id)).catch(() => {});
      }
    } catch {}

    toast.success('Template deleted successfully');
  };

  const handleCopy = (tmpl: WhatsAppTemplate) => {
    navigator.clipboard.writeText(tmpl.message);
    setCopiedId(tmpl.id);
    toast.success('Message copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2500);
  };


  const insertVariable = (variable: string) => {
    setMessage((prev) => `${prev} ${variable} `);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a Template Title (शीर्षक आवश्यक आहे)');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter the Message Text (संदेश मजकूर आवश्यक आहे)');
      return;
    }

    // Extract variables used in message
    const matchedVars = message.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    const uniqueVars = Array.from(new Set(matchedVars));

    if (editTarget) {
      const updatedTmpl: WhatsAppTemplate = {
        ...editTarget,
        name: title.trim(),
        title: title.trim(),
        category,
        triggerEvent: triggerEvent.trim() || 'Custom Broadcast',
        message: message.trim(),
        mediaUrl: mediaUrl.trim() || undefined,
        variables: uniqueVars,
        isActive,
        updatedAt: new Date().toISOString(),
      };

      const updatedList = templates.map((t) => (t.id === editTarget.id ? updatedTmpl : t));
      setTemplates(updatedList);
      saveStoredTemplates(updatedList);

      try {
        if (db) {
          setDoc(doc(db, 'whatsappTemplates', editTarget.id), updatedTmpl, { merge: true }).catch(() => {});
        }
      } catch {}

      toast.success('Template updated successfully!');
    } else {
      const newId = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newTmpl: WhatsAppTemplate = {
        id: newId,
        name: title.trim(),
        title: title.trim(),
        category,
        triggerEvent: triggerEvent.trim() || 'Custom Broadcast',
        message: message.trim(),
        mediaUrl: mediaUrl.trim() || undefined,
        isActive,
        variables: uniqueVars,
        createdAt: new Date().toISOString(),
      };

      const updatedList = [newTmpl, ...templates];
      setTemplates(updatedList);
      saveStoredTemplates(updatedList);

      try {
        if (db) {
          setDoc(doc(db, 'whatsappTemplates', newId), newTmpl, { merge: true }).catch(() => {});
        }
      } catch {}

      toast.success('New WhatsApp template added successfully!');
    }

    setModalOpen(false);
  };

  const availableVariables = useMemo(() => {
    return [
      { label: 'Customer Name', tag: '{{name}}' },
      { label: 'Meeting Date', tag: '{{date}}' },
      { label: 'Meeting Time', tag: '{{time}}' },
      { label: 'Meeting Day', tag: '{{day}}' },
      { label: 'Consultant Name', tag: '{{consultant_name}}' },
    ];
  }, [category]);

  return (
    <div className="space-y-4 pb-16 animate-fadeIn">
      {/* ── Top Bar: Search, Filters & Add Button ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 items-center gap-3 overflow-x-auto w-full">
          <div className="relative min-w-[180px] shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
              placeholder="Search templates..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <select 
            className="input w-32 shrink-0 text-xs py-1.5 rounded-xl border-slate-200 bg-slate-50"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select 
            className="input w-32 shrink-0 text-xs py-1.5 rounded-xl border-slate-200 bg-slate-50"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="Meeting">Meeting</option>
            <option value="Follow Up">Follow Up</option>
            <option value="Reminder">Reminder</option>
            <option value="Documents">Documents</option>
            <option value="Proposal">Proposal</option>
            <option value="Welcome">Welcome</option>
            <option value="Payment">Payment</option>
            <option value="Medical">Medical</option>
          </select>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="px-5 py-2.5 shrink-0 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg hover:scale-105 transition-all"
          style={{ background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add Template</span>
        </button>
      </div>

      {/* ── Template Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredTemplates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 p-4.5 flex flex-col justify-between group"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    {tmpl.category === 'SEMINAR' ? <Presentation size={17} /> : <MessageSquare size={17} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-1">
                      {tmpl.name || tmpl.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-100">
                        {tmpl.category}
                      </span>
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer',
                        tmpl.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                      )}
                      onClick={async (e) => {
                        e.stopPropagation();
                        // quick toggle
                        const updated = { ...tmpl, isActive: !tmpl.isActive, updatedAt: new Date().toISOString() };
                        setTemplates(templates.map(t => t.id === tmpl.id ? updated : t));
                        if(db) setDoc(doc(db, 'whatsappTemplates', tmpl.id), updated, {merge:true}).catch(()=>{});
                      }}>
                        {tmpl.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(tmpl)}
                    title="Edit Template"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 transition-all cursor-pointer"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(tmpl.id, e)}
                    title="Delete Template"
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* WhatsApp Message Preview Bubble */}
              <div className="bg-[#EFEAE2] p-3.5 rounded-xl border border-[#DAD4CB] relative font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text mb-3 shadow-2xs">
                <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-xs border border-slate-200/50">
                  {tmpl.message}
                  <div className="text-[9px] text-slate-400 text-right mt-1 font-semibold flex items-center justify-end gap-1">
                    <span>10:30 AM</span>
                    <Check size={11} className="text-blue-500" />
                  </div>
                </div>
              </div>

              {/* Dynamic Variables Pill Tags */}
              {tmpl.variables && tmpl.variables.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tags:</span>
                  {tmpl.variables.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => handleCopy(tmpl)}
                className={clsx(
                  'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                  copiedId === tmpl.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                )}
              >
                {copiedId === tmpl.id ? <Check size={13} /> : <Copy size={13} />}
                {copiedId === tmpl.id ? 'Copied!' : 'Copy Text'}
              </button>
            </div>
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center p-6">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 shadow-inner">
              {isSeminars ? <Presentation size={24} /> : <MessageSquare size={24} />}
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              No WhatsApp {isSeminars ? 'Seminar' : 'Lead'} Messages Found
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Create and automate high-converting WhatsApp message templates for your {isSeminars ? 'seminars' : 'leads'}.
            </p>
          </div>
        )}
      </div>

      {/* ── Add / Edit WhatsApp Message Modal ───────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit WhatsApp Template' : `Add WhatsApp Message (${category === 'SEMINAR' ? 'Seminars' : 'Leads'})`}
        subtitle="Configure template details, dynamic placeholders, and live WhatsApp message preview."
        size="lg"
        heightClass="h-[560px] max-h-[85vh]"
        footerActions={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="whatsapp-template-form"
              className="px-6 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-lg hover:scale-102 transition-all cursor-pointer flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' }}
            >
              <Check size={14} />
              <span>{editTarget ? 'Update Template' : 'Save Template'}</span>
            </button>
          </>
        }
      >
        <form id="whatsapp-template-form" onSubmit={handleSubmit} className="space-y-3.5 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Template Title */}
            <div className="sm:col-span-2">
              <label className="label text-xs font-bold text-slate-700 block mb-1">
                Template Title / Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input w-full font-semibold text-xs rounded-xl"
                placeholder={category === 'SEMINAR' ? 'उदा. 1-Hour Prior Seminar Link' : 'उदा. Lead Proposal & Quotation Message'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="label text-xs font-bold text-slate-700 block mb-1">Target Category</label>
              <select
                className="input w-full text-xs font-semibold rounded-xl cursor-pointer"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="LEAD">WhatsApp Message for Leads</option>
                <option value="SEMINAR">WhatsApp Message for Seminars</option>
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 block mb-1">Status</label>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  checked={isActive} 
                  onChange={(e) => setIsActive(e.target.checked)} 
                  className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">{isActive ? 'Active Template' : 'Inactive Template'}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Variables Help Chips */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">
                Dynamic Variables (मेसेजमध्ये आपोआप नाव, तारीख, लिंक भरण्यासाठी खालील बटनांवर क्लिक करा):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableVariables.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  title={`Insert ${v.tag}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-300 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                >
                  <span className="text-purple-600 font-extrabold group-hover:scale-110 transition-transform">+</span>
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label text-xs font-bold text-slate-700">
                Message Content (WhatsApp Formatted) <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Use *bold*, _italic_, {`{variable}`}</span>
            </div>
            <textarea
              className="input w-full text-xs font-medium rounded-xl p-2.5 leading-relaxed"
              rows={4}
              placeholder="Type WhatsApp message here. Use *bold*, _italic_, ~strikethrough~ and tags like {name} or {attendee_name}..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          {/* Live Preview Box */}
          {message.trim() && (
            <div className="bg-[#EFEAE2] p-2.5 rounded-xl border border-[#DAD4CB]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Live WhatsApp Preview:
              </span>
              <div className="bg-white p-2.5 rounded-lg shadow-xs text-xs text-slate-800 whitespace-pre-wrap font-sans">
                {message}
                <div className="text-[9px] text-slate-400 text-right mt-1 font-semibold flex items-center justify-end gap-1">
                  <span>10:30 AM</span>
                  <Check size={11} className="text-blue-500" />
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
