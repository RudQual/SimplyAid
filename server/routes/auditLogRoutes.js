const router = require('express').Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// @desc    Get audit logs with filtering & pagination
// @route   GET /api/audit-logs
// @access  Admin only
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const { entity, user: userId, startDate, endDate, search, page = 1, limit = 25 } = req.query;

    const filter = { company: companyId };
    if (entity) filter.entity = entity;
    if (userId) filter.user = userId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { action: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('user', 'name role')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
