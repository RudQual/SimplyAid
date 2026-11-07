const Scanner = require('../models/Scanner');
const Department = require('../models/Department');
const { audit } = require('../utils/notificationService');
const { ApiError, companyIdOf, isValidId, pick } = require('../utils/http');

const FIELDS = ['scannerId', 'name', 'department', 'location', 'floor'];

const validateDept = async (req, data) => {
  if (data.department !== undefined
    && (!isValidId(String(data.department)) || !(await Department.exists({ _id: data.department, company: companyIdOf(req) })))) {
    throw ApiError.badRequest('Invalid department');
  }
};

// @route GET /api/scanners
exports.getScanners = async (req, res) => {
  const scanners = await Scanner.find({ company: companyIdOf(req), isActive: true })
    .populate('department', 'name code')
    .sort('department name');
  res.json({ success: true, count: scanners.length, data: scanners });
};

// @route POST /api/scanners
exports.createScanner = async (req, res) => {
  const data = pick(req.body, FIELDS);
  await validateDept(req, data);
  const scanner = await Scanner.create({ ...data, company: companyIdOf(req) });
  await scanner.populate('department', 'name code');
  audit(req, { action: 'Created scanner', entity: 'Scanner', entityId: scanner._id, entityLabel: scanner.name });
  res.status(201).json({ success: true, data: scanner, message: 'Scanner created' });
};

// @route PUT /api/scanners/:id
exports.updateScanner = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Scanner not found');
  const data = pick(req.body, FIELDS);
  await validateDept(req, data);
  const scanner = await Scanner.findOne({ _id: req.params.id, company: companyIdOf(req), isActive: true });
  if (!scanner) throw ApiError.notFound('Scanner not found');
  scanner.set(data);
  await scanner.save();
  await scanner.populate('department', 'name code');
  audit(req, { action: 'Updated scanner', entity: 'Scanner', entityId: scanner._id, entityLabel: scanner.name });
  res.json({ success: true, data: scanner, message: 'Scanner updated' });
};

// @route DELETE /api/scanners/:id  (deactivates)
exports.deleteScanner = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Scanner not found');
  const scanner = await Scanner.findOneAndUpdate({ _id: req.params.id, company: companyIdOf(req) }, { isActive: false }, { returnDocument: 'after' });
  if (!scanner) throw ApiError.notFound('Scanner not found');
  audit(req, { action: 'Deactivated scanner', entity: 'Scanner', entityId: scanner._id, entityLabel: scanner.name });
  res.json({ success: true, message: 'Scanner deactivated' });
};
