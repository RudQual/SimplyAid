const Incident = require('../models/Incident');
const TreatmentRecord = require('../models/TreatmentRecord');
const FirstAidBox = require('../models/FirstAidBox');
const Inspection = require('../models/Inspection');
const User = require('../models/User');
const Department = require('../models/Department');

// @desc    Get injury analytics
// @route   GET /api/analytics/injuries
exports.getInjuryAnalytics = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const period = parseInt(req.query.period || '180');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const [summary] = await Incident.aggregate([
      { $match: { company: companyId, dateTime: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          minor: { $sum: { $cond: [{ $eq: ['$severity', 'minor'] }, 1, 0] } },
          moderate: { $sum: { $cond: [{ $eq: ['$severity', 'moderate'] }, 1, 0] } },
          serious: { $sum: { $cond: [{ $eq: ['$severity', 'serious'] }, 1, 0] } },
          fatal: { $sum: { $cond: [{ $eq: ['$severity', 'fatal'] }, 1, 0] } },
          totalDaysLost: { $sum: '$daysLost' }
        }
      }
    ]);

    const monthlyTrend = await Incident.aggregate([
      { $match: { company: companyId, dateTime: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$dateTime' }, month: { $month: '$dateTime' } },
          count: { $sum: 1 },
          serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const departmentWise = await Incident.aggregate([
      { $match: { company: companyId, dateTime: { $gte: startDate } } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } },
          daysLost: { $sum: '$daysLost' }
        }
      },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$dept.name', count: 1, serious: 1, daysLost: 1 } },
      { $sort: { count: -1 } }
    ]);

    const severityDistribution = await Incident.aggregate([
      { $match: { company: companyId, dateTime: { $gte: startDate } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    const commonInjuryTypes = await Incident.aggregate([
      { $match: { company: companyId, dateTime: { $gte: startDate } } },
      { $group: { _id: '$incidentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary || { total: 0, minor: 0, moderate: 0, serious: 0, fatal: 0, totalDaysLost: 0 },
        monthlyTrend,
        departmentWise,
        severityDistribution,
        commonInjuryTypes
      }
    });
  } catch (error) { next(error); }
};

// @desc    Get treatment analytics
// @route   GET /api/analytics/treatments
exports.getTreatmentAnalytics = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const period = parseInt(req.query.period || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const [summary] = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          minor: { $sum: { $cond: [{ $eq: ['$injurySeverity', 'minor'] }, 1, 0] } },
          moderate: { $sum: { $cond: [{ $eq: ['$injurySeverity', 'moderate'] }, 1, 0] } },
          serious: { $sum: { $cond: [{ $eq: ['$injurySeverity', 'serious'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$injurySeverity', 'critical'] }, 1, 0] } }
        }
      }
    ]);

    const monthlyTrend = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { year: { $year: '$treatmentDate' }, month: { $month: '$treatmentDate' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const topMedicines = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: startDate } } },
      { $unwind: '$medicinesUsed' },
      {
        $group: {
          _id: '$medicinesUsed.name',
          totalUsed: { $sum: '$medicinesUsed.quantity' },
          treatmentCount: { $sum: 1 }
        }
      },
      { $sort: { totalUsed: -1 } },
      { $limit: 10 }
    ]);

    const topFirstAiders = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: startDate } } },
      {
        $group: {
          _id: '$firstAider',
          count: { $sum: 1 },
          name: { $first: '$firstAiderName' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary || { total: 0, minor: 0, moderate: 0, serious: 0, critical: 0 },
        monthlyTrend,
        topMedicines,
        topFirstAiders
      }
    });
  } catch (error) { next(error); }
};

// @desc    Get inventory analytics
// @route   GET /api/analytics/inventory
exports.getInventoryAnalytics = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const period = parseInt(req.query.period || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Most consumed items (from treatments)
    const mostConsumed = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: startDate } } },
      { $unwind: '$medicinesUsed' },
      {
        $group: {
          _id: '$medicinesUsed.name',
          totalConsumed: { $sum: '$medicinesUsed.quantity' }
        }
      },
      { $sort: { totalConsumed: -1 } },
      { $limit: 10 }
    ]);

    // Stock status across boxes
    const boxes = await FirstAidBox.find({ company: companyId, isActive: true })
      .populate('items.item', 'name category');

    let totalItems = 0;
    let lowStockItems = 0;
    let adequateItems = 0;
    const now = new Date();
    let expiredItems = 0;

    boxes.forEach(box => {
      box.items.forEach(item => {
        totalItems++;
        if (item.currentQty < item.requiredQty) lowStockItems++;
        else adequateItems++;
        if (item.expiryDate && new Date(item.expiryDate) < now) expiredItems++;
      });
    });

    // Consumption trend (monthly)
    const consumptionTrend = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } },
      { $unwind: '$medicinesUsed' },
      {
        $group: {
          _id: { year: { $year: '$treatmentDate' }, month: { $month: '$treatmentDate' } },
          totalConsumed: { $sum: '$medicinesUsed.quantity' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: { totalItems, lowStockItems, adequateItems, expiredItems, totalBoxes: boxes.length },
        mostConsumed,
        consumptionTrend
      }
    });
  } catch (error) { next(error); }
};

// @desc    Get compliance analytics
// @route   GET /api/analytics/compliance
exports.getComplianceAnalytics = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;

    // Department rankings
    const departments = await Department.find({ company: companyId, isActive: true });
    const deptRankings = await Promise.all(departments.map(async dept => {
      const empCount = await User.countDocuments({ department: dept._id, isActive: true });
      const boxCount = await FirstAidBox.countDocuments({ department: dept._id, isActive: true });
      const adequateBoxes = await FirstAidBox.countDocuments({ department: dept._id, status: 'adequate', isActive: true });
      const certCount = await User.countDocuments({ department: dept._id, firstAidCertified: true, isActive: true });

      const requiredBoxes = Math.ceil(empCount / 150) || 1;
      let score = 100;
      if (boxCount < requiredBoxes) score -= 30;
      if (adequateBoxes < boxCount) score -= 20;
      if (certCount < boxCount) score -= 15;

      return { name: dept.name, code: dept.code, score: Math.max(0, score), empCount, boxCount, requiredBoxes };
    }));

    deptRankings.sort((a, b) => b.score - a.score);

    // Inspection completion rate
    const totalBoxes = await FirstAidBox.countDocuments({ company: companyId, isActive: true });
    const inspectedThisMonth = await Inspection.countDocuments({
      company: companyId,
      inspectionDate: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });

    const inspectionRate = totalBoxes > 0 ? Math.round((inspectedThisMonth / totalBoxes) * 100) : 0;

    res.json({
      success: true,
      data: {
        departmentRankings: deptRankings,
        inspectionCompletionRate: inspectionRate,
        inspectedThisMonth,
        totalBoxes
      }
    });
  } catch (error) { next(error); }
};
