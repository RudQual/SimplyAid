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

// @desc    Get full employee profile
// @route   GET /api/employees/profile/:id
// @access  Protected (self or admin/safety_officer)
exports.getEmployeeProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('+qrCodeData')
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Employees can only view their own profile
    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = ['doctor', 'manager'].includes(req.user.role);
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
    const user = await User.findOne({ employeeId })
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

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate QR code for an employee
// @route   POST /api/employees/qr/:id/regenerate
// @access  Admin only
exports.regenerateEmployeeQr = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+qrCodeData');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
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
  } catch (error) {
    next(error);
  }
};

// @desc    Download QR code as PNG
// @route   GET /api/employees/qr/:id/download
// @access  Protected (self or admin)
exports.downloadQr = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = ['doctor', 'manager'].includes(req.user.role);
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
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      const isSelf = req.user._id.toString() === user._id.toString();
      const isAdmin = ['doctor', 'manager'].includes(req.user.role);
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload a photo' });
      }

      // Delete old photo if it exists
      if (user.profilePhoto) {
        const oldPath = path.join(__dirname, '..', user.profilePhoto);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
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
    const user = await User.findById(req.params.id)
      .select('+qrCodeData')
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = ['doctor', 'manager'].includes(req.user.role);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
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
    if (employee) filter.employee = employee;
    if (actionType) filter.actionType = actionType;
    if (startDate || endDate) {
      filter.scanTime = {};
      if (startDate) filter.scanTime.$gte = new Date(startDate);
      if (endDate) filter.scanTime.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      QrScanLog.find(filter)
        .populate('employee', 'name employeeId profilePhoto')
        .populate('scannedBy', 'name role')
        .sort({ scanTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      QrScanLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
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
    const employee = await User.findById(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === employee._id.toString();
    const isAdmin = ['doctor', 'manager'].includes(req.user.role);
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
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = ['doctor', 'manager'].includes(req.user.role);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Fields employees can update themselves
    const selfAllowed = [
      // Personal
      'name', 'gender', 'dateOfBirth', 'bloodGroup', 'phone', 'emergencyContact',
      // Employment (normally admin only, but allowing based on requirements, or keeping some restricted)
      'employeeId', 'department', 'designation', 'factoryLocation', 'shiftTiming', 'dateOfJoining', 'reportingManager',
      // Medical
      'knownAllergies', 'chronicConditions', 'currentMedications', 'disabilityInfo', 'additionalMedicalNotes',
      // Safety
      'firstAidTrainingStatus', 'lastSafetyTrainingDate', 'ppeAssigned', 'safetyCertifications',
      // Settings
      'preferredLanguage'
    ];
    // Admins can update everything except password and system fields
    const adminBlocked = ['password', '_id', 'qrCodeId', 'qrCodeData']; // Allow admin to change employeeId if needed

    for (const [key, value] of Object.entries(req.body)) {
      if (adminBlocked.includes(key)) continue;
      if (!isAdmin && !selfAllowed.includes(key)) continue;
      
      // Handle empty strings for ObjectId fields like department
      if (key === 'department' && value === '') {
        user[key] = undefined;
      } else {
        user[key] = value;
      }
    }

    await user.save();
    
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
    const { userId, employeeId, qrCodeId, type } = req.body;

    if (!qrCodeId || type !== 'employee') {
      return res.status(400).json({ success: false, message: 'Invalid QR format' });
    }

    const user = await User.findOne({ qrCodeId })
      .populate('company', 'name code')
      .populate('department', 'name');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Invalid or expired QR Code' });
    }

    // Verify IDs match to prevent spoofing
    if (user._id.toString() !== userId || user.employeeId !== employeeId) {
      return res.status(400).json({ success: false, message: 'QR Code data mismatch' });
    }

    // Log the scan event
    await QrScanLog.create({
      employee: user._id,
      company: user.company?._id || user.company,
      scannedBy: req.user._id,
      scanTime: new Date(),
      actionType: 'qr_validation',
      ipAddress: req.ip || req.connection?.remoteAddress
    });

    user.lastQrScanAt = new Date();
    await user.save();

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
