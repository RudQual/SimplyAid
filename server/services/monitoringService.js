const crypto = require('crypto');
const FirstAidBox = require('../models/FirstAidBox');
const Company = require('../models/Company');
const User = require('../models/User');
const ExpirySchedule = require('../models/ExpirySchedule');
const { notifyKitOwners, createAlert, findRecipients, createAuditLog } = require('../utils/notificationService');
const { classify } = require('./expiryService');
const { DAY_MS } = require('../config/constants');

/**
 * Monitoring — turns data conditions into notifications.
 *
 * Runs (a) right after every stock change for the affected kit and (b) on a
 * schedule for every company, so expiry and overdue inspections are detected
 * even if nobody opens the app.
 *
 * Each alert carries a dedupe key derived from the condition (kit + affected
 * batches/items + restock episode), so re-running never duplicates an alert, but
 * a new condition (another batch expiring, stock running low again after a
 * restock) does produce a new one.
 */

const hash = (parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
const idOf = (v) => (v && v._id ? v._id : v);
const listNames = (names, max = 4) => (names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`);

/** Generate deduplicated alerts for a single kit. Returns number of notifications created. */
const evaluateBoxAlerts = async (box, now = new Date()) => {
  if (!box || !box.isActive) return 0;
  const companyId = idOf(box.company);
  const departmentId = idOf(box.department);
  const label = `${box.boxId} (${box.location})`;
  const alerts = [];

  const missing = [];
  const low = [];
  const expired = [];
  const critical = [];
  const soon = [];

  box.items.forEach((i) => {
    const name = (i.item && i.item.name) || 'Item';
    const qty = (i.stocks || []).reduce((s, b) => s + (b.quantity || 0), 0);
    const episode = i.lastRestocked ? new Date(i.lastRestocked).getTime() : 0;
    if (i.requiredQty > 0 && qty === 0) missing.push({ name, key: `${idOf(i.item)}:${episode}` });
    else if (i.requiredQty > 0 && qty < i.requiredQty) low.push({ name: `${name} (${qty}/${i.requiredQty})`, key: `${idOf(i.item)}:${episode}` });
    (i.stocks || []).forEach((b) => {
      if (!b.quantity) return;
      const { status } = classify(b.expiryDate, now);
      const entry = { name: `${name}${b.batchNumber ? ` [${b.batchNumber}]` : ''}`, key: String(b._id) };
      if (status === 'expired') expired.push(entry);
      else if (status === 'critical') critical.push(entry);
      else if (status === 'soon') soon.push(entry);
    });
  });

  const base = { relatedModel: 'FirstAidBox', relatedId: box._id, link: `/kits/${box._id}` };

  if (missing.length) {
    alerts.push({
      ...base, type: 'inventory_alert', severity: 'critical',
      title: `Missing supplies in kit ${box.boxId}`,
      message: `${label} is out of: ${listNames(missing.map((m) => m.name))}. Restock immediately.`,
      dedupeKey: `kit:missing:${box._id}:${hash(missing.map((m) => m.key).sort())}`
    });
  }
  if (low.length) {
    alerts.push({
      ...base, type: 'inventory_low', severity: 'warning',
      title: `Low stock in kit ${box.boxId}`,
      message: `${label} is below the required quantity for: ${listNames(low.map((m) => m.name))}.`,
      dedupeKey: `kit:low:${box._id}:${hash(low.map((m) => m.key).sort())}`
    });
  }
  if (expired.length) {
    alerts.push({
      ...base, type: 'expiry_alert', severity: 'critical',
      title: `Expired supplies in kit ${box.boxId}`,
      message: `${label} contains expired stock: ${listNames(expired.map((m) => m.name))}. Remove and replace it.`,
      dedupeKey: `kit:expired:${box._id}:${hash(expired.map((m) => m.key).sort())}`
    });
  }
  if (critical.length) {
    alerts.push({
      ...base, type: 'expiry_alert', severity: 'critical',
      title: `Supplies expiring within 7 days in kit ${box.boxId}`,
      message: `${label}: ${listNames(critical.map((m) => m.name))} expire within a week.`,
      dedupeKey: `kit:exp7:${box._id}:${hash(critical.map((m) => m.key).sort())}`
    });
  }
  if (soon.length) {
    alerts.push({
      ...base, type: 'expiry_alert', severity: 'warning',
      title: `Supplies expiring within 30 days in kit ${box.boxId}`,
      message: `${label}: ${listNames(soon.map((m) => m.name))} expire within 30 days.`,
      dedupeKey: `kit:exp30:${box._id}:${hash(soon.map((m) => m.key).sort())}`
    });
  }
  if (!box.nextInspectionDue || new Date(box.nextInspectionDue) < now) {
    alerts.push({
      ...base, type: 'inspection_due', severity: 'warning',
      title: `Inspection overdue for kit ${box.boxId}`,
      message: box.nextInspectionDue
        ? `${label} was due for inspection on ${new Date(box.nextInspectionDue).toDateString()}.`
        : `${label} has never been inspected.`,
      dedupeKey: `kit:inspection:${box._id}:${box.nextInspectionDue ? new Date(box.nextInspectionDue).getTime() : 'never'}`
    });
  }

  if (!alerts.length) return 0;
  const recipients = await findRecipients(companyId, { roles: ['admin', 'doctor'], departmentId });
  let created = 0;
  for (const alert of alerts) {
    created += await createAlert({ ...alert, company: companyId, recipients });
  }
  return created;
};

const isoWeek = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${Math.ceil(((date - yearStart) / DAY_MS + 1) / 7)}`;
};

/** Run all checks for one company. */
const runCompanyChecks = async (companyId, now = new Date()) => {
  const boxes = await FirstAidBox.find({ company: companyId, isActive: true }).populate('items.item', 'name');
  let alerts = 0;
  let statusUpdates = 0;

  for (const box of boxes) {
    const previous = box.status;
    const migrated = box.migrateLegacyStock();
    box.computeStatus(now);
    if (migrated) {
      await box.save();
      statusUpdates += 1;
    } else if (previous !== box.status || box.isModified('health')) {
      // Time-based changes (expiry, overdue inspection) — persist without touching stock.
      await FirstAidBox.updateOne({ _id: box._id }, { $set: { status: box.status, health: box.health } });
      if (previous !== box.status) statusUpdates += 1;
    }
    alerts += await evaluateBoxAlerts(box, now);
  }

  // Statutory compliance failures — re-alerted at most once per week while failing.
  const { companyCompliance } = require('./complianceService');
  const compliance = await companyCompliance(companyId);
  const failing = compliance.checks.filter((c) => !c.compliant && ['box_count', 'form18', 'in_charge'].includes(c.key));
  if (failing.length) {
    const recipients = await findRecipients(companyId, { roles: ['admin', 'doctor'] });
    for (const c of failing) {
      alerts += await createAlert({
        company: companyId,
        recipients,
        type: 'compliance_alert',
        severity: c.status === 'red' ? 'critical' : 'warning',
        title: `Compliance issue: ${c.rule}`,
        message: `${c.section}: required ${c.required}, current ${c.actual}.`,
        link: '/compliance',
        dedupeKey: `compliance:${companyId}:${c.key}:${isoWeek(now)}`
      });
    }
  }

  // First-aid certifications expiring within 30 days
  const expiringCerts = await User.find({
    company: companyId, isActive: true, firstAidCertified: true,
    certificationExpiry: { $gte: now, $lte: new Date(now.getTime() + 30 * DAY_MS) }
  }).select('name certificationExpiry department');
  if (expiringCerts.length) {
    const recipients = await findRecipients(companyId, { roles: ['admin', 'doctor'] });
    for (const u of expiringCerts) {
      alerts += await createAlert({
        company: companyId,
        recipients: [...recipients, u._id],
        type: 'certification_expiry',
        severity: 'warning',
        title: `First-aid certification expiring: ${u.name}`,
        message: `${u.name}'s first-aid certification expires on ${u.certificationExpiry.toDateString()}.`,
        relatedModel: 'User',
        relatedId: u._id,
        dedupeKey: `cert:${u._id}:${u.certificationExpiry.getTime()}`
      });
    }
  }

  return { boxesChecked: boxes.length, alertsGenerated: alerts, statusUpdates, complianceScore: compliance.overallCompliance };
};

/** Run checks for every active company. */
const runAllChecks = async () => {
  const companies = await Company.find({ isActive: { $ne: false } }).select('_id name');
  const totals = { companies: companies.length, boxesChecked: 0, alertsGenerated: 0, statusUpdates: 0 };
  for (const company of companies) {
    try {
      const r = await runCompanyChecks(company._id);
      totals.boxesChecked += r.boxesChecked;
      totals.alertsGenerated += r.alertsGenerated;
      totals.statusUpdates += r.statusUpdates;
      if (r.alertsGenerated || r.statusUpdates) {
        await createAuditLog({
          company: company._id,
          userName: 'System',
          userRole: 'system',
          action: 'Scheduled monitoring run',
          entity: 'System',
          details: `Checked ${r.boxesChecked} kit(s): ${r.alertsGenerated} new alert(s), ${r.statusUpdates} status change(s)`
        });
      }
    } catch (err) {
      console.error(`Monitoring failed for company ${company.name}:`, err.message);
    }
  }
  return totals;
};

// ─── Scheduler ──────────────────────────────────────────────────────────────

const SCHEDULE_KEY = 'expiry_check';
const TICK_MS = 15 * 60 * 1000;
let timer = null;

const intervalHours = (schedule) => Number(process.env.MONITOR_INTERVAL_HOURS) || (schedule && schedule.intervalHours) || 24;

/**
 * Claim the next run atomically so that, with several server instances, only
 * one of them runs the job per interval.
 */
const claimRun = async (now = new Date()) => {
  await ExpirySchedule.updateOne({ key: SCHEDULE_KEY }, { $setOnInsert: { key: SCHEDULE_KEY, lastRunAt: null } }, { upsert: true });
  const schedule = await ExpirySchedule.findOne({ key: SCHEDULE_KEY });
  const cutoff = new Date(now.getTime() - intervalHours(schedule) * 60 * 60 * 1000);
  return ExpirySchedule.findOneAndUpdate(
    { key: SCHEDULE_KEY, $or: [{ lastRunAt: null }, { lastRunAt: { $lte: cutoff } }] },
    { $set: { lastRunAt: now } },
    { returnDocument: 'after' }
  );
};

const tick = async () => {
  try {
    const claimed = await claimRun();
    if (!claimed) return null;
    const totals = await runAllChecks();
    await ExpirySchedule.updateOne({ key: SCHEDULE_KEY }, {
      $set: { alertsGeneratedLastRun: totals.alertsGenerated, boxesCheckedLastRun: totals.boxesChecked }
    });
    console.log(`⏰ Monitoring: ${totals.boxesChecked} kit(s) checked, ${totals.alertsGenerated} new alert(s)`);
    return totals;
  } catch (err) {
    console.error('❌ Monitoring scheduler error:', err.message);
    return null;
  }
};

const startScheduler = () => {
  if (timer) return;
  console.log(`⏰ Monitoring scheduler started (runs every ${Number(process.env.MONITOR_INTERVAL_HOURS) || 'configured'}h, checked every 15 min)`);
  tick();
  timer = setInterval(tick, TICK_MS);
  if (timer.unref) timer.unref();
};

const stopScheduler = () => { if (timer) clearInterval(timer); timer = null; };

const getScheduleStatus = async () => {
  const schedule = await ExpirySchedule.findOne({ key: SCHEDULE_KEY }).lean();
  const hours = intervalHours(schedule);
  return {
    lastRunAt: schedule ? schedule.lastRunAt : null,
    intervalHours: hours,
    nextRunAt: schedule && schedule.lastRunAt ? new Date(new Date(schedule.lastRunAt).getTime() + hours * 3600 * 1000) : null,
    alertsGeneratedLastRun: schedule ? schedule.alertsGeneratedLastRun : 0,
    boxesCheckedLastRun: schedule ? schedule.boxesCheckedLastRun : 0
  };
};

module.exports = { evaluateBoxAlerts, runCompanyChecks, runAllChecks, startScheduler, stopScheduler, tick, getScheduleStatus, notifyKitOwners };
