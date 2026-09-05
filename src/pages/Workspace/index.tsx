import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import {
  useWorkspaceData,
  useClockIn,
  useClockOut,
  useUpsertDailyLog,
  useDeleteDailyLog,
  useUpdateTaskStatus,
  useCreateTask,
  useEmployeeTasks
} from '@hooks/useWorkspace';
import { useContacts } from '@hooks/useContacts';
import { usePolicies } from '@hooks/usePolicies';
import { useClaims } from '@hooks/useClaims';
import { useLeads } from '@hooks/useLeads';
import { db } from '../../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { commissionsService, employeesService, workspaceService } from '@api/index';
import {
  Clock, CheckCircle, Play, Square,
  TrendingUp, ListTodo, ClipboardList,
  Plus, CheckSquare, Target, User, Shield,
  FileText, Users, Calendar, Phone, DollarSign,
  Filter, Check, AlertCircle, LayoutDashboard, ArrowRight, Lock, MessageSquare,
  ChevronDown, Eye, X, Trash2, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import Modal from '@comps/common/Modal';
import toast from 'react-hot-toast';

function formatTotalDuration(checkIn: string | Date, checkOut: string | Date) {
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (diffMs <= 0) return '0m';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

type TabType = 'overview' | 'tasks' | 'daily_log' | 'targets';

export default function Workspace() {
  const user = useAuthStore(s => s.user);
  const { data: wsRes, isLoading, refetch } = useWorkspaceData();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const saveLogMutation = useUpsertDailyLog();
  const deleteDailyLogMutation = useDeleteDailyLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const createTaskMutation = useCreateTask();

  // Selected Daily Log for Pop-up Window Modal
  const [selectedDailyLog, setSelectedDailyLog] = useState<any | null>(null);
  const [deletedLogKeys, setDeletedLogKeys] = useState<string[]>([]);

  // Real data queries from all sidebar pages
  const { data: contactsRes } = useContacts({ limit: 1000 });
  const { data: policiesRes } = usePolicies({ limit: 1000 });
  const { data: claimsRes } = useClaims({ limit: 1000 });
  const { data: leadsRes } = useLeads({ limit: 1000 });

  // Real-time Firestore Leads listener
  const [firestoreLeads, setFirestoreLeads] = useState<any[]>([]);
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = onSnapshot(collection(db, 'leads'), (snap) => {
        const list: any[] = [];
        snap.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setFirestoreLeads(list);
      });
    } catch (e) {}
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Task filter & form state
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('ALL');
  const [taskFilterDateFrom, setTaskFilterDateFrom] = useState('');
  const [taskFilterDateTo, setTaskFilterDateTo] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [comments, setComments] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTargetTime, setTaskTargetTime] = useState('');
  const [taskTimeRequired, setTaskTimeRequired] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [showAddTask, setShowAddTask] = useState(false);

  // Employee list for Task assignment
  const { data: employeesRes } = useQuery({
    queryKey: ['employees-lookup-workspace'],
    queryFn: () => employeesService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  // My tasks list query
  const { data: allTasksRes, isLoading: tasksLoading } = useEmployeeTasks(
    taskStatusFilter === 'ALL' ? {} : { status: taskStatusFilter }
  );

  // My commissions — backend filters by beneficiaryId for EMPLOYEE role
  const { data: commRes, isLoading: commLoading } = useQuery({
    queryKey: ['my-commissions'],
    queryFn: () => commissionsService.list({ limit: 50 }),
    staleTime: 60_000,
  });

  // EOD fields
  const [notes, setNotes] = useState('');
  const [callsMade, setCallsMade] = useState(0);
  const [visitsCompleted, setVisitsCompleted] = useState(0);
  const [premiumCollected, setPremiumCollected] = useState(0);
  const [nextDayPlan, setNextDayPlan] = useState('');

  // Admin View Employee Workspace state
  const [selectedEmployeeUserId, setSelectedEmployeeUserId] = useState<string | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

  // Query for selected employee workspace data (when admin selects an employee)
  const { data: selectedEmpWsRes } = useQuery({
    queryKey: ['workspace', 'employee-data', selectedEmployeeUserId],
    queryFn: () => selectedEmployeeUserId ? workspaceService.getEmployeeData(selectedEmployeeUserId) : null,
    enabled: !!selectedEmployeeUserId && (user?.role === 'OWNER' || user?.role === 'SUPERADMIN'),
    staleTime: 30_000,
  });

  const workspaceData = wsRes?.data || wsRes; // support both envelope formats
  const logToday = workspaceData?.dailyLog;
  const isClockedIn = !!logToday?.checkIn && !logToday?.checkOut;
  const isClockedOut = !!logToday?.checkIn && !!logToday?.checkOut;

  const handleClockIn = () => {
    if (isClockedOut) {
      toast.error('Attendance is locked after EOD submission for today');
      return;
    }
    clockInMutation.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleClockOut = () => {
    if (isClockedOut) {
      toast.error('Attendance already ended and locked for today');
      return;
    }
    clockOutMutation.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    saveLogMutation.mutate({
      notes,
      callsMade,
      visitsCompleted,
      premiumCollected,
      nextDayPlan
    }, {
      onSuccess: () => {
        // Reset and clear the EOD form fields upon submit
        setNotes('');
        setCallsMade(0);
        setVisitsCompleted(0);
        setPremiumCollected(0);
        setNextDayPlan('');
        refetch();
      }
    });
  };

  const handleDeleteDailyLog = (log: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const logDateFormatted = log?.logDate ? format(new Date(log.logDate), 'dd/MMM/yyyy') : 'selected date';
    if (!window.confirm(`Are you sure you want to remove the daily log for ${logDateFormatted}?`)) {
      return;
    }
    const logKey = log.id || log.logDate || (log?.logDate ? format(new Date(log.logDate), 'yyyy-MM-dd') : '');
    setDeletedLogKeys(prev => [...prev, String(logKey), String(log.id), String(log.logDate)].filter(Boolean));
    
    deleteDailyLogMutation.mutate(String(logKey), {
      onSuccess: () => {
        if (selectedDailyLog && (selectedDailyLog.id === log.id || selectedDailyLog.logDate === log.logDate)) {
          setSelectedDailyLog(null);
        }
        refetch();
      },
      onError: () => {
        refetch();
      }
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    createTaskMutation.mutate({
      title: taskTitle,
      description: taskDesc || undefined,
      assignedToId: assignedToId || user?.id,
      comments: comments || undefined,
      startDate: taskStartDate ? new Date(taskStartDate).toISOString() : undefined,
      dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      targetTime: taskTargetTime || undefined,
      timeRequired: taskTimeRequired || undefined,
      priority: taskPriority,
    }, {
      onSuccess: () => {
        setTaskTitle('');
        setTaskDesc('');
        setComments('');
        setTaskStartDate('');
        setTaskDueDate('');
        setTaskTargetTime('');
        setTaskTimeRequired('');
        setTaskPriority('MEDIUM');
        setShowAddTask(false);
        refetch();
      }
    });
  };

  const handleToggleTask = (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    updateTaskStatusMutation.mutate({ taskId, status: nextStatus }, {
      onSuccess: () => refetch()
    });
  };

  const employeesList = (employeesRes?.data?.data || employeesRes?.data || []) as any[];
  const selectedEmployeeObj = employeesList.find((e: any) => (e.user?.id || e.userId || e.id) === selectedEmployeeUserId);

  const rawContacts = useMemo(() => contactsRes?.data ?? [], [contactsRes]);
  const rawPolicies = useMemo(() => policiesRes?.data ?? [], [policiesRes]);
  const rawClaims = useMemo(() => claimsRes?.data ?? [], [claimsRes]);

  // Combine API leads and Firestore leads
  const combinedLeads = useMemo(() => {
    const apiList = leadsRes?.data ?? [];
    const map = new Map<string, any>();
    apiList.forEach((l: any) => map.set(String(l.id), l));
    firestoreLeads.forEach((fl: any) => {
      const id = 'fs_' + fl.id;
      if (!map.has(id)) {
        map.set(id, {
          id,
          stage: fl.stage || 'TO_CONTACT',
          assignedEmployeeId: fl.assignedEmployeeId || fl.assignedToId,
          createdById: fl.createdById || fl.userId,
          fullName: fl.fullName || fl.name,
        });
      }
    });
    return Array.from(map.values());
  }, [leadsRes, firestoreLeads]);

  // Contextual filtering based on selected employee (or role)
  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'SUPERADMIN';
  const effectiveUserId = selectedEmployeeUserId || (!isOwnerOrAdmin ? user?.id : null);

  const filteredContacts = useMemo(() => {
    if (!effectiveUserId) return rawContacts;
    return rawContacts.filter((c: any) => 
      c.assignedEmployeeId === effectiveUserId || 
      c.createdById === effectiveUserId ||
      c.assignedToId === effectiveUserId
    );
  }, [rawContacts, effectiveUserId]);

  const filteredPolicies = useMemo(() => {
    if (!effectiveUserId) return rawPolicies;
    return rawPolicies.filter((p: any) => 
      p.assignedEmployeeId === effectiveUserId || 
      p.createdById === effectiveUserId ||
      p.agentId === effectiveUserId
    );
  }, [rawPolicies, effectiveUserId]);

  const filteredClaims = useMemo(() => {
    if (!effectiveUserId) return rawClaims;
    return rawClaims.filter((c: any) => 
      c.assignedEmployeeId === effectiveUserId || 
      c.createdById === effectiveUserId ||
      c.handledById === effectiveUserId
    );
  }, [rawClaims, effectiveUserId]);

  const filteredLeads = useMemo(() => {
    if (!effectiveUserId) return combinedLeads;
    return combinedLeads.filter((l: any) => 
      l.assignedEmployeeId === effectiveUserId || 
      l.assignedToId === effectiveUserId ||
      l.createdById === effectiveUserId
    );
  }, [combinedLeads, effectiveUserId]);

  const activeWorkspaceData = selectedEmployeeUserId ? (selectedEmpWsRes?.data || selectedEmpWsRes) : workspaceData;

  const activeCounts = useMemo(() => {
    const activePoliciesList = filteredPolicies.filter((p: any) => p.status === 'ACTIVE' || !p.status);
    const openClaimsList = filteredClaims.filter((c: any) => c.status !== 'SETTLED' && c.status !== 'REJECTED' && c.status !== 'CLOSED');
    const activeLeadsList = filteredLeads.filter((l: any) => l.stage !== 'PROCESS_COMPLETED' && l.stage !== 'DROPPED');

    return {
      leads: activeLeadsList.length > 0 ? activeLeadsList.length : (activeWorkspaceData?.counts?.leads ?? (effectiveUserId ? 0 : combinedLeads.length)),
      contacts: filteredContacts.length > 0 ? filteredContacts.length : (activeWorkspaceData?.counts?.contacts ?? (effectiveUserId ? 0 : rawContacts.length)),
      policies: activePoliciesList.length > 0 ? activePoliciesList.length : (activeWorkspaceData?.counts?.policies ?? (effectiveUserId ? 0 : filteredPolicies.length)),
      claims: openClaimsList.length > 0 ? openClaimsList.length : (activeWorkspaceData?.counts?.claims ?? 0),
    };
  }, [filteredPolicies, filteredClaims, filteredLeads, filteredContacts, activeWorkspaceData, combinedLeads, rawContacts, effectiveUserId]);

  const calculatedSalesAchieved = useMemo(() => {
    return filteredPolicies.reduce((acc: number, curr: any) => {
      return acc + Number(curr.premiumAmount || curr.grossPremium || curr.netPremium || curr.premium || 0);
    }, 0);
  }, [filteredPolicies]);

  const activeTarget = useMemo(() => {
    const baseTarget = activeWorkspaceData?.target || workspaceData?.target || {};
    const monthlyTarget = baseTarget.monthlyTarget > 0 ? baseTarget.monthlyTarget : (calculatedSalesAchieved > 0 ? calculatedSalesAchieved * 1.2 : 500000);
    const progress = calculatedSalesAchieved > 0 ? calculatedSalesAchieved : (baseTarget.progress || 0);
    const percentage = monthlyTarget > 0 ? Math.min(100, Math.round((progress / monthlyTarget) * 100)) : (baseTarget.percentage || 0);

    return {
      ...baseTarget,
      monthlyTarget,
      progress,
      percentage,
      callsProgress: baseTarget.callsProgress ?? callsMade,
      callsTarget: baseTarget.callsTarget ?? 20,
      visitsProgress: baseTarget.visitsProgress ?? visitsCompleted,
      visitsTarget: baseTarget.visitsTarget ?? 10,
    };
  }, [activeWorkspaceData, workspaceData, calculatedSalesAchieved, callsMade, visitsCompleted]);

  const activeTasks = activeWorkspaceData?.tasks || (workspaceData?.tasks || []);
  const rawRecentLogs = (activeWorkspaceData?.recentLogs || (workspaceData?.recentLogs || [])) as any[];
  
  // Exclude locally removed logs
  const activeRecentLogs = useMemo(() => {
    return rawRecentLogs.filter((log: any) => {
      if (log.id && deletedLogKeys.includes(String(log.id))) return false;
      if (log.logDate && deletedLogKeys.includes(String(log.logDate))) return false;
      return true;
    });
  }, [rawRecentLogs, deletedLogKeys]);

  const activeLogToday = activeWorkspaceData?.dailyLog;
  const activeIsClockedIn = !!activeLogToday?.checkIn && !activeLogToday?.checkOut;
  const activeIsClockedOut = !!activeLogToday?.checkIn && !!activeLogToday?.checkOut;

  const counts = activeCounts;
  const target = activeTarget;
  const tasks = activeTasks;
  const recentLogs = activeRecentLogs;

  const taskListFromApi = selectedEmployeeUserId ? activeTasks : (allTasksRes?.data || tasks);

  const filteredTasksList = useMemo(() => {
    const list = taskListFromApi || [];
    return list.filter((task: any) => {
      // 1. Status Filter
      if (taskStatusFilter !== 'ALL' && task.status !== taskStatusFilter) {
        return false;
      }
      // 2. Priority Filter
      if (taskPriorityFilter !== 'ALL' && (task.priority || 'MEDIUM') !== taskPriorityFilter) {
        return false;
      }
      // 3. Datewise Filter (matches task dueDate, startDate, or createdAt)
      const taskDateStr = task.dueDate || task.startDate || task.createdAt;
      if (taskDateStr) {
        const taskTime = new Date(taskDateStr).getTime();
        if (taskFilterDateFrom) {
          const fromTime = new Date(taskFilterDateFrom).setHours(0, 0, 0, 0);
          if (taskTime < fromTime) return false;
        }
        if (taskFilterDateTo) {
          const toTime = new Date(taskFilterDateTo).setHours(23, 59, 59, 999);
          if (taskTime > toTime) return false;
        }
      }
      return true;
    });
  }, [taskListFromApi, taskStatusFilter, taskPriorityFilter, taskFilterDateFrom, taskFilterDateTo]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sleek Header & Shift Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">
            {selectedEmployeeUserId && selectedEmployeeObj
              ? `Viewing ${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName}'s Workspace`
              : `Welcome back, ${user?.firstName}!`}
          </h1>
          {selectedEmployeeUserId && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> View Only Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-700">
            Shift Status: {activeIsClockedOut ? 'Attendance Ended (Locked)' : activeIsClockedIn ? 'Attendance Marked (On Duty)' : 'Attendance Not Marked'}
          </span>
        </div>
      </div>      {/* Admin Select Employee Modal */}
      {isEmployeeModalOpen && (
        <Modal
          open={isEmployeeModalOpen}
          onClose={() => setIsEmployeeModalOpen(false)}
          title="Select Employee Workspace"
          icon={<Users className="w-5 h-5 text-[#8064E8]" />}
          size="sm"
          footerActions={
            <div className="flex justify-between items-center w-full">
              {selectedEmployeeUserId ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployeeUserId(null);
                    setIsEmployeeModalOpen(false);
                  }}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Reset to My Workspace
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          }
        >
          <div className="space-y-2 py-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {employeesList.map((emp: any) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  setSelectedEmployeeUserId(emp.userId || emp.id);
                  setIsEmployeeModalOpen(false);
                }}
                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  selectedEmployeeUserId === (emp.userId || emp.id)
                    ? 'bg-purple-50 border-[#8064E8] text-[#8064E8] font-bold'
                    : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-gray-900">{emp.firstName} {emp.lastName}</p>
                  <p className="text-[10px] text-gray-500">{emp.designation || 'Employee'} • {emp.email || emp.user?.email}</p>
                </div>
                {selectedEmployeeUserId === (emp.userId || emp.id) && (
                  <Check className="w-4 h-4 text-[#8064E8]" />
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* POP-UP WINDOW / MODAL FOR DAILY LOG DETAILS */}
      {selectedDailyLog && (
        <Modal
          open={!!selectedDailyLog}
          onClose={() => setSelectedDailyLog(null)}
          title="Daily Log Details"
          subtitle={format(new Date(selectedDailyLog.logDate), 'EEEE, dd MMMM yyyy')}
          icon={<ClipboardList className="w-5 h-5 text-purple-600" />}
          size="md"
          footerActions={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={(e) => handleDeleteDailyLog(selectedDailyLog, e)}
                disabled={deleteDailyLogMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                {deleteDailyLogMutation.isPending ? 'Removing...' : 'Remove Daily Log'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedDailyLog(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4 py-2">
            {/* Shift Attendance Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shift Attendance</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-semibold block">Check In</span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedDailyLog.checkIn ? format(new Date(selectedDailyLog.checkIn), 'hh:mm a') : '—'}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-semibold block">Check Out</span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedDailyLog.checkOut ? format(new Date(selectedDailyLog.checkOut), 'hh:mm a') : '—'}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Duration</span>
                  <span className="text-xs font-bold text-blue-600">
                    {selectedDailyLog.checkIn && selectedDailyLog.checkOut
                      ? formatTotalDuration(selectedDailyLog.checkIn, selectedDailyLog.checkOut)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Metrics Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-center shadow-2xs">
                <Phone className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Calls Made</span>
                <span className="text-base font-black text-blue-700">{selectedDailyLog.callsMade ?? 0}</span>
              </div>
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100 text-center shadow-2xs">
                <Users className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Visits Done</span>
                <span className="text-base font-black text-purple-700">{selectedDailyLog.visitsCompleted ?? 0}</span>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 text-center shadow-2xs">
                <DollarSign className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Premium (₹)</span>
                <span className="text-base font-black text-emerald-700">₹{Number(selectedDailyLog.premiumCollected ?? 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Next Day Plan */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary-600" /> Next Day Plan / Agenda
              </span>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap min-h-[45px] shadow-2xs">
                {selectedDailyLog.nextDayPlan || <span className="text-slate-400 italic">No next day plan provided.</span>}
              </div>
            </div>

            {/* Shift Notes / Remarks */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary-600" /> Shift Notes / Remarks
              </span>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap min-h-[50px] shadow-2xs">
                {selectedDailyLog.notes || <span className="text-slate-400 italic">No notes recorded for this shift.</span>}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EDE5F0] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'text-white shadow-md'
              : 'text-[#777080] hover:bg-[#FCF6FA] hover:text-[#211A2E]'
          }`}
          style={activeTab === 'overview' ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
        >
          <LayoutDashboard className="w-4 h-4" /> Overview
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'tasks'
              ? 'text-white shadow-md'
              : 'text-[#777080] hover:bg-[#FCF6FA] hover:text-[#211A2E]'
          }`}
          style={activeTab === 'tasks' ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
        >
          <ListTodo className="w-4 h-4" /> My Tasks
          {tasks.length > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
              activeTab === 'tasks' ? 'bg-white text-[#5B2BA8]' : 'bg-[#F4EFFF] text-[#5B2BA8]'
            }`}>
              {tasks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('targets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'targets'
              ? 'text-white shadow-md'
              : 'text-[#777080] hover:bg-[#FCF6FA] hover:text-[#211A2E]'
          }`}
          style={activeTab === 'targets' ? { background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)' } : {}}
        >
          <Target className="w-4 h-4" /> My Targets &amp; Commissions
        </button>

        {/* Admin "View Employee Workspace" Button Next to My Targets Tab */}
        {(user?.role === 'OWNER' || user?.role === 'SUPERADMIN') && (
          <div className="relative ml-auto flex flex-wrap items-center gap-2">
            {selectedEmployeeUserId ? (
              <button
                onClick={() => setSelectedEmployeeUserId(null)}
                className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4 text-amber-700" /> Clear Employee Filter
              </button>
            ) : (
              <button
                onClick={() => setIsEmployeeModalOpen(!isEmployeeModalOpen)}
                className="flex flex-wrap items-center gap-1.5 px-3.5 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Users className="w-4 h-4 text-primary-600" /> View Employee Workspace <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mini Dashboard & Quick Actions Row (Visible in Overview tab) */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick Metrics Grid - Clickable with dynamic filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Link
              to={selectedEmployeeUserId ? `/leads?assignedTo=${selectedEmployeeUserId}` : '/leads'}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Assigned Leads</p>
                  <p className="text-lg font-bold text-gray-800">{activeCounts.leads}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to={selectedEmployeeUserId ? `/contacts?assignedTo=${selectedEmployeeUserId}` : '/contacts'}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">My Contacts</p>
                  <p className="text-lg font-bold text-gray-800">{activeCounts.contacts}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to={selectedEmployeeUserId ? `/policies?assignedTo=${selectedEmployeeUserId}` : '/policies'}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-green-50 p-2.5 rounded-xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Active Policies</p>
                  <p className="text-lg font-bold text-gray-800">{activeCounts.policies}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to={selectedEmployeeUserId ? `/claims?assignedTo=${selectedEmployeeUserId}` : '/claims'}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-orange-50 p-2.5 rounded-xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Open Claims</p>
                  <p className="text-lg font-bold text-gray-800">{activeCounts.claims}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer text-left group"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ListTodo className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Assigned Tasks</p>
                  <p className="text-lg font-bold text-gray-800">{taskListFromApi.length}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Attendance & EOD Column */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* Attendance & EOD Form Card */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary-600" /> Attendance & Daily Log
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Attendance Card */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Mark / End Attendance</h3>
                  {!logToday?.checkIn ? (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">You haven't marked attendance for today yet. Click below to mark present.</p>
                      <button
                        onClick={handleClockIn}
                        disabled={clockInMutation.isPending || isClockedOut}
                        className="btn-primary flex items-center justify-center gap-2 w-full px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] sm:text-xs font-semibold cursor-pointer shadow-sm transition-all disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" /> {clockInMutation.isPending ? 'Marking...' : 'Mark Attendance'}
                      </button>
                    </div>
                  ) : isClockedIn ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex flex-wrap items-center gap-3">
                        <div className="bg-green-500 p-2 rounded-lg text-white">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Attendance Marked (On Duty)</p>
                          <p className="text-sm font-bold text-gray-800">
                            Marked In at {format(new Date(logToday.checkIn), 'hh:mm a')}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleClockOut}
                        disabled={clockOutMutation.isPending}
                        className="btn-primary flex items-center justify-center gap-2 w-full px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] sm:text-xs font-semibold cursor-pointer shadow-sm transition-all"
                      >
                        <Square className="w-4 h-4" /> {clockOutMutation.isPending ? 'Ending...' : 'End Attendance'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap items-center gap-3">
                      <div className="bg-gray-400 p-2 rounded-lg text-white">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Attendance Locked</p>
                        <p className="text-xs font-semibold text-gray-800">
                          In: {format(new Date(logToday.checkIn), 'hh:mm a')} | Out: {format(new Date(logToday.checkOut), 'hh:mm a')}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Duration: {formatTotalDuration(logToday.checkIn, logToday.checkOut)} | Attendance locked after EOD
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* EOD Form */}
                <form onSubmit={handleSaveLog} className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">EOD Form & Planning</h3>
                    {logToday?.updatedAt && (
                      <span className="text-[10px] text-gray-400 font-medium">
                        Saved: {format(new Date(logToday.updatedAt), 'hh:mm a')}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Calls Made</label>
                      <input
                        type="number"
                        value={callsMade === 0 ? '' : callsMade}
                        onChange={(e) => setCallsMade(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Visits Done</label>
                      <input
                        type="number"
                        value={visitsCompleted === 0 ? '' : visitsCompleted}
                        onChange={(e) => setVisitsCompleted(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Premium (₹)</label>
                      <input
                        type="number"
                        value={premiumCollected === 0 ? '' : premiumCollected}
                        onChange={(e) => setPremiumCollected(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Next Day Plan / Agenda</label>
                    <input
                      type="text"
                      value={nextDayPlan}
                      onChange={(e) => setNextDayPlan(e.target.value)}
                      placeholder="Agenda, follow ups, scheduled visits..."
                      className="input w-full p-2 text-xs border border-gray-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Shift Notes / Remarks</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Summarize your progress, key client interactions today..."
                      className="input w-full min-h-[50px] text-xs p-2 border border-gray-200 rounded-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saveLogMutation.isPending}
                    className="btn-primary w-full text-[10px] sm:text-xs font-semibold py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-all cursor-pointer shadow-sm"
                  >
                    {saveLogMutation.isPending ? 'Saving EOD...' : 'Save EOD'}
                  </button>
                </form>
              </div>
            </div>

            {/* EOD History Table Preview */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary-600" /> Recent Daily Logs
                </h2>
                <span className="text-[11px] font-medium text-slate-400">
                  Click any row to view & manage full log
                </span>
              </div>
              {recentLogs.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">No EOD history found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="pb-3 px-2">Date</th>
                        <th className="pb-3 px-2">Attendance</th>
                        <th className="pb-3 px-2 text-center">Calls</th>
                        <th className="pb-3 px-2 text-center">Visits</th>
                        <th className="pb-3 px-2 text-right">Premium</th>
                        <th className="pb-3 px-2">Next Day Plan</th>
                        <th className="pb-3 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {recentLogs.slice(0, 10).map((log: any, i: number) => (
                        <tr
                          key={log.id || log.logDate || i}
                          onClick={() => setSelectedDailyLog(log)}
                          className="text-gray-700 hover:bg-slate-50 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-2 font-semibold text-gray-900">{format(new Date(log.logDate), 'dd/MMM/yyyy')}</td>
                          <td className="py-3 px-2">
                            {log.checkIn ? (
                              <span className="text-green-600 font-medium">
                                In: {format(new Date(log.checkIn), 'hh:mm a')}
                                {log.checkOut ? ` | Out: ${format(new Date(log.checkOut), 'hh:mm a')}` : ''}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-medium">{log.callsMade ?? 0}</td>
                          <td className="py-3 px-2 text-center font-medium">{log.visitsCompleted ?? 0}</td>
                          <td className="py-3 px-2 text-right font-medium text-green-700">
                            ₹{Number(log.premiumCollected ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-2 text-gray-600 truncate max-w-[150px]" title={log.nextDayPlan || undefined}>
                            {log.nextDayPlan || '—'}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDailyLog(log);
                                }}
                                className="p-1 rounded-lg text-blue-600 hover:bg-blue-100/70 transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteDailyLog(log, e)}
                                disabled={deleteDailyLogMutation.isPending}
                                className="p-1 rounded-lg text-red-500 hover:bg-red-100/70 hover:text-red-700 transition-colors"
                                title="Remove Daily Log"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Tasks & Targets Summary */}
          <div className="space-y-6">

            {/* Active Tasks Tracker */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                  <ListTodo className="w-5 h-5 text-primary-600" /> Active Tasks
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowAddTask(!showAddTask)}
                    className="bg-primary-50 text-primary-700 hover:bg-primary-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Add Task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className="text-xs text-primary-600 hover:text-primary-700 font-semibold cursor-pointer"
                  >
                    View All
                  </button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">No active tasks for today. Good job!</div>
              ) : (
                <ul className="space-y-3">
                  {tasks.slice(0, 5).map((task: any) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => handleToggleTask(task.id, task.status)}
                          className="text-gray-400 hover:text-primary-600 mt-0.5 cursor-pointer"
                          title="Mark Complete"
                        >
                          <CheckSquare className="w-5 h-5" />
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Target: {format(new Date(task.dueDate), 'dd MMM')}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`badge text-[10px] uppercase font-bold ${
                        task.priority === 'URGENT' ? 'badge-red' :
                        task.priority === 'HIGH' ? 'badge-orange' : 'badge-yellow'
                      }`}>
                        {task.priority || 'NORMAL'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Targets Summary */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                  <Target className="w-5 h-5 text-primary-600" /> Target Progress
                </h2>
                <button
                  onClick={() => setActiveTab('targets')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold cursor-pointer"
                >
                  View Details
                </button>
              </div>

              {/* Sales Target */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span className="flex flex-wrap items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-green-600" /> Sales Progress</span>
                  <span className="text-primary-700">{target.monthlyTarget > 0 ? target.percentage : 0}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${target.monthlyTarget > 0 ? target.percentage : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>₹{(target.progress || 0).toLocaleString('en-IN')} achieved</span>
                  <span>Target: ₹{(target.monthlyTarget || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Calls Target */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span className="flex flex-wrap items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-blue-600" /> Calls Progress</span>
                  <span className="text-primary-700">
                    {target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>{target.callsProgress || 0} calls</span>
                  <span>Target: {target.callsTarget || 0}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: MY TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex flex-wrap items-center gap-2">
                  <ListTodo className="w-5 h-5 text-primary-600" /> My Tasks
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage and track work items with complete assignment, timing, and multi-filter control</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="btn-primary flex flex-wrap items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              </div>
            </div>

            {/* Task Filters Bar: Status, Priority, Datewise Filter */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                  <Filter className="w-4 h-4 text-primary-600" />
                  <span>Filter Tasks</span>
                </div>
                {(taskStatusFilter !== 'ALL' || taskPriorityFilter !== 'ALL' || taskFilterDateFrom || taskFilterDateTo) && (
                  <button
                    onClick={() => {
                      setTaskStatusFilter('ALL');
                      setTaskPriorityFilter('ALL');
                      setTaskFilterDateFrom('');
                      setTaskFilterDateTo('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex flex-wrap items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Status Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Filter</label>
                  <select
                    value={taskStatusFilter}
                    onChange={(e: any) => setTaskStatusFilter(e.target.value)}
                    className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white font-semibold"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Tasks</option>
                    <option value="COMPLETED">Completed Tasks</option>
                  </select>
                </div>

                {/* 2. Priority Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority Filter</label>
                  <select
                    value={taskPriorityFilter}
                    onChange={(e: any) => setTaskPriorityFilter(e.target.value)}
                    className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white font-semibold"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Priority</option>
                  </select>
                </div>

                {/* 3. Date From */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date From</label>
                  <DatePicker
                    value={taskFilterDateFrom}
                    onDateChange={setTaskFilterDateFrom}
                    className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>

                {/* 4. Date To */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date To</label>
                  <DatePicker
                    value={taskFilterDateTo}
                    onDateChange={setTaskFilterDateTo}
                    className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Task Creation Form with ALL required fields */}
            {showAddTask && (
              <form onSubmit={handleAddTask} className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Create New Task (All Fields)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Title *</label>
                    <input
                      type="text"
                      placeholder="Task title..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Assigned To</label>
                    <select
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    >
                      <option value="">Self ({user?.firstName} {user?.lastName})</option>
                      {employeesList.map((emp: any) => (
                        <option key={emp.userId || emp.id} value={emp.userId || emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.designation || 'Employee'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e: any) => setTaskPriority(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    >
                      <option value="LOW">Low Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    placeholder="Task details and scope..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="input w-full min-h-[50px] p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                    <DatePicker
                      value={taskStartDate}
                      onDateChange={setTaskStartDate}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Target Date</label>
                    <DatePicker
                      value={taskDueDate}
                      onDateChange={setTaskDueDate}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Target Time</label>
                    <input
                      type="time"
                      value={taskTargetTime}
                      onChange={(e) => setTaskTargetTime(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Time Required (e.g. 2h 30m)</label>
                    <input
                      type="text"
                      placeholder="e.g. 3 hours"
                      value={taskTimeRequired}
                      onChange={(e) => setTaskTimeRequired(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Comments / Instructions</label>
                  <input
                    type="text"
                    placeholder="Additional instructions or notes..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTask(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTaskMutation.isPending}
                    className="btn-primary px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-primary-600 text-white text-[10px] sm:text-xs font-semibold cursor-pointer"
                  >
                    {createTaskMutation.isPending ? 'Creating Task...' : 'Save Task'}
                  </button>
                </div>
              </form>
            )}

            {/* Task Table with ALL required columns */}
            {tasksLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : filteredTasksList.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ListTodo className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium">No tasks found matching current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="pb-3 px-3">Done</th>
                      <th className="pb-3 px-3">Title & Scope</th>
                      <th className="pb-3 px-3">Assigned To</th>
                      <th className="pb-3 px-3 text-center">Priority</th>
                      <th className="pb-3 px-3">Start Date</th>
                      <th className="pb-3 px-3">Target Date & Time</th>
                      <th className="pb-3 px-3">Time Required</th>
                      <th className="pb-3 px-3">Comments</th>
                      <th className="pb-3 px-3 text-center">Status</th>
                      <th className="pb-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredTasksList.map((task: any) => {
                      const isDone = task.status === 'COMPLETED';
                      const assignedName = task.assignedTo?.employeeProfile
                        ? `${task.assignedTo.employeeProfile.firstName} ${task.assignedTo.employeeProfile.lastName}`
                        : task.assignedTo?.email || 'Self';
                      return (
                        <tr key={task.id} className={`hover:bg-gray-50/80 transition-colors ${isDone ? 'bg-gray-50/40' : ''}`}>
                          <td className="py-4 px-3">
                            <button
                              onClick={() => handleToggleTask(task.id, task.status)}
                              disabled={updateTaskStatusMutation.isPending}
                              className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                                isDone
                                  ? 'bg-green-500 border-green-600 text-white'
                                  : 'border-gray-300 text-transparent hover:text-gray-400'
                              }`}
                              title={isDone ? 'Mark as Pending' : 'Mark as Complete'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="py-4 px-3 max-w-[200px]">
                            <p className={`font-semibold text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate" title={task.description}>{task.description}</p>
                            )}
                          </td>
                          <td className="py-4 px-3 text-gray-700 font-medium">
                            {assignedName}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className={`badge text-[10px] uppercase font-bold ${
                              task.priority === 'URGENT' ? 'badge-red' :
                              task.priority === 'HIGH' ? 'badge-orange' :
                              task.priority === 'LOW' ? 'badge-gray' : 'badge-yellow'
                            }`}>
                              {task.priority || 'MEDIUM'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-gray-600">
                            {task.startDate ? format(new Date(task.startDate), 'dd/MMM/yyyy') : '—'}
                          </td>
                          <td className="py-4 px-3 text-gray-600">
                            {task.dueDate ? (
                              <span className="flex flex-col">
                                <span>{format(new Date(task.dueDate), 'dd/MMM/yyyy')}</span>
                                {task.targetTime && <span className="text-[10px] text-gray-400">{task.targetTime}</span>}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-4 px-3 text-gray-600">
                            {task.timeRequired || '—'}
                          </td>
                          <td className="py-4 px-3 text-gray-500 truncate max-w-[150px]" title={task.comments || undefined}>
                            {task.comments || '—'}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className={`badge text-[10px] uppercase font-bold ${
                              isDone ? 'badge-green' : 'badge-yellow'
                            }`}>
                              {task.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <button
                              onClick={() => handleToggleTask(task.id, task.status)}
                              disabled={updateTaskStatusMutation.isPending}
                              className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                                isDone
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                              }`}
                            >
                              {isDone ? 'Reopen' : 'Mark Complete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MY TARGETS & COMMISSIONS */}
      {activeTab === 'targets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Target Meters */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 lg:col-span-2">
              <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                <Target className="w-5 h-5 text-primary-600" /> Monthly Target Progress (Auto-Calculated from Policies & Lead Movements)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sales Progress Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
                      <Shield className="w-4 h-4 text-green-600" /> Sales Target
                    </span>
                    <span className="text-xs font-bold text-green-600">{target.monthlyTarget > 0 ? target.percentage : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${target.monthlyTarget > 0 ? target.percentage : 0}%` }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Achieved:</span>
                      <span className="font-bold text-gray-800">₹{(target.progress || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Target:</span>
                      <span className="font-semibold text-gray-700">₹{(target.monthlyTarget || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Calls Progress Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
                      <Phone className="w-4 h-4 text-blue-600" /> Calls Target
                    </span>
                    <span className="text-xs font-bold text-blue-600">
                      {target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%` }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Calls Made:</span>
                      <span className="font-bold text-gray-800">{target.callsProgress || 0}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Target:</span>
                      <span className="font-semibold text-gray-700">{target.callsTarget || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Proposal Progress Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-600" /> Proposal Target
                    </span>
                    <span className="text-xs font-bold text-purple-600">
                      {target.visitsTarget > 0 ? Math.min(100, Math.round(((target.visitsProgress || 0) / target.visitsTarget) * 100)) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${target.visitsTarget > 0 ? Math.min(100, Math.round(((target.visitsProgress || 0) / target.visitsTarget) * 100)) : 0}%` }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Proposals Done:</span>
                      <span className="font-bold text-gray-800">{target.visitsProgress || 0}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Target:</span>
                      <span className="font-semibold text-gray-700">{target.visitsTarget || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compensation Overview (Backend Sourced) */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" /> Real Backend Compensation
              </h2>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Base Salary</span>
                  <span className="text-sm font-bold text-gray-900">₹{(target.baseSalary || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Bonus Planned</span>
                  <span className="text-sm font-bold text-gray-900">₹{(target.bonusPlanned || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-green-50/60 rounded-xl border border-green-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-green-700">Monthly Commission</span>
                  <span className="text-sm font-bold text-green-700">₹{(target.monthlyCommission || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Commissions List */}
          {(() => {
            const commList: any[] = commRes?.data ?? [];
            const totalCommission = commList.reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            const paidCommission  = commList.filter((c: any) => c.isPaid).reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            return (
              <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" /> Commission History (Backend Sourced)
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-gray-500">Total: <span className="font-bold text-gray-800">₹{totalCommission.toLocaleString('en-IN')}</span></span>
                    <span className="text-gray-500">Paid: <span className="font-bold text-green-600">₹{paidCommission.toLocaleString('en-IN')}</span></span>
                  </div>
                </div>

                {commLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                  </div>
                ) : commList.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">No commission entries found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <th className="pb-3 px-3">Policy Details</th>
                          <th className="pb-3 px-3">Policy Number</th>
                          <th className="pb-3 px-3">Year</th>
                          <th className="pb-3 px-3 text-right">Commission Amount</th>
                          <th className="pb-3 px-3 text-right">Rate</th>
                          <th className="pb-3 px-3 text-center">Status</th>
                          <th className="pb-3 px-3">Paid Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {commList.map((c: any) => {
                          const contactName = c.policy?.contact ? `${c.policy.contact.firstName ?? ''} ${c.policy.contact.lastName ?? ''}`.trim() : '';
                          const planName = c.policy?.plan?.name || c.policyName || 'Insurance Policy';
                          return (
                            <tr key={c.id} className="text-gray-700 hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-xs">{planName}</span>
                                  {contactName && <span className="text-[11px] text-gray-500 font-medium">Holder: {contactName}</span>}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                  #{c.policy?.policyNumber ?? '—'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-gray-600 font-medium">{c.commissionYear?.name ?? (c.year ? `Year ${c.year}` : '—')}</td>
                              <td className="py-3 px-3 text-right font-bold text-gray-900">₹{Number(c.amount ?? 0).toLocaleString('en-IN')}</td>
                              <td className="py-3 px-3 text-right text-gray-500">{Number(c.rate ?? 0).toFixed(2)}%</td>
                              <td className="py-3 px-3 text-center">
                                <span className={c.isPaid ? 'badge-green' : 'badge-yellow'}>
                                  {c.isPaid ? 'Paid' : 'Pending'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-gray-500">
                                {c.paidAt ? format(new Date(c.paidAt), 'dd/MMM/yyyy') : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
