const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const { generateEmployeeId } = require('../utils/employeeIdGenerator');
const { generateQrCode } = require('../utils/qrService');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Helper: get default company for self-registration
const getDefaultCompany = async () => {
  const company = await Company.findOne({ isActive: true }).sort({ createdAt: 1 });
  return company ? company._id : null;
};

// Helper: login response — generates token and sends user data
const sendAuthResponse = (res, user, statusCode = 200) => {
  const token = generateToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({
    success: true,
    token,
    data: user
  });
};

// @desc    Register a new user (admin-created)
// @route   POST /api/auth/register
// @access  Admin only (or first user = auto admin)
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, company, department, employeeId, phone, designation } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Verify company exists
    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    // Auto-generate employee ID if not provided
    const autoEmployeeId = employeeId || await generateEmployeeId(company);

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
      company,
      department,
      employeeId: autoEmployeeId,
      phone,
      designation
    });

    // Generate QR code for the new employee
    try {
      const qrData = await generateQrCode(user);
      user.qrCodeId = qrData.qrCodeId;
      user.qrCodeData = qrData.qrCodeData;
      user.qrCodeGeneratedAt = qrData.qrCodeGeneratedAt;
      await user.save();
    } catch (qrErr) {
      console.error('QR generation failed (non-blocking):', qrErr.message);
    }

    // Don't return password
    user.password = undefined;

    res.status(201).json({
      success: true,
      data: user,
      message: 'User registered successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Self sign-up (public)
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res, next) => {
  try {
    const { name, email, password, employeeId, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Auto-assign default company
    const defaultCompany = await getDefaultCompany();

    // Auto-generate employee ID for self-signup
    const autoEmpId = defaultCompany ? await generateEmployeeId(defaultCompany) : undefined;

    const user = await User.create({
      name,
      email,
      password,
      role: ['doctor', 'manager', 'user'].includes(role) ? role : 'user',
      company: defaultCompany,
      employeeId: employeeId || autoEmpId
    });

    // Generate QR code for the new employee
    try {
      const qrData = await generateQrCode(user);
      user.qrCodeId = qrData.qrCodeId;
      user.qrCodeData = qrData.qrCodeData;
      user.qrCodeGeneratedAt = qrData.qrCodeGeneratedAt;
      await user.save();
    } catch (qrErr) {
      console.error('QR generation failed (non-blocking):', qrErr.message);
    }

    // Populate company for response
    await user.populate('company', 'name code');

    sendAuthResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email })
      .select('+password')
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact your administrator.'
      });
    }



    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    sendAuthResponse(res, user);
  } catch (error) {
    next(error);
  }
};



// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('company', 'name code')
      .populate('department', 'name code');

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
