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
    const isAdmin = ['admin', 'safety_officer', 'department_head'].includes(req.user.role);
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
    const isAdmin = ['admin', 'safety_officer'].includes(req.user.role);
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
      const isAdmin = req.user.role === 'admin';
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
    const isAdmin = ['admin', 'safety_officer'].includes(req.user.role);
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
    const isAdmin = ['admin', 'safety_officer'].includes(req.user.role);
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
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Fields employees can update themselves
    const selfAllowed = ['phone', 'emergencyContact', 'knownAllergies', 'chronicConditions', 'preferredLanguage'];
    // Admins can update everything except password and system fields
    const adminBlocked = ['password', '_id', 'qrCodeId', 'qrCodeData', 'employeeId'];

    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (adminBlocked.includes(key)) continue;
      if (!isAdmin && !selfAllowed.includes(key)) continue;
      updates[key] = value;
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    })
      .populate('company', 'name code')
      .populate('department', 'name code');

    res.json({ success: true, data: updated, message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
};
