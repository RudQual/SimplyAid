const Incident = require('../models/Incident');
const FirstAidBox = require('../models/FirstAidBox');
const User = require('../models/User');
const Department = require('../models/Department');

exports.getAccidentRegister = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const { startDate, endDate } = req.query;
    const filter = { company: companyId, isReportable: true };
    if (startDate || endDate) { filter.dateTime = {}; if (startDate) filter.dateTime.$gte = new Date(startDate); if (endDate) filter.dateTime.$lte = new Date(endDate); }
    const incidents = await Incident.find(filter)
      .populate('department', 'name').populate('reportedBy', 'name').populate('treatedBy', 'name')
      .sort('-dateTime');
    res.json({ success: true, count: incidents.length, data: incidents });
  } catch (error) { next(error); }
};

exports.getDepartmentSummary = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const departments = await Department.find({ company: companyId, isActive: true });
    const summary = await Promise.all(departments.map(async dept => {
      const incidentCount = await Incident.countDocuments({ department: dept._id });
      const openCases = await Incident.countDocuments({ department: dept._id, status: { $in: ['reported', 'under_investigation'] } });
      const boxCount = await FirstAidBox.countDocuments({ department: dept._id, isActive: true });
      const boxesNeedingAttention = await FirstAidBox.countDocuments({ department: dept._id, status: { $ne: 'adequate' }, isActive: true });
      const certifiedCount = await User.countDocuments({ department: dept._id, firstAidCertified: true, isActive: true });
      return { department: { _id: dept._id, name: dept.name, code: dept.code, riskLevel: dept.riskLevel }, incidentCount, openCases, boxCount, boxesNeedingAttention, certifiedCount, workerCount: dept.workerCount };
    }));
    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
};

exports.getComplianceStatus = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const totalWorkers = await User.countDocuments({ company: companyId, isActive: true });
    const requiredBoxes = Math.ceil(totalWorkers / 150);
    const activeBoxes = await FirstAidBox.countDocuments({ company: companyId, isActive: true });
    const adequateBoxes = await FirstAidBox.countDocuments({ company: companyId, status: 'adequate', isActive: true });
    const overdueInspections = await FirstAidBox.countDocuments({ company: companyId, status: 'overdue_inspection', isActive: true });
    const certifiedPersons = await User.countDocuments({ company: companyId, firstAidCertified: true, isActive: true });
    const expiringCerts = await User.countDocuments({ company: companyId, firstAidCertified: true, certificationExpiry: { $lte: new Date(Date.now() + 30*24*60*60*1000), $gte: new Date() }, isActive: true });
    const unreportedIncidents = await Incident.countDocuments({ company: companyId, isReportable: true, form18Generated: false });

    const checks = [
      { rule: 'First Aid Boxes (1 per 150 workers)', required: requiredBoxes, actual: activeBoxes, compliant: activeBoxes >= requiredBoxes, section: 'Section 45' },
      { rule: 'Boxes Adequately Stocked', required: activeBoxes, actual: adequateBoxes, compliant: adequateBoxes === activeBoxes, section: 'Section 45' },
      { rule: 'Certified Persons In-Charge', required: activeBoxes, actual: certifiedPersons, compliant: certifiedPersons >= activeBoxes, section: 'Section 45' },
      { rule: 'Overdue Inspections', required: 0, actual: overdueInspections, compliant: overdueInspections === 0, section: 'Best Practice' },
      { rule: 'Pending Form 18 Reports', required: 0, actual: unreportedIncidents, compliant: unreportedIncidents === 0, section: 'Section 88' }
    ];
    const overallCompliance = Math.round((checks.filter(c => c.compliant).length / checks.length) * 100);

    res.json({ success: true, data: { overallCompliance, checks, summary: { totalWorkers, requiredBoxes, activeBoxes, certifiedPersons, expiringCerts, unreportedIncidents } } });
  } catch (error) { next(error); }
};
