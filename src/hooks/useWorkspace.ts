import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceService, employeesService } from '@api/index';
import toast from 'react-hot-toast';

export function useWorkspaceData() {
  return useQuery({
    queryKey: ['workspace', 'data'],
    queryFn: () => workspaceService.getData().catch(() => ({ data: null })),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workspaceService.clockIn,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res.message || 'Attendance marked successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to mark attendance'),
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workspaceService.clockOut,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res.message || 'Attendance ended successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to end attendance'),
  });
}

export function useUpsertDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eodData: any) => workspaceService.saveEod(eodData),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res.message || 'EOD report saved successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save EOD report'),
  });
}

export function useDeleteDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idOrDate: string) => workspaceService.removeLog(idOrDate),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res?.message || 'Daily log deleted successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete daily log'),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      employeesService.updateTaskStatus(taskId, status),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employee-tasks'] });
      toast.success(res.message || 'Task status updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to update task'),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: employeesService.createTask,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employee-tasks'] });
      toast.success(res.message || 'Task created successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create task'),
  });
}

export function useEmployeeTasks(params?: any) {
  return useQuery({
    queryKey: ['employee-tasks', params],
    queryFn: () => employeesService.getTasks(params).catch(() => ({ data: [] })),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}


