const { companyCompliance, departmentCompliance } = require('../services/complianceService');
const { runCompanyChecks } = require('../services/monitoringService');
const { audit } = require('../utils/notificationService');
const { departmentScope } = require('../utils/access');
const { companyIdOf } = require('../utils/http');

// @route GET /api/compliance/company
exports.getCompanyCompliance = async (req, res) => {
  const data = await companyCompliance(companyIdOf(req), { departmentId: departmentScope(req) });
  res.json({ success: true, data });
};

// @route GET /api/compliance/departments
exports.getDepartmentCompliance = async (req, res) => {
  const data = await departmentCompliance(companyIdOf(req), { departmentId: departmentScope(req) });
  res.json({ success: true, data });
};

// @route POST /api/compliance/check — re-evaluate everything and raise alerts for failures
exports.runComplianceCheck = async (req, res) => {
  const result = await runCompanyChecks(companyIdOf(req));
  audit(req, {
    action: 'Ran compliance check', entity: 'Compliance',
    details: `Score ${result.complianceScore}% — ${result.alertsGenerated} new alert(s) across ${result.boxesChecked} kit(s)`
  });
  res.json({
    success: true,
    message: `Compliance check complete — score ${result.complianceScore}%, ${result.alertsGenerated} new alert(s).`,
    data: result
  });
};
