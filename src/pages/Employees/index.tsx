import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';

import { useAuthStore } from '@store/auth.store';
import { canEditModule, canManageModule } from '../../utils/permissions';

const editSchema = z.object({
  firstName:         z.string().min(1, 'Required'),
  lastName:          z.string().min(1, 'Required'),
  phone:             z.string().min(1, 'Phone is required').regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  designation:       z.string().optional(),
  department:        z.string().optional(),
  dateOfJoining:     z.string().or(z.literal('')).optional(),
  dateOfBirth:       z.string().or(z.literal('')).optional(),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER']).or(z.literal('')).optional(),
  baseSalary:        z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  bonusPlanned:      z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  monthlyTarget:     z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  callsTarget:       z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  visitsTarget:      z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode:      z.string().optional(),
  bankBranch:        z.string().optional(),
  bankAccountType:   z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function Employees() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canEditEmployees = canEditModule(user, 'employees');
  const canManageEmployees = canManageModule(user, 'employees');

  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget]         = useState<Employee | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
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
      if (key === 'isActive') return row.isActive ? 1 : -1;
      
      const parts = key.split('.');
      let val = row;
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      return val !== undefined ? val : row[key];
    });
  }, [allEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  const { register: regEdit, handleSubmit: handleEditSubmit, reset: resetEdit,
          setValue: setEditVal, formState: { errors: editErrors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => employeesService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated');
      setEditTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update employee'),
  });

  const deactivateEmployee = useMutation({
    mutationFn: (id: string) => employeesService.deactivate(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res?.data?.message ?? (deactivateTarget?.isActive ? 'Employee deactivated' : 'Employee activated'));
      setDeactivateTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update employee status'),
  });

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setEditVal('firstName',         emp.firstName);
    setEditVal('lastName',          emp.lastName);
    setEditVal('phone',             emp.phone ?? '');
    setEditVal('designation',       emp.designation ?? '');
    setEditVal('department',        emp.department ?? '');
    setEditVal('dateOfJoining',     emp.dateOfJoining ? emp.dateOfJoining.slice(0, 10) : '');
    setEditVal('dateOfBirth',       emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : '');
    setEditVal('gender',            emp.gender as any ?? undefined);
    setEditVal('baseSalary',        emp.baseSalary as any);
    setEditVal('bonusPlanned',       emp.bonusPlanned as any);
    setEditVal('monthlyTarget',     emp.monthlyTarget as any);
    setEditVal('callsTarget',       emp.callsTarget as any);
    setEditVal('visitsTarget',      emp.visitsTarget as any);
    setEditVal('bankName',          emp.bankName ?? '');
    setEditVal('bankAccountNumber', emp.bankAccountNumber ?? '');
    setEditVal('bankIfscCode',      emp.bankIfscCode ?? '');
    setEditVal('bankBranch',        emp.bankBranch ?? '');
    setEditVal('bankAccountType',   emp.bankAccountType ?? '');
  };

  const cols: Column<Employee>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE ▲',
      render: r => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{r.firstName} {r.lastName}</span>
          <span className="text-[11px] text-gray-400 font-medium">ID: {r.id.length > 6 ? r.id.slice(-3) : r.id}</span>
        </div>
      ),
    },
    {
      key: 'designation',
      label: 'ROLE',
      render: r => <span className="text-sm font-medium text-gray-700">{r.designation || r.user?.role || 'Agent'}</span>,
    },
    {
      key: 'isActive',
      label: 'STATUS',
      render: r => (
        <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase',
          r.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {r.isActive ? 'ACTIVE' : 'DEACTIVE'}
        </span>
      ),
    },
    {
      key: 'phone',
      label: 'CONTACT',
      render: r => (
        <div className="flex flex-col text-sm text-gray-600">
          <span>{r.phone ?? '—'}</span>
          <span className="text-xs text-gray-400">{r.user?.email ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center gap-1.5 whitespace-nowrap min-w-[100px] justify-start" onClick={e => e.stopPropagation()}>
          {canEditEmployees && (
            <button
              title="Edit Employee"
              className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
              onClick={() => openEdit(r)}
            >
              <Pencil size={14} />
            </button>
          )}
          {canManageEmployees && (
            <button
              title={r.isActive ? "Deactivate Employee" : "Activate Employee"}
              className={clsx(
                "p-2 rounded-xl text-white font-bold flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105",
                r.isActive
                  ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/20"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20"
              )}
              onClick={() => setDeactivateTarget(r)}
            >
              {r.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
            </button>
          )}
          {!canEditEmployees && !canManageEmployees && (
            <span className="text-xs text-slate-400 italic">View Only</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={cols.map(c => ({ ...c, sortable: c.key !== 'actions' }))}
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

      {/* Edit Modal */}
      <Modal open={!!editTarget} onClose={() => { setEditTarget(null); resetEdit(); }} title="Edit Employee" size="xl">
        <form onSubmit={handleEditSubmit(body => updateEmployee.mutateAsync({ id: editTarget!.id, body }))} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">First Name *</label>
              <input {...regEdit('firstName')} className="input" />
              {editErrors.firstName && <p className="text-xs text-red-500 mt-1">{editErrors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input {...regEdit('lastName')} className="input" />
              {editErrors.lastName && <p className="text-xs text-red-500 mt-1">{editErrors.lastName.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input bg-gray-50 text-gray-500 cursor-not-allowed" value={editTarget?.user?.email ?? ''} disabled readOnly />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input
                {...regEdit('phone', {
                  onChange: (e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setEditVal('phone', digits);
                  }
                })}
                type="tel"
                className="input"
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
              />
              {editErrors.phone && <p className="text-xs text-red-500 mt-1">{editErrors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Designation</label>
              <input {...regEdit('designation')} className="input" />
            </div>
            <div>
              <label className="label">Department</label>
              <input {...regEdit('department')} className="input" />
            </div>
            <div>
              <label className="label">Gender</label>
              <select {...regEdit('gender')} className="input">
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Joining</label>
              <DatePicker {...regEdit('dateOfJoining')} className="input" />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <DatePicker {...regEdit('dateOfBirth')} className="input" />
            </div>
            <div>
              <label className="label">Base Salary (₹)</label>
              <input {...regEdit('baseSalary')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Bonus Planned (₹)</label>
              <input {...regEdit('bonusPlanned')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Monthly Sales Target (₹)</label>
              <input {...regEdit('monthlyTarget')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Daily Calls Target</label>
              <input {...regEdit('callsTarget')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Daily Visits Target</label>
              <input {...regEdit('visitsTarget')} type="number" className="input" />
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Details</h3>
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input {...regEdit('bankName')} className="input text-xs" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input {...regEdit('bankAccountNumber')} className="input text-xs" />
              </div>
              <div>
                <label className="label">IFSC Code</label>
                <input {...regEdit('bankIfscCode')} className="input text-xs" />
              </div>
              <div>
                <label className="label">Branch Name</label>
                <input {...regEdit('bankBranch')} className="input text-xs" />
              </div>
              <div>
                <label className="label">Account Type</label>
                <select {...regEdit('bankAccountType')} className="input text-xs">
                  <option value="">Select type</option>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setEditTarget(null); resetEdit(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Deactivate / Activate Confirm Modal */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title={deactivateTarget?.isActive ? "Deactivate Employee" : "Activate Employee"} size="sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={clsx("w-5 h-5 flex-shrink-0 mt-0.5", deactivateTarget?.isActive ? "text-red-500" : "text-green-500")} />
          <p className="text-sm text-gray-600">
            {deactivateTarget?.isActive ? (
              <>Deactivate <strong>{deactivateTarget?.firstName} {deactivateTarget?.lastName}</strong>? They will lose access to login.</>
            ) : (
              <>Activate <strong>{deactivateTarget?.firstName} {deactivateTarget?.lastName}</strong>? They will regain access to login.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeactivateTarget(null)}>Cancel</button>
          <button
            className={deactivateTarget?.isActive ? "btn-danger" : "btn-primary"}
            disabled={deactivateEmployee.isPending}
            onClick={() => deactivateEmployee.mutate(deactivateTarget!.id)}
          >
            {deactivateEmployee.isPending
              ? (deactivateTarget?.isActive ? 'Deactivating…' : 'Activating…')
              : (deactivateTarget?.isActive ? 'Deactivate' : 'Activate')}
          </button>
        </div>
      </Modal>
    </>
  );
}
