export type PermissionAction = 'view' | 'edit' | 'all';

/**
 * Helper to check granular module permissions:
 * - 'view': Can view the module and list data (cannot add, edit, or delete)
 * - 'edit': Can view, add/create, and edit data within the module (cannot perform owner-level delete/manage)
 * - 'all': Full module access (same like owner access for that specific module)
 */
export function hasModulePermission(user: any, moduleKey: string, action: PermissionAction = 'view'): boolean {
  if (!user) return false;
  if (user.role === 'OWNER' || user.role === 'SUPERADMIN') return true;
  if (user.role !== 'EMPLOYEE') return false;

  const perms: string[] = user.permissions || [];
  const viewKey   = `view_${moduleKey}`;
  const editKey   = `edit_${moduleKey}`;
  const manageKey = `manage_${moduleKey}`;
  const allKey    = `all_${moduleKey}`;

  const hasAll  = perms.includes(manageKey) || perms.includes(allKey);
  const hasEdit = hasAll || perms.includes(editKey);
  const hasView = hasEdit || perms.includes(viewKey);

  if (action === 'all') return hasAll;
  if (action === 'edit') return hasEdit;
  if (action === 'view') return hasView;

  return false;
}

export function canViewModule(user: any, moduleKey: string): boolean {
  return hasModulePermission(user, moduleKey, 'view');
}

export function canEditModule(user: any, moduleKey: string): boolean {
  return hasModulePermission(user, moduleKey, 'edit');
}

export function canManageModule(user: any, moduleKey: string): boolean {
  return hasModulePermission(user, moduleKey, 'all');
}
