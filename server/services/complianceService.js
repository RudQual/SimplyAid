const FirstAidBox = require('../models/FirstAidBox');
const User = require('../models/User');
const Incident = require('../models/Incident');
const Department = require('../models/Department');
const {
  DAY_MS, EXPIRY_SOON_DAYS, WORKERS_PER_BOX, COMPLIANCE_WEIGHTS, COMPLIANCE_THRESHOLDS
} = require('../config/constants');

/**
 * Compliance rules
 * ────────────────
 * Kit score (0–100) is the weighted sum of four rules:
 *
 *  1. Supplies   (40) — share of required items whose quantity meets the
 *                       required quantity. A required item with 0 units is "missing".
 *  2. Expiry     (25) — full marks when the kit holds no expired units, 0 otherwise.
 *  3. Inspection (20) — full marks when the kit has been inspected and the next
 *                       inspection is not overdue, 0 otherwise.
 *  4. In-charge  (15) — full marks when a person in charge is assigned AND holds
 *                       a valid first-aid certification (Section 45(2)); 7 when
 *                       assigned but not certified; 0 when unassigned.
 *
 *  Status: ≥ 90 compliant · ≥ 70 at risk · otherwise non-compliant — with two caps
 *  regardless of score: a kit holding ANY expired units is non-compliant, and a kit
 *  with ANY required item completely missing is at best "at risk".
 *
 * Company level adds six statutory checks, each scored proportionally (0–100),
 * and the overall score is 50% their average + 50% the average kit score.
 * The statutory checks include the requirement of
 * one first aid box per 150 workers (Factories Act, 1948 — Section 45(1)) and
 * pending Form 18 accident reports (Section 88).
 */

const statusFromScore = (score) => {
  if (score >= COMPLIANCE_THRESHOLDS.compliant) return 'compliant';
  if (score >= COMPLIANCE_THRESHOLDS.atRisk) return 'at_risk';
  return 'non_compliant';
};

const trafficLight = (status) => ({ compliant: 'green', at_risk: 'yellow', non_compliant: 'red' }[status]);

/** Evaluate one kit. `box` should have `inCharge` and `items.item` populated. */
const evaluateBox = (box, now = new Date()) => {
  const soon = new Date(now.getTime() + EXPIRY_SOON_DAYS * DAY_MS);
  const required = box.items.filter((i) => i.requiredQty > 0);
  const missing = [];
  const low = [];
  const expired = [];
  const expiringSoon = [];

  box.items.forEach((i) => {
    const name = (i.item && i.item.name) || 'Item';
    const qty = (i.stocks || []).reduce((s, b) => s + (b.quantity || 0), 0);
    if (i.requiredQty > 0 && qty === 0) missing.push({ item: i.item && i.item._id, name, required: i.requiredQty, current: 0 });
    else if (i.requiredQty > 0 && qty < i.requiredQty) low.push({ item: i.item && i.item._id, name, required: i.requiredQty, current: qty });
    (i.stocks || []).forEach((b) => {
      if (!b.expiryDate || !b.quantity) return;
      const exp = new Date(b.expiryDate);
      const entry = { item: i.item && i.item._id, name, quantity: b.quantity, batchNumber: b.batchNumber, expiryDate: b.expiryDate };
      if (exp < now) expired.push(entry);
      else if (exp <= soon) expiringSoon.push(entry);
    });
  });

  const satisfied = required.length - missing.length - low.length;
  const suppliesScore = required.length ? (satisfied / required.length) * COMPLIANCE_WEIGHTS.supplies : COMPLIANCE_WEIGHTS.supplies;
  const expiryOk = expired.length === 0;
  const inspectionOk = Boolean(box.lastInspectionDate && box.nextInspectionDue && new Date(box.nextInspectionDue) >= now);

  const inCharge = box.inCharge && typeof box.inCharge === 'object' && box.inCharge.name !== undefined ? box.inCharge : null;
  const certified = Boolean(inCharge && inCharge.firstAidCertified
    && (!inCharge.certificationExpiry || new Date(inCharge.certificationExpiry) >= now));
  let inChargeScore = 0;
  if (certified) inChargeScore = COMPLIANCE_WEIGHTS.inCharge;
  else if (box.inCharge) inChargeScore = Math.floor(COMPLIANCE_WEIGHTS.inCharge / 2);

  const score = Math.round(
    suppliesScore
    + (expiryOk ? COMPLIANCE_WEIGHTS.expiry : 0)
    + (inspectionOk ? COMPLIANCE_WEIGHTS.inspection : 0)
    + inChargeScore
  );
  let status = statusFromScore(score);
  if (!expiryOk) status = 'non_compliant';
  else if (missing.length && status === 'compliant') status = 'at_risk';

  const issues = [];
  if (missing.length) issues.push({ rule: 'supplies', severity: 'critical', message: `${missing.length} mandatory item(s) missing` });
  if (low.length) issues.push({ rule: 'supplies', severity: 'warning', message: `${low.length} item(s) below required quantity` });
  if (!expiryOk) issues.push({ rule: 'expiry', severity: 'critical', message: `${expired.reduce((s, e) => s + e.quantity, 0)} expired unit(s) in kit` });
  if (!inspectionOk) issues.push({ rule: 'inspection', severity: 'warning', message: box.lastInspectionDate ? 'Inspection overdue' : 'Never inspected' });
  if (!box.inCharge) issues.push({ rule: 'inCharge', severity: 'warning', message: 'No person in charge assigned' });
  else if (!certified) issues.push({ rule: 'inCharge', severity: 'warning', message: 'Person in charge is not certified (or certification expired)' });

  return {
    score,
    status,
    rules: {
      supplies: { score: Math.round(suppliesScore), max: COMPLIANCE_WEIGHTS.supplies, required: required.length, satisfied },
      expiry: { score: expiryOk ? COMPLIANCE_WEIGHTS.expiry : 0, max: COMPLIANCE_WEIGHTS.expiry, expiredBatches: expired.length },
      inspection: { score: inspectionOk ? COMPLIANCE_WEIGHTS.inspection : 0, max: COMPLIANCE_WEIGHTS.inspection, lastInspectionDate: box.lastInspectionDate, nextInspectionDue: box.nextInspectionDue },
      inCharge: { score: inChargeScore, max: COMPLIANCE_WEIGHTS.inCharge, assigned: Boolean(box.inCharge), certified }
    },
    missing,
    low,
    expired,
    expiringSoon,
    issues
  };
};

const loadBoxes = (filter) => FirstAidBox.find(filter)
  .populate('items.item', 'name category unit isMandatory')
  .populate('inCharge', 'name firstAidCertified certificationExpiry')
  .populate('department', 'name code');

const summarizeBoxes = (boxes, now) => {
  const evaluated = boxes.map((box) => ({ box, compliance: evaluateBox(box, now) }));
  const count = (pred) => evaluated.filter(pred).length;
  const avg = evaluated.length
    ? Math.round(evaluated.reduce((s, e) => s + e.compliance.score, 0) / evaluated.length)
    : 0;
  return {
    evaluated,
    averageScore: avg,
    compliantBoxes: count((e) => e.compliance.status === 'compliant'),
    atRiskBoxes: count((e) => e.compliance.status === 'at_risk'),
    nonCompliantBoxes: count((e) => e.compliance.status === 'non_compliant'),
    boxesMissingSupplies: count((e) => e.compliance.missing.length > 0),
    fullyStocked: count((e) => !e.compliance.missing.length && !e.compliance.low.length),
    boxesWithExpired: count((e) => e.compliance.expired.length > 0),
    overdueInspections: count((e) => !e.compliance.rules.inspection.score),
    expiredUnits: evaluated.reduce((s, e) => s + e.compliance.expired.reduce((a, x) => a + x.quantity, 0), 0),
    expiringSoonUnits: evaluated.reduce((s, e) => s + e.compliance.expiringSoon.reduce((a, x) => a + x.quantity, 0), 0),
    certifiedInCharge: count((e) => e.compliance.rules.inCharge.certified)
  };
};

const boxRow = ({ box, compliance }) => ({
  _id: box._id,
  boxId: box.boxId,
  location: box.location,
  classType: box.classType,
  department: box.department ? { _id: box.department._id, name: box.department.name, code: box.department.code } : null,
  inCharge: box.inCharge ? { _id: box.inCharge._id, name: box.inCharge.name } : null,
  status: box.status,
  score: compliance.score,
  complianceStatus: compliance.status,
  issues: compliance.issues,
  missingCount: compliance.missing.length,
  lowCount: compliance.low.length,
  expiredCount: compliance.expired.length,
  lastInspectionDate: box.lastInspectionDate,
  nextInspectionDue: box.nextInspectionDue
});

/** Company-wide compliance (optionally restricted to one department). */
const companyCompliance = async (companyId, { departmentId } = {}) => {
  const now = new Date();
  const boxFilter = { company: companyId, isActive: true };
  const userFilter = { company: companyId, isActive: true };
  const incidentFilter = { company: companyId, isReportable: true, form18Generated: false };
  if (departmentId) {
    boxFilter.department = departmentId;
    userFilter.department = departmentId;
    incidentFilter.department = departmentId;
  }

  const reportableFilter = { ...incidentFilter };
  delete reportableFilter.form18Generated;
  const [boxes, totalWorkers, certifiedPersons, expiringCerts, unreportedIncidents, reportableIncidents] = await Promise.all([
    loadBoxes(boxFilter),
    User.countDocuments(userFilter),
    User.countDocuments({ ...userFilter, firstAidCertified: true, $or: [{ certificationExpiry: null }, { certificationExpiry: { $gte: now } }] }),
    User.countDocuments({ ...userFilter, firstAidCertified: true, certificationExpiry: { $gte: now, $lte: new Date(now.getTime() + 30 * DAY_MS) } }),
    Incident.countDocuments(incidentFilter),
    Incident.countDocuments(reportableFilter)
  ]);

  const s = summarizeBoxes(boxes, now);
  const activeBoxes = boxes.length;
  const requiredBoxes = Math.max(totalWorkers > 0 ? 1 : 0, Math.ceil(totalWorkers / WORKERS_PER_BOX));

  // Each statutory check reports pass/fail plus a proportional score (0–100),
  // e.g. 17 of 20 kits free of expired stock scores 85.
  const pct = (part, whole) => (whole > 0 ? Math.round((Math.max(0, part) / whole) * 100) : 100);
  const check = (key, rule, section, required, actual, compliant, warn, score) => ({
    key, rule, section, required, actual, compliant, score: compliant ? 100 : Math.min(99, score),
    status: compliant ? 'green' : (warn ? 'yellow' : 'red')
  });
  const checks = [
    check('box_count', `First aid boxes (1 per ${WORKERS_PER_BOX} workers)`, 'Section 45(1)', requiredBoxes, activeBoxes,
      activeBoxes >= requiredBoxes, activeBoxes === requiredBoxes - 1, pct(activeBoxes, requiredBoxes)),
    check('supplies', 'Kits fully stocked with mandatory supplies', 'Section 45 / Schedule', activeBoxes, s.fullyStocked,
      s.fullyStocked === activeBoxes, s.boxesMissingSupplies === 0, pct(s.fullyStocked, activeBoxes)),
    check('expiry', 'No expired supplies in any kit', 'Section 45', 0, s.boxesWithExpired, s.boxesWithExpired === 0, false, pct(activeBoxes - s.boxesWithExpired, activeBoxes)),
    check('inspection', 'All kits inspected on schedule', 'Best practice', 0, s.overdueInspections, s.overdueInspections === 0, s.overdueInspections <= 2, pct(activeBoxes - s.overdueInspections, activeBoxes)),
    check('in_charge', 'Kits in charge of a certified first-aider', 'Section 45(2)', activeBoxes, s.certifiedInCharge,
      s.certifiedInCharge >= activeBoxes, s.certifiedInCharge >= activeBoxes * 0.8, pct(s.certifiedInCharge, activeBoxes)),
    check('form18', 'Reportable accidents notified (Form 18)', 'Section 88', 0, unreportedIncidents, unreportedIncidents === 0, false, pct(reportableIncidents - unreportedIncidents, reportableIncidents))
  ];

  // Overall: 50% average statutory-check score, 50% average kit score
  const checksScore = checks.length ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length : 100;
  const overallCompliance = activeBoxes ? Math.round(checksScore * 0.5 + s.averageScore * 0.5) : Math.round(checksScore * 0.5);
  const overallStatusKey = statusFromScore(overallCompliance);

  const pendingActions = [];
  if (activeBoxes < requiredBoxes) pendingActions.push({ severity: 'critical', message: `Add ${requiredBoxes - activeBoxes} more first aid kit(s) to meet Section 45`, link: '/kits' });
  if (s.boxesWithExpired) pendingActions.push({ severity: 'critical', message: `${s.boxesWithExpired} kit(s) contain expired supplies`, link: '/expiry?status=expired' });
  if (s.boxesMissingSupplies) pendingActions.push({ severity: 'critical', message: `${s.boxesMissingSupplies} kit(s) are missing mandatory supplies`, link: '/kits?compliance=non_compliant' });
  if (s.overdueInspections) pendingActions.push({ severity: 'warning', message: `${s.overdueInspections} kit(s) overdue for inspection`, link: '/kits?status=overdue_inspection' });
  if (unreportedIncidents) pendingActions.push({ severity: 'critical', message: `${unreportedIncidents} reportable incident(s) pending Form 18`, link: '/incidents' });
  if (expiringCerts) pendingActions.push({ severity: 'warning', message: `${expiringCerts} first-aid certification(s) expire within 30 days`, link: '/employees' });
  if (activeBoxes - s.certifiedInCharge > 0) pendingActions.push({ severity: 'warning', message: `${activeBoxes - s.certifiedInCharge} kit(s) lack a certified person in charge`, link: '/kits' });

  return {
    overallCompliance,
    overallStatus: trafficLight(overallStatusKey),
    complianceStatus: overallStatusKey,
    checks,
    summary: {
      totalWorkers,
      requiredBoxes,
      activeBoxes,
      adequateBoxes: boxes.filter((b) => b.status === 'adequate').length,
      compliantBoxes: s.compliantBoxes,
      atRiskBoxes: s.atRiskBoxes,
      nonCompliantBoxes: s.nonCompliantBoxes,
      averageBoxScore: s.averageScore,
      certifiedPersons,
      expiringCerts,
      overdueInspections: s.overdueInspections,
      boxesMissingSupplies: s.boxesMissingSupplies,
      boxesWithExpired: s.boxesWithExpired,
      expiredItems: s.expiredUnits,
      expiringItems: s.expiringSoonUnits,
      unreportedIncidents
    },
    pendingActions,
    boxes: s.evaluated.map(boxRow).sort((a, b) => a.score - b.score)
  };
};

/** Compliance per department. */
const departmentCompliance = async (companyId, { departmentId } = {}) => {
  const now = new Date();
  const deptFilter = { company: companyId, isActive: true };
  if (departmentId) deptFilter._id = departmentId;
  const [departments, boxes, userCounts, incidentCounts] = await Promise.all([
    Department.find(deptFilter).lean(),
    loadBoxes({ company: companyId, isActive: true, ...(departmentId ? { department: departmentId } : {}) }),
    User.aggregate([{ $match: { company: companyId, isActive: true } }, { $group: { _id: '$department', count: { $sum: 1 }, certified: { $sum: { $cond: ['$firstAidCertified', 1, 0] } } } }]),
    Incident.aggregate([{ $match: { company: companyId, dateTime: { $gte: new Date(now.getTime() - 30 * DAY_MS) } } }, { $group: { _id: '$department', count: { $sum: 1 } } }])
  ]);
  const usersBy = new Map(userCounts.map((u) => [String(u._id), u]));
  const incidentsBy = new Map(incidentCounts.map((i) => [String(i._id), i.count]));

  const rows = departments.map((dept) => {
    const deptBoxes = boxes.filter((b) => b.department && String(b.department._id) === String(dept._id));
    const s = summarizeBoxes(deptBoxes, now);
    const employeeCount = (usersBy.get(String(dept._id)) || {}).count || 0;
    const requiredBoxes = Math.max(employeeCount > 0 ? 1 : 0, Math.ceil(employeeCount / WORKERS_PER_BOX));
    const coveragePenalty = deptBoxes.length < requiredBoxes ? 25 : 0;
    const score = deptBoxes.length ? Math.max(0, s.averageScore - coveragePenalty) : (requiredBoxes ? 0 : 100);
    const statusKey = statusFromScore(score);
    return {
      department: { _id: dept._id, name: dept.name, code: dept.code, riskLevel: dept.riskLevel },
      employeeCount,
      requiredBoxes,
      availableBoxes: deptBoxes.length,
      adequateBoxes: deptBoxes.filter((b) => b.status === 'adequate').length,
      overdueInspections: s.overdueInspections,
      certifiedPersons: (usersBy.get(String(dept._id)) || {}).certified || 0,
      incidentCount: incidentsBy.get(String(dept._id)) || 0,
      expiredItems: s.expiredUnits,
      boxesMissingSupplies: s.boxesMissingSupplies,
      complianceScore: score,
      complianceStatus: statusKey,
      status: trafficLight(statusKey)
    };
  }).sort((a, b) => a.complianceScore - b.complianceScore);

  const averageScore = rows.length ? Math.round(rows.reduce((s, d) => s + d.complianceScore, 0) / rows.length) : 0;
  return {
    departments: rows,
    averageScore,
    totalDepartments: rows.length,
    riskAreas: rows.filter((d) => d.status === 'red').map((d) => d.department.name)
  };
};

module.exports = { evaluateBox, companyCompliance, departmentCompliance, statusFromScore, loadBoxes };
