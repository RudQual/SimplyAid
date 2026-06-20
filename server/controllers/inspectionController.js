const Inspection = require('../models/Inspection');
const FirstAidBox = require('../models/FirstAidBox');
const { createAuditLog, notifySafetyTeam } = require('../utils/notificationService');

// @desc    Create a full inspection record
// @route   POST /api/inspections
// @access  Admin, Safety Officer, First Aider
exports.createInspection = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    req.body.company = companyId;
    req.body.inspector = req.user._id;
    req.body.inspectorName = req.user.name;

    const inspection = await Inspection.create(req.body);

    // Also update the FirstAidBox embedded inspection log + dates
    const box = await FirstAidBox.findById(req.body.firstAidBox);
    if (box) {
      box.inspectionLogs.push({
        inspectedBy: req.user._id,
        status: req.body.status || 'adequate',
        notes: req.body.overallNotes || ''
      });
      box.lastInspectionDate = new Date();
      box.nextInspectionDue = new Date(Date.now() + box.inspectionFrequencyDays * 24 * 60 * 60 * 1000);
      box.computeStatus();
      await box.save();
    }

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Completed box inspection',
      entity: 'Inspection',
      entityId: inspection._id,
      details: `Inspection ${inspection.inspectionId} for box ${box?.boxId || 'unknown'} — Status: ${req.body.status}`,
      company: companyId,
      ipAddress: req.ip
    });

    // Notify if deficiencies found
    if (req.body.deficiencies && req.body.deficiencies.length > 0) {
      notifySafetyTeam(companyId, {
        type: 'inspection_due',
        title: `Inspection deficiencies found in box ${box?.boxId}`,
        message: `${req.body.deficiencies.length} deficiency(ies) logged during inspection of box ${box?.boxId} at ${box?.location}`,
        severity: 'warning',
        relatedModel: 'FirstAidBox',
        relatedId: box?._id
      });
    }

    const populated = await Inspection.findById(inspection._id)
      .populate('firstAidBox', 'boxId location department')
      .populate('inspector', 'name');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Get inspections with filtering & pagination
// @route   GET /api/inspections
// @access  Protected
exports.getInspections = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const { firstAidBox, inspector, status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { company: companyId };
    if (firstAidBox) filter.firstAidBox = firstAidBox;
    if (inspector) filter.inspector = inspector;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.inspectionDate = {};
      if (startDate) filter.inspectionDate.$gte = new Date(startDate);
      if (endDate) filter.inspectionDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [inspections, total] = await Promise.all([
      Inspection.find(filter)
        .populate('firstAidBox', 'boxId location')
        .populate('inspector', 'name')
        .sort('-inspectionDate')
        .skip(skip)
        .limit(parseInt(limit)),
      Inspection.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: inspections.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: inspections
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single inspection by ID
// @route   GET /api/inspections/:id
// @access  Protected
exports.getInspection = async (req, res, next) => {
  try {
    const inspection = await Inspection.findById(req.params.id)
      .populate('firstAidBox', 'boxId location department items')
      .populate('inspector', 'name email')
      .populate('deficiencies.resolvedBy', 'name');

    if (!inspection) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }

    res.json({ success: true, data: inspection });
  } catch (error) {
    next(error);
  }
};
