// Single-admin app: there is only one role ('Admin') and it has access to
// every module. This used to look up a per-role rule set from a
// `ROLE_PERMISSIONS` export that never actually existed in mockData.js —
// calling canAccessModule would have thrown a TypeError. Nothing in the app
// currently calls it, but it's fixed here so it's safe if that changes.
export function canAccessModule(role) {
  return role === 'Admin';
}

export function isAdminRole(role) {
  return role === 'Admin';
}
