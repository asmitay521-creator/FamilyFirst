import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import { ArrowLeft, CheckSquare, BookOpen, Plus, Check, Clock, Shield, Target, Key, Calendar, Pencil } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import { useAuthStore } from '@store/auth.store';

const taskSchema = z.object({
  title:       z.string().min(1, 'Required'),
  description: z.string().optional(),
  dueDate:     z.string().optional(),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});
type TaskForm = z.infer<typeof taskSchema>;

const logSchema = z.object({
  date:     z.string().min(1, 'Required'),
  callsMade: z.coerce.number().min(0).optional(),
  meetingsDone: z.coerce.number().min(0).optional(),
  leadsGenerated: z.coerce.number().min(0).optional(),
  policiesSold: z.coerce.number().min(0).optional(),
  premiumCollected: z.coerce.number().min(0).optional(),
  notes:    z.string().optional(),
  checkIn:  z.string().optional(),
  checkOut: z.string().optional(),
  adminRemarks: z.string().optional(),
});
type LogForm = z.infer<typeof logSchema>;

const targetSchema = z.object({
  monthlyTarget: z.coerce.number().min(0),
  callsTarget:   z.coerce.number().min(0),
  visitsTarget:  z.coerce.number().min(0),
  bonusPlanned:  z.coerce.number().min(0).optional(),
});
type TargetForm = z.infer<typeof targetSchema>;

const permissionSchema = z.object({
  role:        z.enum(['OWNER', 'EMPLOYEE', 'CONTACT']),
  permissions: z.array(z.string()),
});
type PermissionForm = z.infer<typeof permissionSchema>;

const PRIORITY_BADGE: Record<string, string> = {
  LOW:    'bg-gray-100 text-gray-500',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH:   'bg-red-100 text-red-700',
};

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

const formatPreview = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MMM/yyyy');
  } catch {
    return '';
  }
};

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const isOwner = currentUser?.role === 'OWNER';

  const [taskModal, setTaskModal]   = useState(false);
  const [logModal, setLogModal]     = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [targetModal, setTargetModal] = useState(false);
  const [permModal, setPermModal]   = useState(false);
  const [activeTab, setActiveTab]   = useState<'tasks' | 'log'>('tasks');

  // Logs filters — default to current month so logs are visible immediately
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate]     = useState(today);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesService.getEmployeeDetail(id!),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['employee-stats', id],
    queryFn: () => employeesService.stats(id!),
    enabled: !!id,
  });

  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['employee-tasks', id],
    queryFn: () => employeesService.tasks(id!),
    enabled: !!id,
  });

  const { data: logsRes, refetch: refetchLogs } = useQuery({
    queryKey: ['employee-logs', id, startDate, endDate],
    queryFn: () => employeesService.getEmployeeLogs(id!, { startDate: startDate || undefined, endDate: endDate || undefined }),
    enabled: !!id,
  });

  const taskForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'MEDIUM', dueDate: '' },
  });
  const watchDueDate = taskForm.watch('dueDate');

  const logForm = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
  });

  const targetForm = useForm<TargetForm>({
    resolver: zodResolver(targetSchema),
  });

  const permForm = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
  });

  const emp = employee?.data ?? employee;

  // Reset target and permission forms when employee details update or load
  useEffect(() => {
    if (emp) {
      targetForm.reset({
        monthlyTarget: emp.monthlyTarget ?? 0,
        callsTarget:   emp.callsTarget ?? 0,
        visitsTarget:  emp.visitsTarget ?? 0,
        bonusPlanned:  emp.bonusPlanned ?? 0,
      });
      permForm.reset({
        role:        emp.user?.role ?? 'EMPLOYEE',
        permissions: emp.user?.permissions ?? [],
      });
    }
  }, [emp, targetForm, permForm]);

  const addTask = useMutation({
    mutationFn: (body: TaskForm) => employeesService.createEmployeeTask(id!, body),
    onSuccess: () => {
      refetchTasks();
      setTaskModal(false);
      taskForm.reset({ priority: 'MEDIUM' });
      toast.success('Task added');
    },
    onError: () => toast.error('Failed to add task'),
  });

  const addLog = useMutation({
    mutationFn: (body: LogForm) => employeesService.dailyLog(id!, body),
    onSuccess: () => {
      refetchLogs();
      setLogModal(false);
      setSelectedLog(null);
      logForm.reset({ date: format(new Date(), 'yyyy-MM-dd') });
      toast.success('Log saved');
    },
    onError: (e: any) => {
      setSelectedLog(null);
      toast.error(e?.response?.data?.message ?? 'Failed to save log');
    },
  });

  const updateTargets = useMutation({
    mutationFn: (body: TargetForm) => employeesService.updateEmployeeProfile(id!, body),
    onSuccess: (res) => {
      if (res?.data) {
        qc.setQueryData(['employee', id], (old: any) => {
          if (!old) return old;
          if (old.data) {
            return {
              ...old,
              data: { ...old.data, ...res.data },
            };
          }
          return { ...old, ...res.data };
        });
      }
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setTargetModal(false);
      toast.success('Targets updated successfully');
    },
    onError: () => toast.error('Failed to update targets'),
  });

  const updatePermissions = useMutation({
    mutationFn: (body: PermissionForm) => employeesService.updateRole(id!, body),
    onSuccess: (res) => {
      if (res?.data) {
        qc.setQueryData(['employee', id], (old: any) => {
          if (!old) return old;
          const updatedUser = res.data;
          if (old.data) {
            return {
              ...old,
              data: {
                ...old.data,
                user: {
                  ...old.data.user,
                  role: updatedUser.role,
                  permissions: updatedUser.permissions,
                },
              },
            };
          }
          return {
            ...old,
            user: {
              ...old.user,
              role: updatedUser.role,
              permissions: updatedUser.permissions,
            },
          };
        });
      }
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setPermModal(false);
      toast.success('Permissions updated successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update permissions'),
  });

  const toggleTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      employeesService.updateTaskStatus(taskId, status),
    onSuccess: () => {
      refetchTasks();
      toast.success('Task status updated');
    },
    onError: () => toast.error('Failed to update task status'),
  });

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  if (!emp) return <div className="text-gray-500 p-8">Employee not found.</div>;

  const taskList: any[] = tasks?.data ?? tasks ?? [];
  const pendingTasks = taskList.filter(t => t.status !== 'COMPLETED');
  const doneTasks    = taskList.filter(t => t.status === 'COMPLETED');

  const s = stats?.data ?? stats;
  const logsList: any[] = logsRes?.data ?? [];

  const openTargetEdit = () => {
    targetForm.reset({
      monthlyTarget: emp.monthlyTarget ?? 0,
      callsTarget:   emp.callsTarget ?? 0,
      visitsTarget:  emp.visitsTarget ?? 0,
    });
    setTargetModal(true);
  };

  const openPermEdit = () => {
    permForm.reset({
      role:        emp.user?.role ?? 'EMPLOYEE',
      permissions: emp.user?.permissions ?? [],
    });
    setPermModal(true);
  };

  // Performance calculations
  const premiumProgress = emp.monthlyTarget > 0 ? Math.min(100, Math.round(((s?.premiumThisMonth ?? 0) / emp.monthlyTarget) * 100)) : 0;
  const callsProgress = emp.callsTarget > 0 ? Math.min(100, Math.round(((s?.callsToday ?? 0) / emp.callsTarget) * 100)) : 0;
  const visitsProgress = emp.visitsTarget > 0 ? Math.min(100, Math.round(((s?.meetingsToday ?? 0) / emp.visitsTarget) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{emp.firstName} {emp.lastName}</h2>
            <span className={emp.isActive ? 'badge-green' : 'badge-gray'}>{emp.isActive ? 'Active' : 'Inactive'}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {[emp.designation, emp.department].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openTargetEdit} className="btn-secondary flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs font-semibold py-2 px-3 rounded-lg border border-slate-200">
            <Target size={14} className="text-slate-500" /> Targets
          </button>
          {isOwner && (
            <button onClick={openPermEdit} className="btn-secondary flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs font-semibold py-2 px-3 rounded-lg border border-slate-200">
              <Key size={14} className="text-slate-500" /> Permissions
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Profile details */}
        <div className="lg:col-span-1 space-y-5">
          {/* Details Card */}
          <div className="card space-y-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Profile Details</h3>
            <div className="space-y-2.5">
              {emp.user?.email && <InfoRow label="Email" value={emp.user.email} />}
              {emp.phone && <InfoRow label="Phone" value={emp.phone} />}
              {emp.gender && <InfoRow label="Gender" value={emp.gender} />}
              {emp.dateOfBirth && <InfoRow label="Date of Birth" value={format(new Date(emp.dateOfBirth), 'dd/MMM/yyyy')} />}
              {emp.dateOfJoining && <InfoRow label="Joined" value={format(new Date(emp.dateOfJoining), 'dd/MMM/yyyy')} />}
              {emp.baseSalary != null && <InfoRow label="Base Salary" value={`₹${Number(emp.baseSalary).toLocaleString('en-IN')}`} />}
              {emp.bonusPlanned != null && <InfoRow label="Bonus Planned" value={`₹${Number(emp.bonusPlanned).toLocaleString('en-IN')}`} />}
            </div>
          </div>

          {/* Bank Details Card */}
          <div className="card space-y-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Bank Details</h3>
            <div className="space-y-2.5">
              <InfoRow label="Bank Name" value={emp.bankName || '—'} />
              <InfoRow label="Account Number" value={emp.bankAccountNumber || '—'} />
              <InfoRow label="IFSC Code" value={emp.bankIfscCode || '—'} />
              <InfoRow label="Branch Name" value={emp.bankBranch || '—'} />
              <InfoRow label="Account Type" value={emp.bankAccountType || '—'} />
            </div>
          </div>

          {/* Performance Card */}
          {s && (
            <div className="card space-y-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Performance Summary</h3>
              <div className="space-y-2.5">
                <InfoRow label="Total Policies" value={String(s.totalPolicies ?? 0)} />
                <InfoRow label="Total Leads" value={String(s.totalLeads ?? 0)} />
                <InfoRow label="Total Revenue" value={`₹${Number(s.totalRevenue ?? 0).toLocaleString('en-IN')}`} />
              </div>
            </div>
          )}
        </div>

        {/* Right column: Target progress & tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Target Progress Bar Cards */}
          <div className="card bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800">Target Trackers</h3>
            
            <div className="space-y-3">
              {/* Sales Target */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>Monthly Sales target progress</span>
                  <span className="text-primary-700 font-bold">{premiumProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${premiumProgress}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Achieved: ₹{(s?.premiumThisMonth ?? 0).toLocaleString('en-IN')}</span>
                  <span>Target: ₹{(emp.monthlyTarget ?? 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Calls Target */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>Daily Calls target progress</span>
                  <span className="text-primary-700 font-bold">{callsProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${callsProgress}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Made Today: {s?.callsToday ?? 0}</span>
                  <span>Target: {emp.callsTarget ?? 0} calls</span>
                </div>
              </div>

              {/* Proposal Target */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>Proposal target progress</span>
                  <span className="text-primary-700 font-bold">{visitsProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${visitsProgress}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Done Today: {s?.meetingsToday ?? 0}</span>
                  <span>Target: {emp.visitsTarget ?? 0} proposals</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit border border-gray-200/55">
            <button
              onClick={() => setActiveTab('tasks')}
              className={clsx('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                activeTab === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <CheckSquare size={14} className="inline mr-1.5"/>Tasks
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={clsx('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                activeTab === 'log' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <BookOpen size={14} className="inline mr-1.5"/>Attendance & Logs
            </button>
          </div>

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="card bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Tasks Pipeline</h3>
                <button onClick={() => setTaskModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1"><Plus size={12}/>Add Task</button>
              </div>

              {pendingTasks.length === 0 && doneTasks.length === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">No tasks assigned to this employee.</p>
              )}

              {pendingTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pending ({pendingTasks.length})</p>
                  {pendingTasks.map(task => (
                    <TaskCard key={task.id} task={task} onToggle={(id, done) => toggleTaskStatus.mutate({ taskId: id, status: done ? 'COMPLETED' : 'PENDING' })} />
                  ))}
                </div>
              )}

              {doneTasks.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Completed ({doneTasks.length})</p>
                  {doneTasks.map(task => (
                    <TaskCard key={task.id} task={task} done onToggle={(id, done) => toggleTaskStatus.mutate({ taskId: id, status: done ? 'COMPLETED' : 'PENDING' })} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'log' && (
            <div className="card bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Daily Activity Logs</h3>
                <button onClick={() => setLogModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1"><Plus size={12}/>Add Log</button>
              </div>

              {/* Lazy loading Date Filters */}
              <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200/50">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <Calendar size={13} className="text-slate-400" /> Filter:
                </div>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  className="input py-1 px-2.5 text-xs w-32 bg-white border border-gray-200"
                  placeholder="Start date"
                />
                <span className="text-gray-400 text-xs">—</span>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  className="input py-1 px-2.5 text-xs w-32 bg-white border border-gray-200"
                  placeholder="End date"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-xs text-red-500 font-semibold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Logs List Table */}
              <div className="overflow-x-auto">
                {logsList.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No daily logs found for this date range.</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <th className="pb-2.5">Date</th>
                        <th className="pb-2.5">In/Out</th>
                        <th className="pb-2.5 text-center">Calls</th>
                        <th className="pb-2.5 text-center">Visits</th>
                        <th className="pb-2.5 text-right">Premium</th>
                        <th className="pb-2.5 pl-4">Remarks/Agenda</th>
                        <th className="pb-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {logsList.map((log: any) => (
                        <tr key={log.id} className="text-gray-700">
                          <td className="py-3 font-semibold">
                            {format(new Date(log.logDate), 'dd/MMM/yyyy')}
                            {log.isEditedByAdmin && (
                              <span className="block text-[9px] text-orange-500 font-bold tracking-wide uppercase mt-0.5">✍️ Admin Edited</span>
                            )}
                          </td>
                          <td className="py-3 font-medium">
                            {log.checkIn ? (
                              <span className="text-green-600">
                                {format(new Date(log.checkIn), 'hh:mm a')}
                                {log.checkOut && ` - ${format(new Date(log.checkOut), 'hh:mm a')}`}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 text-center font-bold">{log.callsMade ?? 0}</td>
                          <td className="py-3 text-center font-bold">{log.visitsCompleted ?? 0}</td>
                          <td className="py-3 text-right font-bold text-green-600">₹{(log.premiumCollected ?? 0).toLocaleString('en-IN')}</td>
                          <td className="py-3 pl-4 max-w-xs truncate text-gray-500" title={`Notes: ${log.notes ?? ''}\nNext Day: ${log.nextDayPlan ?? ''}\nAdmin Remarks: ${log.adminRemarks ?? ''}`}>
                            {log.adminRemarks ? (
                              <span className="text-orange-600 font-medium">Admin: {log.adminRemarks}</span>
                            ) : (
                              log.notes || log.nextDayPlan || '—'
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedLog(log);
                                logForm.reset({
                                  date: log.logDate.slice(0, 10),
                                  callsMade: log.callsMade ?? 0,
                                  meetingsDone: log.visitsCompleted ?? 0,
                                  premiumCollected: log.premiumCollected ?? 0,
                                  notes: log.notes ?? '',
                                  checkIn: log.checkIn ? format(new Date(log.checkIn), "yyyy-MM-dd'T'HH:mm") : '',
                                  checkOut: log.checkOut ? format(new Date(log.checkOut), "yyyy-MM-dd'T'HH:mm") : '',
                                  adminRemarks: log.adminRemarks ?? '',
                                });
                                setLogModal(true);
                              }}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                              title="Edit log entry"
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      <Modal open={taskModal} onClose={() => { setTaskModal(false); taskForm.reset({ priority: 'MEDIUM' }); }} title="Add Task">
        <form onSubmit={taskForm.handleSubmit(d => addTask.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input {...taskForm.register('title')} className="input" placeholder="e.g. Follow up with client Ravi" />
            {taskForm.formState.errors.title && <p className="text-xs text-red-500">{taskForm.formState.errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...taskForm.register('description')} className="input" rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Due Date</label>
              <DatePicker {...taskForm.register('dueDate')} className="input mt-1" />
            </div>
            <div>
              <label className="label">Priority</label>
              <select {...taskForm.register('priority')} className="input">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setTaskModal(false); taskForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addTask.isPending}>
              {addTask.isPending ? 'Adding…' : 'Add Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Daily Log Modal */}
      <Modal open={logModal} onClose={() => { setLogModal(false); setSelectedLog(null); logForm.reset({ date: format(new Date(), 'yyyy-MM-dd') }); }} title={selectedLog ? 'Edit Daily Log (Admin Override)' : 'Add Daily Log'}>
        <form onSubmit={logForm.handleSubmit(d => addLog.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Date *</label>
            <DatePicker {...logForm.register('date')} className="input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Calls Made</label>
              <input {...logForm.register('callsMade')} type="number" min="0" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Meetings/Visits Done</label>
              <input {...logForm.register('meetingsDone')} type="number" min="0" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Leads Worked</label>
              <input {...logForm.register('leadsGenerated')} type="number" min="0" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Policies Sold</label>
              <input {...logForm.register('policiesSold')} type="number" min="0" className="input" placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="label">Premium Collected (₹)</label>
              <input {...logForm.register('premiumCollected')} type="number" min="0" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Check In Time (Optional override)</label>
              <input {...logForm.register('checkIn')} type="datetime-local" className="input" />
            </div>
            <div>
              <label className="label">Check Out Time (Optional override)</label>
              <input {...logForm.register('checkOut')} type="datetime-local" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Notes / Remarks</label>
            <textarea {...logForm.register('notes')} className="input" rows={2} placeholder="Any additional notes…" />
          </div>
          <div>
            <label className="label font-semibold text-orange-600">Admin Remarks (Flagged as Edited by Admin)</label>
            <textarea {...logForm.register('adminRemarks')} className="input border-orange-200 focus:border-orange-500" rows={2} placeholder="Explain why this entry is remarked/changed..." />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setLogModal(false); setSelectedLog(null); logForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addLog.isPending}>
              {addLog.isPending ? 'Saving…' : 'Save Log'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Targets Modal */}
      <Modal open={targetModal} onClose={() => setTargetModal(false)} title="Update Employee Targets" size="sm">
        <form onSubmit={targetForm.handleSubmit(d => updateTargets.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Monthly Sales Target (₹) *</label>
            <input {...targetForm.register('monthlyTarget')} type="number" className="input" />
          </div>
          <div>
            <label className="label">Bonus Planned (₹)</label>
            <input {...targetForm.register('bonusPlanned')} type="number" className="input" />
          </div>
          <div>
            <label className="label">Daily Calls Target *</label>
            <input {...targetForm.register('callsTarget')} type="number" className="input" />
          </div>
          <div>
            <label className="label">Proposal Target *</label>
            <input {...targetForm.register('visitsTarget')} type="number" className="input" />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setTargetModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateTargets.isPending}>
              {updateTargets.isPending ? 'Saving…' : 'Save Targets'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Permissions Modal */}
      <Modal open={permModal} onClose={() => setPermModal(false)} title="Manage Employee Role & Permissions">
        <form onSubmit={permForm.handleSubmit(d => updatePermissions.mutate(d))} className="space-y-4">
          <div>
            <label className="label">System User Role *</label>
            <select {...permForm.register('role')} className="input">
              <option value="EMPLOYEE">Employee (Agent)</option>
              <option value="OWNER">Owner (Administrator)</option>
              <option value="CONTACT">Contact (Client Portal)</option>
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
                        {...permForm.register('permissions')}
                      />
                      <span className="text-emerald-800">View</span>
                    </label>
                    <label className="flex flex-wrap items-center gap-1.5 cursor-pointer text-purple-800 select-none bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200/80 font-bold">
                      <input
                        type="checkbox"
                        value={editKey}
                        className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                        {...permForm.register('permissions')}
                      />
                      <span>Edit</span>
                    </label>
                    <label className="flex flex-wrap items-center gap-1.5 cursor-pointer text-blue-800 select-none bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/80 font-bold">
                      <input
                        type="checkbox"
                        value={allKey}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        {...permForm.register('permissions')}
                      />
                      <span>All Data (Owner Access)</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setPermModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updatePermissions.isPending}>
              {updatePermissions.isPending ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TaskCard({ task, done, onToggle }: { task: any; done?: boolean; onToggle: (id: string, done: boolean) => void }) {
  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-xl border group transition-all duration-350 bg-slate-50/50',
      done ? 'border-slate-100 opacity-60' : 'border-gray-200/70 hover:border-primary-200 hover:bg-slate-50')}>
      <input
        type="checkbox"
        checked={!!done}
        onChange={e => onToggle(task.id, e.target.checked)}
        className="mt-1 w-4 h-4 cursor-pointer accent-green-600 rounded"
      />
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-semibold', done ? 'line-through text-gray-400' : 'text-gray-800')}>{task.title}</p>
        {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2 flex-wrap">
          {task.priority && (
            <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider', PRIORITY_BADGE[task.priority] ?? 'bg-gray-100 text-gray-500')}>
              {task.priority}
            </span>
          )}
          {task.dueDate && (
            <span className="text-[10px] text-gray-400 flex flex-wrap items-center gap-0.5">
              <Clock size={10}/>{format(new Date(task.dueDate), 'dd/MMM/yyyy')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-dashed border-gray-100 last:border-b-0">
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="text-gray-800 font-semibold text-right">{value ?? '—'}</span>
    </div>
  );
}
