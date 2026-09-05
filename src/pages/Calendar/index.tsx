import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarService, contactsService, policiesService, leadsService, employeesService } from '@api/index';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Clock, Tag, Cake, Users, RefreshCw, Zap, CalendarDays, CheckSquare, CalendarPlus, Phone, ArrowUpRight } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAuthStore } from '@store/auth.store';
import { DatePicker } from '@comps/common/DatePicker';
import { deleteOrRequestEntity } from '@utils/deleteAction';
import { useCreateTask, useUpdateTaskStatus } from '@hooks/useWorkspace';
import { db } from '../../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

// ── Event type colours ─────────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  FOLLOWUP: 'bg-blue-500',
  MEETING: 'bg-violet-500',
  RENEWAL: 'bg-amber-500',
  PAYMENT_DUE: 'bg-red-500',
  BIRTHDAY: 'bg-pink-500',
  OTHER: 'bg-gray-400',
  TASK: 'bg-emerald-500',
};

const EVENT_GRADIENT: Record<string, string> = {
  FOLLOWUP: 'from-blue-500 to-blue-600',
  MEETING: 'from-violet-500 to-violet-600',
  RENEWAL: 'from-amber-500 to-orange-500',
  PAYMENT_DUE: 'from-red-500 to-rose-600',
  BIRTHDAY: 'from-pink-500 to-rose-500',
  OTHER: 'from-slate-400 to-slate-500',
  TASK: 'from-emerald-500 to-teal-600',
};

const EVENT_BADGE: Record<string, string> = {
  FOLLOWUP: 'bg-blue-50   text-blue-700   border-blue-200',
  MEETING: 'bg-violet-50 text-violet-700 border-violet-200',
  RENEWAL: 'bg-amber-50  text-amber-700  border-amber-200',
  PAYMENT_DUE: 'bg-red-50    text-red-700    border-red-200',
  BIRTHDAY: 'bg-pink-50   text-pink-700   border-pink-200',
  OTHER: 'bg-gray-50   text-gray-600   border-gray-200',
  TASK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  FOLLOWUP: 'Follow Up', MEETING: 'Meeting', RENEWAL: 'Renewal',
  PAYMENT_DUE: 'Payment Due', BIRTHDAY: 'Birthday', OTHER: 'Other',
  TASK: 'Task',
};

const EVENT_DOT_COLOR: Record<string, string> = {
  FOLLOWUP: 'bg-blue-400',
  MEETING: 'bg-violet-400',
  RENEWAL: 'bg-amber-400',
  PAYMENT_DUE: 'bg-red-400',
  BIRTHDAY: 'bg-pink-400',
  OTHER: 'bg-slate-400',
  TASK: 'bg-emerald-400',
};

// Active pill colours per event type (checked state)
const FILTER_ACTIVE: Record<string, string> = {
  FOLLOWUP: 'bg-blue-100   text-blue-700   border-blue-300',
  MEETING: 'bg-violet-100 text-violet-700 border-violet-300',
  RENEWAL: 'bg-amber-100  text-amber-700  border-amber-300',
  PAYMENT_DUE: 'bg-red-100    text-red-700    border-red-300',
  BIRTHDAY: 'bg-pink-100   text-pink-700   border-pink-300',
  OTHER: 'bg-slate-100  text-slate-600  border-slate-300',
  TASK: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

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

export default function Calendar() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'threeDays'>('month');
  const [visibleCategories, setVisibleCategories] = useState<string[]>([
    'FOLLOWUP', 'MEETING', 'RENEWAL', 'PAYMENT_DUE', 'BIRTHDAY', 'OTHER', 'TASK'
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [overflowDay, setOverflowDay] = useState<{ date: Date; events: any[] } | null>(null);
  const role = useAuthStore(s => s.user?.role);
  const user = useAuthStore(s => s.user);

  // Task Creation States
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTargetTime, setTaskTargetTime] = useState('');
  const [taskTimeRequired, setTaskTimeRequired] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [assignedToId, setAssignedToId] = useState('');
  const [taskComments, setTaskComments] = useState('');

  const createTaskMutation = useCreateTask();
  const updateTaskStatusMutation = useUpdateTaskStatus();

  // Employee list lookup for Task assignments
  const { data: employeesRes } = useQuery({
    queryKey: ['employees-lookup-calendar'],
    queryFn: () => employeesService.list({ limit: 100 }),
    enabled: taskModalOpen,
  });
  const employeesList = (employeesRes?.data as any[]) || [];

  // Real-time Web & Local Leads
  const [webLeads, setWebLeads] = useState<any[]>([]);

  useEffect(() => {
    const deletedSet = new Set(
      (() => {
        try {
          const raw = JSON.parse(localStorage.getItem('insumitra_deleted_lead_keys') || '[]');
          return raw.map((k: string) => String(k).trim().toLowerCase());
        } catch {
          return [];
        }
      })()
    );

    const isDeletedItem = (id: string) => {
      const idLow = id.toLowerCase();
      const fsId = idLow.replace('fs_', '');
      if (deletedSet.has(idLow) || (fsId && deletedSet.has(fsId))) return true;
      return false;
    };

    const loadLocal = () => {
      try {
        const local = JSON.parse(localStorage.getItem('insumitra_local_leads') || '[]');
        const rahulLeads = JSON.parse(localStorage.getItem('rahul_kulkarni_leads') || '[]');
        const rahulCheckups = JSON.parse(localStorage.getItem('rahul_kulkarni_checkups') || '[]');

        const mappedRahul = rahulLeads.map((item: any) => {
          const fullName = item.name || item.fullName || 'Website Lead';
          const parts = fullName.trim().split(/\s+/);
          return {
            id: 'local_lead_' + (item.id || item.timestamp || Date.now()),
            stage: 'TO_CONTACT',
            createdAt: item.date || item.createdAt || new Date().toISOString(),
            followUpDate: item.followUpDate ? item.followUpDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
            interests: [item.service || 'Financial Advisory'],
            contact: {
              id: 'local_contact_' + (item.id || item.timestamp || Date.now()),
              firstName: parts[0] || 'Web',
              lastName: parts.slice(1).join(' ') || 'User',
              phone: item.phone || item.mobile || '',
            },
            plan: { name: item.service || 'Financial Advisory', category: 'LIFE' }
          };
        });

        const mappedCheckups = rahulCheckups.map((item: any) => {
          const fullName = item.name || item.fullName || 'Health Checkup Lead';
          const parts = fullName.trim().split(/\s+/);
          return {
            id: 'checkup_lead_' + (item.id || item.timestamp || Date.now()),
            stage: 'TO_CONTACT',
            createdAt: item.timestamp || new Date().toISOString(),
            followUpDate: item.followUpDate ? item.followUpDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
            interests: ['Financial Health Checkup'],
            contact: {
              id: 'checkup_contact_' + (item.id || item.timestamp || Date.now()),
              firstName: parts[0] || 'Web',
              lastName: parts.slice(1).join(' ') || 'User',
              phone: item.phone || item.mobile || '',
            },
            plan: { name: `Financial Health Checkup`, category: 'HEALTH' }
          };
        });

        return [...local, ...mappedRahul, ...mappedCheckups].filter(l => !isDeletedItem(String(l.id || '')));
      } catch {
        return [];
      }
    };

    setWebLeads(loadLocal());

    // Firestore listener
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      const leadsCol = collection(db, 'leads');
      unsubscribeFirestore = onSnapshot(leadsCol, (snapshot) => {
        const firestoreList: any[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const fullName = (data.fullName || data.name || 'Website Lead').trim();
          const parts = fullName.split(/\s+/);
          const firstName = parts[0] || 'Web';
          const lastName = parts.slice(1).join(' ') || 'User';
          const service = data.serviceRequired || data.service || 'Financial Advisory';
          const phone = data.phone || data.mobile || '';
          const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString());

          if (!isDeletedItem('fs_' + docSnap.id)) {
            firestoreList.push({
              id: 'fs_' + docSnap.id,
              stage: data.stage === 'OPEN' || !data.stage ? 'TO_CONTACT' : data.stage,
              createdAt: createdAtDate,
              followUpDate: data.followUpDate ? data.followUpDate.slice(0, 10) : (data.nextFollowUpDate ? data.nextFollowUpDate.slice(0, 10) : new Date().toISOString().split('T')[0]),
              interests: [service],
              contact: {
                id: 'fs_contact_' + docSnap.id,
                firstName,
                lastName,
                phone,
              },
              plan: { name: service, category: 'LIFE' }
            });
          }
        });

        if (firestoreList.length >= 0) {
          setWebLeads(prev => [...firestoreList, ...prev.filter(p => !p.id.startsWith('fs_'))]);
        }
      });
    } catch {}

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  // Fetch backend leads
  const { data: kanbanRes } = useQuery({
    queryKey: ['leads', 'board'],
    queryFn: () => leadsService.kanban(),
  });

  // Combine all leads
  const allLeads = useMemo(() => {
    const flat: any[] = [];
    const rawData = kanbanRes?.data ?? {};
    Object.keys(rawData).forEach(stg => {
      (rawData[stg] || []).forEach((c: any) => flat.push(c));
    });
    const seenKeys = new Set(flat.map(l => (l.contact?.phone ? `${l.contact.phone}_${(l.interests || [])[0]}` : l.id)));
    webLeads.forEach(wl => {
      const key = wl.contact?.phone ? `${wl.contact.phone}_${(wl.interests || [])[0]}` : wl.id;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        flat.unshift(wl);
      }
    });
    return flat;
  }, [kanbanRes, webLeads]);

  // Lead Follow Up Date helper
  const getLeadFollowUpDate = (lead: any): Date | null => {
    let raw = lead.followUpDate || lead.nextFollowUpDate;
    if (!raw && lead.notes) {
      try {
        const parsed = typeof lead.notes === 'string' ? JSON.parse(lead.notes) : lead.notes;
        raw = parsed?.followUpDate || parsed?.nextFollowUpDate;
      } catch {}
    }
    if (!raw && lead.createdAt) {
      raw = lead.createdAt;
    }
    if (!raw) {
      raw = new Date().toISOString().slice(0, 10);
    }
    if (raw instanceof Date) return isNaN(raw.getTime()) ? new Date() : raw;
    if (typeof raw === 'string') {
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }
      const d = new Date(raw);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  };

  // Queries for calendar events
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);

  const { data } = useQuery({
    queryKey: ['calendar', format(currentDate, 'yyyy-MM')],
    queryFn: () => calendarService.list({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }),
  });
  const events: any[] = data?.data ?? [];

  // All policies for renewal reminders
  const { data: allPoliciesRes } = useQuery({
    queryKey: ['calendar-all-policies'],
    queryFn: () => policiesService.list({ limit: 2000 }),
  });
  const allPolicies: any[] = allPoliciesRes?.data ?? [];

  // Derived days array based on active viewMode
  const days = useMemo(() => {
    if (viewMode === 'month') {
      const s = startOfMonth(currentDate);
      const e = endOfMonth(currentDate);
      return eachDayOfInterval({ start: s, end: e });
    } else if (viewMode === 'week') {
      const s = startOfWeek(currentDate);
      const e = endOfWeek(currentDate);
      return eachDayOfInterval({ start: s, end: e });
    } else {
      const s = currentDate;
      const e = addDays(currentDate, 2);
      return eachDayOfInterval({ start: s, end: e });
    }
  }, [currentDate, viewMode]);

  const prefixDays = useMemo(() => {
    return viewMode === 'month' ? startOfMonth(currentDate).getDay() : 0;
  }, [currentDate, viewMode]);

  // Sidebar contacts birthdays
  const { data: contactsRes } = useQuery({
    queryKey: ['calendar-contacts-birthdays'],
    queryFn: () => contactsService.list({ limit: 2000 }),
  });

  const selectedDayStart = useMemo(() => startOfDay(selectedDate), [selectedDate]);
  const selectedDayEnd = useMemo(() => endOfDay(selectedDate), [selectedDate]);
  const selectedDayKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const { data: selectedDayEventsRes } = useQuery({
    queryKey: ['calendar-day-events', selectedDayKey],
    queryFn: () => calendarService.list({
      startDate: selectedDayStart.toISOString(),
      endDate: selectedDayEnd.toISOString(),
    }),
  });
  const selectedDayEvents: any[] = selectedDayEventsRes?.data ?? [];

  const invalidateAgendaQueries = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['calendar'] }),
      qc.invalidateQueries({ queryKey: ['calendar-day-events'] }),
      qc.invalidateQueries({ queryKey: ['calendar-all-policies'] }),
      qc.invalidateQueries({ queryKey: ['leads'] }),
    ]);
  };

  const birthdaysToday = useMemo(() => {
    const isBirthdayVisible = visibleCategories.includes('BIRTHDAY');

    const contactBirthdays = isBirthdayVisible
      ? (contactsRes?.data ?? []).filter((c: any) => {
        if (!c.birthday) return false;
        const bDate = new Date(c.birthday);
        return bDate.getDate() === selectedDate.getDate() && bDate.getMonth() === selectedDate.getMonth();
      }).map((c: any) => ({ _type: 'contact', id: c.id, label: `${c.firstName} ${c.lastName}`, event: null }))
      : [];

    const eventBirthdays = isBirthdayVisible
      ? selectedDayEvents
        .filter(e => e.eventType === 'BIRTHDAY' && isSameDay(new Date(e.startAt ?? e.startTime), selectedDate))
        .map(e => ({ _type: 'event', id: e.id, label: e.title, event: e }))
      : [];

    return [...contactBirthdays, ...eventBirthdays];
  }, [contactsRes, selectedDayEvents, selectedDate, visibleCategories]);

  const renewalsToday = useMemo(() => {
    return allPolicies.filter((p: any) => p.nextDueDate && isSameDay(new Date(p.nextDueDate), selectedDate));
  }, [allPolicies, selectedDate]);

  const leadsToday = useMemo(() => {
    return allLeads.filter(lead => {
      const fDate = getLeadFollowUpDate(lead);
      return fDate && isSameDay(fDate, selectedDate);
    });
  }, [allLeads, selectedDate]);

  // All calendar events on selected date (non-birthday) for Tasks section
  const tasksToday = useMemo(() => {
    return selectedDayEvents.filter(e => {
      const isDateMatch = isSameDay(new Date(e.startAt ?? e.startTime), selectedDate);
      const isNotBirthday = e.eventType !== 'BIRTHDAY';
      const isVisible = visibleCategories.includes(e.eventType || 'OTHER');
      return isDateMatch && isNotBirthday && isVisible;
    });
  }, [selectedDayEvents, selectedDate, visibleCategories]);

  const createEvent = useMutation({
    mutationFn: calendarService.create,
    onSuccess: () => { void invalidateAgendaQueries(); toast.success('Event created'); setModalOpen(false); },
    onError: () => toast.error('Failed to create event'),
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => calendarService.update(id, body),
    onSuccess: () => { void invalidateAgendaQueries(); toast.success('Event updated'); setEditTarget(null); },
    onError: () => toast.error('Failed to update event'),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => deleteOrRequestEntity({
      role,
      entityType: 'CalendarEvent',
      entityId: id,
      deleteFn: () => calendarService.remove(id),
      requestReason: 'Employee requested deletion of calendar event',
    }),
    onSuccess: (result) => {
      void invalidateAgendaQueries();
      toast.success(result.mode === 'requested' ? 'Deletion request submitted to admin' : 'Event deleted');
      setDeleteTarget(null);
      setViewTarget(null);
    },
    onError: () => toast.error('Failed to delete event'),
  });

  const { register, handleSubmit, reset, watch } = useForm<any>();
  const { register: regEdit, handleSubmit: handleEditSubmit, reset: resetEdit, setValue: editSetValue, watch: watchEdit } = useForm<any>();

  const openEdit = (ev: any) => {
    setViewTarget(null);
    setEditTarget(ev);

    const startStr = ev.startAt ?? ev.startTime;
    let startDate = '';
    let startTime = '';
    if (startStr) {
      const d = new Date(startStr);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      startDate = `${yyyy}-${mm}-${dd}`;
      startTime = `${hh}:${min}`;
    }

    const endStr = ev.endAt ?? ev.endTime;
    let endDate = '';
    let endTime = '';
    if (endStr) {
      const d = new Date(endStr);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      endDate = `${yyyy}-${mm}-${dd}`;
      endTime = `${hh}:${min}`;
    }

    resetEdit({
      title: ev.title,
      eventType: ev.eventType ?? 'OTHER',
      isAllDay: ev.isAllDay ?? false,
      startDate,
      startTime,
      endDate,
      endTime,
      description: ev.description ?? ''
    });
  };

  // Date Navigation based on viewMode
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(d => subDays(d, 7));
    } else {
      setCurrentDate(d => subDays(d, 3));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(d => addDays(d, 7));
    } else {
      setCurrentDate(d => addDays(d, 3));
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    createTaskMutation.mutate({
      title: taskTitle,
      description: taskDesc || undefined,
      assignedToId: assignedToId || user?.id,
      comments: taskComments || undefined,
      startDate: taskStartDate ? new Date(taskStartDate).toISOString() : undefined,
      dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      targetTime: taskTargetTime || undefined,
      timeRequired: taskTimeRequired || undefined,
      priority: taskPriority,
    }, {
      onSuccess: () => {
        setTaskTitle('');
        setTaskDesc('');
        setTaskComments('');
        setTaskStartDate('');
        setTaskDueDate('');
        setTaskTargetTime('');
        setTaskTimeRequired('');
        setTaskPriority('MEDIUM');
        setAssignedToId('');
        setTaskModalOpen(false);
        void invalidateAgendaQueries();
      }
    });
  };

  const EventFormFields = ({ reg, watch }: { reg: any; watch: any }) => {
    const isAllDay = watch('isAllDay');
    return (
      <div className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input {...reg('title')} className="input" placeholder="Event title" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Event Type</label>
            <select {...reg('eventType')} className="input">
              {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex flex-wrap items-center gap-2 cursor-pointer">
              <input {...reg('isAllDay')} type="checkbox" className="rounded accent-blue-600" />
              <span className="text-sm text-gray-600 font-medium">All Day</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date *</label>
            <DatePicker {...reg('startDate')} className="input w-full" />
          </div>


          <div>
            <label className="label">End Date</label>
            <DatePicker {...reg('endDate')} className="input w-full" />
          </div>

        </div>

        <div>
          <label className="label">Description</label>
          <textarea {...reg('description')} className="input" rows={2} placeholder="Optional description…" />
        </div>
      </div>
    );
  };

  // ── Day-of-week labels
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 animate-fade-in pb-10">

      {/* Floating Right Action Panel (Task & Event Creation) */}
      <div className="fixed right-2 sm:right-3.5 top-60 sm:top-64 z-40 flex flex-col gap-2 bg-white/95 backdrop-blur-xl p-1.5 rounded-xl shadow-xl border border-slate-200/80 animate-fadeIn">
        {/* Add Task */}
        <button
          type="button"
          onClick={() => {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            setTaskStartDate(dateStr);
            setTaskDueDate(dateStr);
            setTaskModalOpen(true);
          }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="Add Task"
        >
          <CheckSquare size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            Add Task
          </span>
        </button>

        {/* New Event */}
        <button
          type="button"
          onClick={() => {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            reset({
              title: '',
              eventType: 'OTHER',
              isAllDay: false,
              startDate: dateStr,
              startTime: '09:00',
              endDate: dateStr,
              endTime: '10:00',
              description: ''
            });
            setModalOpen(true);
          }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-xs cursor-pointer group relative"
          title="New Event"
        >
          <Plus size={14} strokeWidth={2.2} />
          <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-lg border border-slate-800">
            New Event
          </span>
        </button>
      </div>

      {/* ── Hero Header Bar ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 shadow-xl border border-[#5B2BA8]/30"
        style={{ background: 'linear-gradient(135deg, #17143F 0%, #24165A 55%, #5B2BA8 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 left-10 w-28 h-28 rounded-full bg-[#5B2BA8]/20 blur-xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">

          {/* Left: nav + title */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrev}
              aria-label="Previous"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all border border-white/20 backdrop-blur-sm cursor-pointer"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="text-center min-w-[160px]">
              <h2 className="text-lg font-extrabold text-white tracking-tight leading-none">
                {viewMode === 'month'
                  ? format(currentDate, 'MMMM yyyy')
                  : `${format(days[0], 'dd/MMM/yyyy')} – ${format(days[days.length - 1], 'dd/MMM/yyyy')}`}
              </h2>
              <p className="text-white/60 text-[11px] mt-0.5 font-medium">
                {format(new Date(), 'EEEE, dd/MMM/yyyy')}
              </p>
            </div>

            <button
              onClick={handleNext}
              aria-label="Next"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all border border-white/20 backdrop-blur-sm cursor-pointer"
            >
              <ChevronRight size={15} />
            </button>

            <button
              onClick={goToToday}
              className="ml-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[10px] sm:text-xs font-bold border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Centre/Right: view-mode pills */}
          <div className="flex items-center bg-white/10 backdrop-blur-sm p-1 rounded-xl border border-white/15 gap-1">
            {(['month', 'week', 'threeDays'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={clsx(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  viewMode === mode
                    ? 'bg-white text-[#5B2BA8] shadow-sm font-extrabold'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                {mode === 'threeDays' ? '3 Days' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category Filter Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mr-1">Filters:</span>
        {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => {
          const isChecked = visibleCategories.includes(key);
          return (
            <label
              key={key}
              className={clsx(
                'flex items-center gap-1.5 cursor-pointer select-none rounded-full py-1 px-3 text-xs font-semibold border transition-all',
                isChecked
                  ? (FILTER_ACTIVE[key] ?? 'bg-slate-100 text-slate-600 border-slate-300') + ' shadow-sm'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {
                  if (isChecked) {
                    setVisibleCategories(prev => prev.filter(k => k !== key));
                  } else {
                    setVisibleCategories(prev => [...prev, key]);
                  }
                }}
                className="sr-only"
              />
              <span className={clsx('w-2 h-2 rounded-full', EVENT_COLORS[key] ?? 'bg-gray-400')} />
              {label}
            </label>
          );
        })}
      </div>

      {/* ── Main Grid: Calendar + Sidebar ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">

        {/* ── Left: Calendar Grid ─────────────────────────────────────────── */}
        <div className="lg:col-span-3 overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">

          {/* Day-of-week header row */}
          <div className={clsx(
            'grid border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/60',
            viewMode === 'threeDays' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-7'
          )}>
            {viewMode === 'threeDays' ? (
              days.map((d: Date) => (
                <div key={d.toISOString()} className="py-3 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {format(d, 'eee dd MMM')}
                </div>
              ))
            ) : (
              DOW_LABELS.map(d => (
                <div key={d} className="py-3 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {d}
                </div>
              ))
            )}
          </div>

          {/* Days grid */}
          <div className={clsx(
            'grid',
            viewMode === 'threeDays' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-7'
          )}>
            {/* Prefix blanks */}
            {viewMode === 'month' && Array.from({ length: prefixDays }).map((_, i) => (
              <div key={`pre-${i}`} className="min-h-[110px] border-b border-r border-slate-50 bg-slate-50/30" />
            ))}

            {days.map((day: Date) => {
              const isFollowupVisible = visibleCategories.includes('FOLLOWUP');
              const isRenewalVisible = visibleCategories.includes('RENEWAL');

              const dayLeadFollowups = isFollowupVisible
                ? allLeads
                    .filter(lead => {
                      const fDate = getLeadFollowUpDate(lead);
                      return fDate && isSameDay(fDate, day);
                    })
                    .map(lead => {
                      const clientName = `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || lead.fullName || lead.name || 'Lead';
                      const product = (lead.interests && lead.interests[0]) || lead.plan?.name || '';
                      return {
                        id: 'lead_followup_' + lead.id,
                        title: `Follow-up: ${clientName}`,
                        leadName: clientName,
                        leadProduct: product,
                        eventType: 'FOLLOWUP',
                        startAt: day.toISOString(),
                        isLead: true,
                        leadData: lead,
                      };
                    })
                : [];

              const dayPolicyRenewals = isRenewalVisible
                ? allPolicies
                    .filter((pol: any) => pol.nextDueDate && isSameDay(new Date(pol.nextDueDate), day))
                    .map((pol: any) => ({
                      id: 'policy_renewal_' + pol.id,
                      title: `Renewal: ${pol.clientName || pol.policyNumber || 'Policy'}`,
                      eventType: 'RENEWAL',
                      startAt: day.toISOString(),
                      isPolicy: true,
                      policyData: pol,
                    }))
                : [];

              const dayEvents = [
                ...events.filter(e => {
                  const isDateMatch = isSameDay(new Date(e.startAt ?? e.startTime), day);
                  const isVisible = visibleCategories.includes(e.eventType || 'OTHER');
                  return isDateMatch && isVisible;
                }),
                ...dayLeadFollowups,
                ...dayPolicyRenewals,
              ];

              const hasFollowup = dayLeadFollowups.length > 0;
              const hasMeeting = dayEvents.some(e => e.eventType === 'MEETING');
              const hasRenewal = dayPolicyRenewals.length > 0;
              const today = isToday(day);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={clsx(
                    viewMode === 'week' || viewMode === 'threeDays'
                      ? 'min-h-[400px]'
                      : 'min-h-[118px]',
                    'border-b border-r border-slate-100 p-2 transition-all cursor-pointer group relative',
                    today
                      ? 'bg-gradient-to-br from-indigo-50/90 via-blue-50/70 to-purple-50/60'
                      : hasFollowup && hasMeeting
                        ? 'bg-gradient-to-br from-violet-50/90 via-blue-50/60 to-slate-50/50 hover:bg-violet-100/60'
                        : hasFollowup
                          ? 'bg-gradient-to-br from-blue-50/80 via-sky-50/50 to-white hover:bg-blue-100/60'
                          : hasMeeting
                            ? 'bg-gradient-to-br from-violet-50/80 via-purple-50/50 to-white hover:bg-violet-100/60'
                            : hasRenewal
                              ? 'bg-gradient-to-br from-amber-50/70 to-orange-50/40 hover:bg-amber-100/60'
                              : isSelected
                                ? 'bg-gradient-to-br from-slate-50 to-slate-100/70'
                                : 'hover:bg-slate-50/70',
                    isSelected && !today ? 'ring-2 ring-inset ring-purple-500/50 shadow-inner' : '',
                    today && isSelected ? 'ring-2 ring-inset ring-indigo-600/70 shadow-inner' : '',
                  )}
                >
                  {/* Day number & indicators */}
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={clsx(
                        'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold transition-all',
                        today
                          ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-300/60'
                          : isSelected
                            ? 'text-purple-700 bg-purple-100 font-black'
                            : hasFollowup || hasMeeting
                              ? 'text-slate-800 font-black'
                              : 'text-slate-500 group-hover:text-slate-700'
                      )}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* Date Highlight Badges */}
                    <div className="flex items-center gap-1">
                      {hasFollowup && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-blue-100/90 text-blue-800 border border-blue-300/80 shadow-2xs"
                          title={`${dayLeadFollowups.length} Lead Follow-up(s)`}
                        >
                          <Phone size={7} className="text-blue-600" />
                          <span>{dayLeadFollowups.length}</span>
                        </span>
                      )}
                      {hasMeeting && (
                        <span
                          className="inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-extrabold bg-violet-100 text-violet-800 border border-violet-300/80 shadow-2xs"
                          title="Meeting Scheduled"
                        >
                          🤝
                        </span>
                      )}
                      {hasRenewal && !hasFollowup && (
                        <span
                          className="inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300/80 shadow-2xs"
                          title={`${dayPolicyRenewals.length} Policy Renewal(s)`}
                        >
                          🛡️
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Events inside Day Cell */}
                  <div className="space-y-1">
                    {(viewMode === 'week' || viewMode === 'threeDays' ? dayEvents : dayEvents.slice(0, 3)).map((e: any) => {
                      if (e.isLead) {
                        return (
                          <div
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              navigate('/leads');
                            }}
                            className="w-full text-left px-1.5 py-1 rounded-lg bg-blue-50/95 hover:bg-blue-100 border border-blue-200/90 hover:border-blue-400 text-blue-950 transition-all cursor-pointer shadow-2xs group/lead flex items-center justify-between gap-1"
                            title={`Follow-up: ${e.leadName} (${e.leadProduct})`}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <Phone size={9} className="text-blue-600 shrink-0" />
                              <span className="text-[9px] font-bold truncate">
                                {e.leadName}
                              </span>
                            </div>
                            {e.leadProduct && (
                              <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-blue-200/70 text-blue-900 shrink-0 max-w-[65px] truncate">
                                {e.leadProduct}
                              </span>
                            )}
                          </div>
                        );
                      }
                      if (e.eventType === 'MEETING') {
                        return (
                          <button
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setViewTarget(e);
                            }}
                            className="w-full text-left flex items-center justify-between gap-1 rounded-lg px-1.5 py-1 text-[9px] font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-2xs transition-all hover:scale-[1.01] cursor-pointer"
                            title={`Meeting: ${e.title}`}
                          >
                            <span className="truncate flex items-center gap-0.5">
                              🤝 {e.title}
                            </span>
                          </button>
                        );
                      }
                      if (e.isPolicy) {
                        return (
                          <button
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              navigate('/policies');
                            }}
                            className="w-full text-left flex items-center gap-1 rounded-lg px-1.5 py-1 text-[9px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-2xs transition-all hover:scale-[1.01] cursor-pointer"
                            title={e.title}
                          >
                            <span className="truncate">🛡️ {e.title}</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={e.id}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setViewTarget(e);
                          }}
                          className={clsx(
                            'w-full text-left flex items-center gap-1 rounded-lg px-1.5 py-1 text-[9px] font-semibold text-white truncate transition-all hover:scale-[1.01] hover:shadow-sm cursor-pointer',
                            `bg-gradient-to-r ${EVENT_GRADIENT[e.eventType] ?? 'from-slate-400 to-slate-500'}`
                          )}
                          title={e.title}
                        >
                          <span className="truncate">{e.title}</span>
                        </button>
                      );
                    })}
                    {viewMode !== 'week' && viewMode !== 'threeDays' && dayEvents.length > 3 && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setOverflowDay({ date: day, events: dayEvents }); }}
                        className="text-[8px] text-purple-700 font-extrabold px-1.5 py-0.5 hover:text-purple-900 hover:bg-purple-50 w-full text-left rounded transition-colors"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Agenda card */}
          <div className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            {/* Agenda header */}
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 bg-gradient-to-r from-slate-50 to-white">
              <CalendarDays size={13} className="text-blue-500" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Agenda — {format(selectedDate, 'dd/MMM/yyyy')}
              </h3>
            </div>

            <div className="p-3 space-y-4 max-h-[460px] overflow-y-auto">

              {/* Tasks & Meetings */}
              <AgendaSection
                icon={<CalendarDays size={11} className="text-blue-500" />}
                title="Tasks & Meetings"
                count={tasksToday.length}
                countCls="bg-blue-100 text-blue-700"
                emptyText="No tasks scheduled."
              >
                {tasksToday.map((t: any) => (
                  <AgendaItem
                    key={t.id}
                    label={t.title}
                    dotCls={EVENT_DOT_COLOR[t.eventType] ?? 'bg-slate-400'}
                    onClick={() => setViewTarget(t)}
                  />
                ))}
              </AgendaSection>

              {/* Birthdays */}
              <AgendaSection
                icon={<Cake size={11} className="text-pink-500" />}
                title="Birthdays"
                count={birthdaysToday.length}
                countCls="bg-pink-100 text-pink-700"
                emptyText="No birthdays today."
              >
                {birthdaysToday.map((b: any) => (
                  <AgendaItem
                    key={b.id}
                    label={b.label}
                    dotCls="bg-pink-400"
                    onClick={b.event ? () => setViewTarget(b.event) : undefined}
                    badge={b._type === 'event' ? { label: 'Event', cls: 'bg-pink-100 text-pink-700' } : undefined}
                  />
                ))}
              </AgendaSection>

              {/* Leads */}
              <AgendaSection
                icon={<Users size={11} className="text-violet-500" />}
                title="Lead Followups"
                count={leadsToday.length}
                countCls="bg-violet-100 text-violet-700"
                emptyText="No lead followups."
              >
                {leadsToday.map((l: any) => {
                  const leadName = `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim() || l.fullName || l.name || 'Lead';
                  const leadPhone = l.contact?.phone || l.phone || '';
                  const leadProduct = (l.interests && l.interests[0]) || l.plan?.name || '';
                  return (
                    <div
                      key={l.id}
                      onClick={() => navigate('/leads')}
                      className="group flex flex-col p-2.5 rounded-xl bg-slate-50 hover:bg-violet-50/70 border border-slate-100 hover:border-violet-200 transition-all cursor-pointer shadow-2xs mb-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate group-hover:text-violet-700">
                            {leadName}
                          </span>
                        </div>
                        {leadProduct && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                            {leadProduct}
                          </span>
                        )}
                      </div>
                      {leadPhone && (
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 pl-3.5">
                          <span className="font-mono">{leadPhone}</span>
                          <span className="text-[10px] font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            View Lead <ArrowUpRight size={10} />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </AgendaSection>

              {/* Policy Renewals */}
              <AgendaSection
                icon={<RefreshCw size={11} className="text-amber-500" />}
                title="Policy Renewals"
                count={renewalsToday.length}
                countCls="bg-amber-100 text-amber-700"
                emptyText="No policy renewals today."
              >
                {renewalsToday.map((p: any) => (
                  <AgendaItem
                    key={p.id}
                    label={`${p.clientName ? `${p.clientName} · ` : ''}${p.policyNumber || 'Policy'}`}
                    dotCls="bg-amber-400"
                    onClick={() => navigate('/policies')}
                  />
                ))}
              </AgendaSection>

            </div>
          </div>
        </div>

      </div>

      {/* ── Create Event Modal ─────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="New Event">
        <form onSubmit={handleSubmit((d: any) => {
          const payload = { ...d };
          if (payload.startDate) {
            const datePart = payload.startDate;
            const timePart = payload.isAllDay ? '00:00' : (payload.startTime || '00:00');
            payload.startAt = new Date(`${datePart}T${timePart}`).toISOString();
          }
          if (payload.endDate) {
            const datePart = payload.endDate;
            const timePart = payload.isAllDay ? '23:59' : (payload.endTime || '00:00');
            payload.endAt = new Date(`${datePart}T${timePart}`).toISOString();
          }
          delete payload.startDate;
          delete payload.startTime;
          delete payload.endDate;
          delete payload.endTime;
          createEvent.mutate(payload);
        })} className="space-y-4">
          <EventFormFields reg={register} watch={watch} />
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => { setModalOpen(false); reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createEvent.isPending}>
              {createEvent.isPending ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Create Task Modal ───────────────────────────────────────────────── */}
      <Modal open={taskModalOpen} onClose={() => { setTaskModalOpen(false); }} title="Add Task">
        <form onSubmit={handleAddTaskSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Title *</label>
              <input
                type="text"
                placeholder="Task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                value={taskPriority}
                onChange={(e: any) => setTaskPriority(e.target.value)}
                className="input w-full"
              >
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent Priority</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              placeholder="Task details and scope..."
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              className="input w-full min-h-[60px]"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <DatePicker
                value={taskStartDate}
                onDateChange={setTaskStartDate}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Target Date</label>
              <DatePicker
                value={taskDueDate}
                onDateChange={setTaskDueDate}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Target Time</label>
              <input
                type="time"
                value={taskTargetTime}
                onChange={(e) => setTaskTargetTime(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Time Required</label>
              <input
                type="text"
                placeholder="e.g. 3 hours"
                value={taskTimeRequired}
                onChange={(e) => setTaskTimeRequired(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="label">Assigned To</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="input w-full"
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
            <label className="label">Comments / Instructions</label>
            <input
              type="text"
              placeholder="Additional instructions or notes..."
              value={taskComments}
              onChange={(e) => setTaskComments(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setTaskModalOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="btn-primary"
            >
              {createTaskMutation.isPending ? 'Creating Task...' : 'Save Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Event Modal ───────────────────────────────────────────────── */}
      {viewTarget && (
        <Modal open onClose={() => setViewTarget(null)} title={viewTarget.title}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx('badge border text-xs', EVENT_BADGE[viewTarget.eventType] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                <Tag size={10} /> {EVENT_TYPE_LABELS[viewTarget.eventType] ?? viewTarget.eventType}
              </span>
              {viewTarget.isTask && (
                <span className={clsx('badge border text-xs', viewTarget.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                  {viewTarget.status}
                </span>
              )}
              {viewTarget.isTask && (
                <span className={clsx('badge border text-xs', viewTarget.priority === 'URGENT' ? 'bg-red-50 text-red-700 border-red-200' : viewTarget.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200')}>
                  {viewTarget.priority}
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm text-gray-700 bg-gray-50 rounded-xl p-4 border border-gray-100">
              {viewTarget.isTask ? (
                <>
                  {viewTarget.startAt && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock size={14} className="text-gray-400 shrink-0" />
                      <span><span className="font-medium">Due Date:</span> {format(new Date(viewTarget.startAt), 'dd/MMM/yyyy')}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(viewTarget.startAt ?? viewTarget.startTime) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock size={14} className="text-gray-400 shrink-0" />
                      <span><span className="font-medium">Start:</span> {format(new Date(viewTarget.startAt ?? viewTarget.startTime), 'dd/MMM/yyyy, HH:mm')}</span>
                    </div>
                  )}
                  {(viewTarget.endAt ?? viewTarget.endTime) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock size={14} className="text-gray-400 shrink-0" />
                      <span><span className="font-medium">End:</span> {format(new Date(viewTarget.endAt ?? viewTarget.endTime), 'dd/MMM/yyyy, HH:mm')}</span>
                    </div>
                  )}
                </>
              )}
              {viewTarget.description && (
                <p className="text-gray-600 mt-2 pt-2 border-t border-gray-200">{viewTarget.description}</p>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
            {viewTarget.isTask ? (
              <button
                className="btn-primary gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => {
                  const nextStatus = viewTarget.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
                  updateTaskStatusMutation.mutate({ taskId: viewTarget.id, status: nextStatus }, {
                    onSuccess: () => {
                      setViewTarget(null);
                      void invalidateAgendaQueries();
                    }
                  });
                }}
                disabled={updateTaskStatusMutation.isPending}
              >
                {viewTarget.status === 'COMPLETED' ? 'Mark Pending' : 'Mark Completed'}
              </button>
            ) : (
              <>
                <button className="btn-secondary gap-1.5" onClick={() => openEdit(viewTarget)}>
                  <Pencil size={13} /> Edit
                </button>
                <button className="btn-danger gap-1.5" onClick={() => { setViewTarget(null); setDeleteTarget(viewTarget); }}>
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Edit Event Modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <Modal open onClose={() => { setEditTarget(null); resetEdit(); }} title="Edit Event">
          <form onSubmit={handleEditSubmit((d: any) => {
            const payload = { ...d };
            if (payload.startDate) {
              const datePart = payload.startDate;
              const timePart = payload.isAllDay ? '00:00' : (payload.startTime || '00:00');
              payload.startAt = new Date(`${datePart}T${timePart}`).toISOString();
            }
            if (payload.endDate) {
              const datePart = payload.endDate;
              const timePart = payload.isAllDay ? '23:59' : (payload.endTime || '00:00');
              payload.endAt = new Date(`${datePart}T${timePart}`).toISOString();
            }
            delete payload.startDate;
            delete payload.startTime;
            delete payload.endDate;
            delete payload.endTime;
            updateEvent.mutate({ id: editTarget.id, body: payload });
          })} className="space-y-4">
            <EventFormFields reg={regEdit} watch={watchEdit} />
            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" className="btn-secondary" onClick={() => { setEditTarget(null); resetEdit(); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateEvent.isPending}>
                {updateEvent.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Event" size="sm">
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to delete <strong className="text-gray-900">"{deleteTarget?.title}"</strong>?
          This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button
            className="btn-danger"
            disabled={deleteEvent.isPending}
            onClick={() => deleteEvent.mutate(deleteTarget!.id)}
          >
            {deleteEvent.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Day Overflow Modal ─────────────────────────────────────────────── */}
      {overflowDay && (
        <Modal
          open
          onClose={() => setOverflowDay(null)}
          title={`All Events — ${format(overflowDay.date, 'dd/MMM/yyyy')}`}
        >
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {overflowDay.events.map((e: any) => (
              <button
                key={e.id}
                onClick={() => { setOverflowDay(null); setViewTarget(e); }}
                className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-md bg-gradient-to-r ${EVENT_GRADIENT[e.eventType] ?? 'from-slate-400 to-slate-500'}`}
              >
                <span className="truncate flex-1">{e.title}</span>
                <span className="shrink-0 text-white/70 font-normal">
                  {(e.startAt ?? e.startTime) ? format(new Date(e.startAt ?? e.startTime), 'HH:mm') : ''}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

    </div>
  );
}

// ── Small reusable agenda section component ──────────────────────────────────
function AgendaSection({
  icon, title, count, countCls, emptyText, children
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  countCls: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          {icon}
          <span>{title}</span>
        </div>
        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${countCls}`}>{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-[11px] text-slate-400 italic pl-1">{emptyText}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

// ── Small reusable agenda row ────────────────────────────────────────────────
function AgendaItem({
  label, dotCls, onClick, badge
}: {
  label: string;
  dotCls: string;
  onClick?: () => void;
  badge?: { label: string; cls: string };
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className={clsx(
        'w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all',
        'bg-white border-slate-100 text-slate-700',
        onClick
          ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm'
          : 'cursor-default'
      )}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
      <span className="truncate flex-1 text-left">{label}</span>
      {badge && (
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
      )}
    </Tag>
  );
}
