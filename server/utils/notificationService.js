const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

/**
 * Create a notification for specific recipients.
 * @param {Object} opts
 * @param {string} opts.type - Notification type enum value
 * @param {string} opts.title - Notification title
 * @param {string} opts.message - Notification message
 * @param {string} opts.severity - info | warning | critical
 * @param {string} [opts.category] - Category for filtering
 * @param {string} [opts.priority] - critical | high | medium | low
 * @param {string} [opts.relatedModel] - Related model name
 * @param {ObjectId} [opts.relatedId] - Related document ID
 * @param {ObjectId} opts.company - Company ID
 * @param {ObjectId[]} opts.recipients - Array of user IDs
 */
const createAlert = async (opts) => {
  const { type, title, message, severity = 'info', relatedModel, relatedId, company, recipients } = opts;

  if (!recipients || !recipients.length) return [];

  const notifications = recipients.map(recipientId => ({
    recipient: recipientId,
    company,
    type,
    title,
    message,
    severity,
    relatedModel,
    relatedId
  }));

  return Notification.insertMany(notifications);
};

/**
 * Notify all admins and safety officers in a company.
 */
const notifySafetyTeam = async (companyId, alertData) => {
  const users = await User.find({
    company: companyId,
    role: { $in: ['admin', 'safety_officer'] },
    isActive: true
  }).select('_id');

  if (!users.length) return [];

  return createAlert({
    ...alertData,
    company: companyId,
    recipients: users.map(u => u._id)
  });
};

/**
 * Notify the head of a specific department.
 */
const notifyDepartmentHead = async (departmentId, companyId, alertData) => {
  const users = await User.find({
    company: companyId,
    department: departmentId,
    role: 'department_head',
    isActive: true
  }).select('_id');

  if (!users.length) return [];

  return createAlert({
    ...alertData,
    company: companyId,
    recipients: users.map(u => u._id)
  });
};

/**
 * Create an audit log entry.
 * @param {Object} opts
 * @param {ObjectId} opts.user - User who performed the action
 * @param {string} [opts.userName] - User's name for quick reference
 * @param {string} opts.action - Description of the action
 * @param {string} opts.entity - Entity type (Treatment, Prescription, etc.)
 * @param {ObjectId} [opts.entityId] - ID of the affected entity
 * @param {string} [opts.details] - Additional details
 * @param {Object} [opts.metadata] - Extra metadata
 * @param {ObjectId} opts.company - Company ID
 * @param {string} [opts.ipAddress] - Request IP address
 */
const createAuditLog = async (opts) => {
  try {
    return await AuditLog.create(opts);
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('Audit log creation failed:', err.message);
    return null;
  }
};

module.exports = { createAlert, notifySafetyTeam, notifyDepartmentHead, createAuditLog };
