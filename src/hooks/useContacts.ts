import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { deleteOrRequestEntity } from '@utils/deleteAction';

export function useContacts(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn:  () => contactsService.list(params),
    staleTime: 0,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn:  () => contactsService.get(id),
    enabled:  !!id,
    staleTime: 0,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactsService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contact created'); },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create contact'),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => contactsService.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contact updated'); },
    onError:   (e: any) => {
      const msgs = e.response?.data?.errors || e.response?.data?.message;
      const errMsg = Array.isArray(msgs) ? msgs.join(', ') : msgs;
      toast.error(errMsg ?? 'Failed to update contact');
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  return useMutation({
    mutationFn: (id: string) => deleteOrRequestEntity({
      role,
      entityType: 'Contact',
      entityId: id,
      deleteFn: () => contactsService.remove(id),
      requestReason: 'Employee requested deletion of contact',
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(result.mode === 'requested' ? 'Deletion request submitted to admin' : 'Contact deleted');
    },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete contact'),
  });
}

export function useUpcomingBirthdays(days = 30, enabled = false) {
  return useQuery({
    queryKey: ['contacts', 'birthdays', days],
    queryFn:  () => contactsService.birthdays(days),
    enabled,
  });
}
