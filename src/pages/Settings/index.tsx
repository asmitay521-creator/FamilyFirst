import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { authService } from '@api/auth.service';
import { tenantService, subscriptionsService } from '@api/index';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const pwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Must contain uppercase + number'),
});
type PwForm = z.infer<typeof pwSchema>;

const tenantSchema = z.object({
  name: z.string().min(1, 'Required'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  licenseNumber: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});
type TenantForm = z.infer<typeof tenantSchema>;

export default function Settings() {
  const user = useAuthStore(s => s.user);
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPERADMIN';
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwForm>({ resolver: zodResolver(pwSchema) });

  // Subscription checking
  const { data: subRes } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => subscriptionsService.current(),
    staleTime: 5 * 60_000,
  });
  const planName = subRes?.data?.plan?.name || 'Free';
  const isFirmProfileEnabled = user?.role === 'SUPERADMIN' || planName === 'Growth' || planName === 'Business' || planName === 'Enterprise';

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: () => tenantService.getCurrent(),
    enabled: isOwner && isFirmProfileEnabled,
  });
  const tenant = tenantData?.data ?? tenantData;

  const tenantForm = useForm<TenantForm>({
    resolver: zodResolver(tenantSchema),
    values: tenant ? {
      name: tenant.name ?? '',
      gstin: tenant.gstin ?? '',
      pan: tenant.pan ?? '',
      licenseNumber: tenant.licenseNumber ?? '',
      address: tenant.address ?? '',
      logoUrl: tenant.logoUrl ?? '',
    } : undefined,
  });

  const updateTenant = useMutation({
    mutationFn: (body: TenantForm) => tenantService.update(body),
    onSuccess: () => toast.success('Tenant profile updated'),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

  const onSubmit = async (data: PwForm) => {
    setLoading(true);
    try {
      await authService.changePassword(data);
      toast.success('Password changed successfully');
      reset();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">Manage your profile, change credentials, and configure agency configurations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Profile & Tenant info */}
        <div className="space-y-6 lg:col-span-1">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-md shadow-blue-500/20 relative group">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
              <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-md bg-slate-800 text-[8px] font-extrabold text-white uppercase tracking-wider shadow-sm">
                {user?.role}
              </span>
            </div>
            
            <div className="mt-5 space-y-1">
              <h3 className="text-sm font-bold text-slate-800">{user?.firstName} {user?.lastName}</h3>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>

            <div className="w-full h-px bg-slate-100 my-5" />

            <div className="w-full text-left space-y-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Tenant ID</span>
                <code className="text-xs font-semibold font-mono text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 block truncate select-all" title={user?.tenantId}>
                  {user?.tenantId}
                </code>
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Current Plan</span>
                <span className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/50 text-blue-600 border border-blue-100/30 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  {planName} Plan
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Change Password & Agency Settings */}
        <div className="space-y-6 lg:col-span-2">
          {/* Change Password */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">Change Password</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input
                  {...register('currentPassword')}
                  type="password"
                  className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                  placeholder="Enter current password"
                />
                {errors.currentPassword && <p className="text-[10px] text-red-500 font-semibold mt-1">{errors.currentPassword.message}</p>}
              </div>
              <div>
                <label className="label">New Password</label>
                <input
                  {...register('newPassword')}
                  type="password"
                  className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                  placeholder="At least 8 chars with uppercase + number"
                />
                {errors.newPassword && <p className="text-[10px] text-red-500 font-semibold mt-1">{errors.newPassword.message}</p>}
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-500/10"
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Tenant Profile (OWNER only) */}
          {isOwner && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
              {!isFirmProfileEnabled && (
                <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[3px] z-10 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-1.5">Firm Profile Locked</h4>
                  <p className="text-[10.5px] text-slate-300 max-w-sm leading-relaxed mb-4">Upgrade to the Growth plan or above to customize your agency branding, GSTIN, PAN, and license details.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/subscription')}
                    className="pointer-events-auto px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-[10px] font-extrabold rounded-xl shadow-lg shadow-pink-500/20 transition-transform active:scale-95 uppercase tracking-wider"
                  >
                    Upgrade Now
                  </button>
                </div>
              )}
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">Tenant / Agency Profile</h3>
              <form onSubmit={tenantForm.handleSubmit(d => updateTenant.mutate(d))} className="space-y-4">
                <div>
                  <label className="label">Agency Name *</label>
                  <input
                    {...tenantForm.register('name')}
                    className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                    placeholder="e.g. Sharma Insurance Brokers"
                  />
                  {tenantForm.formState.errors.name && <p className="text-[10px] text-red-500 font-semibold mt-1">{tenantForm.formState.errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">GSTIN</label>
                    <input
                      {...tenantForm.register('gstin')}
                      className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="label">PAN</label>
                    <input
                      {...tenantForm.register('pan')}
                      className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                      placeholder="AAAAA0000A"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">IRDAI / License Number</label>
                  <input
                    {...tenantForm.register('licenseNumber')}
                    className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                    placeholder="Enter license details"
                  />
                </div>
                <div>
                  <label className="label">Address</label>
                  <textarea
                    {...tenantForm.register('address')}
                    className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                    placeholder="Enter full physical address"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="label">Logo URL</label>
                  <input
                    {...tenantForm.register('logoUrl')}
                    className="input focus:ring-4 focus:ring-blue-500/5 transition-all duration-200"
                    placeholder="https://..."
                  />
                  {tenantForm.formState.errors.logoUrl && <p className="text-[10px] text-red-500 font-semibold mt-1">{tenantForm.formState.errors.logoUrl.message}</p>}
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updateTenant.isPending}
                    className="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-500/10"
                  >
                    {updateTenant.isPending ? 'Saving…' : 'Save Tenant Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

