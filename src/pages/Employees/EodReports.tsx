import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Download, Eye } from 'lucide-react';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import * as XLSX from 'xlsx';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';

export default function EmployeeEodReports() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [nextDayPlan, setNextDayPlan] = useState('');
  const [notes, setNotes] = useState('');

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

  useEffect(() => {
    const log = editTarget?.user?.dailyLogs?.[0];
    setNextDayPlan(log?.nextDayPlan ?? '');
    setNotes(log?.notes ?? log?.adminRemarks ?? '');
  }, [editTarget]);

  const saveLog = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => employeesService.dailyLog(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['employees'] });
      setEditTarget(null);
    },
  });

  const handleExportSingleReport = (r: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    const log = r.user?.dailyLogs?.[0];
    const reportData = [
      {
        'Employee ID': r.id,
        'Employee Name': `${r.firstName} ${r.lastName}`,
        'Designation': r.designation || r.user?.role || 'Agent',
        'Department': r.department || '—',
        'Phone': r.phone || '—',
        'Email': r.user?.email || '—',
        'Calls Made': log?.callsMade ?? 0,
        'Meetings Done': log?.visitsCompleted ?? 0,
        'Premium Collected (₹)': log?.premiumCollected ?? 0,
        'Next Day Plan': log?.nextDayPlan || '—',
        'Notes / Remarks': log?.notes || '—',
        'Admin Remarks': log?.adminRemarks || '—',
        'Export Date': new Date().toLocaleDateString('en-IN'),
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'EOD Report');
    XLSX.writeFile(workbook, `${r.firstName}_${r.lastName}_Report.xlsx`);
  };

  const handleExportAllReports = () => {
    if (!data?.data || data.data.length === 0) return;
    const reportData = data.data.map((r: Employee) => {
      const log = r.user?.dailyLogs?.[0];
      return {
        'Employee ID': r.id,
        'Employee Name': `${r.firstName} ${r.lastName}`,
        'Designation': r.designation || r.user?.role || 'Agent',
        'Department': r.department || '—',
        'Phone': r.phone || '—',
        'Email': r.user?.email || '—',
        'Calls Made': log?.callsMade ?? 0,
        'Meetings Done': log?.visitsCompleted ?? 0,
        'Premium Collected (₹)': log?.premiumCollected ?? 0,
        'Next Day Plan': log?.nextDayPlan || '—',
        'Notes / Remarks': log?.notes || '—',
        'Admin Remarks': log?.adminRemarks || '—',
        'Export Date': new Date().toLocaleDateString('en-IN'),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Reports');
    XLSX.writeFile(workbook, `Employee_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      label: 'CALLS MADE',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-sm font-semibold text-slate-700">{log?.callsMade ?? 0}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'MEETINGS DONE',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-sm font-semibold text-slate-700">{log?.visitsCompleted ?? 0}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'PREMIUM COLLECTED',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return (
          <span className="text-sm font-semibold text-green-600">
            ₹{Number(log?.premiumCollected ?? 0).toLocaleString('en-IN')}
          </span>
        );
      },
    },
    {
      key: 'user' as any,
      label: 'NEXT DAY PLAN',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-xs text-slate-600 max-w-xs truncate block" title={log?.nextDayPlan || undefined}>{log?.nextDayPlan || '—'}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'NOTES / REMARKS',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-xs text-slate-600 max-w-xs truncate block" title={log?.notes || undefined}>{log?.notes || '—'}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'ADMIN REMARKS',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-xs text-orange-600 max-w-xs truncate block" title={log?.adminRemarks || undefined}>{log?.adminRemarks || '—'}</span>;
      },
    },
    {
      key: 'actions' as any,
      label: 'ACTION',
      render: r => (
        <div className="flex items-center gap-1.5 whitespace-nowrap min-w-[120px]" onClick={e => e.stopPropagation()}>
          <button
            title="Add / Edit EOD"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => setEditTarget(r)}
          >
            <Pencil size={14} />
          </button>
          <button
            title="View Employee"
            className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => navigate(`/employees/${r.id}`)}
          >
            <Eye size={14} />
          </button>
          <button
            title="Export Report"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={e => handleExportSingleReport(r, e)}
          >
            <Download size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end items-center">
        <button
          type="button"
          onClick={handleExportAllReports}
          className="btn-secondary h-8 py-0 px-3 text-[10px] sm:text-xs flex flex-wrap items-center gap-1.5 font-bold cursor-pointer hover:bg-slate-100"
          title="Export all employee reports to Excel"
        >
          <Download size={13} /> Export All Reports
        </button>
      </div>
      <DataTable
        columns={cols.map(c => ({ ...c, sortable: c.key !== 'actions' && c.key !== 'user' }))}
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

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `EOD Update - ${editTarget.firstName} ${editTarget.lastName}` : 'EOD Update'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">NEXT DAY PLAN</label>
            <textarea
              value={nextDayPlan}
              onChange={e => setNextDayPlan(e.target.value)}
              rows={4}
              className="input w-full"
              placeholder="Plan for tomorrow..."
            />
          </div>

          <div>
            <label className="label">NOTES / REMARKS</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="input w-full"
              placeholder="Additional notes or remarks..."
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!editTarget || saveLog.isPending}
              onClick={() => {
                if (!editTarget) return;
                saveLog.mutate({
                  id: editTarget.id,
                  body: {
                    date: new Date().toISOString(),
                    nextDayPlan,
                    notes,
                  },
                });
              }}
            >
              {saveLog.isPending ? 'Saving...' : 'Save EOD'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
