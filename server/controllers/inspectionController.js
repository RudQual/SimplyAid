const Inspection = require('../models/Inspection');
const FirstAidBox = require('../models/FirstAidBox');
const { evaluateBox } = require('../services/complianceService');
const { audit, notifyKitOwners } = require('../utils/notificationService');
const { assertCanManageKit, departmentScope } = require('../utils/access');
const {
  ApiError, companyIdOf, qs, isValidId, parsePagination, paginated, dateRange, searchRegex
} = require('../utils/http');

const STATUSES = ['adequate', 'needs_replenishment', 'items_expired', 'failed'];

/**
 * Record an inspection of a kit: stores the inspection (with a snapshot of the
 * kit's compliance at that moment), appends to the kit's log, and schedules the
 * next inspection.
 */
const recordInspection = async (req, { boxId, status, overallNotes, checklist, deficiencies, inspectionDate }) => {
  const companyId = companyIdOf(req);
  if (!isValidId(String(boxId))) throw ApiError.badRequest('A valid first aid kit is required');
  const box = await FirstAidBox.findOne({ _id: boxId, company: companyId, isActive: true })
    .populate('items.item', 'name')
    .populate('inCharge', 'name firstAidCertified certificationExpiry');
  if (!box) throw ApiError.notFound('First aid kit not found');
  assertCanManageKit(req, box);

  const before = evaluateBox(box);
  // Default status from the actual kit condition when the inspector doesn't set one.
  let finalStatus = status;
  if (!finalStatus) {
    if (before.expired.length) finalStatus = 'items_expired';
    else if (before.missing.length || before.low.length) finalStatus = 'needs_replenishment';
    else finalStatus = 'adequate';
  }
  if (!STATUSES.includes(finalStatus)) throw ApiError.badRequest('Invalid inspection status');

  const cleanChecklist = Array.isArray(checklist)
    ? checklist.filter((c) => c && c.itemName).slice(0, 200).map((c) => ({
      itemName: String(c.itemName).slice(0, 200), checked: Boolean(c.checked), notes: c.notes ? String(c.notes).slice(0, 500) : undefined
    }))
    : box.items.map((i) => ({ itemName: (i.item && i.item.name) || 'Item', checked: i.requiredQty === 0 || i.currentQty >= i.requiredQty }));
  const cleanDeficiencies = Array.isArray(deficiencies)
    ? deficiencies.filter((d) => d && d.description && String(d.description).trim()).slice(0, 100).map((d) => ({
      description: String(d.description).trim().slice(0, 500),
      severity: ['minor', 'moderate', 'serious', 'critical'].includes(d.severity) ? d.severity : 'minor'
    }))
    : [];

  const date = inspectionDate ? new Date(inspectionDate) : new Date();
  if (Number.isNaN(date.getTime()) || date > new Date(Date.now() + 60000)) throw ApiError.badRequest('Inspection date cannot be in the future');

  const inspection = await Inspection.create({
    firstAidBox: box._id,
    inspector: req.user._id,
    inspectorName: req.user.name,
    company: companyId,
    inspectionDate: date,
    status: finalStatus,
    checklist: cleanChecklist,
    deficiencies: cleanDeficiencies,
    overallNotes: overallNotes ? String(overallNotes).slice(0, 2000) : undefined
  });

  box.inspectionLogs.push({ inspectedBy: req.user._id, inspection: inspection._id, date, status: finalStatus, notes: overallNotes || '' });
  if (box.inspectionLogs.length > 200) box.inspectionLogs = box.inspectionLogs.slice(-200);
  box.lastInspectionDate = date;
  box.nextInspectionDue = new Date(date.getTime() + box.inspectionFrequencyDays * 24 * 60 * 60 * 1000);
  await box.save();

  const after = evaluateBox(box);
  inspection.complianceScore = after.score;
  inspection.complianceStatus = after.status;
  inspection.findings = {
    missingItems: after.missing.length,
    lowStockItems: after.low.length,
    expiredUnits: after.expired.reduce((s, e) => s + e.quantity, 0),
    expiringSoonUnits: after.expiringSoon.reduce((s, e) => s + e.quantity, 0)
  };
  await inspection.save();

  audit(req, {
    action: 'Completed kit inspection', entity: 'Inspection', entityId: inspection._id, entityLabel: inspection.inspectionId,
    details: `${inspection.inspectionId} for ${box.boxId} — ${finalStatus.replace(/_/g, ' ')}, score ${after.score}`
  });

  if (cleanDeficiencies.length || finalStatus === 'failed') {
    await notifyKitOwners(companyId, box.department, {
      type: 'compliance_alert',
      severity: finalStatus === 'failed' || cleanDeficiencies.some((d) => ['serious', 'critical'].includes(d.severity)) ? 'critical' : 'warning',
      title: `Inspection issues found in kit ${box.boxId}`,
      message: `${cleanDeficiencies.length} deficiency(ies) logged during inspection ${inspection.inspectionId} of ${box.boxId} (${box.location}).`,
      relatedModel: 'Inspection',
      relatedId: inspection._id,
      dedupeKey: `inspection:${inspection._id}`
    });
  }
  return { inspection, box };
};

// @route POST /api/inspections
exports.createInspection = async (req, res) => {
  const { inspection } = await recordInspection(req, { ...req.body, boxId: req.body.firstAidBox });
  const populated = await Inspection.findById(inspection._id)
    .populate('firstAidBox', 'boxId location department')
    .populate('inspector', 'name');
  res.status(201).json({ success: true, data: populated, message: `Inspection ${inspection.inspectionId} recorded` });
};

// @route GET /api/inspections
exports.getInspections = async (req, res) => {
  const companyId = companyIdOf(req);
  const filter = { company: companyId };
  const box = qs(req.query.firstAidBox);
  if (box) { if (!isValidId(box)) throw ApiError.badRequest('Invalid kit'); filter.firstAidBox = box; }
  const inspector = qs(req.query.inspector);
  if (inspector) { if (!isValidId(inspector)) throw ApiError.badRequest('Invalid inspector'); filter.inspector = inspector; }
  const status = qs(req.query.status);
  if (status) filter.status = status;
  const complianceStatus = qs(req.query.complianceStatus);
  if (complianceStatus) filter.complianceStatus = complianceStatus;
  const range = dateRange(req.query);
  if (range) filter.inspectionDate = range;

  const dept = departmentScope(req) || qs(req.query.department);
  if (dept) {
    if (!isValidId(String(dept))) throw ApiError.badRequest('Invalid department');
    const deptBoxIds = (await FirstAidBox.find({ company: companyId, department: dept }).distinct('_id')).map(String);
    const allowed = filter.firstAidBox ? deptBoxIds.filter((id) => id === String(filter.firstAidBox)) : deptBoxIds;
    filter.firstAidBox = { $in: allowed };
  }
  const search = qs(req.query.search);
  if (search) {
    const rx = searchRegex(search);
    const matchingBoxes = await FirstAidBox.find({ company: companyId, $or: [{ boxId: rx }, { location: rx }] }).distinct('_id');
    filter.$or = [{ firstAidBox: { $in: matchingBoxes } }, { inspectionId: rx }, { inspectorName: rx }];
  }

  const pg = parsePagination(req.query, { defaultLimit: 20 });
  const [inspections, total] = await Promise.all([
    Inspection.find(filter)
      .populate({ path: 'firstAidBox', select: 'boxId location department', populate: { path: 'department', select: 'name' } })
      .populate('inspector', 'name')
      .sort('-inspectionDate')
      .skip(pg.skip)
      .limit(pg.limit),
    Inspection.countDocuments(filter)
  ]);
  res.json(paginated(inspections, total, pg));
};

// @route GET /api/inspections/:id
exports.getInspection = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Inspection not found');
  const inspection = await Inspection.findOne({ _id: req.params.id, company: companyIdOf(req) })
    .populate({ path: 'firstAidBox', select: 'boxId location department classType', populate: { path: 'department', select: 'name' } })
    .populate('inspector', 'name email')
    .populate('deficiencies.resolvedBy', 'name');
  if (!inspection) throw ApiError.notFound('Inspection not found');
  res.json({ success: true, data: inspection });
};

// @route PUT /api/inspections/:id/deficiencies/:defId/resolve
exports.resolveDeficiency = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Inspection not found');
  const inspection = await Inspection.findOne({ _id: req.params.id, company: companyIdOf(req) }).populate('firstAidBox', 'department boxId');
  if (!inspection) throw ApiError.notFound('Inspection not found');
  if (inspection.firstAidBox) assertCanManageKit(req, inspection.firstAidBox);
  const def = inspection.deficiencies.id(req.params.defId);
  if (!def) throw ApiError.notFound('Deficiency not found');
  if (def.resolved) throw ApiError.conflict('This deficiency is already resolved');
  def.resolved = true;
  def.resolvedAt = new Date();
  def.resolvedBy = req.user._id;
  await inspection.save();
  audit(req, {
    action: 'Resolved inspection deficiency', entity: 'Inspection', entityId: inspection._id, entityLabel: inspection.inspectionId,
    details: def.description
  });
  await inspection.populate('deficiencies.resolvedBy', 'name');
  res.json({ success: true, data: inspection, message: 'Deficiency marked as resolved' });
};

exports.recordInspection = recordInspection;
