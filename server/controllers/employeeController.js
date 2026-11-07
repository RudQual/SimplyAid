const User = require('../models/User');
const QrScanLog = require('../models/QrScanLog');
const { generateQrCode, regenerateQrCode, generateQrBuffer } = require('../utils/qrService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'profiles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.params.id}-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error('Only image files (jpg, png, webp) are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const { companyIdOf, departmentIdOf, isValidId, escapeRegex, ApiError } = require('../utils/http');
const { audit } = require('../utils/notificationService');

/** Load a user of the requester's company by Mongo id. */
// Always returns a chainable query; malformed ids simply match nothing (→ 404).
const findCompanyUser = (req, id) => User.findOne({ _id: isValidId(String(id)) ? id : null, company: companyIdOf(req) });

/**
 * Admins/doctors may manage anyone in their company; managers only users of
 * their own department; everyone may manage themselves.
 */
const canManage = (req, user) => {
  if (req.user._id.toString() === user._id.toString()) return true;
  if (['admin', 'doctor'].includes(req.user.role)) return true;
  if (req.user.role === 'manager') {
    const dept = departmentIdOf(req);
    const userDept = user.department && (user.department._id || user.department);
    return Boolean(dept && userDept && String(dept) === String(userDept));
  }
  return false;
};

// Emergency-relevant subset shown to any colleague who scans an employee QR.
const EMERGENCY_FIELDS = ['_id', 'name', 'employeeId', 'department', 'designation', 'profilePhoto', 'bloodGroup',
  'knownAllergies', 'chronicConditions', 'currentMedications', 'emergencyContact', 'disabilityInfo', 'role',
  'profileCompleted', 'profileCompletionPercentage', 'factoryLocation'];
const emergencyView = (user) => {
  const obj = user.toJSON ? user.toJSON() : user;
  const out = {};
  EMERGENCY_FIELDS.forEach((k) => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
};

// @desc    Get full employee profile
// @route   GET /api/employees/profile/:id
// @access  Protected (self or admin/safety_officer)
exports.getEmployeeProfile = async (req, res, next) => {
  try {
    const user = await findCompanyUser(req, req.params.id)
      .select('+qrCodeData')
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Employees can only view their own profile
    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = !isSelf && canManage(req, user);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this profile' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    QR scan → fetch employee profile + log scan
// @route   GET /api/employees/qr/:employeeId
// @access  Protected
exports.getEmployeeByQr = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const user = await User.findOne({ employeeId: String(employeeId), company: companyIdOf(req) })
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Update last scan timestamp
    user.lastQrScanAt = new Date();
    await user.save();

    // Log the scan event
    await QrScanLog.create({
      employee: user._id,
      company: user.company._id || user.company,
      scannedBy: req.user._id,
      scanTime: new Date(),
      actionType: 'profile_view',
      ipAddress: req.ip || req.connection?.remoteAddress
    });

    res.json({ success: true, data: canManage(req, user) ? user : emergencyView(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate QR code for an employee
// @route   POST /api/employees/qr/:id/regenerate
// @access  Admin only
exports.regenerateEmployeeQr = async (req, res, next) => {
  try {
    const user = await findCompanyUser(req, req.params.id).select('+qrCodeData');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!canManage(req, user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const qrData = await regenerateQrCode(user);
    user.qrCodeId = qrData.qrCodeId;
    user.qrCodeData = qrData.qrCodeData;
    user.qrCodeGeneratedAt = qrData.qrCodeGeneratedAt;
    await user.save();

    res.json({
      success: true,
      data: {
        qrCodeId: user.qrCodeId,
        qrCodeData: user.qrCodeData,
        qrCodeGeneratedAt: user.qrCodeGeneratedAt
      },
      message: 'QR code regenerated successfully'
    });
    audit(req, { action: 'Regenerated employee QR code', entity: 'User', entityId: user._id, entityLabel: user.email });
  } catch (error) {
    next(error);
  }
};

// @desc    Download QR code as PNG
// @route   GET /api/employees/qr/:id/download
// @access  Protected (self or admin)
exports.downloadQr = async (req, res, next) => {
  try {
    const user = await findCompanyUser(req, req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = !isSelf && canManage(req, user);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const buffer = await generateQrBuffer(user);
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="QR-${user.employeeId}.png"`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile photo
// @route   PUT /api/employees/:id/photo
// @access  Protected (self or admin)
exports.uploadPhoto = [
  upload.single('photo'),
  async (req, res, next) => {
    try {
      const user = await findCompanyUser(req, req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      const isSelf = req.user._id.toString() === user._id.toString();
      const isAdmin = !isSelf && canManage(req, user);
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload a photo' });
      }

      // Delete old photo if it exists
      if (user.profilePhoto) {
        const uploadsDir = path.resolve(__dirname, '..', 'uploads', 'profiles');
        const oldPath = path.resolve(__dirname, '..', '.' + user.profilePhoto);
        // Only ever delete files inside the profile uploads directory
        if (oldPath.startsWith(uploadsDir + path.sep) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
      await user.save();

      res.json({ success: true, data: { profilePhoto: user.profilePhoto }, message: 'Photo uploaded' });
    } catch (error) {
      next(error);
    }
  }
];

// @desc    Get full ID card data for an employee
// @route   GET /api/employees/card/:id
// @access  Protected (self or admin)
exports.getEmployeeCard = async (req, res, next) => {
  try {
    const user = await findCompanyUser(req, req.params.id)
      .select('+qrCodeData')
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = !isSelf && canManage(req, user);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Older accounts may not have a QR yet — create it so the card is usable
    if (!user.qrCodeData) {
      const qr = await generateQrCode(user);
      Object.assign(user, { qrCodeId: qr.qrCodeId, qrCodeData: qr.qrCodeData, qrCodeGeneratedAt: qr.qrCodeGeneratedAt });
      await user.save();
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all QR scan logs (admin)
// @route   GET /api/employees/scan-history
// @access  Admin, Safety Officer
exports.getScanHistory = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const { employee, actionType, startDate, endDate, page = 1, limit = 25 } = req.query;

    const filter = { company: companyId };
    if (employee) {
      if (!isValidId(String(employee))) return res.status(400).json({ success: false, message: 'Invalid employee' });
      filter.employee = employee;
    }
    if (req.user.role === 'manager' && departmentIdOf(req)) {
      filter.employee = { $in: await User.find({ company: companyId, department: departmentIdOf(req) }).distinct('_id') };
      if (employee) filter.employee.$in = filter.employee.$in.filter((id) => String(id) === String(employee));
    }
    if (actionType) filter.actionType = actionType;
    if (startDate || endDate) {
      filter.scanTime = {};
      if (startDate) filter.scanTime.$gte = new Date(startDate);
      if (endDate) filter.scanTime.$lte = new Date(endDate);
    }

    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const skip = (Math.max(1, parseInt(page) || 1) - 1) * safeLimit;
    const [logs, total] = await Promise.all([
      QrScanLog.find(filter)
        .populate('employee', 'name employeeId profilePhoto')
        .populate('scannedBy', 'name role')
        .sort({ scanTime: -1 })
        .skip(skip)
        .limit(safeLimit),
      QrScanLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.max(1, Math.ceil(total / safeLimit)),
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get scan history for a specific employee
// @route   GET /api/employees/scan-history/:employeeId
// @access  Protected (self or admin)
exports.getEmployeeScanHistory = async (req, res, next) => {
  try {
    const employee = await findCompanyUser(req, req.params.employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === employee._id.toString();
    const isAdmin = !isSelf && canManage(req, employee);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const logs = await QrScanLog.find({ employee: employee._id })
      .populate('scannedBy', 'name role')
      .sort({ scanTime: -1 })
      .limit(100);

    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
};

// @desc    Update employee profile (limited fields for self, all for admin)
// @route   PUT /api/employees/profile/:id
// @access  Protected (self or admin)
exports.updateEmployeeProfile = async (req, res, next) => {
  try {
    const user = await findCompanyUser(req, req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = !isSelf && canManage(req, user);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Fields employees can update themselves
    const selfAllowed = [
      // Personal
      'name', 'gender', 'dateOfBirth', 'bloodGroup', 'phone', 'emergencyContact',
      // Employment (normally admin only, but allowing based on requirements, or keeping some restricted)
      'designation', 'factoryLocation', 'shiftTiming', 'dateOfJoining', 'reportingManager',
      // Medical
      'knownAllergies', 'chronicConditions', 'currentMedications', 'disabilityInfo', 'additionalMedicalNotes',
      // Safety
      'firstAidTrainingStatus', 'lastSafetyTrainingDate', 'ppeAssigned', 'safetyCertifications',
      // Settings
      'preferredLanguage'
    ];
    // Managers/doctors/admins may additionally maintain employment & certification data.
    // Role, company, email and account status are changed only via /api/users.
    const managerAllowed = [...selfAllowed, 'employeeId', 'department', 'firstAidCertified', 'certificationNumber', 'certificationExpiry'];
    const allowed = isAdmin ? managerAllowed : selfAllowed;

    if (isAdmin && req.body.department !== undefined && req.body.department !== '' && req.user.role === 'manager') {
      // Managers cannot move people out of their own department
      if (String(req.body.department) !== String(departmentIdOf(req))) delete req.body.department;
    }
    if (req.body.department) {
      const Department = require('../models/Department');
      if (!isValidId(String(req.body.department)) || !(await Department.exists({ _id: req.body.department, company: companyIdOf(req) }))) {
        return res.status(400).json({ success: false, message: 'Invalid department' });
      }
    }
    if (req.body.employeeId && isAdmin && req.body.employeeId !== user.employeeId) {
      if (await User.exists({ _id: { $ne: user._id }, company: user.company, employeeId: String(req.body.employeeId) })) {
        return res.status(409).json({ success: false, message: 'This employee ID is already in use' });
      }
    }

    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue;
      
      // Handle empty strings for ObjectId fields like department
      if (key === 'department' && value === '') {
        user[key] = undefined;
      } else {
        user[key] = value;
      }
    }

    await user.save();
    audit(req, { action: 'Updated employee profile', entity: 'User', entityId: user._id, entityLabel: user.email });

    // Repopulate for response
    await user.populate('company', 'name code');
    await user.populate('department', 'name code');

    res.json({ success: true, data: user, message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's profile
// @route   GET /api/employees/my-profile
// @access  Protected
exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+qrCodeData')
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Auto-generate QR if missing
    if (!user.qrCodeData) {
      try {
        const { generateQrCode } = require('../utils/qrService');
        const qrData = await generateQrCode(user);
        user.qrCodeId = qrData.qrCodeId;
        user.qrCodeData = qrData.qrCodeData;
        user.qrCodeGeneratedAt = qrData.qrCodeGeneratedAt;
        await user.save();
      } catch (err) {
        console.error('Auto-generation of QR failed:', err);
      }
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's profile
// @route   PUT /api/employees/my-profile
// @access  Protected
exports.updateMyProfile = async (req, res, next) => {
  req.params.id = req.user._id.toString(); // Reuse updateEmployeeProfile logic
  return exports.updateEmployeeProfile(req, res, next);
};

// @desc    Validate a scanned QR code payload
// @route   POST /api/employees/qr/validate
// @access  Protected
exports.validateQrScan = async (req, res, next) => {
  try {
    const { userId, employeeId, qrCodeId, type, id, empId } = req.body;

    const targetUserId = userId || id;
    const targetEmpId = employeeId || empId;

    if (!qrCodeId && !targetUserId && !targetEmpId) {
      return res.status(400).json({ success: false, message: 'Invalid QR format: no user identification found' });
    }

    let user = null;

    const scope = { company: companyIdOf(req) };
    const safeStr = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined);
    // 1. Try finding by qrCodeId if provided
    if (safeStr(qrCodeId)) {
      user = await User.findOne({ ...scope, qrCodeId: safeStr(qrCodeId) })
        .populate('company', 'name code')
        .populate('department', 'name');
    }

    // 2. Fallback: try finding by userId and employeeId
    if (!user && isValidId(safeStr(targetUserId) || '') && safeStr(targetEmpId)) {
      user = await User.findOne({ ...scope, _id: targetUserId, employeeId: safeStr(targetEmpId) })
        .populate('company', 'name code')
        .populate('department', 'name');
    }

    // 3. Fallback: try finding by employeeId alone
    if (!user && safeStr(targetEmpId)) {
      user = await User.findOne({ ...scope, employeeId: safeStr(targetEmpId) })
        .populate('company', 'name code')
        .populate('department', 'name');
    }

    // 4. Fallback: try finding by userId alone
    if (!user && isValidId(safeStr(targetUserId) || '')) {
      user = await User.findOne({ ...scope, _id: targetUserId })
        .populate('company', 'name code')
        .populate('department', 'name');
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Invalid or expired QR Code' });
    }

    // A QR that carries a qrCodeId must match the employee's current code
    // (regenerating a QR invalidates the old printed one).
    if (qrCodeId && user.qrCodeId && String(qrCodeId) !== user.qrCodeId) {
      return res.status(400).json({ success: false, message: 'This QR code has been replaced. Please use the employee\'s latest ID card.' });
    }

    // Verify IDs match to prevent spoofing (only if provided in payload and different from found user)
    if (targetUserId && user._id.toString() !== targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'QR Code user ID mismatch' });
    }
    if (targetEmpId && user.employeeId !== targetEmpId) {
      return res.status(400).json({ success: false, message: 'QR Code employee ID mismatch' });
    }

    // Log the scan event safely
    try {
      await QrScanLog.create({
        employee: user._id,
        company: user.company?._id || user.company,
        scannedBy: req.user._id,
        scanTime: new Date(),
        actionType: 'qr_validation',
        ipAddress: req.ip || req.connection?.remoteAddress
      });
    } catch (logErr) {
      console.error('Failed to log scan event:', logErr.message);
    }

    await User.updateOne({ _id: user._id }, { $set: { lastQrScanAt: new Date() } });

    res.json({ 
      success: true, 
      data: {
        _id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        designation: user.designation,
        profilePhoto: user.profilePhoto,
        profileCompleted: user.profileCompleted,
        profileCompletionPercentage: user.profileCompletionPercentage,
        bloodGroup: user.bloodGroup
      },
      message: 'QR Code Validated' 
    });
  } catch (error) {
    next(error);
  }
};
