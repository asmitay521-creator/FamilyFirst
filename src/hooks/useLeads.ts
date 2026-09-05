import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { deleteOrRequestEntity } from '@utils/deleteAction';

export function useLeads(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn:  () => leadsService.list(params),
    staleTime: 2 * 60_000,
  });
}

export function useLeadKanban() {
  return useQuery({
    queryKey: ['leads', 'kanban'],
    queryFn:  () => leadsService.kanban(),
    staleTime: 2 * 60_000,
  });
}

export function useMoveLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => leadsService.moveStage(id, stage),
    onMutate: async ({ id, stage }) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ['leads', 'kanban'] });

      // Snapshot the previous value
      const previousKanban = qc.getQueryData(['leads', 'kanban']);

      // Optimistically update
      if (previousKanban) {
        qc.setQueryData(['leads', 'kanban'], (old: any) => {
          if (!old || !old.data) return old;
          const newData = { ...old.data };
          let foundLead: any = null;

          for (const s of Object.keys(newData)) {
            const list = newData[s] || [];
            const idx = list.findIndex((l: any) => l.id === id);
            if (idx !== -1) {
              [foundLead] = list.splice(idx, 1);
              break;
            }
          }

          if (foundLead) {
            const updatedLead = { ...foundLead, stage };
            if (!newData[stage]) newData[stage] = [];
            newData[stage].push(updatedLead);
          }

          return { ...old, data: newData };
        });
      }

      return { previousKanban };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousKanban) {
        qc.setQueryData(['leads', 'kanban'], context.previousKanban);
      }
      toast.error('Failed to move lead stage');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}


export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadsService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead created'); },
    onError:   (e: any, variables: any) => {
      const errs = e.response?.data?.errors;
      const msg = Array.isArray(errs) && errs.length > 0
        ? errs.join(', ')
        : (e.response?.data?.message ?? 'Error creating lead');

      if (process.env.NODE_ENV !== 'production') {
        console.error('[Lead Create Failed]', {
          payload: variables,
          status: e.response?.status,
          response: e.response?.data,
        });
      }
      toast.error(msg);
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => leadsService.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead updated'); },
    onError:   (e: any, variables: any) => {
      const errs = e.response?.data?.errors;
      const msg = Array.isArray(errs) && errs.length > 0
        ? errs.join(', ')
        : (e.response?.data?.message ?? 'Error updating lead');

      if (process.env.NODE_ENV !== 'production') {
        console.error('[Lead Update Failed]', {
          payload: variables,
          status: e.response?.status,
          response: e.response?.data,
        });
      }
      toast.error(msg);
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  return useMutation({
    mutationFn: (id: string) => deleteOrRequestEntity({
      role,
      entityType: 'Lead',
      entityId: id,
      deleteFn: () => leadsService.remove(id),
      requestReason: 'Employee requested deletion of lead',
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success(result.mode === 'requested' ? 'Deletion request submitted to admin' : 'Lead deleted');
    },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Error'),
  });
}
