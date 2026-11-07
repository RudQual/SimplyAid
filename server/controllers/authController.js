const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const { generateEmployeeId } = require('../utils/employeeIdGenerator');
const { generateQrCode } = require('../utils/qrService');
const { createAuditLog, audit } = require('../utils/notificationService');
const { demoLoginEnabled, selfSignupEnabled } = require('../config/env');
const { normalizeRole } = require('../config/roles');
const { ApiError } = require('../utils/http');

const PASSWORD_RULE = 'Password must be at least 8 characters and include a letter and a number';
const isStrongPassword = (pw) => typeof pw === 'string' && pw.length >= 8 && pw.length <= 128 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn: process.env.JWT_EXPIRE || '7d'
});

const sendAuthResponse = (res, user, statusCode = 200, message) => {
  const data = user.toJSON();
  data.role = normalizeRole(data.role);
  delete data.qrCodeData;
  res.status(statusCode).json({ success: true, token: signToken(user._id), data, message });
};

const attachQr = async (user) => {
  try {
    const qr = await generateQrCode(user);
    user.qrCodeId = qr.qrCodeId;
    user.qrCodeData = qr.qrCodeData;
    user.qrCodeGeneratedAt = qr.qrCodeGeneratedAt;
    await user.save();
  } catch (err) {
    // The account is still usable; the QR can be regenerated from the profile.
    console.error('QR generation failed for new user:', err.message);
  }
};

// @route GET /api/auth/config  (public) — tells the login page which options are available
exports.getAuthConfig = (req, res) => {
  res.json({ success: true, data: { demoLogin: demoLoginEnabled(), selfSignup: selfSignupEnabled(), passwordRule: PASSWORD_RULE } });
};

// @route POST /api/auth/signup  (public) — self-registration as an employee of an existing company
exports.signup = async (req, res) => {
  if (!selfSignupEnabled()) throw ApiError.forbidden('Self sign-up is disabled. Ask your administrator to create an account.');
  const { name, email, password, companyCode } = req.body;
  if (typeof name !== 'string' || !name.trim()) throw ApiError.badRequest('Name is required');
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) throw ApiError.badRequest('A valid email is required');
  if (!isStrongPassword(password)) throw ApiError.badRequest(PASSWORD_RULE);
  if (typeof companyCode !== 'string' || !companyCode.trim()) throw ApiError.badRequest('Company code is required');

  const company = await Company.findOne({ code: companyCode.trim().toUpperCase(), isActive: { $ne: false } });
  if (!company) throw ApiError.badRequest('Unknown company code');

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) throw ApiError.conflict('An account with this email already exists');

  // Self sign-up always creates an employee account; roles are assigned by administrators.
  const user = await User.create({
    name: name.trim().slice(0, 100),
    email: normalizedEmail,
    password,
    role: 'employee',
    company: company._id,
    employeeId: await generateEmployeeId(company._id)
  });
  await attachQr(user);
  await user.populate('company', 'name code');
  createAuditLog({ user: user._id, userName: user.name, userRole: 'employee', company: company._id, action: 'Signed up', entity: 'Auth', entityId: user._id, entityLabel: user.email, ipAddress: req.ip });
  sendAuthResponse(res, user, 201, 'Account created');
};

// @route POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw ApiError.badRequest('Please provide email and password');
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() })
    .select('+password')
    .populate('company', 'name code')
    .populate('department', 'name code');

  // Same message for unknown email and wrong password (no account enumeration)
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.unauthorized('Account is deactivated. Contact your administrator.');

  user.lastLoginAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: user.lastLoginAt } });
  if (user.company) {
    createAuditLog({ user: user._id, userName: user.name, userRole: normalizeRole(user.role), company: user.company._id, action: 'Signed in', entity: 'Auth', entityId: user._id, entityLabel: user.email, ipAddress: req.ip });
  }
  sendAuthResponse(res, user);
};

// @route POST /api/auth/logout — tokens are stateless; this records the event for the activity log
exports.logout = async (req, res) => {
  audit(req, { action: 'Signed out', entity: 'Auth', entityId: req.user._id, entityLabel: req.user.email });
  res.json({ success: true, message: 'Signed out' });
};

// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  const data = req.user.toJSON();
  delete data.qrCodeData;
  res.json({ success: true, data });
};

// @route PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword) throw ApiError.badRequest('Current password is required');
  if (!isStrongPassword(newPassword)) throw ApiError.badRequest(PASSWORD_RULE);
  if (currentPassword === newPassword) throw ApiError.badRequest('New password must be different from the current password');

  const user = await User.findById(req.user._id).select('+password').populate('company', 'name code').populate('department', 'name code');
  if (!(await user.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  user.password = newPassword;
  await user.save();
  audit(req, { action: 'Changed password', entity: 'Auth', entityId: user._id, entityLabel: user.email });
  // Old tokens are now invalid — return a fresh one so this session continues.
  sendAuthResponse(res, user, 200, 'Password updated');
};

// @route POST /api/auth/quick-login  (demo only — requires ENABLE_DEMO_LOGIN=true, never in production)
exports.quickLogin = async (req, res) => {
  if (!demoLoginEnabled()) throw ApiError.notFound('Not found');
  const { email } = req.body;
  if (typeof email !== 'string' || !email.trim()) throw ApiError.badRequest('Please provide an email');
  const user = await User.findOne({ email: email.trim().toLowerCase() }).populate('company', 'name code').populate('department', 'name code');
  if (!user) throw ApiError.notFound('No account found with this email');
  if (!user.isActive) throw ApiError.unauthorized('Account is deactivated');
  sendAuthResponse(res, user);
};

// @route GET /api/auth/demo-accounts  (demo only)
exports.getDemoAccounts = async (req, res) => {
  if (!demoLoginEnabled()) throw ApiError.notFound('Not found');
  const users = await User.find({ isActive: true })
    .select('name email role designation department employeeId')
    .populate('department', 'name code')
    .sort({ role: 1, name: 1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: users.map((u) => ({ ...u, role: normalizeRole(u.role) })) });
};

exports.isStrongPassword = isStrongPassword;
exports.PASSWORD_RULE = PASSWORD_RULE;
