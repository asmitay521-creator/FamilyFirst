import { deletionRequestsService } from '@api/deletionRequestsService';

type DeleteActionParams = {
  role?: string | null;
  entityType: string;
  entityId: string;
  deleteFn: () => Promise<any>;
  requestReason: string;
};

export async function deleteOrRequestEntity({
  role,
  entityType,
  entityId,
  deleteFn,
  requestReason,
}: DeleteActionParams) {
  if (role === 'OWNER' || role === 'SUPERADMIN') {
    await deleteFn();
    return { mode: 'deleted' as const };
  }

  await deletionRequestsService.requestDeletion(entityType, entityId, requestReason);
  return { mode: 'requested' as const };
}
