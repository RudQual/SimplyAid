const Prescription = require('../models/Prescription');
const User = require('../models/User');
const { createAuditLog, notifySafetyTeam } = require('../utils/notificationService');

// @desc    Create a new prescription
// @route   POST /api/prescriptions
// @access  Protected (admin, safety_officer)
exports.createPrescription = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    req.body.company = companyId;
    req.body.createdBy = req.user._id;

    const prescription = await Prescription.create(req.body);

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Created prescription',
      entity: 'Prescription',
      entityId: prescription._id,
      details: `Prescription ${prescription.prescriptionId} created for employee`,
      company: companyId,
      ipAddress: req.ip
    });

    const populated = await Prescription.findById(prescription._id)
      .populate('employee', 'name employeeId')
      .populate('createdBy', 'name');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Get prescriptions with filtering & pagination
// @route   GET /api/prescriptions
// @access  Protected
exports.getPrescriptions = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const { employee, status, startDate, endDate, search, page = 1, limit = 20 } = req.query;

    const filter = { company: companyId };

    // Employees can only see their own prescriptions
    if (req.user.role === 'employee') {
      filter.employee = req.user._id;
    } else if (employee) {
      filter.employee = employee;
    }

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = new Date(startDate);
      if (endDate) filter.issueDate.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { prescriptionId: { $regex: search, $options: 'i' } },
        { doctorName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [prescriptions, total] = await Promise.all([
      Prescription.find(filter)
        .populate('employee', 'name employeeId profilePhoto')
        .populate('createdBy', 'name')
        .sort('-issueDate')
        .skip(skip)
        .limit(parseInt(limit)),
      Prescription.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: prescriptions.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single prescription by ID
// @route   GET /api/prescriptions/:id
// @access  Protected
exports.getPrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('employee', 'name employeeId email phone department profilePhoto')
      .populate('createdBy', 'name email');

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    // Employees can only view their own prescriptions
    if (req.user.role === 'employee' && prescription.employee._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: prescription });
  } catch (error) {
    next(error);
  }
};

// @desc    Update prescription (status, details)
// @route   PUT /api/prescriptions/:id
// @access  Protected (admin, safety_officer)
exports.updatePrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const allowedFields = ['status', 'doctorName', 'doctorRegistrationNumber', 'expiryDate', 'medicines', 'notes'];
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) prescription[f] = req.body[f];
    });

    await prescription.save();

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: `Updated prescription (${req.body.status ? 'status: ' + req.body.status : 'details'})`,
      entity: 'Prescription',
      entityId: prescription._id,
      details: `Prescription ${prescription.prescriptionId} updated`,
      company: req.user.company._id || req.user.company,
      ipAddress: req.ip
    });

    const populated = await Prescription.findById(prescription._id)
      .populate('employee', 'name employeeId')
      .populate('createdBy', 'name');

    res.json({ success: true, data: populated, message: 'Prescription updated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active prescriptions for an employee (smart dispenser API)
// @route   GET /api/prescriptions/employee/:id/active
// @access  Protected
exports.getActivePrescriptions = async (req, res, next) => {
  try {
    const prescriptions = await Prescription.find({
      employee: req.params.id,
      status: 'active'
    })
      .populate('employee', 'name employeeId')
      .populate('createdBy', 'name')
      .sort('-issueDate');

    // Log the access for future smart dispenser audit trail
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Retrieved active prescriptions',
      entity: 'Prescription',
      details: `Retrieved ${prescriptions.length} active prescriptions for employee ${req.params.id}`,
      company: req.user.company._id || req.user.company,
      ipAddress: req.ip
    });

    res.json({ success: true, count: prescriptions.length, data: prescriptions });
  } catch (error) {
    next(error);
  }
};
