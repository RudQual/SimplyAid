const Incident = require('../models/Incident');
const FirstAidBox = require('../models/FirstAidBox');
const User = require('../models/User');
const Department = require('../models/Department');
const { REPORTS, getReport, toCsv, streamPdf } = require('../services/reportService');
const { companyCompliance } = require('../services/complianceService');
const { audit } = require('../utils/notificationService');
const { departmentScope } = require('../utils/access');
const { ApiError, companyIdOf, qs, dateRange } = require('../utils/http');

// @route GET /api/reports  — list of available reports for the current role
exports.listReports = (req, res) => {
  const data = Object.entries(REPORTS)
    .filter(([, def]) => req.user.role === 'admin' || def.roles.includes(req.user.role))
    .map(([type, def]) => ({ type, title: def.title }));
  res.json({ success: true, data });
};

// @route GET /api/reports/:type?format=json|csv|pdf  (+ report-specific filters)
exports.getReport = async (req, res) => {
  const def = REPORTS[req.params.type];
  if (!def) throw ApiError.notFound('Unknown report');
  if (req.user.role !== 'admin' && !def.roles.includes(req.user.role)) throw ApiError.forbidden();
  const format = qs(req.query.format) || 'json';
  if (!['json', 'csv', 'pdf'].includes(format)) throw ApiError.badRequest('format must be json, csv or pdf');

  const report = await getReport(req.params.type, { companyId: companyIdOf(req), departmentId: departmentScope(req), query: req.query });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `simplyaid-${req.params.type}-${stamp}`;

  if (format !== 'json') {
    audit(req, { action: `Exported ${report.title} (${format.toUpperCase()})`, entity: 'Report', details: `${report.rows.length} row(s)` });
  }
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(report));
  }
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return streamPdf(res, report, { companyName: req.user.company && req.user.company.name, userName: req.user.name });
  }
  res.json({ success: true, data: report });
};

// ─── Legacy JSON endpoints (kept for compatibility) ─────────────────────────

// @route GET /api/reports/accident-register
exports.getAccidentRegister = async (req, res) => {
  const filter = { company: companyIdOf(req), isReportable: true };
  const scope = departmentScope(req);
  if (scope) filter.department = scope;
  const range = dateRange(req.query);
  if (range) filter.dateTime = range;
  const incidents = await Incident.find(filter)
    .populate('department', 'name').populate('reportedBy', 'name').populate('treatedBy', 'name')
    .sort('-dateTime');
  res.json({ success: true, count: incidents.length, data: incidents });
};

// @route GET /api/reports/department-summary
exports.getDepartmentSummary = async (req, res) => {
  const companyId = companyIdOf(req);
  const filter = { company: companyId, isActive: true };
  const scope = departmentScope(req);
  if (scope) filter._id = scope;
  const departments = await Department.find(filter);
  const summary = await Promise.all(departments.map(async (dept) => {
    const [incidentCount, openCases, boxCount, boxesNeedingAttention, certifiedCount, workerCount] = await Promise.all([
      Incident.countDocuments({ company: companyId, department: dept._id }),
      Incident.countDocuments({ company: companyId, department: dept._id, status: { $in: ['reported', 'under_investigation'] } }),
      FirstAidBox.countDocuments({ company: companyId, department: dept._id, isActive: true }),
      FirstAidBox.countDocuments({ company: companyId, department: dept._id, status: { $ne: 'adequate' }, isActive: true }),
      User.countDocuments({ company: companyId, department: dept._id, firstAidCertified: true, isActive: true }),
      User.countDocuments({ company: companyId, department: dept._id, isActive: true })
    ]);
    return {
      department: { _id: dept._id, name: dept.name, code: dept.code, riskLevel: dept.riskLevel },
      incidentCount, openCases, boxCount, boxesNeedingAttention, certifiedCount, workerCount
    };
  }));
  res.json({ success: true, data: summary });
};

// @route GET /api/reports/compliance-status
exports.getComplianceStatus = async (req, res) => {
  const c = await companyCompliance(companyIdOf(req), { departmentId: departmentScope(req) });
  res.json({ success: true, data: { overallCompliance: c.overallCompliance, checks: c.checks, summary: c.summary } });
};
