export function isSuperAdmin(account) {
  return account?.roleSlug === 'super-admin' || account?.role === 'super_admin';
}

export function isAdminAccount(account) {
  return isSuperAdmin(account) || account?.role === 'admin';
}
