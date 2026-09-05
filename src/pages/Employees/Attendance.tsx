import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';

const todayStr = format(new Date(), 'yyyy-MM-dd');

export default function EmployeeAttendance() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

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
      if (key === 'isActive') {
        const log = row.user?.dailyLogs?.[0];
        return log?.checkIn ? 1 : -1;
      }
      return row[key];
    });
  }, [allEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  const cols: Column<Employee>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE',
      render: r => (
        <span className="font-medium text-gray-900">{r.firstName} {r.lastName}</span>
      ),
    },
    {
      key: 'user' as any,
      label: 'DATE',
      render: () => (
        <span className="text-blue-500 font-medium text-sm">{todayStr}</span>
      ),
    },
    {
      key: 'user' as any,
      label: 'ATTENDANCE IN',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return log?.checkIn
          ? <span className="text-gray-700 text-sm">{format(new Date(log.checkIn), 'hh:mm a')}</span>
          : <span className="text-gray-400 text-sm">–</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'ATTENDANCE OUT',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        if (log?.checkOut) {
          return <span className="text-gray-700 text-sm">{format(new Date(log.checkOut), 'hh:mm a')}</span>;
        }
        if (log?.checkIn) {
          return <span className="text-xs text-orange-500 font-semibold">Active</span>;
        }
        return <span className="text-gray-400 text-sm">–</span>;
      },
    },
    {
      key: 'isActive' as any,
      label: 'STATUS',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        const present = !!log?.checkIn;
        return (
          <span className={clsx(
            'px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider',
            present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          )}>
            {present ? 'PRESENT' : 'ABSENT'}
          </span>
        );
      },
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center justify-start" onClick={e => e.stopPropagation()}>
          <button
            title="Edit / View Employee"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => navigate(`/employees/${r.id}`)}
          >
            <Pencil size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <h3 className="text-base font-bold text-gray-800 mb-3">Today's Attendance</h3>
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
    </>
  );
}
