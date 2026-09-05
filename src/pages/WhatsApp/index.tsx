import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whatsappService, contactsService, leadsService } from '@api/index';
import { useState, useRef, useMemo } from 'react';
import {
  Plus, Send, Rocket, Trash2, Wallet, Users, MessageSquare, MessageCircle,
  Search, X, AlertTriangle, UserPlus, ChevronDown, ChevronRight,
  CheckCircle2, Clock, XCircle, Zap, BarChart2, CreditCard,
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useAuthStore } from '@store/auth.store';

const COST_PER_MSG = 0.48; // ₹ per WhatsApp message

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     'badge-gray',
  SCHEDULED: 'badge-yellow',
  RUNNING:   'badge-blue',
  COMPLETED: 'badge-green',
  FAILED:    'badge-red',
};

const STATUS_GRADIENT: Record<string, string> = {
  DRAFT:     'from-slate-400 to-slate-500',
  SCHEDULED: 'from-amber-400 to-orange-500',
  RUNNING:   'from-blue-500 to-indigo-600',
  COMPLETED: 'from-emerald-500 to-green-600',
  FAILED:    'from-red-500 to-rose-600',
};

function normalizePhone(phone: string): string {
  return (phone ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(-10);
}

// ── Small log status indicator ───────────────────────────────────────────────
function LogStatusIcon({ status }: { status: string }) {
  if (status === 'DELIVERED' || status === 'READ')
    return <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />;
  if (status === 'FAILED')
    return <XCircle size={13} className="text-red-400 shrink-0" />;
  return <Clock size={13} className="text-amber-400 shrink-0" />;
}

export default function WhatsApp() {
  const qc   = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isOwner = user?.role === 'OWNER';

  const [tab, setTab]     = useState<'campaigns' | 'templates' | 'conversations' | 'wallet'>('campaigns');
  const [modal, setModal] = useState<null | 'template' | 'campaign' | 'topup'>(null);
  const [campaignType, setCampaignType] = useState<'one-time' | 'recurring'>('one-time');
  const [triggerType, setTriggerType]   = useState<'now' | 'schedule' | 'event'>('now');
  const [eventTrigger, setEventTrigger] = useState<string>('renewal');
  const [targetAudience, setTargetAudience] = useState<'all-leads' | 'all-customers' | 'hot-leads' | 'custom'>('all-leads');
  const [selectedBanner, setSelectedBanner]     = useState<string>('banner1');
  const [customBannerFile, setCustomBannerFile] = useState<File | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Contact picker state
  const [contactSearch, setContactSearch]         = useState('');
  const [selectedContacts, setSelectedContacts]   = useState<any[]>([]);
  const [showContactDrop, setShowContactDrop]     = useState(false);

  // Conversations
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  const TABS = [
    { key: 'campaigns',      label: 'Campaigns',      icon: Rocket },
    { key: 'templates',      label: 'Templates',      icon: MessageSquare },
    { key: 'conversations',  label: 'Conversations',  icon: Users },
    { key: 'wallet',         label: 'Wallet',         icon: Wallet },
  ] as const;

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: templatesData } = useQuery({ queryKey: ['whatsapp', 'templates'], queryFn: () => whatsappService.templates() });
  const { data: campaignsData } = useQuery({ queryKey: ['whatsapp', 'campaigns'], queryFn: () => whatsappService.campaigns() });
  const { data: walletData }    = useQuery({ queryKey: ['whatsapp', 'wallet'],    queryFn: whatsappService.wallet });

  const { data: contactsPickerData } = useQuery({
    queryKey: ['whatsapp-picker-contacts', contactSearch],
    queryFn: () => contactsService.list({ search: contactSearch || undefined, limit: 20 }),
    enabled: modal === 'campaign',
  });

  const { data: allContactsRes } = useQuery({
    queryKey: ['whatsapp-all-contacts'],
    queryFn: () => contactsService.list({ limit: 1000 }),
    enabled: modal === 'campaign',
  });

  const { data: logsData, isFetching: logsFetching } = useQuery({
    queryKey: ['whatsapp', 'logs', expandedCampaignId],
    queryFn:  () => whatsappService.campaignLogs(expandedCampaignId!),
    enabled:  !!expandedCampaignId,
  });

  const templates: any[]     = templatesData?.data ?? [];
  const campaigns: any[]     = campaignsData?.data ?? [];
  const pickerContacts: any[] = contactsPickerData?.data ?? [];
  const allContacts: any[]    = allContactsRes?.data ?? [];
  const logs: any[]           = logsData?.data ?? [];
  const walletBalance         = Number(walletData?.data?.balance ?? 0);

  // ── Deduplication ──────────────────────────────────────────────────────────
  const { deduped, dupCount } = useMemo(() => {
    const seen = new Set<string>();
    const deduped: any[] = [];
    let dupCount = 0;
    for (const c of selectedContacts) {
      const norm = normalizePhone(c.phone ?? '');
      if (!norm || seen.has(norm)) { dupCount++; }
      else { seen.add(norm); deduped.push(c); }
    }
    return { deduped, dupCount };
  }, [selectedContacts]);

  const audienceCount = useMemo(() => {
    if (targetAudience === 'custom') {
      return deduped.length;
    }
    if (targetAudience === 'all-leads') {
      return allContacts.filter(c => c.leadStage || (c.productInterests && c.productInterests.length > 0)).length;
    }
    if (targetAudience === 'all-customers') {
      return allContacts.filter(c => c.policies && c.policies.length > 0).length;
    }
    if (targetAudience === 'hot-leads') {
      return allContacts.filter(c => c.leadStage === 'HOT' || (c.productInterests && c.productInterests.some((p: any) => p.stage === 'HOT'))).length;
    }
    return 0;
  }, [targetAudience, deduped, allContacts]);

  const estimatedCost     = (audienceCount * COST_PER_MSG).toFixed(2);
  const hasSufficientBal  = walletBalance >= audienceCount * COST_PER_MSG;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createTemplate = useMutation({
    mutationFn: whatsappService.createTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp', 'templates'] }); toast.success('Template created'); setModal(null); tForm.reset(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });
  const deleteTemplate = useMutation({
    mutationFn: (id: string) => whatsappService.deleteTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp', 'templates'] }); toast.success('Template deleted'); },
  });
  const createCampaign = useMutation({
    mutationFn: whatsappService.createCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp', 'campaigns'] });
      toast.success('Campaign created');
      setModal(null); cForm.reset();
      setSelectedContacts([]); setContactSearch('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });
  const launchCampaign = useMutation({
    mutationFn: (id: string) => whatsappService.launchCampaign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp', 'campaigns'] }); toast.success('Campaign launched!'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Launch failed'),
  });
  const topup = useMutation({
    mutationFn: whatsappService.topupWallet,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp', 'wallet'] }); toast.success('Credits added'); setModal(null); topupForm.reset(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Top-up failed'),
  });
  const createLead = useMutation({
    mutationFn: leadsService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead created from conversation!'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create lead'),
  });

  const tForm     = useForm<any>({ defaultValues: { category: 'PROMOTIONAL' } });
  const cForm     = useForm<any>();
  const topupForm = useForm<any>();

  // ── Contact picker helpers ──────────────────────────────────────────────────
  const addContact = (c: any) => {
    if (!selectedContacts.find(s => s.id === c.id)) setSelectedContacts(p => [...p, c]);
    setContactSearch(''); setShowContactDrop(false);
  };
  const removeContact = (id: string) => setSelectedContacts(p => p.filter(c => c.id !== id));

  const handleCampaignSubmit = (d: any) => {
    if (targetAudience === 'custom' && deduped.length === 0) {
      toast.error('Add at least one contact');
      return;
    }
    if (targetAudience === 'custom' && dupCount > 0) {
      toast(`Skipped ${dupCount} duplicate number(s)`, { icon: '⚠️' });
    }
    createCampaign.mutate({
      ...d,
      triggerType,
      eventTrigger: triggerType === 'event' ? eventTrigger : undefined,
      targetAudience,
      contactIds: targetAudience === 'custom' ? deduped.map(c => c.id) : undefined,
      totalCount: audienceCount,
      scheduledAt: triggerType === 'schedule' && d.scheduledAt ? new Date(d.scheduledAt).toISOString() : undefined,
    });
  };

  const handleMarkAsLead = (log: any) => {
    createLead.mutate({
      name: log.contactName ?? log.phone ?? 'WhatsApp Contact',
      phone: log.phone,
      source: 'WHATSAPP',
      notes: `Interested via WhatsApp campaign`,
      stage: 'NEW',
    });
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in pb-10">

      {/* Employee view-only notice */}
      {!isOwner && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
          <AlertTriangle size={14} />
          You have view-only access. Contact your workspace owner to create or launch campaigns.
        </div>
      )}

      {/* ── Tabs & Actions Row ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Wallet balance */}
          <button
            onClick={() => { setTab('wallet'); isOwner && setModal('topup'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Wallet size={14} className="text-slate-600" />
            <span>₹{walletBalance.toLocaleString('en-IN')}</span>
            {isOwner && (
              <span className="text-blue-600 text-[11px] font-bold ml-1">+ Top Up</span>
            )}
          </button>

          {isOwner && (
            <>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                onClick={() => setModal('template')}
              >
                <Plus size={14} /> Template
              </button>
              <button
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-md shadow-purple-500/30 transition-all cursor-pointer"
                onClick={() => setModal('campaign')}
              >
                <Send size={14} /> New Campaign
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Campaigns Tab ───────────────────────────────────────────────────── */}
      {tab === 'campaigns' && (
        <div className="space-y-3">
          {campaigns.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                <Rocket size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No campaigns yet</p>
              {isOwner && (
                <button className="btn-primary mt-4 text-[10px] sm:text-xs" onClick={() => setModal('campaign')}>
                  <Plus size={13} /> Create First Campaign
                </button>
              )}
            </div>
          )}
          {campaigns.map((c: any) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 p-4">
                {/* Status colour bar */}
                <div className={`w-1.5 self-stretch rounded-full bg-gradient-to-b ${STATUS_GRADIENT[c.status] ?? 'from-slate-400 to-slate-500'}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      c.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'RUNNING'   ? 'bg-blue-100 text-blue-700' :
                      c.status === 'FAILED'    ? 'bg-red-100 text-red-700' :
                      c.status === 'SCHEDULED' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{c.status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium">
                    <span>Template: <span className="text-slate-600 font-semibold">{c.template?.name ?? '—'}</span></span>
                    {c.scheduledAt && (
                      <span>Scheduled: <span className="text-slate-600 font-semibold">{format(new Date(c.scheduledAt), 'dd MMM yyyy HH:mm')}</span></span>
                    )}
                    <span className="flex flex-wrap items-center gap-1">
                      <BarChart2 size={10} />
                      Sent {c.sentCount ?? 0}/{c.totalCount ?? 0}
                      {c.failedCount > 0 && <span className="text-red-500 font-semibold"> · Failed {c.failedCount}</span>}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedCampaignId(expandedCampaignId === c.id ? null : c.id)}
                    className="flex flex-wrap items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-semibold transition-all"
                  >
                    <Users size={12} /> Logs
                    {expandedCampaignId === c.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                  {isOwner && (c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                    <button
                      className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold transition-all"
                      onClick={() => launchCampaign.mutate(c.id)}
                      disabled={launchCampaign.isPending}
                    >
                      <Rocket size={12} /> Launch
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded logs panel */}
              {expandedCampaignId === c.id && (
                <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
                  {logsFetching ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Loading logs…</p>
                  ) : logs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">No delivery logs yet for this campaign.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 pb-1.5 border-b border-slate-200">
                        <span>Contact / Phone</span>
                        <span>Status</span>
                        <span>Sent At</span>
                        <span className="text-right">Action</span>
                      </div>
                      {logs.map((log: any) => (
                        <div key={log.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-center py-1.5 hover:bg-white rounded-lg px-1 transition-all">
                          <span className="text-xs font-semibold text-slate-700 truncate">
                            {log.contactName ?? log.phone ?? '—'}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            <LogStatusIcon status={log.status} />
                            <span className={`text-[10px] font-semibold ${
                              log.status === 'DELIVERED' || log.status === 'READ' ? 'text-emerald-600' :
                              log.status === 'FAILED' ? 'text-red-500' : 'text-amber-500'
                            }`}>{log.status}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {log.sentAt ? format(new Date(log.sentAt), 'dd MMM, HH:mm') : log.createdAt ? format(new Date(log.createdAt), 'dd MMM, HH:mm') : '—'}
                          </span>
                          <div className="flex justify-end">
                            {isOwner && (log.status === 'DELIVERED' || log.status === 'READ') && (
                              <button
                                onClick={() => handleMarkAsLead(log)}
                                disabled={createLead.isPending}
                                className="flex flex-wrap items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-bold transition-all"
                              >
                                <UserPlus size={10} /> Lead
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Templates Tab ────────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                <MessageSquare size={24} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No templates yet</p>
              {isOwner && (
                <button className="btn-secondary mt-4 text-[10px] sm:text-xs" onClick={() => setModal('template')}>
                  <Plus size={13} /> Create Template
                </button>
              )}
            </div>
          )}
          {templates.map((t: any) => {
            const cat = t.category || 'PROMOTIONAL';
            const badgeStyle =
              cat === 'TRANSACTIONAL'
                ? { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', icon: '📝', hoverBorder: 'hover:border-indigo-300' }
                : cat === 'REMINDER'
                ? { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: '⏰', hoverBorder: 'hover:border-amber-300' }
                : { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', icon: '📣', hoverBorder: 'hover:border-rose-300' };

            return (
              <div
                key={t.id}
                className={clsx(
                  "bg-white rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 p-5 relative group flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5",
                  badgeStyle.hoverBorder
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        {badgeStyle.icon} {cat}
                      </p>
                      <h4 className="text-sm font-extrabold text-slate-800 tracking-tight capitalize truncate">
                        {t.name?.replace(/_/g, ' ')}
                      </h4>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => deleteTemplate.mutate(t.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all shrink-0 opacity-0 group-hover:opacity-100"
                        title="Delete Template"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3">
                    <p className="text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">
                      {t.body}
                    </p>
                  </div>
                </div>

                {(t.variables ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-slate-100/60">
                    {(t.variables ?? []).map((v: string) => (
                      <span
                        key={v}
                        className={clsx(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide transition-colors",
                          cat === 'TRANSACTIONAL'
                            ? 'bg-indigo-50/50 text-indigo-600 border-indigo-100'
                            : cat === 'REMINDER'
                            ? 'bg-amber-50/50 text-amber-600 border-amber-100'
                            : 'bg-rose-50/50 text-rose-600 border-rose-100'
                        )}
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Conversations Tab ─────────────────────────────────────────────────── */}
      {tab === 'conversations' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 font-medium">
            <MessageSquare size={13} className="text-blue-500" />
            Select any campaign below to view delivery logs and mark interested contacts as leads.
          </div>

          {campaigns.length === 0 && (
            <p className="text-sm text-slate-400 py-10 text-center italic">No campaigns to show conversations for.</p>
          )}

          {campaigns.map((c: any) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedCampaignId(expandedCampaignId === c.id ? null : c.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-all text-left"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${STATUS_GRADIENT[c.status] ?? 'from-slate-400 to-slate-500'}`} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{c.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {c.sentCount ?? 0} sent · {c.totalCount ?? 0} total
                      {c.scheduledAt && ` · ${format(new Date(c.scheduledAt), 'dd/MMM/yyyy')}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    c.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    c.status === 'RUNNING'   ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{c.status}</span>
                  {expandedCampaignId === c.id ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                </div>
              </button>

              {expandedCampaignId === c.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                  {logsFetching ? (
                    <p className="text-xs text-slate-400 text-center py-6">Loading conversations…</p>
                  ) : logs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">No responses yet for this campaign.</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log: any) => (
                        <div
                          key={log.id}
                          className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex flex-wrap items-center gap-4 hover:shadow-sm transition-all"
                        >
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(log.contactName ?? log.phone ?? '?')[0].toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {log.contactName ?? log.phone ?? 'Unknown'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
                              {log.phone}
                              {log.message && ` · ${String(log.message).slice(0, 60)}…`}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="flex flex-wrap items-center gap-1">
                              <LogStatusIcon status={log.status} />
                              <span className={`text-[10px] font-semibold ${
                                log.status === 'DELIVERED' || log.status === 'READ' ? 'text-emerald-600' :
                                log.status === 'FAILED' ? 'text-red-500' : 'text-amber-500'
                              }`}>{log.status}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {log.sentAt ?? log.createdAt ? format(new Date(log.sentAt ?? log.createdAt), 'dd MMM, HH:mm') : '—'}
                            </span>
                            {isOwner && (
                              <button
                                onClick={() => handleMarkAsLead(log)}
                                disabled={createLead.isPending}
                                title="Create lead from this contact"
                                className="flex flex-wrap items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 font-bold transition-all"
                              >
                                <UserPlus size={11} /> Mark Lead
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Wallet Tab ───────────────────────────────────────────────────────── */}
      {tab === 'wallet' && (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Balance card */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200/40">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Wallet size={18} className="text-white/80" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-white/70">WhatsApp Wallet</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight">
              ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-white/60 text-xs mt-1 font-medium">Available credits · ₹{COST_PER_MSG}/msg</p>
            <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
              <p className="text-xs text-white/70">
                Approx. <span className="text-white font-bold">{Math.floor(walletBalance / COST_PER_MSG)}</span> messages remaining
              </p>
              {isOwner && (
                <button
                  onClick={() => setModal('topup')}
                  className="flex flex-wrap items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-emerald-700 text-xs font-extrabold hover:bg-emerald-50 shadow-md transition-all"
                >
                  <CreditCard size={13} /> Add Balance
                </button>
              )}
            </div>
          </div>

          {/* Cost calculator */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-4 flex flex-wrap items-center gap-1.5">
              <Zap size={12} className="text-amber-500" /> Cost Calculator
            </h3>
            <div className="space-y-3">
              {[100, 500, 1000, 5000].map(count => (
                <div key={count} className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm font-semibold text-slate-600">{count.toLocaleString()} contacts</span>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-800">₹{(count * COST_PER_MSG).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 block">one-time campaign</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Template Modal ─────────────────────────────────────────────────── */}
      <Modal open={modal === 'template'} onClose={() => { setModal(null); tForm.reset(); }} title="Create Template" size="xl">
        <form onSubmit={tForm.handleSubmit(d => createTemplate.mutate(d))} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="label">Name *</label>
            <input {...tForm.register('name', { required: true })} className="input" placeholder="Policy Renewal Reminder" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Category</label>
            <select {...tForm.register('category')} className="input">
              <option value="PROMOTIONAL">Promotional</option>
              <option value="TRANSACTIONAL">Transactional</option>
              <option value="REMINDER">Reminder</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Body *</label>
            <textarea
              {...tForm.register('body', { required: true })}
              className="input font-mono"
              rows={5}
              placeholder="Hi {{name}}, your policy {{policy_number}} is due on {{due_date}}."
            />
            <p className="text-xs text-slate-400">Use {'{{variable}}'} for dynamic values — auto-detected as variables.</p>
          </div>
          {createTemplate.isError && (
            <p className="text-sm text-red-500">{(createTemplate.error as any)?.response?.data?.message ?? 'Error'}</p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => { setModal(null); tForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createTemplate.isPending}>
              {createTemplate.isPending ? 'Creating…' : 'Create Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Campaign Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={modal === 'campaign'}
        onClose={() => { setModal(null); cForm.reset(); setSelectedContacts([]); setContactSearch(''); }}
        title="Create New Campaign"
        subtitle="Set up a bulk WhatsApp blast with message, contacts & schedule."
        size="lg"
      >
        <form onSubmit={cForm.handleSubmit(handleCampaignSubmit)} className="space-y-4 pt-2">

          {/* Campaign Title */}
          <div>
            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Campaign Title *</label>
            <input
              {...cForm.register('name', { required: true })}
              className="input w-full mt-1.5"
              placeholder="e.g., February Health Drive"
            />
          </div>

          {/* Campaign Type */}
          <div>
            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Campaign Type</label>
            <div className="flex gap-2">
              {(['one-time', 'recurring'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCampaignType(type)}
                  className={clsx(
                    'flex-1 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer capitalize',
                    campaignType === type
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-400 font-bold'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {type === 'one-time' ? 'One-Time' : 'Recurring'}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger Type + Message Type + Recurrence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Trigger Type</label>
              <select
                className="input w-full mt-1.5"
                value={triggerType}
                onChange={e => setTriggerType(e.target.value as any)}
              >
                <option value="now">Immediate</option>
                <option value="schedule">Scheduled</option>
                <option value="event">Event-based</option>
              </select>
            </div>
            <div>
              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Message Type</label>
              <select {...cForm.register('messageType')} className="input w-full mt-1.5">
                <option value="template">Template Message</option>
                <option value="session">Session Message</option>
              </select>
            </div>
          </div>

          {/* Conditional Event-based fields */}
          {triggerType === 'event' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100 bg-slate-50/50 p-3 rounded-xl">
              <div>
                <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Event Trigger</label>
                <select
                  className="input w-full mt-1.5"
                  value={eventTrigger}
                  onChange={e => setEventTrigger(e.target.value)}
                >
                  <option value="renewal">Policy Renewal</option>
                  <option value="installment">Installment Due</option>
                  <option value="phc">Preventive Health Checkup</option>
                  <option value="birthday">Birthday</option>
                  <option value="festival">Festival</option>
                </select>
              </div>
              {eventTrigger === 'festival' && (
                <div>
                  <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Festival Name</label>
                  <select {...cForm.register('festivalName')} className="input w-full mt-1.5">
                    <option value="diwali">Diwali</option>
                    <option value="new_year">New Year</option>
                    <option value="eid">Eid</option>
                    <option value="christmas">Christmas</option>
                    <option value="holi">Holi</option>
                    <option value="custom">Custom / Other</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Conditional Scheduled field */}
          {triggerType === 'schedule' && (
            <div>
              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Schedule Date &amp; Time *</label>
              <input
                {...cForm.register('scheduledAt', { required: triggerType === 'schedule' })}
                type="datetime-local"
                className="input w-full mt-1.5"
              />
            </div>
          )}

          {/* Recurrence & Frequency (If Recurring Type is chosen) */}
          {campaignType === 'recurring' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100 bg-slate-50/50 p-3 rounded-xl">
              <div>
                <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Recurrence</label>
                <select {...cForm.register('recurrence')} className="input w-full mt-1.5">
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Frequency</label>
                <select {...cForm.register('frequency')} className="input w-full mt-1.5">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          )}

          {/* Message Template */}
          <div>
            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Message Template *</label>
            <select {...cForm.register('templateId', { required: true })} className="input w-full mt-1.5">
              <option value="">Select a template…</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-[10px] text-orange-500 mt-1 font-semibold">No templates yet — create one first.</p>
            )}
            {/* Preview */}
            {(() => {
              const tpl = templates.find((t: any) => t.id === cForm.watch('templateId'));
              return tpl ? (
                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Preview</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{tpl.body}</p>
                </div>
              ) : null;
            })()}
          </div>

          {/* Target Audience */}
          <div>
            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target Audience</label>
            <select
              className="input w-full mt-1.5"
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value as any)}
            >
              <option value="all-leads">All Leads</option>
              <option value="all-customers">All Customers</option>
              <option value="hot-leads">Hot Leads Only</option>
              <option value="custom">Custom Selection</option>
            </select>
          </div>

          {/* ── Contact Picker (Conditional on Custom Selection) ────────────── */}
          {targetAudience === 'custom' && (
            <div>
              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Contacts * <span className="normal-case font-normal text-slate-400">(search from contacts or type phone)</span>
              </label>

              {/* Search input */}
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 input">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input
                    className="flex-1 outline-none bg-transparent text-sm"
                    placeholder="Search by name or phone…"
                    value={contactSearch}
                    onChange={e => { setContactSearch(e.target.value); setShowContactDrop(true); }}
                    onFocus={() => setShowContactDrop(true)}
                  />
                  {contactSearch && (
                    <button type="button" onClick={() => { setContactSearch(''); setShowContactDrop(false); }}>
                      <X size={13} className="text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {showContactDrop && (pickerContacts.length > 0) && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {pickerContacts
                      .filter((c: any) => !selectedContacts.find(s => s.id === c.id))
                      .map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => addContact(c)}
                          className="w-full flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {(c.firstName ?? c.phone ?? '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{c.firstName} {c.lastName}</p>
                            <p className="text-[10px] text-slate-400">{c.phone}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Selected chips */}
              {selectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedContacts.map((c: any) => {
                    const norm = normalizePhone(c.phone ?? '');
                    const isDup = selectedContacts.filter(x => normalizePhone(x.phone ?? '') === norm).length > 1;
                    return (
                      <span
                        key={c.id}
                        className={clsx(
                          'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border',
                          isDup
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        )}
                      >
                        {isDup && <AlertTriangle size={9} />}
                        {c.firstName ?? c.phone}
                        <button type="button" onClick={() => removeContact(c.id)} className="ml-0.5 hover:text-red-500">
                          <X size={9} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Deduplication warning */}
              {dupCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <AlertTriangle size={11} />
                  {dupCount} duplicate number(s) detected — will be skipped on send
                </div>
              )}
            </div>
          )}

          {/* Promotional Banner */}
          <div>
            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Promotional Banner (Optional)</label>
            <div className="flex gap-3">
              {[
                { key: 'banner1', label: 'Health Care', cls: 'from-purple-600 to-blue-500' },
                { key: 'banner2', label: 'New Year Offer', cls: 'from-orange-400 to-red-500' },
              ].map(b => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSelectedBanner(b.key)}
                  className={clsx(
                    'w-24 h-16 rounded-lg overflow-hidden border-2 cursor-pointer',
                    selectedBanner === b.key ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200'
                  )}
                >
                  <div className={`w-full h-full bg-gradient-to-tr ${b.cls} flex items-center justify-center`}>
                    <span className="text-[10px] text-white font-bold">{b.label}</span>
                  </div>
                </button>
              ))}
              <input type="file" ref={bannerInputRef} accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setCustomBannerFile(f); setSelectedBanner('custom'); } }}
              />
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className={clsx(
                  'w-24 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer text-xs font-bold',
                  selectedBanner === 'custom'
                    ? 'border-emerald-500 bg-emerald-50/10 text-emerald-500'
                    : 'border-gray-300 text-gray-400 hover:border-emerald-500'
                )}
              >
                {customBannerFile ? (
                  <span className="text-[8px] px-1 text-center truncate w-full">{customBannerFile.name}</span>
                ) : <><span className="text-lg">+</span><span className="text-[9px]">Custom</span></>}
              </button>
            </div>
          </div>

          {/* Dynamic Cost Estimation */}
          <div className="border border-emerald-100 bg-emerald-50/30 p-4 rounded-xl space-y-3">
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block flex flex-wrap items-center gap-1">
              <BarChart2 size={11} /> Campaign Cost Estimate
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pb-3 border-b border-emerald-100/50">
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Recipients</span>
                <span className="text-base font-extrabold text-gray-800 mt-0.5 block">{deduped.length}</span>
                {dupCount > 0 && <span className="text-[9px] text-amber-500 font-semibold">{dupCount} dupes removed</span>}
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Cost / Msg</span>
                <span className="text-base font-extrabold text-emerald-600 mt-0.5 block">₹{COST_PER_MSG}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Total Cost</span>
                <span className="text-base font-extrabold text-slate-800 mt-0.5 block">₹{estimatedCost}</span>
              </div>
            </div>
            <div className={clsx(
              'text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5',
              hasSufficientBal
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            )}>
              {hasSufficientBal
                ? <><CheckCircle2 size={11} /> Sufficient wallet balance (₹{walletBalance.toFixed(2)} available)</>
                : <><AlertTriangle size={11} /> Insufficient balance — need ₹{estimatedCost}, have ₹{walletBalance.toFixed(2)}</>
              }
            </div>
          </div>

          {createCampaign.isError && (
            <p className="text-xs text-red-500 font-semibold">
              {(createCampaign.error as any)?.response?.data?.message ?? 'Error saving campaign'}
            </p>
          )}

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary text-[10px] sm:text-xs"
              onClick={() => { setModal(null); cForm.reset(); setSelectedContacts([]); }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-bold rounded-xl shadow-sm flex flex-wrap items-center gap-1.5 transition-colors disabled:opacity-60"
              disabled={createCampaign.isPending || !hasSufficientBal}
            >
              {createCampaign.isPending ? 'Creating…' : <><Send size={13} /> Create Campaign</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Top-Up Modal ────────────────────────────────────────────────────── */}
      <Modal open={modal === 'topup'} onClose={() => { setModal(null); topupForm.reset(); }} title="Add WhatsApp Credits" size="xl">
        <form onSubmit={topupForm.handleSubmit(d => topup.mutate({ amount: Number(d.amount), notes: d.notes }))} className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs text-emerald-700 font-semibold">Current Balance</p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-0.5">₹{walletBalance.toFixed(2)}</p>
            <p className="text-[10px] text-emerald-500 mt-1">≈ {Math.floor(walletBalance / COST_PER_MSG)} messages at ₹{COST_PER_MSG}/msg</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Amount (₹) *</label>
            <input {...topupForm.register('amount', { required: true, min: 1 })} type="number" className="input" placeholder="500" />
            {topupForm.watch('amount') && (
              <p className="text-[10px] text-emerald-600 font-semibold">
                ≈ {Math.floor(Number(topupForm.watch('amount')) / COST_PER_MSG).toLocaleString()} messages
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Notes / Reference</label>
            <input {...topupForm.register('notes')} className="input" placeholder="Razorpay txn #12345" />
          </div>
          {topup.isError && <p className="text-sm text-red-500">{(topup.error as any)?.response?.data?.message ?? 'Error'}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => { setModal(null); topupForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={topup.isPending}>
              {topup.isPending ? 'Processing…' : 'Add Credits'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
