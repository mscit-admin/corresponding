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

// ---- Security clearance (درجة السرية) — mirror of the backend mapping ----
const CLEARANCE_BY_ROLE: Record<string, string> = {
  super_admin: 'top_secret',
  archive_mgr: 'top_secret',
  diwan_officer: 'secret',
  dept_manager: 'secret',
  employee: 'normal',
};
const CONF_RANK: Record<string, number> = { normal: 0, secret: 1, top_secret: 2 };

export function maxClearance(roleName?: string): string {
  return CLEARANCE_BY_ROLE[roleName || ''] || 'normal';
}

/** هل يستطيع المستخدم تعيين هذه الدرجة من السرية (حسب تصريح دوره)؟ */
export function canSetConfidentiality(roleName: string | undefined, level: string): boolean {
  return (CONF_RANK[level] ?? 0) <= (CONF_RANK[maxClearance(roleName)] ?? 0);
}

// Roles allowed to route/refer (تهميش) a message to departments.
export const ROUTING_ROLES = ['super_admin', 'archive_mgr', 'dept_manager'];

export function canRoute(roleName?: string): boolean {
  return !!roleName && ROUTING_ROLES.includes(roleName);
}

// Roles allowed to take decision actions (اعتماد/رفض/إغلاق/أرشفة).
export const DECISION_ROLES = ['super_admin', 'archive_mgr', 'dept_manager'];

export function canDecide(roleName?: string): boolean {
  return !!roleName && DECISION_ROLES.includes(roleName);
}

// Roles allowed to manage AI settings (admin + supervisory).
export const AI_SETTINGS_ROLES = ['super_admin', 'archive_mgr'];

export function canManageAiSettings(roleName?: string): boolean {
  return !!roleName && AI_SETTINGS_ROLES.includes(roleName);
}
