const User = require('../models/User');

// @desc    Get all users (company-scoped)
// @route   GET /api/users
// @access  Admin, Safety Officer
exports.getUsers = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const { department, role, isActive, search } = req.query;

    const filter = { company: companyId };
    
    // Managers can only see employees in their own department
    if (req.user.role === 'manager' && req.user.department) {
      filter.department = req.user.department._id || req.user.department;
    } else if (department) {
      filter.department = department;
    }
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .populate('department', 'name code')
      .select('-password')
      .sort('name');

    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Admin, Safety Officer
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('company', 'name code')
      .populate('department', 'name code');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Admin
exports.updateUser = async (req, res, next) => {
  try {
    // Don't allow password update through this route
    delete req.body.password;

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate user
// @route   DELETE /api/users/:id
// @access  Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users with expiring certifications
// @route   GET /api/users/expiring-certifications
// @access  Admin, Safety Officer
exports.getExpiringCertifications = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const daysAhead = parseInt(req.query.days) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const users = await User.find({
      company: companyId,
      firstAidCertified: true,
      certificationExpiry: { $lte: futureDate, $gte: new Date() },
      isActive: true
    })
      .populate('department', 'name')
      .select('name email employeeId department certificationExpiry')
      .sort('certificationExpiry');

    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};
