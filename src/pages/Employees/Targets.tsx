import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target } from 'lucide-react';
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

const targetSchema = z.object({
  monthlyTarget: z.coerce.number().min(0),
  callsTarget:   z.coerce.number().min(0),
  visitsTarget:  z.coerce.number().min(0),
});
type TargetForm = z.infer<typeof targetSchema>;

export default function EmployeeTargets() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [targetEditEmp, setTargetEditEmp] = useState<Employee | null>(null);
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
      return row[key];
    });
  }, [allEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  const { register, handleSubmit, setValue } = useForm<TargetForm>({
    resolver: zodResolver(targetSchema),
  });

  const updateTargets = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TargetForm }) =>
      employeesService.updateEmployeeProfile(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Targets updated successfully');
      setTargetEditEmp(null);
    },
    onError: () => toast.error('Failed to update targets'),
  });

  const openTargetEdit = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetEditEmp(emp);
    setValue('monthlyTarget', emp.monthlyTarget ?? 0);
    setValue('callsTarget',   emp.callsTarget   ?? 0);
    setValue('visitsTarget',  emp.visitsTarget  ?? 0);
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
      key: 'monthlyTarget',
      label: 'MONTHLY SALES TARGET',
      render: r => (
        <span className="text-sm font-semibold text-slate-700">
          {r.monthlyTarget != null ? `₹${Number(r.monthlyTarget).toLocaleString('en-IN')}` : '—'}
        </span>
      ),
    },
    {
      key: 'callsTarget',
      label: 'DAILY CALLS TARGET',
      render: r => <span className="text-sm font-medium text-slate-600">{r.callsTarget ?? '—'} calls</span>,
    },
    {
      key: 'visitsTarget',
      label: 'PROPOSAL TARGET',
      render: r => <span className="text-sm font-medium text-slate-600">{r.visitsTarget ?? '—'} proposals</span>,
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center justify-start" onClick={e => e.stopPropagation()}>
          <button
            title="Edit Targets"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={e => openTargetEdit(r, e)}
          >
            <Target size={14} />
          </button>
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

      {/* Target Edit Modal */}
      <Modal
        open={!!targetEditEmp}
        onClose={() => setTargetEditEmp(null)}
        title={targetEditEmp ? `Edit Targets: ${targetEditEmp.firstName} ${targetEditEmp.lastName}` : 'Edit Targets'}
        size="sm"
      >
        {targetEditEmp && (
          <form
            onSubmit={handleSubmit(body => updateTargets.mutate({ id: targetEditEmp.id, body }))}
            className="space-y-5"
          >
            <div>
              <label className="label">Monthly Sales Target (₹)</label>
              <input {...register('monthlyTarget')} type="number" className="input" placeholder="e.g. 100000" />
            </div>
            <div>
              <label className="label">Daily Calls Target</label>
              <input {...register('callsTarget')} type="number" className="input" placeholder="e.g. 50" />
            </div>
            <div>
              <label className="label">Proposal Target</label>
              <input {...register('visitsTarget')} type="number" className="input" placeholder="e.g. 5" />
            </div>
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-50">
              <button type="button" className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors" onClick={() => setTargetEditEmp(null)}>Cancel</button>
              <button type="submit" className="px-6 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-lg shadow-sm transition-colors" disabled={updateTargets.isPending}>
                {updateTargets.isPending ? 'Saving…' : 'Save Targets'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
