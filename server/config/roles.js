/**
 * Role model
 *
 *  admin    — full access, including user/role management and system configuration.
 *  doctor   — medical lead: inventory, kits, expiry, compliance, inspections, treatments,
 *             reports, activity logs and user management (cannot create/modify admins).
 *  manager  — department lead: incidents and employees of their own department, kit
 *             inspections/restocking, reports.
 *  employee — reports incidents, manages own profile, views own records.
 *
 * Legacy role values that may exist in older databases are mapped onto the model above.
 */
const ROLES = ['admin', 'doctor', 'manager', 'employee'];

const LEGACY_ROLE_MAP = {
  user: 'employee',
  worker: 'employee',
  first_aider: 'employee',
  supervisor: 'manager',
  safety_officer: 'manager'
};

const normalizeRole = (role) => LEGACY_ROLE_MAP[role] || role;

// Roles that may manage the inventory catalog, kits and stock.
const INVENTORY_MANAGERS = ['doctor', 'manager'];
// Roles that may run inspections.
const INSPECTORS = ['doctor', 'manager'];
// Roles with company-wide (rather than department-scoped) visibility.
const COMPANY_WIDE = ['admin', 'doctor'];
// Roles that may manage user accounts.
const USER_ADMINS = ['doctor'];

module.exports = {
  ROLES,
  LEGACY_ROLE_MAP,
  normalizeRole,
  INVENTORY_MANAGERS,
  INSPECTORS,
  COMPANY_WIDE,
  USER_ADMINS
};
