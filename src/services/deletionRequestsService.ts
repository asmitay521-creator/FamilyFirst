import api from './api';

export const deletionRequestsService = {
  requestDeletion: async (entityType: string, entityId: string, reason?: string) => {
    const res = await api.post('/deletion-requests', { entityType, entityId, reason });
    return res.data;
  },
  getRequests: async (filters?: any) => {
    const res = await api.get('/deletion-requests', { params: filters });
    return res.data;
  },

  resolveRequest: async (id: string, data: { action: 'APPROVED' | 'REJECTED'; adminNotes?: string }) => {
    const res = await api.put(`/deletion-requests/${id}/resolve`, data);
    return res.data;
  },
};
