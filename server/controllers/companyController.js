const Company = require('../models/Company');

// @desc    Create a company
// @route   POST /api/companies
// @access  Admin
exports.createCompany = async (req, res, next) => {
  try {
    const company = await Company.create(req.body);
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all companies
// @route   GET /api/companies
// @access  Admin
exports.getCompanies = async (req, res, next) => {
  try {
    const companies = await Company.find({ isActive: true }).sort('name');
    res.json({ success: true, count: companies.length, data: companies });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single company
// @route   GET /api/companies/:id
// @access  Private
exports.getCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Admin
exports.updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete company (soft)
// @route   DELETE /api/companies/:id
// @access  Admin
exports.deleteCompany = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, message: 'Company deactivated' });
  } catch (error) {
    next(error);
  }
};
