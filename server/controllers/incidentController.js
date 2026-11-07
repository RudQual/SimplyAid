const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Incident = require('../models/Incident');
const User = require('../models/User');
const Scanner = require('../models/Scanner');
const Department = require('../models/Department');
const FirstAidBox = require('../models/FirstAidBox');
const { deductForIncident } = require('../services/stockService');
const { createAlert, findRecipients, audit } = require('../utils/notificationService');
const { departmentScope } = require('../utils/access');
const {
  ApiError, companyIdOf, departmentIdOf, qs, isValidId, searchRegex, parsePagination, paginated, dateRange, pick
} = require('../utils/http');

const SEVERITIES = ['minor', 'moderate', 'serious', 'fatal'];
const STATUSES = ['reported', 'under_investigation', 'resolved', 'closed'];
const OUTCOMES = ['returned_to_work', 'sent_home', 'hospitalized', 'referred_to_doctor', 'fatal', 'under_observation', 'pending_confirmation'];

const CREATE_FIELDS = ['injuredPerson', 'dateTime', 'location', 'department', 'scanner', 'incidentType', 'injuryTypes', 'severity',
  'description', 'causeOfInjury', 'bodyPartAffected', 'treatmentGiven', 'treatedBy', 'firstAidBoxUsed', 'itemsUsed', 'outcome',
  'hospitalName', 'daysLost', 'witnesses', 'reportMode'];
const UPDATE_FIELDS = ['severity', 'description', 'treatmentGiven', 'treatedBy', 'outcome', 'daysLost', 'dateOfReturn', 'rootCause',
  'correctiveAction', 'preventiveMeasures', 'causeOfInjury', 'hospitalName', 'witnesses', 'status', 'bodyPartAffected', 'location', 'incidentType'];
const FILL_FIELDS = ['incidentType', 'severity', 'description', 'location', 'causeOfInjury', 'bodyPartAffected', 'treatmentGiven',
  'treatedBy', 'firstAidBoxUsed', 'itemsUsed', 'outcome', 'daysLost', 'hospitalName', 'witnesses', 'injuredPerson', 'dateTime', 'department'];

const severityToAlert = (s) => (s === 'fatal' ? 'critical' : s === 'serious' ? 'warning' : 'info');

/** Restrict which incidents the current user may see. */
const visibilityFilter = (req) => {
  const filter = { company: companyIdOf(req) };
  const scope = departmentScope(req);
  // Managers see their department, plus any incident they were alerted to as a responder.
  if (scope) filter.$or = [{ department: scope }, { responders: req.user._id }];
  if (req.user.role === 'employee') {
    filter.$or = [{ reportedBy: req.user._id }];
    if (req.user.employeeId) filter.$or.push({ 'injuredPerson.employeeId': req.user.employeeId });
  }
  return filter;
};

const isResponder = (incident, userId) => (incident.responders || []).some((r) => String(r._id || r) === String(userId));

const loadIncident = async (req, id, { forManager = false } = {}) => {
  if (!isValidId(id)) throw ApiError.notFound('Incident not found');
  const incident = await Incident.findOne({ _id: id, ...visibilityFilter(req) });
  if (!incident) throw ApiError.notFound('Incident not found');
  if (forManager && req.user.role === 'manager' && departmentIdOf(req)
    && String(incident.department) !== String(departmentIdOf(req)) && !isResponder(incident, req.user._id)) {
    throw ApiError.forbidden('Managers can only act on incidents in their own department');
  }
  return incident;
};

/** Validate references and sanitise the itemsUsed list. */
const normalizeRefs = async (req, data) => {
  const companyId = companyIdOf(req);
  if (data.department !== undefined && data.department !== null && data.department !== '') {
    if (!isValidId(String(data.department)) || !(await Department.exists({ _id: data.department, company: companyId }))) {
      throw ApiError.badRequest('Invalid department');
    }
  } else if (data.department === '') delete data.department;
  if (data.firstAidBoxUsed) {
    if (!isValidId(String(data.firstAidBoxUsed)) || !(await FirstAidBox.exists({ _id: data.firstAidBoxUsed, company: companyId }))) {
      throw ApiError.badRequest('Invalid first aid kit');
    }
  } else if (data.firstAidBoxUsed === '') data.firstAidBoxUsed = undefined;
  if (data.treatedBy) {
    if (!isValidId(String(data.treatedBy)) || !(await User.exists({ _id: data.treatedBy, company: companyId }))) throw ApiError.badRequest('Invalid "treated by" user');
  } else if (data.treatedBy === '') data.treatedBy = undefined;
  if (data.itemsUsed !== undefined) {
    if (!Array.isArray(data.itemsUsed)) throw ApiError.badRequest('itemsUsed must be a list');
    data.itemsUsed = data.itemsUsed
      .filter((u) => u && (u.item || u.itemName))
      .slice(0, 50)
      .map((u) => {
        const quantity = Number(u.quantity ?? 1);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw ApiError.badRequest('Quantity used must be a whole number between 1 and 1000');
        if (u.item && !isValidId(String(u.item))) throw ApiError.badRequest('Invalid item in itemsUsed');
        return { item: u.item || undefined, itemName: u.itemName ? String(u.itemName).slice(0, 120) : undefined, quantity };
      });
  }
  if (data.severity !== undefined && !SEVERITIES.includes(data.severity)) throw ApiError.badRequest('Invalid severity');
  if (data.outcome !== undefined && !OUTCOMES.includes(data.outcome)) throw ApiError.badRequest('Invalid outcome');
  if (data.status !== undefined && !STATUSES.includes(data.status)) throw ApiError.badRequest('Invalid status');
  if (data.daysLost !== undefined) {
    const d = Number(data.daysLost);
    if (!Number.isFinite(d) || d < 0 || d > 3650) throw ApiError.badRequest('Days lost must be between 0 and 3650');
    data.daysLost = d;
  }
  if (data.dateTime !== undefined) {
    const dt = new Date(data.dateTime);
    if (Number.isNaN(dt.getTime())) throw ApiError.badRequest('Invalid incident date');
    if (dt > new Date(Date.now() + 5 * 60000)) throw ApiError.badRequest('Incident date cannot be in the future');
  }
  return data;
};

const deductSafely = async (incident, user) => {
  try {
    const result = await deductForIncident(incident, user);
    const shortfall = result ? result.transactions.reduce((s, t) => s + (t.shortfall || 0), 0) : 0;
    return shortfall ? `Kit stock was insufficient by ${shortfall} unit(s); the kit has been flagged for restocking.` : null;
  } catch (err) {
    console.error('Stock deduction failed for incident', incident.incidentId, err.message);
    return 'Supplies could not be deducted from the kit automatically. Please adjust the kit stock manually.';
  }
};

const populateIncident = (id) => Incident.findById(id)
  .populate('reportedBy', 'name email').populate('company', 'name').populate('department', 'name code')
  .populate('injuredPerson.department', 'name').populate('treatedBy', 'name')
  .populate('firstAidBoxUsed', 'boxId location').populate('itemsUsed.item', 'name category unit')
  .populate('statusHistory.changedBy', 'name').populate('closedBy', 'name').populate('scanner', 'name location')
  .populate('managerConfirmation.confirmedBy', 'name').populate('doctorReview.reviewedBy', 'name');

// @route POST /api/incidents
exports.createIncident = async (req, res) => {
  const companyId = companyIdOf(req);
  const data = await normalizeRefs(req, pick(req.body, CREATE_FIELDS));

  if (data.scanner) {
    if (!isValidId(String(data.scanner))) throw ApiError.badRequest('Invalid scanner');
    const scanner = await Scanner.findOne({ _id: data.scanner, company: companyId });
    if (!scanner) throw ApiError.badRequest('Invalid scanner');
    if (!data.department) data.department = scanner.department;
    if (!data.location) data.location = scanner.location;
  }
  if (!data.department && departmentIdOf(req)) data.department = departmentIdOf(req);
  if (!data.department) throw ApiError.badRequest('Department is required');
  if (!data.injuredPerson || !data.injuredPerson.name) {
    data.injuredPerson = { ...(data.injuredPerson || {}), name: req.user.name, employeeId: req.user.employeeId };
  }
  data.injuredPerson = pick(data.injuredPerson, ['name', 'employeeId', 'department', 'age', 'gender', 'designation']);
  if (data.reportMode && !['self_reported', 'manager_assisted'].includes(data.reportMode)) delete data.reportMode;
  const isManagerAssisted = data.reportMode === 'manager_assisted';
  if (!data.outcome) data.outcome = 'pending_confirmation';

  // Notifications: department managers (or all managers if none), doctors for serious/fatal
  let managers = await User.find({ company: companyId, role: 'manager', department: data.department, isActive: true }).select('_id');
  if (!managers.length) managers = await User.find({ company: companyId, role: 'manager', isActive: true }).select('_id');
  const managerIds = managers.map((m) => m._id).filter((id) => String(id) !== String(req.user._id));

  const incident = new Incident({
    ...data,
    company: companyId,
    reportedBy: req.user._id,
    pendingManagerAssist: isManagerAssisted,
    responders: managerIds,
    statusHistory: [{ status: 'reported', changedBy: req.user._id, notes: isManagerAssisted ? 'Employee requested manager assistance to fill report' : 'Incident reported' }]
  });
  await incident.save();

  const warning = await deductSafely(incident, req.user);
  const base = { company: companyId, relatedModel: 'Incident', relatedId: incident._id };

  if (isManagerAssisted) {
    await createAlert({
      ...base, recipients: managerIds, type: 'report_pending', severity: 'warning', priority: 'high',
      title: `Action required: fill incident report for ${incident.injuredPerson.name}`,
      message: `${incident.injuredPerson.name} (${incident.injuredPerson.employeeId || 'N/A'}) needs help filling report ${incident.incidentId}. Please visit them on-site.`,
      titleHi: `ज़रूरी: ${incident.injuredPerson.name} की घटना रिपोर्ट भरें`,
      messageHi: `${incident.injuredPerson.name} को रिपोर्ट ${incident.incidentId} भरने में मदद चाहिए। कृपया मौके पर जाएँ।`
    });
  } else {
    await createAlert({
      ...base, recipients: managerIds, type: 'incident_alert', severity: severityToAlert(incident.severity),
      title: `New ${incident.severity} incident reported`,
      message: `${incident.incidentId}: ${incident.description.substring(0, 140)}`
    });
    if (['serious', 'fatal'].includes(incident.severity)) {
      const doctors = await findRecipients(companyId, { roles: ['doctor', 'admin'] });
      await createAlert({
        ...base, recipients: doctors, type: 'incident_alert', severity: severityToAlert(incident.severity),
        title: `${incident.severity === 'fatal' ? 'Fatal' : 'Serious'} incident ${incident.incidentId}`,
        message: `${incident.injuredPerson.name} at ${incident.location}. ${incident.isReportable ? 'Reportable under Section 88 — Form 18 required.' : ''}`
      });
    }
  }

  audit(req, { action: 'Reported incident', entity: 'Incident', entityId: incident._id, entityLabel: incident.incidentId, details: `${incident.severity} ${incident.incidentType} at ${incident.location}` });
  const populated = await populateIncident(incident._id);
  res.status(201).json({ success: true, data: populated, message: `Incident ${incident.incidentId} reported`, warning });
};

// @route POST /api/incidents/sos
exports.createSOSIncident = async (req, res) => {
  const user = req.user;
  const companyId = companyIdOf(req);
  const departmentId = departmentIdOf(req);
  if (!departmentId) throw ApiError.badRequest('Your account has no department. Ask your administrator to assign one so SOS can be routed.');

  let immediateManager = null;
  if (user.reportingManager) {
    immediateManager = await User.findOne({ company: companyId, role: 'manager', name: user.reportingManager, isActive: true });
  }
  if (!immediateManager) immediateManager = await User.findOne({ company: companyId, department: departmentId, role: 'manager', isActive: true });
  if (!immediateManager) immediateManager = await User.findOne({ company: companyId, role: 'manager', isActive: true });

  const location = user.factoryLocation || 'Unknown — SOS triggered';
  // Every manager is alerted about an SOS, so every manager must be able to open it.
  const allManagers = await findRecipients(companyId, { roles: ['manager'] });
  const responders = [...new Set([...(immediateManager ? [String(immediateManager._id)] : []), ...allManagers.map(String)])]
    .filter((id) => id !== String(user._id));
  const incident = await Incident.create({
    isSOS: true,
    responders,
    company: companyId,
    reportedBy: user._id,
    injuredPerson: { name: user.name, employeeId: user.employeeId, department: departmentId, gender: user.gender, designation: user.designation },
    dateTime: new Date(),
    location,
    department: departmentId,
    incidentType: 'injury',
    severity: 'serious',
    description: `SOS EMERGENCY triggered by ${user.name} (${user.employeeId || 'N/A'}). Immediate assistance required. Details pending.`,
    outcome: 'pending_confirmation',
    status: 'reported',
    reportMode: 'self_reported',
    pendingManagerAssist: true,
    statusHistory: [{ status: 'reported', changedBy: user._id, notes: 'SOS Emergency — auto-generated. Employee needs immediate help.' }]
  });

  const base = { company: companyId, relatedModel: 'Incident', relatedId: incident._id, severity: 'critical', priority: 'critical' };
  const deptName = (user.department && user.department.name) || 'Unknown department';
  if (immediateManager) {
    await createAlert({
      ...base, recipients: [immediateManager._id], type: 'report_pending',
      title: `SOS EMERGENCY from ${user.name}`,
      message: `${user.name} (${user.employeeId || 'N/A'}), ${user.designation || 'Employee'} in ${deptName}, triggered SOS at ${location}. Report ${incident.incidentId}. Go to them immediately.`,
      titleHi: `${user.name} की ओर से SOS आपातकाल`,
      messageHi: `${user.name} (${user.employeeId || 'N/A'}), ${deptName}, ने ${location} पर SOS दबाया है। रिपोर्ट ${incident.incidentId}। तुरंत उनके पास पहुँचें।`
    });
  }
  const others = (await findRecipients(companyId, { roles: ['manager', 'doctor', 'admin'] }))
    .filter((id) => !immediateManager || String(id) !== String(immediateManager._id));
  await createAlert({
    ...base, recipients: others, type: 'incident_alert',
    title: `SOS: ${user.name} needs emergency help`,
    message: `Emergency incident ${incident.incidentId} at ${location}. Prepare for medical response.`,
    titleHi: `SOS: ${user.name} को तुरंत मदद चाहिए`,
    messageHi: `${location} पर आपातकालीन घटना ${incident.incidentId}। मेडिकल सहायता के लिए तैयार रहें।`
  });

  audit(req, { action: 'Triggered SOS', entity: 'Incident', entityId: incident._id, entityLabel: incident.incidentId });
  const populated = await populateIncident(incident._id);
  res.status(201).json({
    success: true,
    data: populated,
    message: `SOS sent! ${immediateManager ? `${immediateManager.name} has been notified.` : 'All managers have been notified.'}`
  });
};

// @route GET /api/incidents
exports.getIncidents = async (req, res) => {
  const filter = visibilityFilter(req);
  const department = qs(req.query.department);
  if (department && !filter.department) { if (!isValidId(department)) throw ApiError.badRequest('Invalid department'); filter.department = department; }
  const map = { severity: 'severity', status: 'status', outcome: 'outcome', incidentType: 'incidentType', location: 'location' };
  Object.entries(map).forEach(([q, f]) => { const v = qs(req.query[q]); if (v) filter[f] = v; });
  const fwd = qs(req.query.forwardedToDoctor);
  if (fwd !== undefined) filter.forwardedToDoctor = fwd === 'true';
  const sos = qs(req.query.isSOS);
  if (sos !== undefined) filter.isSOS = sos === 'true';
  const pending = qs(req.query.pendingManagerAssist);
  if (pending !== undefined) filter.pendingManagerAssist = pending === 'true';
  const reportable = qs(req.query.reportable);
  if (reportable !== undefined) filter.isReportable = reportable === 'true';
  const range = dateRange(req.query);
  if (range) filter.dateTime = range;
  const search = qs(req.query.search);
  if (search) {
    const rx = searchRegex(search);
    const or = [{ incidentId: rx }, { description: rx }, { 'injuredPerson.name': rx }, { location: rx }];
    filter.$and = [...(filter.$and || []), { $or: or }];
  }

  const pg = parsePagination(req.query, { defaultLimit: 20 });
  const [incidents, total] = await Promise.all([
    Incident.find(filter).populate('reportedBy', 'name').populate('department', 'name code').populate('treatedBy', 'name')
      .populate('firstAidBoxUsed', 'boxId').populate('managerConfirmation.confirmedBy', 'name')
      .sort('-dateTime').skip(pg.skip).limit(pg.limit),
    Incident.countDocuments(filter)
  ]);
  res.json(paginated(incidents, total, pg));
};

// @route GET /api/incidents/:id
exports.getIncident = async (req, res) => {
  const incident = await loadIncident(req, req.params.id);
  res.json({ success: true, data: await populateIncident(incident._id) });
};

// @route PUT /api/incidents/:id
exports.updateIncident = async (req, res) => {
  const incident = await loadIncident(req, req.params.id, { forManager: true });
  const data = await normalizeRefs(req, pick(req.body, UPDATE_FIELDS));
  const before = { status: incident.status, outcome: incident.outcome, severity: incident.severity };

  if (data.status && data.status !== incident.status) {
    incident.statusHistory.push({ status: data.status, changedBy: req.user._id, notes: req.body.statusNotes ? String(req.body.statusNotes).slice(0, 500) : `Status changed to ${data.status.replace(/_/g, ' ')}` });
    if (data.status === 'closed') { incident.closedBy = req.user._id; incident.closedAt = new Date(); }
  }
  const outcomeChanged = data.outcome && data.outcome !== incident.outcome;
  incident.set(data);

  if (outcomeChanged && incident.outcome === 'referred_to_doctor') {
    incident.forwardedToDoctor = true;
    const doctors = await findRecipients(incident.company, { roles: ['doctor'] });
    await createAlert({
      company: incident.company, recipients: doctors, type: 'incident_alert', severity: 'warning',
      title: `Incident ${incident.incidentId} requires medical attention`, message: 'The incident was referred to a doctor. Please review.',
      relatedModel: 'Incident', relatedId: incident._id
    });
  } else if (outcomeChanged && incident.outcome === 'returned_to_work') {
    incident.forwardedToDoctor = false;
    if (!['resolved', 'closed'].includes(incident.status)) {
      incident.status = 'resolved';
      incident.statusHistory.push({ status: 'resolved', changedBy: req.user._id, notes: 'Resolved automatically: employee returned to work.' });
    }
  }
  await incident.save();
  audit(req, {
    action: 'Updated incident', entity: 'Incident', entityId: incident._id, entityLabel: incident.incidentId,
    changes: Object.fromEntries(Object.entries(before).filter(([k, v]) => v !== incident[k]).map(([k, v]) => [k, { from: v, to: incident[k] }]))
  });
  res.json({ success: true, data: await populateIncident(incident._id), message: 'Incident updated' });
};

// @route GET /api/incidents/stats/summary
exports.getIncidentStats = async (req, res) => {
  const vis = visibilityFilter(req);
  const oid = (v) => new mongoose.Types.ObjectId(String(v));
  const baseMatch = { company: oid(vis.company) };
  // Aggregations don't cast types, so convert ids in the visibility clauses.
  if (vis.$or) {
    baseMatch.$or = vis.$or.map((c) => (c.department ? { department: oid(c.department) } : c.responders ? { responders: oid(c.responders) } : c));
  }
  const period = Math.min(3650, Math.max(1, parseInt(qs(req.query.period), 10) || 30));
  const startDate = new Date(Date.now() - period * 86400000);
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [[stats], deptStats, monthlyTrend, typeBreakdown] = await Promise.all([
    Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: startDate } } },
      { $group: {
        _id: null, total: { $sum: 1 },
        minor: { $sum: { $cond: [{ $eq: ['$severity', 'minor'] }, 1, 0] } },
        moderate: { $sum: { $cond: [{ $eq: ['$severity', 'moderate'] }, 1, 0] } },
        serious: { $sum: { $cond: [{ $eq: ['$severity', 'serious'] }, 1, 0] } },
        fatal: { $sum: { $cond: [{ $eq: ['$severity', 'fatal'] }, 1, 0] } },
        totalDaysLost: { $sum: '$daysLost' },
        reportable: { $sum: { $cond: ['$isReportable', 1, 0] } },
        openCases: { $sum: { $cond: [{ $in: ['$status', ['reported', 'under_investigation']] }, 1, 0] } }
      } }
    ]),
    Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: startDate } } },
      { $group: { _id: '$department', count: { $sum: 1 }, serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: '$department' }, { $sort: { count: -1 } }
    ]),
    Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$dateTime' }, month: { $month: '$dateTime' } }, count: { $sum: 1 }, serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: startDate } } },
      { $group: { _id: '$incidentType', count: { $sum: 1 } } }
    ])
  ]);
  res.json({
    success: true,
    data: {
      summary: stats || { total: 0, minor: 0, moderate: 0, serious: 0, fatal: 0, totalDaysLost: 0, reportable: 0, openCases: 0 },
      departmentStats: deptStats,
      monthlyTrend,
      typeBreakdown
    }
  });
};

// @route PUT /api/incidents/:id/manager-confirm
exports.managerConfirm = async (req, res) => {
  const incident = await loadIncident(req, req.params.id, { forManager: true });
  if (['resolved', 'closed'].includes(incident.status)) throw ApiError.conflict('This incident is already resolved');
  const notes = req.body.notes ? String(req.body.notes).slice(0, 2000) : '';
  if (req.body.outcome !== undefined) {
    if (!OUTCOMES.includes(req.body.outcome)) throw ApiError.badRequest('Invalid outcome');
    incident.outcome = req.body.outcome;
  }
  incident.managerConfirmation = { confirmedBy: req.user._id, notes, confirmedAt: new Date() };
  incident.status = 'under_investigation';
  incident.statusHistory.push({ status: 'under_investigation', changedBy: req.user._id, notes: `Manager confirmed on-site. Outcome: ${incident.outcome.replace(/_/g, ' ')}. ${notes}` });

  if (incident.outcome === 'referred_to_doctor') {
    incident.forwardedToDoctor = true;
    const doctors = await findRecipients(incident.company, { roles: ['doctor'] });
    await createAlert({
      company: incident.company, recipients: doctors, type: 'incident_alert', severity: 'warning',
      title: `Incident ${incident.incidentId} requires medical attention`, message: 'A manager referred the employee to a doctor. Please review.',
      relatedModel: 'Incident', relatedId: incident._id
    });
  } else {
    incident.forwardedToDoctor = false;
    if (incident.outcome === 'returned_to_work') {
      incident.status = 'resolved';
      incident.statusHistory.push({ status: 'resolved', changedBy: req.user._id, notes: 'Resolved automatically: employee returned to work.' });
    }
  }
  await incident.save();
  const warning = await deductSafely(incident, req.user);
  audit(req, { action: 'Manager confirmed incident', entity: 'Incident', entityId: incident._id, entityLabel: incident.incidentId, details: notes });
  res.json({ success: true, data: await populateIncident(incident._id), message: 'Incident confirmed', warning });
};

// @route PUT /api/incidents/:id/doctor-review
exports.doctorReview = async (req, res) => {
  const incident = await loadIncident(req, req.params.id);
  if (['resolved', 'closed'].includes(incident.status) && incident.doctorReview && incident.doctorReview.reviewedAt) {
    throw ApiError.conflict('This incident has already been reviewed');
  }
  const notes = req.body.notes ? String(req.body.notes).slice(0, 4000) : '';
  incident.doctorReview = { reviewedBy: req.user._id, notes, reviewedAt: new Date() };
  incident.status = 'resolved';
  incident.statusHistory.push({ status: 'resolved', changedBy: req.user._id, notes: `Doctor reviewed. ${notes}` });
  await incident.save();
  const warning = await deductSafely(incident, req.user);
  audit(req, { action: 'Doctor reviewed incident', entity: 'Incident', entityId: incident._id, entityLabel: incident.incidentId });
  res.json({ success: true, data: await populateIncident(incident._id), message: 'Incident reviewed and resolved', warning });
};

// @route PUT /api/incidents/:id/manager-fill
exports.managerFillIncident = async (req, res) => {
  const incident = await loadIncident(req, req.params.id, { forManager: true });
  if (!incident.pendingManagerAssist) throw ApiError.badRequest('This incident does not require manager assistance');
  const data = await normalizeRefs(req, pick(req.body, FILL_FIELDS));
  if (data.injuredPerson) data.injuredPerson = pick(data.injuredPerson, ['name', 'employeeId', 'department', 'age', 'gender', 'designation']);
  if (incident.stockDeducted) { delete data.itemsUsed; delete data.firstAidBoxUsed; }
  incident.set(data);
  incident.pendingManagerAssist = false;
  const notes = req.body.managerNotes ? String(req.body.managerNotes).slice(0, 2000) : 'Manager visited on-site and filled the incident report.';
  incident.managerConfirmation = { confirmedBy: req.user._id, notes, confirmedAt: new Date() };
  incident.forwardedToDoctor = true;
  incident.status = 'under_investigation';
  incident.statusHistory.push({ status: 'under_investigation', changedBy: req.user._id, notes: `Manager completed the incident report on-site. ${notes}` });
  await incident.save();
  const warning = await deductSafely(incident, req.user);

  const doctors = await findRecipients(incident.company, { roles: ['doctor'] });
  await createAlert({
    company: incident.company, recipients: doctors, type: 'incident_alert', severity: 'warning',
    title: `Incident ${incident.incidentId} filed by manager`,
    message: `The incident report for ${incident.injuredPerson.name} was completed on-site. Please review.`,
    relatedModel: 'Incident', relatedId: incident._id
  });
  audit(req, { action: 'Manager filled incident report', entity: 'Incident', entityId: incident._id, entityLabel: incident.incidentId });
  res.json({ success: true, data: await populateIncident(incident._id), message: 'Incident report completed', warning });
};

// @route GET /api/incidents/:id/form18 — Form 18 (Section 88) accident notice as PDF; marks it generated
exports.generateForm18 = async (req, res) => {
  const incident = await loadIncident(req, req.params.id);
  const full = await populateIncident(incident._id);
  if (!incident.form18Generated) {
    await Incident.updateOne({ _id: incident._id }, { $set: { form18Generated: true, form18GeneratedDate: new Date() } });
    audit(req, { action: 'Generated Form 18', entity: 'Incident', entityId: incident._id, entityLabel: incident.incidentId });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Form18-${incident.incidentId}.pdf"`);
  doc.pipe(res);
  doc.fontSize(16).text('FORM No. 18', { align: 'center' });
  doc.fontSize(10).text('(Prescribed under Section 88 of the Factories Act, 1948)', { align: 'center' });
  doc.fontSize(12).text('Report of Accident / Dangerous Occurrence', { align: 'center' }).moveDown(1.5);
  const row = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true }).font('Helvetica').text(value == null || value === '' ? '—' : String(value));
    doc.moveDown(0.3);
  };
  const ip = full.injuredPerson || {};
  row('1. Name of factory', full.company && full.company.name);
  row('2. Incident reference', full.incidentId);
  row('3. Date and time of accident', new Date(full.dateTime).toLocaleString('en-IN'));
  row('4. Place / department', `${full.location} — ${full.department ? full.department.name : ''}`);
  row('5. Name of injured person', ip.name);
  row('6. Employee ID', ip.employeeId);
  row('7. Age / gender', [ip.age, ip.gender].filter(Boolean).join(' / '));
  row('8. Designation', ip.designation);
  row('9. Nature of incident', `${full.incidentType} — severity: ${full.severity}`);
  row('10. Body parts affected', (full.bodyPartAffected || []).join(', '));
  row('11. Cause of injury', full.causeOfInjury);
  row('12. Description', full.description);
  row('13. First aid / treatment given', full.treatmentGiven);
  row('14. Outcome', (full.outcome || '').replace(/_/g, ' '));
  row('15. Hospital (if any)', full.hospitalName);
  row('16. Days lost', full.daysLost);
  row('17. Witnesses', (full.witnesses || []).join(', '));
  row('18. Root cause', full.rootCause);
  row('19. Corrective action', full.correctiveAction);
  doc.moveDown(2);
  doc.fontSize(10).text(`Generated by SimplyAID on ${new Date().toLocaleString('en-IN')} by ${req.user.name}.`);
  doc.moveDown(3).text('Signature of Manager / Occupier: ______________________________');
  doc.end();
};
