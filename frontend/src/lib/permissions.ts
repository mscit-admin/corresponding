// Roles allowed to edit correspondence (must match the backend EDIT_ROLES).
export const EDIT_ROLES = ['super_admin', 'archive_mgr', 'diwan_officer'];

export function canEditCorrespondence(roleName?: string): boolean {
  return !!roleName && EDIT_ROLES.includes(roleName);
}
