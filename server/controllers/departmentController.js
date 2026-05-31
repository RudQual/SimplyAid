const Department = require('../models/Department');

// @desc    Create department
// @route   POST /api/departments
// @access  Admin
exports.createDepartment = async (req, res, next) => {
  try {
    // Scope to user's company
    req.body.company = req.body.company || (req.user.company ? (req.user.company._id || req.user.company) : null);
    const department = await Department.create(req.body);
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all departments (company-scoped)
// @route   GET /api/departments
// @access  Private
exports.getDepartments = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;
    const departments = await Department.find({ company: companyId, isActive: true })
      .populate('headOfDepartment', 'name email')
      .sort('name');
    res.json({ success: true, count: departments.length, data: departments });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single department
// @route   GET /api/departments/:id
// @access  Private
exports.getDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('headOfDepartment', 'name email phone');
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Admin
exports.updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, data: department });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete department (soft)
// @route   DELETE /api/departments/:id
// @access  Admin
exports.deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, message: 'Department deactivated' });
  } catch (error) {
    next(error);
  }
};
