import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superAdminService } from '@api/superadmin.service';
import { Search, CheckCircle, XCircle, Building2, Users, Shield, ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const editSchema = z.object({
  name:  z.string().min(2, 'Required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

const createSchema = z.object({
  tenantName: z.string().min(2, 'Required'),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Lowercase, numbers & hyphens only'),
  firstName:  z.string().min(1, 'Required'),
  lastName:   z.string().min(1, 'Required'),
  email:      z.string().email('Valid email required'),
  password:   z.string().min(8, 'Min 8 chars').regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Need uppercase + number'),
  phone:      z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

export default function SuperAdminTenants() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget]   = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const openEdit = (t: any) => {
    setEditTarget(t);
    editForm.setValue('name',  t.name);
    editForm.setValue('email', t.email);
    editForm.setValue('phone', t.phone ?? '');
  };

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__saSearchTimer);
    (window as any).__saSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'tenants', page, debouncedSearch],
    queryFn:  () => superAdminService.listTenants({ page, limit: 15, search: debouncedSearch || undefined }),
  });

  const createTenant = useMutation({
    mutationFn: (body: CreateForm) => superAdminService.createTenant(body),
    onSuccess: () => {
      toast.success('Tenant created successfully');
      qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'platform-stats'] });
      setShowCreate(false);
      createForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create tenant'),
  });

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const updateTenant = useMutation({
    mutationFn: (body: EditForm) => superAdminService.updateTenant(editTarget!.id, body),
    onSuccess: () => {
      toast.success('Tenant updated');
      qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      setEditTarget(null);
      editForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update tenant'),
  });

  const deleteTenant = useMutation({
    mutationFn: (tenantId: string) => superAdminService.deleteTenant(tenantId),
    onSuccess: () => {
      toast.success('Tenant deleted');
      qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'platform-stats'] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete tenant'),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ tenantId, isActive }: { tenantId: string; isActive: boolean }) =>
      superAdminService.setTenantStatus(tenantId, isActive),
    onSuccess: (_res, { isActive }) => {
      toast.success(isActive ? 'Tenant activated' : 'Tenant deactivated');
      qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'platform-stats'] });
    },
    onError: () => toast.error('Failed to update tenant status'),
  });

  const tenants  = data?.data  ?? [];
  const meta     = data?.meta;
  const total    = meta?.total ?? 0;
  const totalPgs = meta?.totalPages ?? 1;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} total tenant{total !== 1 ? 's' : ''} on the platform
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              placeholder="Search tenants…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex flex-wrap items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <Plus size={15} /> Create Tenant
          </button>
        </div>
      </div>

      {/* Create Tenant Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Create New Tenant</h2>
              <button onClick={() => { setShowCreate(false); createForm.reset(); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={createForm.handleSubmit(d => createTenant.mutate(d))} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Agency Name *</label>
                  <input {...createForm.register('tenantName')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Demo Insurance Agency" />
                  {createForm.formState.errors.tenantName && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.tenantName.message}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Slug * <span className="font-normal text-gray-400">(unique, lowercase)</span></label>
                  <input {...createForm.register('tenantSlug')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="demo-agency" />
                  {createForm.formState.errors.tenantSlug && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.tenantSlug.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Owner First Name *</label>
                  <input {...createForm.register('firstName')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="John" />
                  {createForm.formState.errors.firstName && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Owner Last Name *</label>
                  <input {...createForm.register('lastName')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Doe" />
                  {createForm.formState.errors.lastName && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.lastName.message}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Owner Email *</label>
                  <input {...createForm.register('email')} type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="owner@agency.com" />
                  {createForm.formState.errors.email && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input {...createForm.register('password')} type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Min 8 chars" />
                  {createForm.formState.errors.password && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.password.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input {...createForm.register('phone')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="+91 9000000000" />
                </div>
              </div>
              <p className="text-xs text-gray-400">A 14-day trial subscription will be auto-assigned.</p>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setShowCreate(false); createForm.reset(); }} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createTenant.isPending} className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60">
                  {createTenant.isPending ? 'Creating…' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Agency</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <Users size={12} className="inline mr-1" />Users
              </th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <Shield size={12} className="inline mr-1" />Policies
              </th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="px-5 py-4">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-40" />
                  No tenants found
                </td>
              </tr>
            )}

            {tenants.map((t: any) => {
              const activeSub = t.subscriptions?.[0];
              return (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.slug}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-gray-700">{t.email}</p>
                    {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-center text-gray-700">{t._count?.users ?? 0}</td>
                  <td className="px-5 py-3.5 text-center text-gray-700">{t._count?.policies ?? 0}</td>
                  <td className="px-5 py-3.5 text-center">
                    {activeSub?.plan
                      ? <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium">{activeSub.plan.name}</span>
                      : <span className="text-xs text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                      t.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600',
                    )}>
                      {t.isActive
                        ? <><CheckCircle size={11} />Active</>
                        : <><XCircle size={11} />Inactive</>
                      }
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        title="Edit tenant"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        title="Delete tenant"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => toggleStatus.mutate({ tenantId: t.id, isActive: !t.isActive })}
                        disabled={toggleStatus.isPending}
                        className={clsx(
                          'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                          t.isActive
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50',
                        )}
                      >
                        {t.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Tenant Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Edit Tenant</h2>
              <button onClick={() => { setEditTarget(null); editForm.reset(); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={editForm.handleSubmit(d => updateTenant.mutate(d))} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Agency Name *</label>
                <input {...editForm.register('name')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {editForm.formState.errors.name && <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email *</label>
                <input {...editForm.register('email')} type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {editForm.formState.errors.email && <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input {...editForm.register('phone')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="+91 9000000000" />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setEditTarget(null); editForm.reset(); }} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={updateTenant.isPending} className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60">
                  {updateTenant.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Tenant Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Delete Tenant</h2>
              <p className="text-sm text-gray-600 mb-1">
                Permanently delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                This will irreversibly remove all users, policies, contacts, claims, and data for this agency.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 px-6 pb-5">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteTenant.mutate(deleteTarget.id)}
                disabled={deleteTenant.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleteTenant.isPending ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPgs > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-gray-500">
            Page {page} of {totalPgs} · {total} tenants
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex flex-wrap items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPgs, p + 1))}
              disabled={page === totalPgs}
              className="flex flex-wrap items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
