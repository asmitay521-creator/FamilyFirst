import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { tenantService, subscriptionsService, agencyDetailsService, bannersService } from '@api/index';
import { deletionRequestsService } from '@api/deletionRequestsService';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Building2, Image as ImageIcon, Palette, Globe, Phone, Mail, Shield,
  Lock, Save, RefreshCw, Eye, Plus, Trash2, Edit2
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import AgencyDetailModal from '../components/firm-profile/AgencyDetailModal';
import BannerModal from '../components/firm-profile/BannerModal';

/* ─── Schema (maps to fields in the Tenant model) ──────────────────────────── */
const firmSchema = z.object({
  // Basic
  name:          z.string().min(1, 'Agency name is required'),
  phone:         z.string().optional(),
  email:         z.string().email('Invalid email').optional().or(z.literal('')),
  website:       z.string().url('Must be a valid URL').optional().or(z.literal('')),
  address:       z.string().optional(),
  city:          z.string().optional(),
  state:         z.string().optional(),
  pincode:       z.string().optional(),
  // Credentials
  gstNumber:     z.string().optional(),
  panNumber:     z.string().optional(),
  licenseNumber: z.string().optional(),
  // Branding
  logoUrl:       z.string().url('Must be a valid URL').optional().or(z.literal('')),
  agentPhotoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tagline:       z.string().max(120).optional(),
  primaryColor:  z.string().optional(),
  socialMedia:   z.any().optional(),
});
type FirmForm = z.infer<typeof firmSchema>;

/* ─── Live Branding Preview ─────────────────────────────────────────────────── */
function BrandingPreview({
  name, tagline, logoUrl, primaryColor,
}: { name: string; tagline: string; logoUrl: string; primaryColor: string }) {
  return (
    <div className="rounded-3xl border border-gray-200/50 overflow-hidden shadow-2xl shadow-gray-300/30 bg-white ring-1 ring-black/5 transition-all duration-500 hover:shadow-gray-300/50 group relative">
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-1000 z-10 pointer-events-none" />
      {/* Simulated sidebar strip */}
      <div className="flex h-[340px] relative z-0">
        <div className="w-[72px] flex flex-col items-center py-6 gap-5 transition-colors duration-500 relative" style={{ background: primaryColor || '#4f46e5' }}>
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/noise-lines.png')] mix-blend-overlay"></div>
          {logoUrl
            ? <img src={logoUrl} alt="logo" className="w-12 h-12 rounded-xl object-cover bg-white shadow-lg ring-2 ring-white/30 transform group-hover:scale-105 transition-transform duration-500 relative z-10" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
            : <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center ring-1 ring-white/40 backdrop-blur-md shadow-inner relative z-10">
                <Shield className="text-white drop-shadow-md" size={20} />
              </div>
          }
          <div className="space-y-4 mt-6 w-full px-5 relative z-10">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-1.5 rounded-full bg-white/20 w-full overflow-hidden relative">
                <div className="absolute inset-0 bg-white/30 w-1/3 rounded-full animate-[shimmer_2s_infinite]" style={{ animationDelay: `${i * 0.15}s` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-gray-50/30 flex flex-col relative overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-5 border-b border-gray-100 bg-white/80 backdrop-blur-md relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="overflow-hidden pr-3">
                <p className="text-lg font-black text-gray-900 tracking-tight truncate drop-shadow-sm">{name || 'Your Agency Name'}</p>
                {tagline && <p className="text-xs text-gray-500 font-semibold mt-0.5 truncate">{tagline}</p>}
              </div>
              <div className="w-10 h-10 flex-shrink-0 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-md shadow-primary-500/20 transform group-hover:rotate-6 transition-transform duration-500"
                style={{ background: primaryColor || '#4f46e5' }}>
                {name ? name.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
            {/* Fake KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Contacts', 'Policies', 'Claims'].map(l => (
                <div key={l} className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-gray-200">
                  <p className="text-base font-black text-gray-800">12</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 flex-1 space-y-3.5 relative z-10">
            {/* Fake table rows */}
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-11 rounded-xl bg-white border border-gray-100/80 shadow-sm flex items-center px-4 gap-4 transform transition-all duration-500 hover:scale-[1.02]">
                 <div className="w-7 h-7 rounded-lg bg-gray-50 animate-pulse border border-gray-100" />
                 <div className="h-2 w-28 bg-gray-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none z-10" />
          <div className="p-3 text-center relative z-20">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1.5"><Eye size={12}/> Live Preview Mode</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section Card ──────────────────────────────────────────────────────────── */
function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-200/50 shadow-sm overflow-hidden group">
      <div className="flex flex-wrap items-center gap-3.5 px-7 py-5 border-b border-gray-100/80 bg-gradient-to-r from-gray-50/80 to-transparent">
        <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <Icon size={16} className="text-gray-700" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
      </div>
      <div className="p-7 space-y-5">
        {children}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function FirmProfile() {
  const qc       = useQueryClient();
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const isOwner  = user?.role === 'OWNER' || user?.role === 'SUPERADMIN';

  /* ─ Subscription gating ─ */
  const { data: subRes } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => subscriptionsService.current(),
    staleTime: 5 * 60_000,
  });
  const planName           = subRes?.data?.plan?.name || 'Free';
  const isFirmProfileEnabled = user?.role === 'SUPERADMIN'
    || planName === 'Growth' || planName === 'Business' || planName === 'Enterprise';

  /* ─ Fetch tenant ─ */
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenant-current'],
    queryFn:  () => tenantService.getCurrent(),
    enabled:  isOwner && isFirmProfileEnabled,
  });
  const tenant = tenantData?.data ?? tenantData;

  /* ─ Form ─ */
  const form = useForm<FirmForm>({
    resolver: zodResolver(firmSchema),
    values: tenant ? {
      name:          tenant.name          ?? '',
      phone:         tenant.phone         ?? '',
      email:         tenant.email         ?? '',
      website:       tenant.website       ?? '',
      address:       tenant.address       ?? '',
      city:          tenant.city          ?? '',
      state:         tenant.state         ?? '',
      pincode:       tenant.pincode       ?? '',
      gstNumber:     tenant.gstNumber     ?? '',
      panNumber:     tenant.panNumber     ?? '',
      licenseNumber: tenant.licenseNumber ?? '',
      logoUrl:       tenant.logoUrl       ?? '',
      agentPhotoUrl: tenant.agentPhotoUrl ?? '',
      primaryColor:  tenant.primaryColor  ?? '#4f46e5',
      tagline:       tenant.tagline       ?? '',
      socialMedia:   tenant.socialMedia   ?? { linkedin: '', facebook: '', twitter: '', instagram: '' },
    } : undefined,
  });

  /* ─ Live preview state ─ */
  const watchedName    = form.watch('name')    || tenant?.name    || '';
  const watchedTagline = form.watch('tagline') || '';
  const watchedLogoUrl = form.watch('logoUrl') || tenant?.logoUrl || '';
  const watchedPrimaryColor = form.watch('primaryColor') || '#4f46e5';

  /* ─ Mutation ─ */
  const updateTenant = useMutation({
    mutationFn: (body: FirmForm) => tenantService.update(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-current'] });
      toast.success('Firm profile saved');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Save failed'),
  });

  const [activeTab, setActiveTab] = useState<'company' | 'agency' | 'banners'>('company');
  
  // Modal states
  const [agencyModal, setAgencyModal] = useState<{ open: boolean, data?: any }>({ open: false });
  const [bannerModal, setBannerModal] = useState<{ open: boolean, data?: any }>({ open: false });
  const [deleteAgencyTarget, setDeleteAgencyTarget] = useState<any | null>(null);
  const [deleteBannerTarget, setDeleteBannerTarget] = useState<any | null>(null);

  // Agency Details Query
  const { data: agencyRes, refetch: refetchAgency } = useQuery({
    queryKey: ['agency-details'],
    queryFn: () => agencyDetailsService.findAll(),
    enabled: isOwner && isFirmProfileEnabled,
  });
  const agencyDetails = agencyRes?.data ?? [];

  // Banners Query
  const { data: bannersRes, refetch: refetchBanners } = useQuery({
    queryKey: ['banners'],
    queryFn: () => bannersService.findAll(),
    enabled: isOwner && isFirmProfileEnabled,
  });
  const banners = bannersRes?.data ?? [];

  const createAgency = useMutation({
    mutationFn: (body: any) => agencyDetailsService.create(body),
    onSuccess: () => { toast.success('Agency detail added'); refetchAgency(); setAgencyModal({ open: false }); },
    onError: () => toast.error('Failed to add agency detail'),
  });

  const updateAgency = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => agencyDetailsService.update(id, data),
    onSuccess: () => { toast.success('Agency detail updated'); refetchAgency(); setAgencyModal({ open: false }); },
    onError: () => toast.error('Failed to update agency detail'),
  });

  const deleteAgency = useMutation({
    mutationFn: (id: string) => agencyDetailsService.remove(id),
    onSuccess: () => { toast.success('Deleted'); refetchAgency(); },
  });

  const createBanner = useMutation({
    mutationFn: (body: any) => bannersService.create(body),
    onSuccess: () => { toast.success('Banner added'); refetchBanners(); setBannerModal({ open: false }); },
    onError: () => toast.error('Failed to add banner'),
  });

  const updateBanner = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => bannersService.update(id, data),
    onSuccess: () => { toast.success('Banner updated'); refetchBanners(); setBannerModal({ open: false }); },
    onError: () => toast.error('Failed to update banner'),
  });

  const deleteBanner = useMutation({
    mutationFn: (id: string) => bannersService.remove(id),
    onSuccess: () => { toast.success('Deleted'); refetchBanners(); },
  });

  /* ─ Locked overlay (Free/Starter plans) ─ */
  const LockedOverlay = () => (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4">
        <Lock size={28} className="text-pink-400 animate-pulse" />
      </div>
      <h2 className="text-base font-bold text-white mb-2">Firm Profile Locked</h2>
      <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-5">
        Upgrade to the <strong className="text-white">Growth</strong> plan or above to customize your agency branding,
        credentials, and white-label settings.
      </p>
      <button
        onClick={() => navigate('/subscription')}
        className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600
          text-white text-sm font-bold rounded-xl shadow-lg shadow-pink-500/25 transition-all uppercase tracking-wide"
      >
        Upgrade Now
      </button>
    </div>
  );

  if (!isFirmProfileEnabled) return <LockedOverlay />;

  return (
    <div className="space-y-6">
      {/* ── Executive Hero Header Banner ────────────────────────────────────── */}
      <div 
        className="rounded-3xl p-6 shadow-xl relative overflow-hidden text-white border border-[#5B2BA8]/30"
        style={{ background: 'linear-gradient(135deg, #17143F 0%, #24165A 55%, #5B2BA8 100%)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-sm flex items-center gap-1.5">
                <Building2 size={12} className="text-[#A78BFA]" />
                Firm Profile
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Agency Branding &amp; Settings
            </h1>
            <p className="text-xs sm:text-sm text-[#EDE5F0]/90 mt-1 max-w-2xl font-medium">
              Personalize agency branding, manage core credentials, and configure white-label settings.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-gray-100/60 backdrop-blur-md rounded-2xl max-w-fit border border-gray-200/50 shadow-inner">
        {(['company', 'agency', 'banners'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
              activeTab === tab
                ? 'text-white shadow-md scale-100'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 scale-95 hover:scale-100'
            }`}
            style={activeTab === tab ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
          >
            {tab === 'company' && 'Company Profile'}
            {tab === 'agency' && 'Agency Details'}
            {tab === 'banners' && 'App Banners'}
          </button>
        ))}
      </div>

      {activeTab === 'company' && (
        <form onSubmit={form.handleSubmit(d => updateTenant.mutate(d))} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Section icon={Palette} title="Branding">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label">Agency Name *</label>
                  <input {...form.register('name')} className="input" placeholder="e.g. Sharma Insurance Brokers" />
                  {form.formState.errors.name && <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label className="label">Tagline</label>
                  <input {...form.register('tagline')} className="input" placeholder="e.g. Trusted protection for your future" maxLength={120} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label flex flex-wrap items-center gap-1">
                      <ImageIcon size={11} /> Logo URL
                    </label>
                    <input {...form.register('logoUrl')} className="input" placeholder="https://example.com/logo.png" />
                    {form.formState.errors.logoUrl && <p className="text-xs text-red-500 mt-1">{form.formState.errors.logoUrl.message}</p>}
                  </div>
                  <div>
                    <label className="label flex flex-wrap items-center gap-1">
                      <ImageIcon size={11} /> Agent Photo URL
                    </label>
                    <input {...form.register('agentPhotoUrl')} className="input" placeholder="https://example.com/photo.png" />
                    {form.formState.errors.agentPhotoUrl && <p className="text-xs text-red-500 mt-1">{form.formState.errors.agentPhotoUrl.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="label flex flex-wrap items-center gap-2">
                    <Palette size={11} /> Primary Brand Color
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="color" {...form.register('primaryColor')} className="h-9 w-14 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                    <input type="text" {...form.register('primaryColor')} className="input max-w-[120px] font-mono text-sm" placeholder="#4f46e5" />
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={Shield} title="Agency Credentials">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">GSTIN</label>
                  <input {...form.register('gstNumber')} className="input font-mono" placeholder="22AAAAA0000A1Z5" />
                </div>
                <div>
                  <label className="label">PAN Number</label>
                  <input {...form.register('panNumber')} className="input font-mono" placeholder="AAAAA0000A" />
                </div>
                <div className="col-span-2">
                  <label className="label">IRDAI / Broker License Number</label>
                  <input {...form.register('licenseNumber')} className="input font-mono" placeholder="IRDA/DB-000/00/00" />
                </div>
              </div>
            </Section>

            <Section icon={Phone} title="Contact & Address">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Phone</label>
                  <input {...form.register('phone')} className="input" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input {...form.register('email')} type="email" className="input" placeholder="agency@example.com" />
                </div>
                <div className="col-span-2">
                  <label className="label">Website</label>
                  <input {...form.register('website')} className="input" placeholder="https://your-agency.in" />
                </div>
                <div className="col-span-2">
                  <label className="label">Address</label>
                  <textarea {...form.register('address')} className="input" rows={2} placeholder="Street address" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input {...form.register('city')} className="input" placeholder="Mumbai" />
                </div>
                <div>
                  <label className="label">State</label>
                  <input {...form.register('state')} className="input" placeholder="Maharashtra" />
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input {...form.register('pincode')} className="input" placeholder="400001" />
                </div>
              </div>
            </Section>

            <Section icon={Globe} title="Social Media">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['linkedin', 'facebook', 'twitter', 'instagram'].map(label => (
                  <div key={label}>
                    <label className="label capitalize">{label}</label>
                    <input className="input text-sm" {...form.register(`socialMedia.${label}`)} placeholder={`https://${label}.com/`} />
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div className="space-y-4">
            <div className="card p-4 sticky top-4">
              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs font-semibold text-gray-600">
                <Eye size={13} />
                Live Branding Preview
              </div>
              <BrandingPreview
                name={watchedName}
                tagline={watchedTagline}
                logoUrl={watchedLogoUrl}
                primaryColor={watchedPrimaryColor}
              />
            </div>
            <button type="submit" className="w-full btn-primary justify-center" disabled={updateTenant.isPending}>
              {updateTenant.isPending ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Profile</>}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'agency' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-gray-900">Registered Agency Details</h3>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Manage multiple agency codes for commission tracking.</p>
            </div>
            <button className="btn-primary text-xs sm:text-sm font-bold shadow-md shadow-primary-500/20" onClick={() => setAgencyModal({ open: true })}>
              <Plus size={16} className="mr-1" /> Add Detail
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agencyDetails.map((a: any) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200/80 p-5 flex flex-col gap-3 relative group hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100 flex-shrink-0">
                      {a.brokerName?.charAt(0).toUpperCase() || 'B'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 text-base truncate">{a.brokerName || 'Unnamed Broker'}</h4>
                      <p className="text-xs font-medium text-gray-500 mt-0.5 truncate">Code: {a.brokerCode || 'N/A'} • Sub: {a.subBrokerCode || 'N/A'}</p>
                    </div>
                  </div>
                  <button onClick={() => setDeleteAgencyTarget(a)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Agent Details</p>
                    <p className="text-xs font-semibold text-gray-800 truncate">{a.agentName || 'N/A'}</p>
                    <p className="text-xs text-gray-500 truncate">{a.agentCode || 'N/A'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Branch</p>
                    <p className="text-xs font-semibold text-gray-800 truncate">{a.homeBranchName || 'N/A'}</p>
                    <p className="text-xs text-gray-500 truncate">{a.homeBranchCode || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-200/60 mt-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Bank Info</p>
                    <p className="text-xs font-semibold text-gray-800 font-mono truncate">{a.bankAccountNo || 'N/A'} <span className="text-gray-400 font-sans mx-1">•</span> <span className="text-gray-500">IFSC: {a.bankIfsc || 'N/A'}</span></p>
                  </div>
                </div>
                
                <button className="text-xs sm:text-sm text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-100/50 py-2 rounded-xl flex items-center justify-center gap-1.5 mt-1 font-semibold transition-colors w-full" onClick={() => {
                    setAgencyModal({ open: true, data: a });
                }}>
                  <Edit2 size={14} /> Edit Detail
                </button>
              </div>
            ))}
            {agencyDetails.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <Building2 size={32} className="text-gray-300 mb-2" />
                <p className="font-semibold text-gray-500">No agency details added yet.</p>
                <p className="text-xs mt-1">Add your broker codes to start tracking commissions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'banners' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-gray-900">Client App Banners</h3>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Showcase posters and promotions on the client application.</p>
            </div>
            <button className="btn-primary text-xs sm:text-sm font-bold shadow-md shadow-primary-500/20" onClick={() => setBannerModal({ open: true })}>
              <Plus size={16} className="mr-1" /> Add Banner
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {banners.map((b: any) => (
              <div key={b.id} className="bg-white rounded-2xl overflow-hidden group relative border border-gray-200/80 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 ring-1 ring-gray-900/5">
                <div className="relative aspect-video overflow-hidden bg-gray-100">
                  <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent opacity-60" />
                  
                  {/* Action Overlay */}
                  <div className="absolute top-3 right-3 flex flex-wrap items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
                    <button onClick={() => setBannerModal({ open: true, data: b })} className="w-8 h-8 flex items-center justify-center bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-lg backdrop-blur-sm transition-all">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleteBannerTarget(b)} className="w-8 h-8 flex items-center justify-center bg-red-500/90 hover:bg-red-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3">
                     <h4 className="text-sm font-bold text-white drop-shadow-md truncate">{b.title || 'Untitled Banner'}</h4>
                     {b.linkUrl && <p className="text-xs text-white/80 font-medium truncate mt-0.5">{b.linkUrl}</p>}
                  </div>
                </div>
              </div>
            ))}
            {banners.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <ImageIcon size={32} className="text-gray-300 mb-2" />
                <p className="font-semibold text-gray-500">No banners uploaded yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={!!deleteAgencyTarget} onClose={() => setDeleteAgencyTarget(null)} title="Delete Agency Detail" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{deleteAgencyTarget?.brokerName || 'this agency detail'}</strong>?
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteAgencyTarget(null)}>Cancel</button>
          <button
            className="btn-danger"
            disabled={deleteAgency.isPending}
            onClick={async () => {
              const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'OWNER';
              if (isAdmin) {
                await deleteAgency.mutateAsync(deleteAgencyTarget!.id);
              } else {
                const toastId = toast.loading('Submitting delete request to admin...');
                try {
                  await deletionRequestsService.requestDeletion('AgencyDetail', deleteAgencyTarget!.id, `Employee requested deletion of agency detail ${deleteAgencyTarget?.brokerName}`);
                  toast.success('Deletion request submitted to admin successfully!', { id: toastId });
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
                }
              }
              setDeleteAgencyTarget(null);
            }}
          >
            {deleteAgency.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      <Modal open={!!deleteBannerTarget} onClose={() => setDeleteBannerTarget(null)} title="Delete Banner" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{deleteBannerTarget?.title || 'this banner'}</strong>?
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteBannerTarget(null)}>Cancel</button>
          <button
            className="btn-danger"
            disabled={deleteBanner.isPending}
            onClick={async () => {
              const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'OWNER';
              if (isAdmin) {
                await deleteBanner.mutateAsync(deleteBannerTarget!.id);
              } else {
                const toastId = toast.loading('Submitting delete request to admin...');
                try {
                  await deletionRequestsService.requestDeletion('Banner', deleteBannerTarget!.id, `Employee requested deletion of banner ${deleteBannerTarget?.title}`);
                  toast.success('Deletion request submitted to admin successfully!', { id: toastId });
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
                }
              }
              setDeleteBannerTarget(null);
            }}
          >
            {deleteBanner.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* Modals */}
      <AgencyDetailModal
        open={agencyModal.open}
        onClose={() => setAgencyModal({ open: false })}
        initialData={agencyModal.data}
        isSaving={createAgency.isPending || updateAgency.isPending}
        onSave={(data) => {
          if (agencyModal.data) updateAgency.mutate({ id: agencyModal.data.id, data });
          else createAgency.mutate(data);
        }}
      />
      <BannerModal
        open={bannerModal.open}
        onClose={() => setBannerModal({ open: false })}
        initialData={bannerModal.data}
        isSaving={createBanner.isPending || updateBanner.isPending}
        onSave={(data) => {
          if (bannerModal.data) updateBanner.mutate({ id: bannerModal.data.id, data });
          else createBanner.mutate(data);
        }}
      />
    </div>
  );
}
