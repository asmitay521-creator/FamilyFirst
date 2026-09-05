import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';

const MODULES = [
  { key: 'dashboard',         label: 'Dashboard' },
  { key: 'workspace',         label: 'Workspace' },
  { key: 'contacts',          label: 'Contacts' },
  { key: 'leads',             label: 'Leads Pipeline' },
  { key: 'policies',          label: 'Policies' },
  { key: 'claims',            label: 'Claims' },
  { key: 'calendar',          label: 'Calendar' },
  { key: 'whatsapp',          label: 'WhatsApp' },
  { key: 'operations',        label: 'Operations' },
  { key: 'commissions',       label: 'Commissions' },
  { key: 'employees',         label: 'Employees' },
  { key: 'deletion_requests', label: 'Delete Requests' },
  { key: 'subscription',      label: 'Subscription' },
  { key: 'firm_profile',      label: 'Firm Profile' },
];

const permissionSchema = z.object({
  role:        z.enum(['OWNER', 'EMPLOYEE', 'CONTACT']),
  permissions: z.array(z.string()),
});
type PermissionForm = z.infer<typeof permissionSchema>;

export default function EmployeeAccessControl() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [permEditEmp, setPermEditEmp] = useState<Employee | null>(null);
  const qc = useQueryClient();

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });

  const allEmployees = data?.data ?? data ?? [];
  const sortedEmployees = React.useMemo(() => {
    return sortData(Array.isArray(allEmployees) ? allEmployees : [], sortKey, sortDir, (row: any, key: string) => {
      if (key === 'firstName') return `${row.firstName} ${row.lastName}`;
      if (key === 'user') return row.user?.role || 'EMPLOYEE';
      return row[key];
    });
  }, [allEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  const { register, handleSubmit, setValue } = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
  });

  const updatePermissions = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PermissionForm }) =>
      employeesService.updateRole(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Permissions updated successfully');
      setPermEditEmp(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update permissions'),
  });

  const openPermEdit = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setPermEditEmp(emp);
    setValue('role', emp.user?.role as any ?? 'EMPLOYEE');
    setValue('permissions', emp.user?.permissions ?? []);
  };

  const cols: Column<Employee>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE',
      render: r => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{r.firstName} {r.lastName}</span>
          <span className="text-[11px] text-gray-400 font-medium">ID: {r.id.length > 6 ? r.id.slice(-3) : r.id}</span>
        </div>
      ),
    },
    {
      key: 'user' as any,
      label: 'SYSTEM ROLE',
      render: r => (
        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-xs font-bold uppercase">
          {r.user?.role || 'EMPLOYEE'}
        </span>
      ),
    },
    {
      key: 'permissions' as any,
      label: 'MODULE PERMISSIONS',
      render: r => {
        if (r.user?.role === 'OWNER') {
          return <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded border border-primary-100">Full Access (Owner)</span>;
        }
        const perms = r.user?.permissions ?? [];
        if (perms.length === 0) {
          return <span className="text-xs text-gray-400 italic">No modules enabled</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-md">
            {perms.map(p => {
              let label = p;
              let badgeStyle = "bg-slate-50 border-slate-200 text-slate-600";
              const matchModule = MODULES.find(m => p.includes(m.key));
              if (matchModule) {
                if (p.startsWith('view_')) {
                  label = `${matchModule.label} (View)`;
                  badgeStyle = "bg-emerald-50 border-emerald-200/80 text-emerald-700 font-bold";
                } else if (p.startsWith('edit_')) {
                  label = `${matchModule.label} (Edit)`;
                  badgeStyle = "bg-purple-50 border-purple-200/80 text-purple-700 font-bold";
                } else if (p.startsWith('manage_') || p.startsWith('all_')) {
                  label = `${matchModule.label} (All Data)`;
                  badgeStyle = "bg-blue-50 border-blue-200/80 text-blue-700 font-bold";
                }
              }
              return (
                <span key={p} className={`text-[10px] border px-2 py-0.5 rounded-lg shadow-2xs ${badgeStyle}`}>
                  {label}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center justify-start" onClick={e => e.stopPropagation()}>
          <button
            title="Edit Permissions"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={e => openPermEdit(r, e)}
          >
            <Key size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={cols.map(c => ({ ...c, sortable: c.key !== 'actions' && c.key !== 'permissions' }))}
        data={paginatedEmployees}
        total={sortedEmployees.length}
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
        onRowClick={r => navigate(`/employees/${r.id}`)}
      />

      {/* Permission Edit Modal */}
      <Modal
        open={!!permEditEmp}
        onClose={() => setPermEditEmp(null)}
        title="Manage Access Control"
        size="md"
      >
        {permEditEmp && (
          <form
            onSubmit={handleSubmit(body => updatePermissions.mutate({ id: permEditEmp.id, body }))}
            className="space-y-4"
          >
            <div className="text-xs text-slate-500 mb-2 font-medium">
              Updating system role and permissions for <strong className="text-slate-800">{permEditEmp.firstName} {permEditEmp.lastName}</strong>.
            </div>
            <div>
              <label className="label">System Role *</label>
              <select {...register('role')} className="input">
                <option value="EMPLOYEE">Employee / Agent</option>
                <option value="OWNER">Agency Owner / Super Admin</option>
              </select>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1 border-t border-slate-100 pt-3">
              <label className="label font-bold text-slate-700 block mb-1">
                Module Access Control Permissions
              </label>
              {MODULES.map(mod => {
                const viewKey = `view_${mod.key}`;
                const editKey = `edit_${mod.key}`;
                const allKey  = `manage_${mod.key}`;

                return (
                  <div key={mod.key} className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-2">
                    <div className="text-[13px] font-black text-slate-900 tracking-tight">{mod.label}</div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex flex-wrap items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900 select-none bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-200/60 font-semibold">
                        <input
                          type="checkbox"
                          value={viewKey}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                          {...register('permissions')}
                        />
                        <span className="text-emerald-800">View</span>
                      </label>
                      <label className="flex flex-wrap items-center gap-1.5 cursor-pointer text-purple-800 select-none bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200/80 font-bold">
                        <input
                          type="checkbox"
                          value={editKey}
                          className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                          {...register('permissions')}
                        />
                        <span>Edit</span>
                      </label>
                      <label className="flex flex-wrap items-center gap-1.5 cursor-pointer text-blue-800 select-none bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/80 font-bold">
                        <input
                          type="checkbox"
                          value={allKey}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                          {...register('permissions')}
                        />
                        <span>All Data (Owner Access)</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setPermEditEmp(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={updatePermissions.isPending}>
                {updatePermissions.isPending ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
