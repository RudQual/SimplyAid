const Company = require('../models/Company');
const { audit, diffFields } = require('../utils/notificationService');
const { ApiError, companyIdOf, isValidId, pick } = require('../utils/http');

const FIELDS = ['name', 'registrationNumber', 'factoryLicenseNumber', 'address', 'contactPerson', 'totalWorkers', 'industry'];

/**
 * Users belong to exactly one company, so these endpoints operate on the
 * caller's own company. Creating additional companies is an administrator task.
 */
const assertOwnCompany = (req, id) => {
  if (!isValidId(id) || String(id) !== String(companyIdOf(req))) throw ApiError.notFound('Company not found');
};

// @route GET /api/companies
exports.getCompanies = async (req, res) => {
  const filter = req.user.role === 'admin' ? { isActive: true } : { _id: companyIdOf(req) };
  const companies = await Company.find(filter).sort('name');
  res.json({ success: true, count: companies.length, data: companies });
};

// @route POST /api/companies  (admin)
exports.createCompany = async (req, res) => {
  const data = pick(req.body, [...FIELDS, 'code']);
  if (!data.code) throw ApiError.badRequest('Company code is required');
  const company = await Company.create(data);
  audit(req, { action: 'Created company', entity: 'Company', entityId: company._id, entityLabel: company.name });
  res.status(201).json({ success: true, data: company, message: 'Company created' });
};

// @route GET /api/companies/:id
exports.getCompany = async (req, res) => {
  assertOwnCompany(req, req.params.id);
  const company = await Company.findById(req.params.id);
  if (!company) throw ApiError.notFound('Company not found');
  res.json({ success: true, data: company });
};

// @route PUT /api/companies/:id
exports.updateCompany = async (req, res) => {
  assertOwnCompany(req, req.params.id);
  const company = await Company.findById(req.params.id);
  if (!company) throw ApiError.notFound('Company not found');
  const before = company.toObject();
  company.set(pick(req.body, FIELDS));
  await company.save();
  audit(req, { action: 'Updated company', entity: 'Company', entityId: company._id, entityLabel: company.name, changes: diffFields(before, company.toObject(), FIELDS) });
  res.json({ success: true, data: company, message: 'Company updated' });
};

// @route DELETE /api/companies/:id  (admin) — deactivating your own company is not allowed
exports.deleteCompany = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Company not found');
  if (String(req.params.id) === String(companyIdOf(req))) throw ApiError.badRequest('You cannot deactivate your own company');
  const company = await Company.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: 'after' });
  if (!company) throw ApiError.notFound('Company not found');
  audit(req, { action: 'Deactivated company', entity: 'Company', entityId: company._id, entityLabel: company.name });
  res.json({ success: true, message: 'Company deactivated' });
};
