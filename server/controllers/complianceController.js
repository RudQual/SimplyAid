const FirstAidBox = require('../models/FirstAidBox');
const User = require('../models/User');
const Department = require('../models/Department');
const Incident = require('../models/Incident');
const Inspection = require('../models/Inspection');
const { notifySafetyTeam, createAuditLog } = require('../utils/notificationService');

// @desc    Get company-wide compliance status (Section 45)
// @route   GET /api/compliance/company
// @access  Protected
exports.getCompanyCompliance = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;

    const totalWorkers = await User.countDocuments({ company: companyId, isActive: true });
    const requiredBoxes = Math.ceil(totalWorkers / 150);
    const activeBoxes = await FirstAidBox.countDocuments({ company: companyId, isActive: true });
    const adequateBoxes = await FirstAidBox.countDocuments({ company: companyId, status: 'adequate', isActive: true });
    const overdueInspections = await FirstAidBox.countDocuments({ company: companyId, status: 'overdue_inspection', isActive: true });
    const certifiedPersons = await User.countDocuments({ company: companyId, firstAidCertified: true, isActive: true });

    // Expiry check
    const now = new Date();
    const boxes = await FirstAidBox.find({ company: companyId, isActive: true });
    let expiredItems = 0;
    let expiringItems = 0;
    boxes.forEach(box => {
      box.items.forEach(item => {
        if (!item.expiryDate) return;
        const exp = new Date(item.expiryDate);
        if (exp < now) expiredItems++;
        else if (exp < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) expiringItems++;
      });
    });

    const expiringCerts = await User.countDocuments({
      company: companyId,
      firstAidCertified: true,
      certificationExpiry: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), $gte: now },
      isActive: true
    });

    const unreportedIncidents = await Incident.countDocuments({
      company: companyId,
      isReportable: true,
      form18Generated: false
    });

    // Compliance checks
    const checks = [
      {
        rule: 'First Aid Boxes (1 per 150 workers)',
        required: requiredBoxes,
        actual: activeBoxes,
        compliant: activeBoxes >= requiredBoxes,
        section: 'Section 45',
        status: activeBoxes >= requiredBoxes ? 'green' : activeBoxes >= requiredBoxes - 1 ? 'yellow' : 'red'
      },
      {
        rule: 'Boxes Adequately Stocked',
        required: activeBoxes,
        actual: adequateBoxes,
        compliant: adequateBoxes === activeBoxes,
        section: 'Section 45',
        status: adequateBoxes === activeBoxes ? 'green' : adequateBoxes >= activeBoxes * 0.8 ? 'yellow' : 'red'
      },
      {
        rule: 'Certified First Aiders In-Charge',
        required: activeBoxes,
        actual: certifiedPersons,
        compliant: certifiedPersons >= activeBoxes,
        section: 'Section 45',
        status: certifiedPersons >= activeBoxes ? 'green' : certifiedPersons >= activeBoxes * 0.8 ? 'yellow' : 'red'
      },
      {
        rule: 'No Overdue Inspections',
        required: 0,
        actual: overdueInspections,
        compliant: overdueInspections === 0,
        section: 'Best Practice',
        status: overdueInspections === 0 ? 'green' : overdueInspections <= 2 ? 'yellow' : 'red'
      },
      {
        rule: 'No Expired Items',
        required: 0,
        actual: expiredItems,
        compliant: expiredItems === 0,
        section: 'Section 45',
        status: expiredItems === 0 ? 'green' : 'red'
      },
      {
        rule: 'Pending Form 18 Reports',
        required: 0,
        actual: unreportedIncidents,
        compliant: unreportedIncidents === 0,
        section: 'Section 88',
        status: unreportedIncidents === 0 ? 'green' : 'red'
      }
    ];

    const compliantCount = checks.filter(c => c.compliant).length;
    const overallCompliance = Math.round((compliantCount / checks.length) * 100);

    let overallStatus = 'green';
    if (overallCompliance < 50) overallStatus = 'red';
    else if (overallCompliance < 80) overallStatus = 'yellow';

    res.json({
      success: true,
      data: {
        overallCompliance,
        overallStatus,
        checks,
        summary: {
          totalWorkers,
          requiredBoxes,
          activeBoxes,
          adequateBoxes,
          certifiedPersons,
          expiringCerts,
          overdueInspections,
          expiredItems,
          expiringItems,
          unreportedIncidents
        },
        pendingActions: [
          ...(activeBoxes < requiredBoxes ? [`Need ${requiredBoxes - activeBoxes} more first aid box(es)`] : []),
          ...(overdueInspections > 0 ? [`${overdueInspections} box(es) overdue for inspection`] : []),
          ...(expiredItems > 0 ? [`${expiredItems} expired item(s) need replacement`] : []),
          ...(unreportedIncidents > 0 ? [`${unreportedIncidents} incident(s) pending Form 18`] : []),
          ...(expiringCerts > 0 ? [`${expiringCerts} certification(s) expiring soon`] : [])
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get department-level compliance
// @route   GET /api/compliance/departments
// @access  Protected
exports.getDepartmentCompliance = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const departments = await Department.find({ company: companyId, isActive: true });

    const deptCompliance = await Promise.all(departments.map(async dept => {
      const employeeCount = await User.countDocuments({ department: dept._id, isActive: true });
      const requiredBoxes = Math.ceil(employeeCount / 150) || 1;
      const availableBoxes = await FirstAidBox.countDocuments({ department: dept._id, isActive: true });
      const adequateBoxes = await FirstAidBox.countDocuments({ department: dept._id, status: 'adequate', isActive: true });
      const overdueInspections = await FirstAidBox.countDocuments({ department: dept._id, status: 'overdue_inspection', isActive: true });
      const certifiedPersons = await User.countDocuments({ department: dept._id, firstAidCertified: true, isActive: true });
      const incidentCount = await Incident.countDocuments({ department: dept._id, dateTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

      // Check expiry
      const deptBoxes = await FirstAidBox.find({ department: dept._id, isActive: true });
      let expiredItems = 0;
      const now = new Date();
      deptBoxes.forEach(box => {
        box.items.forEach(item => {
          if (item.expiryDate && new Date(item.expiryDate) < now) expiredItems++;
        });
      });

      // Compute compliance score
      let score = 100;
      if (availableBoxes < requiredBoxes) score -= 25;
      if (adequateBoxes < availableBoxes) score -= 15;
      if (overdueInspections > 0) score -= 20;
      if (expiredItems > 0) score -= 20;
      if (certifiedPersons < availableBoxes) score -= 10;
      score = Math.max(0, score);

      let status = 'green';
      if (score < 50) status = 'red';
      else if (score < 80) status = 'yellow';

      return {
        department: { _id: dept._id, name: dept.name, code: dept.code, riskLevel: dept.riskLevel },
        employeeCount,
        requiredBoxes,
        availableBoxes,
        adequateBoxes,
        overdueInspections,
        certifiedPersons,
        incidentCount,
        expiredItems,
        complianceScore: score,
        status
      };
    }));

    // Sort by score ascending (worst first)
    deptCompliance.sort((a, b) => a.complianceScore - b.complianceScore);

    const avgScore = deptCompliance.length
      ? Math.round(deptCompliance.reduce((sum, d) => sum + d.complianceScore, 0) / deptCompliance.length)
      : 100;

    res.json({
      success: true,
      data: {
        departments: deptCompliance,
        averageScore: avgScore,
        totalDepartments: deptCompliance.length,
        riskAreas: deptCompliance.filter(d => d.status === 'red').map(d => d.department.name)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Run compliance check and generate alerts for failures
// @route   POST /api/compliance/check
// @access  Admin, Safety Officer
exports.runComplianceCheck = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;

    // Run company compliance check
    const totalWorkers = await User.countDocuments({ company: companyId, isActive: true });
    const requiredBoxes = Math.ceil(totalWorkers / 150);
    const activeBoxes = await FirstAidBox.countDocuments({ company: companyId, isActive: true });
    const overdueInspections = await FirstAidBox.countDocuments({ company: companyId, status: 'overdue_inspection', isActive: true });

    const alertsToCreate = [];

    if (activeBoxes < requiredBoxes) {
      alertsToCreate.push({
        type: 'compliance_alert',
        title: 'Non-Compliant: Insufficient First Aid Boxes',
        message: `Section 45 requires ${requiredBoxes} boxes for ${totalWorkers} workers, but only ${activeBoxes} are available.`,
        severity: 'critical',
        relatedModel: 'Department'
      });
    }

    if (overdueInspections > 0) {
      alertsToCreate.push({
        type: 'compliance_alert',
        title: 'Overdue Inspections Detected',
        message: `${overdueInspections} first aid box(es) have overdue inspections.`,
        severity: 'warning',
        relatedModel: 'FirstAidBox'
      });
    }

    for (const alert of alertsToCreate) {
      await notifySafetyTeam(companyId, alert);
    }

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Ran compliance check',
      entity: 'Compliance',
      details: `Compliance check completed: ${alertsToCreate.length} alerts generated`,
      company: companyId,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Compliance check completed. ${alertsToCreate.length} alerts generated.`,
      data: { alertsGenerated: alertsToCreate.length }
    });
  } catch (error) {
    next(error);
  }
};
