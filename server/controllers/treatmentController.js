const TreatmentRecord = require('../models/TreatmentRecord');
const FirstAidBox = require('../models/FirstAidBox');
const Incident = require('../models/Incident');
const User = require('../models/User');
const { notifySafetyTeam, createAuditLog } = require('../utils/notificationService');
const { deductForTreatment } = require('../services/stockService');
const { ApiError, companyIdOf, isValidId, pick, escapeRegex } = require('../utils/http');

const TREATMENT_FIELDS = ['employee', 'employeeName', 'incident', 'treatmentDate', 'treatmentTime', 'treatmentLocation', 'injuryType',
  'injurySeverity', 'treatmentProvided', 'medicinesUsed', 'firstAidBoxUsed', 'remarks'];

// @desc    Create a treatment record + deduct supplies from the kit used
// @route   POST /api/treatments
// @access  Doctor
exports.createTreatment = async (req, res, next) => {
  try {
    const companyId = companyIdOf(req);
    const data = pick(req.body, TREATMENT_FIELDS);
    if (!data.employee || !isValidId(String(data.employee))) throw ApiError.badRequest('Please select the employee who was treated');
    const emp = await User.findOne({ _id: data.employee, company: companyId }).select('name');
    if (!emp) throw ApiError.badRequest('Employee not found');
    data.employeeName = emp.name;
    if (data.incident) {
      if (!isValidId(String(data.incident)) || !(await Incident.exists({ _id: data.incident, company: companyId }))) throw ApiError.badRequest('Invalid incident');
    } else delete data.incident;
    if (data.firstAidBoxUsed) {
      if (!isValidId(String(data.firstAidBoxUsed)) || !(await FirstAidBox.exists({ _id: data.firstAidBoxUsed, company: companyId }))) throw ApiError.badRequest('Invalid first aid kit');
    } else delete data.firstAidBoxUsed;
    if (data.medicinesUsed !== undefined) {
      if (!Array.isArray(data.medicinesUsed)) throw ApiError.badRequest('medicinesUsed must be a list');
      data.medicinesUsed = data.medicinesUsed.filter((m) => m && m.name).slice(0, 50).map((m) => {
        const quantity = Number(m.quantity ?? 1);
        if (!Number.isInteger(quantity) || quantity < 1) throw ApiError.badRequest('Medicine quantity must be a whole number of at least 1');
        if (m.item && !isValidId(String(m.item))) throw ApiError.badRequest('Invalid medicine item');
        return { item: m.item || undefined, name: String(m.name).slice(0, 120), quantity };
      });
    }

    const treatment = await TreatmentRecord.create({
      ...data,
      company: companyId,
      firstAider: req.user._id,
      firstAiderName: req.user.name
    });

    let warning = null;
    try {
      const result = await deductForTreatment(treatment, req.user);
      const shortfall = result ? result.transactions.reduce((sum, t) => sum + (t.shortfall || 0), 0) : 0;
      if (shortfall) warning = `Kit stock was insufficient by ${shortfall} unit(s); the kit has been flagged for restocking.`;
    } catch (err) {
      console.error('Stock deduction failed for treatment', treatment.treatmentId, err.message);
      warning = 'Supplies could not be deducted from the kit automatically. Please adjust the kit stock manually.';
    }

    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'Created treatment record',
      entity: 'Treatment',
      entityId: treatment._id,
      entityLabel: treatment.treatmentId,
      details: `Treatment ${treatment.treatmentId} for ${treatment.employeeName || 'employee'} — ${treatment.injurySeverity} severity`,
      company: companyId,
      ipAddress: req.ip
    });

    if (['serious', 'critical'].includes(treatment.injurySeverity)) {
      await notifySafetyTeam(companyId, {
        type: 'treatment_alert',
        title: `${treatment.injurySeverity.toUpperCase()} treatment recorded`,
        message: `${treatment.treatmentId}: ${treatment.employeeName || 'Employee'} treated for ${treatment.injuryType || 'injury'} (${treatment.injurySeverity})`,
        severity: treatment.injurySeverity === 'critical' ? 'critical' : 'warning',
        relatedModel: 'TreatmentRecord',
        relatedId: treatment._id
      });
    }

    const populated = await TreatmentRecord.findById(treatment._id)
      .populate('employee', 'name employeeId')
      .populate('firstAider', 'name')
      .populate('incident', 'incidentId')
      .populate('firstAidBoxUsed', 'boxId location');

    res.status(201).json({ success: true, data: populated, message: `Treatment ${treatment.treatmentId} recorded`, warning });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all treatments with filtering & pagination
// @route   GET /api/treatments
// @access  Protected
exports.getTreatments = async (req, res, next) => {
  try {
    const companyId = companyIdOf(req);
    const { employee, severity, firstAider, startDate, endDate, search, page = 1, limit = 20 } = req.query;

    const filter = { company: companyId };
    if (employee) filter.employee = employee;
    if (severity) filter.injurySeverity = severity;
    if (firstAider) filter.firstAider = firstAider;
    if (startDate || endDate) {
      filter.treatmentDate = {};
      if (startDate) filter.treatmentDate.$gte = new Date(startDate);
      if (endDate) filter.treatmentDate.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { treatmentId: { $regex: escapeRegex(search), $options: 'i' } },
        { employeeName: { $regex: escapeRegex(search), $options: 'i' } },
        { treatmentProvided: { $regex: escapeRegex(search), $options: 'i' } },
        { injuryType: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (Math.max(1, parseInt(page) || 1) - 1) * safeLimit;
    const [treatments, total] = await Promise.all([
      TreatmentRecord.find(filter)
        .populate('employee', 'name employeeId profilePhoto')
        .populate('firstAider', 'name')
        .populate('incident', 'incidentId')
        .populate('firstAidBoxUsed', 'boxId')
        .sort('-treatmentDate')
        .skip(skip)
        .limit(safeLimit),
      TreatmentRecord.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: treatments.length,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
      currentPage: parseInt(page),
      data: treatments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single treatment by ID
// @route   GET /api/treatments/:id
// @access  Protected
exports.getTreatment = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.notFound('Treatment record not found');
    const treatment = await TreatmentRecord.findOne({ _id: req.params.id, company: companyIdOf(req) })
      .populate('employee', 'name employeeId email phone profilePhoto department')
      .populate('firstAider', 'name email')
      .populate('incident', 'incidentId description severity')
      .populate('firstAidBoxUsed', 'boxId location department')
      .populate('medicinesUsed.item', 'name category unit');

    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment record not found' });
    }

    res.json({ success: true, data: treatment });
  } catch (error) {
    next(error);
  }
};

// @desc    Get treatment history for a specific employee
// @route   GET /api/treatments/employee/:employeeId
// @access  Protected
exports.getEmployeeTreatments = async (req, res, next) => {
  try {
    const isSelf = String(req.user._id) === String(req.params.employeeId);
    if (!isSelf && !['admin', 'doctor', 'manager'].includes(req.user.role)) throw ApiError.forbidden();
    if (!isValidId(req.params.employeeId)) throw ApiError.notFound('Employee not found');
    const treatments = await TreatmentRecord.find({ employee: req.params.employeeId, company: companyIdOf(req) })
      .populate('firstAider', 'name')
      .populate('incident', 'incidentId')
      .populate('medicinesUsed.item', 'name category')
      .sort('-treatmentDate')
      .limit(100);

    res.json({ success: true, count: treatments.length, data: treatments });
  } catch (error) {
    next(error);
  }
};

// @desc    Get treatment statistics
// @route   GET /api/treatments/stats
// @access  Protected
exports.getTreatmentStats = async (req, res, next) => {
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

    // Monthly trend
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$treatmentDate' }, month: { $month: '$treatmentDate' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Most used medicines
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

    // Top first aiders
    const topFirstAiders = await TreatmentRecord.aggregate([
      { $match: { company: companyId, treatmentDate: { $gte: startDate } } },
      {
        $group: {
          _id: '$firstAider',
          treatmentCount: { $sum: 1 },
          name: { $first: '$firstAiderName' }
        }
      },
      { $sort: { treatmentCount: -1 } },
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
  } catch (error) {
    next(error);
  }
};
