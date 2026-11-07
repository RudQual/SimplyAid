const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const CATEGORY_BY_TYPE = {
  incident_alert: 'incident',
  incident_update: 'incident',
  report_pending: 'incident',
  inventory_low: 'inventory',
  inventory_alert: 'inventory',
  expiry_alert: 'expiry',
  compliance_alert: 'compliance',
  inspection_due: 'compliance',
  certification_expiry: 'certification',
  treatment_alert: 'treatment',
  prescription_alert: 'prescription',
  system: 'system'
};

const PRIORITY_BY_SEVERITY = { critical: 'critical', warning: 'high', info: 'medium', low: 'low' };

const LINK_BY_MODEL = {
  Incident: (id) => `/incidents/${id}`,
  FirstAidBox: (id) => `/kits/${id}`,
  InventoryItem: (id) => `/inventory/${id}`,
  TreatmentRecord: (id) => `/treatments/${id}`,
  Inspection: (id) => `/inspections/${id}`,
  User: (id) => `/employees/${id}`
};

/** Default in-app link for a notification. */
const defaultLink = (relatedModel, relatedId) =>
  (relatedModel && relatedId && LINK_BY_MODEL[relatedModel]) ? LINK_BY_MODEL[relatedModel](relatedId) : undefined;

/**
 * Create a notification for each recipient.
 *
 * When `dedupeKey` is given, a recipient who already has a notification with the
 * same key does not get another one (enforced atomically by a unique index), so
 * repeated scheduled checks never produce duplicates.
 *
 * @returns {Promise<number>} number of notifications created
 */
const createAlert = async (opts) => {
  const {
    type, title, message, severity = 'info', relatedModel, relatedId, company, recipients,
    dedupeKey, link, titleHi, messageHi
  } = opts;
  if (!recipients || !recipients.length || !company) return 0;

  const uniqueRecipients = [...new Set(recipients.map(String))];
  const base = {
    company,
    type,
    title,
    message,
    titleHi,
    messageHi,
    severity,
    priority: opts.priority || PRIORITY_BY_SEVERITY[severity] || 'medium',
    category: opts.category || CATEGORY_BY_TYPE[type] || 'system',
    relatedModel,
    relatedId,
    link: link || defaultLink(relatedModel, relatedId)
  };

  if (!dedupeKey) {
    const docs = await Notification.insertMany(uniqueRecipients.map((recipient) => ({ ...base, recipient })));
    return docs.length;
  }

  const now = new Date();
  const ops = uniqueRecipients.map((recipient) => ({
    updateOne: {
      filter: { recipient, dedupeKey },
      update: { $setOnInsert: { ...base, recipient, dedupeKey, isRead: false, archivedAt: null, createdAt: now, updatedAt: now } },
      upsert: true,
      timestamps: false
    }
  }));
  try {
    const result = await Notification.bulkWrite(ops, { ordered: false });
    return result.upsertedCount || 0;
  } catch (err) {
    // Concurrent runs may race on the unique index; those duplicates are exactly what we want to drop.
    if (err.code === 11000 || (err.writeErrors && err.writeErrors.every((e) => e.code === 11000))) {
      return (err.result && err.result.upsertedCount) || 0;
    }
    throw err;
  }
};

/**
 * Find active users who should receive an alert.
 * @param {ObjectId} companyId
 * @param {Object} opts
 * @param {string[]} [opts.roles] - roles that receive it company-wide
 * @param {ObjectId} [opts.departmentId] - also include managers of this department
 */
const findRecipients = async (companyId, { roles = ['admin', 'doctor'], departmentId } = {}) => {
  const or = [{ role: { $in: roles } }];
  if (departmentId) or.push({ role: 'manager', department: departmentId });
  const users = await User.find({ company: companyId, isActive: true, $or: or }).select('_id').lean();
  return users.map((u) => u._id);
};

/** Notify administrators, doctors and managers (company-wide safety team). */
const notifySafetyTeam = async (companyId, alertData) => {
  const recipients = await findRecipients(companyId, { roles: ['admin', 'doctor', 'manager'] });
  return createAlert({ ...alertData, company: companyId, recipients });
};

/** Notify admins, doctors and the managers of one department. */
const notifyKitOwners = async (companyId, departmentId, alertData) => {
  const recipients = await findRecipients(companyId, { roles: ['admin', 'doctor'], departmentId });
  return createAlert({ ...alertData, company: companyId, recipients });
};

/**
 * Append an entry to the activity log. Never throws: a logging failure must not
 * break the user's operation, but it is reported on the server console.
 */
const createAuditLog = async (opts) => {
  try {
    return await AuditLog.create(opts);
  } catch (err) {
    console.error('Audit log creation failed:', err.message);
    return null;
  }
};

/** Convenience wrapper that fills user/company/ip from the request. */
const audit = (req, { action, entity, entityId, entityLabel, details, changes, metadata }) => createAuditLog({
  user: req.user && req.user._id,
  userName: req.user && req.user.name,
  userRole: req.user && req.user.role,
  company: req.user && (req.user.company._id || req.user.company),
  ipAddress: req.ip,
  action,
  entity,
  entityId,
  entityLabel,
  details,
  changes,
  metadata
});

/** Field-level diff between two plain objects for the given keys. */
const diffFields = (before, after, keys) => {
  const changes = {};
  keys.forEach((k) => {
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    const norm = (v) => (v === undefined || v === null ? null : (v._id || v).toString());
    if (typeof a === 'object' || typeof b === 'object') {
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null) && norm(a) !== norm(b)) changes[k] = { from: a ?? null, to: b ?? null };
    } else if (a !== b) {
      changes[k] = { from: a ?? null, to: b ?? null };
    }
  });
  return Object.keys(changes).length ? changes : undefined;
};

module.exports = {
  createAlert,
  findRecipients,
  notifySafetyTeam,
  notifyKitOwners,
  createAuditLog,
  audit,
  diffFields,
  defaultLink
};
