const Scanner = require('../models/Scanner');

// @desc    Get all scanners (company-scoped)
// @route   GET /api/scanners
// @access  Protected
exports.getScanners = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;
    const scanners = await Scanner.find({ company: companyId, isActive: true })
      .populate('department', 'name code')
      .sort('department name');
    res.json({ success: true, count: scanners.length, data: scanners });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a scanner
// @route   POST /api/scanners
// @access  Protected (manager, doctor)
exports.createScanner = async (req, res, next) => {
  try {
    req.body.company = req.body.company || (req.user.company ? (req.user.company._id || req.user.company) : null);
    const scanner = await Scanner.create(req.body);
    const populated = await Scanner.findById(scanner._id).populate('department', 'name code');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a scanner
// @route   PUT /api/scanners/:id
// @access  Protected (manager, doctor)
exports.updateScanner = async (req, res, next) => {
  try {
    const scanner = await Scanner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('department', 'name code');
    if (!scanner) return res.status(404).json({ success: false, message: 'Scanner not found' });
    res.json({ success: true, data: scanner });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a scanner (soft)
// @route   DELETE /api/scanners/:id
// @access  Protected (manager, doctor)
exports.deleteScanner = async (req, res, next) => {
  try {
    const scanner = await Scanner.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!scanner) return res.status(404).json({ success: false, message: 'Scanner not found' });
    res.json({ success: true, message: 'Scanner deactivated' });
  } catch (error) {
    next(error);
  }
};
