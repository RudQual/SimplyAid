const Department = require('../models/Department');
const User = require('../models/User');
const FirstAidBox = require('../models/FirstAidBox');
const { audit, diffFields } = require('../utils/notificationService');
const { ApiError, companyIdOf, isValidId, pick } = require('../utils/http');

const FIELDS = ['name', 'code', 'headOfDepartment', 'location', 'floor', 'workerCount', 'riskLevel', 'description'];

const load = async (req, id) => {
  if (!isValidId(id)) throw ApiError.notFound('Department not found');
  const dept = await Department.findOne({ _id: id, company: companyIdOf(req) });
  if (!dept) throw ApiError.notFound('Department not found');
  return dept;
};

const validateHead = async (req, data) => {
  if (data.headOfDepartment === '' || data.headOfDepartment === null) { data.headOfDepartment = null; return; }
  if (data.headOfDepartment !== undefined
    && (!isValidId(String(data.headOfDepartment)) || !(await User.exists({ _id: data.headOfDepartment, company: companyIdOf(req) })))) {
    throw ApiError.badRequest('Invalid head of department');
  }
};

// @route POST /api/departments
exports.createDepartment = async (req, res) => {
  const data = pick(req.body, FIELDS);
  await validateHead(req, data);
  const department = await Department.create({ ...data, company: companyIdOf(req) });
  audit(req, { action: 'Created department', entity: 'Department', entityId: department._id, entityLabel: department.name });
  res.status(201).json({ success: true, data: department, message: 'Department created' });
};

// @route GET /api/departments
exports.getDepartments = async (req, res) => {
  const companyId = companyIdOf(req);
  const departments = await Department.find({ company: companyId, isActive: true })
    .populate('headOfDepartment', 'name email')
    .sort('name')
    .lean();
  const [users, kits] = await Promise.all([
    User.aggregate([{ $match: { company: companyId, isActive: true } }, { $group: { _id: '$department', count: { $sum: 1 } } }]),
    FirstAidBox.aggregate([{ $match: { company: companyId, isActive: true } }, { $group: { _id: '$department', count: { $sum: 1 } } }])
  ]);
  const u = new Map(users.map((x) => [String(x._id), x.count]));
  const k = new Map(kits.map((x) => [String(x._id), x.count]));
  const data = departments.map((d) => ({ ...d, employeeCount: u.get(String(d._id)) || 0, kitCount: k.get(String(d._id)) || 0 }));
  res.json({ success: true, count: data.length, data });
};

// @route GET /api/departments/:id
exports.getDepartment = async (req, res) => {
  const department = await load(req, req.params.id);
  await department.populate('headOfDepartment', 'name email phone');
  res.json({ success: true, data: department });
};

// @route PUT /api/departments/:id
exports.updateDepartment = async (req, res) => {
  const department = await load(req, req.params.id);
  const data = pick(req.body, FIELDS);
  await validateHead(req, data);
  const before = department.toObject();
  department.set(data);
  await department.save();
  audit(req, { action: 'Updated department', entity: 'Department', entityId: department._id, entityLabel: department.name, changes: diffFields(before, department.toObject(), FIELDS) });
  res.json({ success: true, data: department, message: 'Department updated' });
};

// @route DELETE /api/departments/:id  (deactivates; blocked while it still has people or kits)
exports.deleteDepartment = async (req, res) => {
  const department = await load(req, req.params.id);
  const [people, kits] = await Promise.all([
    User.countDocuments({ department: department._id, isActive: true }),
    FirstAidBox.countDocuments({ department: department._id, isActive: true })
  ]);
  if (people || kits) {
    throw ApiError.conflict(`${department.name} still has ${people} active user(s) and ${kits} kit(s). Reassign them first.`);
  }
  department.isActive = false;
  await department.save();
  audit(req, { action: 'Deactivated department', entity: 'Department', entityId: department._id, entityLabel: department.name });
  res.json({ success: true, message: 'Department deactivated' });
};
