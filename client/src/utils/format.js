/** Formatting helpers and status vocabularies shared across pages. */

const LABELS = {
  adequate: 'Adequate',
  needs_replenishment: 'Needs restock',
  items_expired: 'Expired items',
  overdue_inspection: 'Inspection due',
  inactive: 'Retired',
  compliant: 'Compliant',
  at_risk: 'At risk',
  non_compliant: 'Non-compliant',
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
  not_stocked: 'Not in any kit',
  expired: 'Expired',
  critical: 'Critical',
  soon: '≤ 30 days',
  warning: '≤ 90 days',
  ok: 'OK',
  none: 'No expiry',
  expiring: 'Expiring',
  under_investigation: 'Under investigation',
  returned_to_work: 'Returned to work',
  referred_to_doctor: 'Referred to doctor',
  pending_confirmation: 'Pending confirmation',
  under_observation: 'Under observation',
  near_miss: 'Near miss',
  dangerous_occurrence: 'Dangerous occurrence',
  restock: 'Restock',
  dispense: 'Dispensed',
  adjustment: 'Adjustment',
  expired_removal: 'Expired removed',
  item_added: 'Item added',
  item_removed: 'Item removed',
  kit_retired: 'Kit retired',
  admin: 'Admin',
  doctor: 'Doctor',
  manager: 'Manager',
  employee: 'Employee'
};

export const labelize = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (LABELS[value]) return LABELS[value];
  const s = String(value).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const TONES = {
  green: ['adequate', 'compliant', 'in_stock', 'ok', 'resolved', 'minor', 'active', 'restock', 'returned_to_work', 'adequate_result', 'item_added', 'green', 'success'],
  amber: ['needs_replenishment', 'at_risk', 'low_stock', 'soon', 'warning', 'expiring', 'moderate', 'under_investigation', 'overdue_inspection', 'adjustment', 'pending_confirmation', 'under_observation', 'yellow', 'on_leave'],
  red: ['items_expired', 'non_compliant', 'out_of_stock', 'expired', 'critical', 'serious', 'fatal', 'failed', 'expired_removal', 'hospitalized', 'red', 'suspended', 'resigned', 'item_removed', 'kit_retired'],
  blue: ['reported', 'info', 'dispense', 'doctor', 'referred_to_doctor'],
  teal: ['manager'],
  purple: ['admin'],
  gray: ['closed', 'none', 'not_stocked', 'inactive', 'employee', 'sent_home', 'low']
};
const TONE_BY_VALUE = Object.fromEntries(Object.entries(TONES).flatMap(([tone, values]) => values.map((v) => [v, tone])));
export const toneFor = (value) => TONE_BY_VALUE[value] || 'gray';

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '—');
export const formatDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—');
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const timeAgo = (d) => {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return formatDate(d);
};

export const daysLabel = (days) => {
  if (days === null || days === undefined) return '—';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
};

export const formatNumber = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n));

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

/** Readable message from an axios error. */
export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || (err?.message === 'Network Error' ? 'Cannot reach the server. Check your connection.' : null) || fallback;

/** Save a Blob response as a file. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const CATEGORIES = ['dressing', 'bandage', 'antiseptic', 'medicine', 'equipment', 'other'];
export const ROLES = ['admin', 'doctor', 'manager', 'employee'];
