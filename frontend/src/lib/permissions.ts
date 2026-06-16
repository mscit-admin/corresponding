// Roles with FULL edit rights over correspondence (the supervisor/admin).
export const EDIT_ROLES = ['super_admin', 'archive_mgr'];

// Roles allowed to add reference data (entities/departments) — includes the
// diwan officer so data-entry can add a missing sender while registering.
export const REFERENCE_ROLES = ['super_admin', 'archive_mgr', 'diwan_officer'];

export function canEditCorrespondence(roleName?: string): boolean {
  return !!roleName && EDIT_ROLES.includes(roleName);
}

export function canManageReference(roleName?: string): boolean {
  return !!roleName && REFERENCE_ROLES.includes(roleName);
}
