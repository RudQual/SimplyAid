const TreatmentRecord = require('../models/TreatmentRecord');
const FirstAidBox = require('../models/FirstAidBox');
const User = require('../models/User');
const { notifySafetyTeam, createAuditLog } = require('../utils/notificationService');

// @desc    Create a treatment record + auto-deduct inventory
// @route   POST /api/treatments
// @access  Protected (safety_officer, first_aider, admin)
exports.createTreatment = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    req.body.company = companyId;
    req.body.firstAider = req.body.firstAider || req.user._id;
    req.body.firstAiderName = req.body.firstAiderName || req.user.name;

    // If employee name not provided, look it up
    if (req.body.employee && !req.body.employeeName) {
      const emp = await User.findById(req.body.employee).select('name');
      if (emp) req.body.employeeName = emp.name;
    }

    const treatment = await TreatmentRecord.create(req.body);

    // Auto-deduct inventory from first aid box if provided
    if (req.body.firstAidBoxUsed && req.body.medicinesUsed && req.body.medicinesUsed.length) {
      const box = await FirstAidBox.findById(req.body.firstAidBoxUsed);
      if (box) {
        req.body.medicinesUsed.forEach(med => {
          const boxItem = box.items.find(i =>
            i.item.toString() === (med.item || '').toString()
          );
          if (boxItem) {
            boxItem.currentQty = Math.max(0, boxItem.currentQty - (med.quantity || 1));
          }
        });
        box.computeStatus();
        await box.save();
      }
    }

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Created treatment record',
      entity: 'Treatment',
      entityId: treatment._id,
      details: `Treatment ${treatment.treatmentId} for ${treatment.employeeName || 'employee'} — ${treatment.injurySeverity} severity`,
      company: companyId,
      ipAddress: req.ip
    });

    // Notify safety team for serious/critical treatments
    if (['serious', 'critical'].includes(treatment.injurySeverity)) {
      notifySafetyTeam(companyId, {
        type: 'incident_alert',
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

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all treatments with filtering & pagination
// @route   GET /api/treatments
// @access  Protected
exports.getTreatments = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
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
        { treatmentId: { $regex: search, $options: 'i' } },
        { employeeName: { $regex: search, $options: 'i' } },
        { treatmentProvided: { $regex: search, $options: 'i' } },
        { injuryType: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [treatments, total] = await Promise.all([
      TreatmentRecord.find(filter)
        .populate('employee', 'name employeeId profilePhoto')
        .populate('firstAider', 'name')
        .populate('incident', 'incidentId')
        .populate('firstAidBoxUsed', 'boxId')
        .sort('-treatmentDate')
        .skip(skip)
        .limit(parseInt(limit)),
      TreatmentRecord.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: treatments.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
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
    const treatment = await TreatmentRecord.findById(req.params.id)
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
    const treatments = await TreatmentRecord.find({ employee: req.params.employeeId })
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
