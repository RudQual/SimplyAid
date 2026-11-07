const User = require('../models/User');
const Department = require('../models/Department');
const { generateEmployeeId } = require('../utils/employeeIdGenerator');
const { generateQrCode } = require('../utils/qrService');
const { audit, diffFields } = require('../utils/notificationService');
const { departmentScope, isAdmin } = require('../utils/access');
const { normalizeRole, ROLES } = require('../config/roles');
const { isStrongPassword, PASSWORD_RULE } = require('./authController');
const {
  ApiError, companyIdOf, departmentIdOf, qs, isValidId, searchRegex, parsePagination, paginated, pick
} = require('../utils/http');

const PROFILE_FIELDS = ['name', 'phone', 'department', 'designation', 'employeeId', 'factoryLocation', 'shiftTiming',
  'reportingManager', 'dateOfJoining', 'firstAidCertified', 'certificationNumber', 'certificationExpiry',
  'firstAidTrainingStatus', 'employeeStatus'];
const LIST_FIELDS = 'name email role employeeId department designation phone isActive employeeStatus firstAidCertified certificationExpiry lastLoginAt profilePhoto createdAt';

const isSelf = (req, id) => String(req.user._id) === String(id);

const loadUser = async (req, id) => {
  if (!isValidId(id)) throw ApiError.notFound('User not found');
  const user = await User.findOne({ _id: id, company: companyIdOf(req) });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

/** Can the current user modify this account at all? */
const assertCanManageUser = (req, target) => {
  if (isSelf(req, target._id)) return;
  const role = req.user.role;
  const targetRole = normalizeRole(target.role);
  if (role === 'admin') return;
  if (role === 'doctor') {
    if (targetRole === 'admin') throw ApiError.forbidden('Only administrators can modify administrator accounts');
    return;
  }
  if (role === 'manager') {
    const sameDept = target.department && departmentIdOf(req) && String(target.department._id || target.department) === String(departmentIdOf(req));
    if (targetRole === 'employee' && sameDept) return;
    throw ApiError.forbidden('Managers can only manage employees in their own department');
  }
  throw ApiError.forbidden();
};

/** Validate a role assignment. */
const assertCanAssignRole = (req, target, newRole) => {
  if (!ROLES.includes(newRole)) throw ApiError.badRequest(`Role must be one of: ${ROLES.join(', ')}`);
  if (target && isSelf(req, target._id) && normalizeRole(target.role) !== newRole) throw ApiError.forbidden('You cannot change your own role');
  if (req.user.role === 'admin') return;
  if (req.user.role === 'doctor') {
    if (newRole === 'admin') throw ApiError.forbidden('Only administrators can grant the administrator role');
    return;
  }
  if (target && normalizeRole(target.role) === newRole) return;
  throw ApiError.forbidden('Only administrators and doctors can assign roles');
};

const validateDepartment = async (req, department) => {
  if (department === undefined) return undefined;
  if (department === null || department === '') return null;
  if (!isValidId(String(department)) || !(await Department.exists({ _id: department, company: companyIdOf(req), isActive: true }))) {
    throw ApiError.badRequest('Invalid department');
  }
  return department;
};

// @route GET /api/users
exports.getUsers = async (req, res) => {
  const filter = { company: companyIdOf(req) };
  const scope = departmentScope(req);
  const department = qs(req.query.department);
  if (scope) filter.department = scope;
  else if (department) { if (!isValidId(department)) throw ApiError.badRequest('Invalid department'); filter.department = department; }
  const role = qs(req.query.role);
  if (role) filter.role = role === 'employee' ? { $in: ['employee', 'user', 'worker', 'first_aider'] } : role;
  const isActive = qs(req.query.isActive);
  if (isActive === 'true' || isActive === 'false') filter.isActive = isActive === 'true';
  else if (isActive !== 'all') filter.isActive = true;
  const certified = qs(req.query.certified);
  if (certified === 'true' || certified === 'false') filter.firstAidCertified = certified === 'true';
  const search = qs(req.query.search);
  if (search) { const rx = searchRegex(search); filter.$or = [{ name: rx }, { email: rx }, { employeeId: rx }, { designation: rx }]; }

  const query = User.find(filter).populate('department', 'name code').select(LIST_FIELDS).sort('name');
  if (!req.query.page && !req.query.limit) {
    const users = await query.lean();
    return res.json({ success: true, count: users.length, total: users.length, data: users.map((u) => ({ ...u, role: normalizeRole(u.role) })) });
  }
  const pg = parsePagination(req.query, { defaultLimit: 25 });
  const [users, total] = await Promise.all([query.skip(pg.skip).limit(pg.limit).lean(), User.countDocuments(filter)]);
  res.json(paginated(users.map((u) => ({ ...u, role: normalizeRole(u.role) })), total, pg));
};

// @route GET /api/users/:id
exports.getUser = async (req, res) => {
  const user = await loadUser(req, req.params.id);
  if (!isSelf(req, user._id) && req.user.role === 'manager') {
    const scope = departmentScope(req);
    if (scope && String(user.department) !== String(scope)) throw ApiError.forbidden('Managers can only view users in their own department');
  } else if (!isSelf(req, user._id) && req.user.role === 'employee') {
    throw ApiError.forbidden();
  }
  await user.populate('company', 'name code');
  await user.populate('department', 'name code');
  const data = user.toJSON();
  data.role = normalizeRole(data.role);
  res.json({ success: true, data });
};

// @route POST /api/users  (also POST /api/auth/register)
exports.createUser = async (req, res) => {
  const companyId = companyIdOf(req);
  const { email, password } = req.body;
  const role = req.body.role ? String(req.body.role) : 'employee';
  if (typeof req.body.name !== 'string' || !req.body.name.trim()) throw ApiError.badRequest('Name is required');
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) throw ApiError.badRequest('A valid email is required');
  if (!isStrongPassword(password)) throw ApiError.badRequest(PASSWORD_RULE);
  assertCanAssignRole(req, null, role);

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) throw ApiError.conflict('A user with this email already exists');

  const data = pick(req.body, PROFILE_FIELDS);
  data.department = await validateDepartment(req, data.department);
  if (data.employeeId) {
    data.employeeId = String(data.employeeId).trim();
    if (await User.exists({ company: companyId, employeeId: data.employeeId })) throw ApiError.conflict(`Employee ID ${data.employeeId} is already in use`);
  } else {
    data.employeeId = await generateEmployeeId(companyId);
  }

  const user = await User.create({ ...data, name: req.body.name.trim(), email: normalizedEmail, password, role, company: companyId });
  try {
    const qr = await generateQrCode(user);
    Object.assign(user, { qrCodeId: qr.qrCodeId, qrCodeData: qr.qrCodeData, qrCodeGeneratedAt: qr.qrCodeGeneratedAt });
    await user.save();
  } catch (err) {
    console.error('QR generation failed for new user:', err.message);
  }
  audit(req, { action: 'Created user', entity: 'User', entityId: user._id, entityLabel: user.email, details: `${user.name} (${role})` });
  await user.populate('department', 'name code');
  const out = user.toJSON();
  delete out.qrCodeData;
  res.status(201).json({ success: true, data: out, message: 'User created' });
};

// @route PUT /api/users/:id
exports.updateUser = async (req, res) => {
  const user = await loadUser(req, req.params.id);
  assertCanManageUser(req, user);

  const before = user.toObject();
  const data = pick(req.body, PROFILE_FIELDS);
  if (req.user.role === 'manager' && !isSelf(req, user._id)) {
    // Managers can't move employees out of their department
    delete data.department;
  }
  if (data.department !== undefined) data.department = await validateDepartment(req, data.department);
  if (data.employeeId !== undefined && data.employeeId !== user.employeeId) {
    data.employeeId = String(data.employeeId).trim() || undefined;
    if (data.employeeId && await User.exists({ _id: { $ne: user._id }, company: user.company, employeeId: data.employeeId })) {
      throw ApiError.conflict(`Employee ID ${data.employeeId} is already in use`);
    }
  }
  if (req.body.role !== undefined && normalizeRole(req.body.role) !== normalizeRole(user.role)) {
    assertCanAssignRole(req, user, String(req.body.role));
    user.role = String(req.body.role);
  }
  if (data.employeeStatus && isSelf(req, user._id) && !['active', 'on_leave'].includes(data.employeeStatus)) {
    throw ApiError.badRequest('You cannot suspend your own account');
  }
  user.set(data);
  await user.save();

  audit(req, {
    action: 'Updated user', entity: 'User', entityId: user._id, entityLabel: user.email,
    changes: diffFields(before, user.toObject(), [...PROFILE_FIELDS, 'role'])
  });
  await user.populate('department', 'name code');
  const out = user.toJSON();
  out.role = normalizeRole(out.role);
  res.json({ success: true, data: out, message: 'User updated' });
};

// @route PATCH /api/users/:id/status  body: { isActive: boolean }
exports.setUserStatus = async (req, res) => {
  const user = await loadUser(req, req.params.id);
  if (typeof req.body.isActive !== 'boolean') throw ApiError.badRequest('isActive must be true or false');
  if (isSelf(req, user._id)) throw ApiError.badRequest('You cannot deactivate your own account');
  assertCanManageUser(req, user);
  if (req.user.role === 'manager') throw ApiError.forbidden('Only administrators and doctors can activate or deactivate accounts');

  user.employeeStatus = req.body.isActive ? 'active' : 'suspended';
  user.isActive = req.body.isActive;
  await user.save();
  audit(req, { action: req.body.isActive ? 'Reactivated user' : 'Deactivated user', entity: 'User', entityId: user._id, entityLabel: user.email });
  res.json({ success: true, data: { _id: user._id, isActive: user.isActive }, message: req.body.isActive ? 'User reactivated' : 'User deactivated' });
};

// @route DELETE /api/users/:id  — deactivates (accounts are never hard-deleted, to preserve history)
exports.deleteUser = async (req, res) => {
  req.body = { isActive: false };
  return exports.setUserStatus(req, res);
};

// @route POST /api/users/:id/reset-password  body: { newPassword }
exports.resetPassword = async (req, res) => {
  const user = await loadUser(req, req.params.id);
  if (isSelf(req, user._id)) throw ApiError.badRequest('Use "Change password" to change your own password');
  assertCanManageUser(req, user);
  if (!['admin', 'doctor'].includes(req.user.role)) throw ApiError.forbidden();
  if (!isStrongPassword(req.body.newPassword)) throw ApiError.badRequest(PASSWORD_RULE);
  const withPw = await User.findById(user._id).select('+password');
  withPw.password = req.body.newPassword;
  await withPw.save();
  audit(req, { action: 'Reset user password', entity: 'User', entityId: user._id, entityLabel: user.email });
  res.json({ success: true, message: `Password reset for ${user.name}. Existing sessions were signed out.` });
};

// @route GET /api/users/expiring-certifications
exports.getExpiringCertifications = async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(qs(req.query.days), 10) || 30));
  const filter = {
    company: companyIdOf(req),
    firstAidCertified: true,
    certificationExpiry: { $lte: new Date(Date.now() + days * 86400000), $gte: new Date() },
    isActive: true
  };
  const scope = departmentScope(req);
  if (scope) filter.department = scope;
  const users = await User.find(filter).populate('department', 'name').select('name email employeeId department certificationExpiry').sort('certificationExpiry');
  res.json({ success: true, count: users.length, data: users });
};

module.exports.isAdminUser = isAdmin;
