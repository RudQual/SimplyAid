const User = require('../models/User');
const Prescription = require('../models/Prescription');
const FirstAidBox = require('../models/FirstAidBox');

// @desc    Vending Machine Kiosk Login
// @route   POST /api/vending/login
// @access  Public (Kiosk mode)
exports.vendingLogin = async (req, res, next) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    const user = await User.findOne({ employeeId, isActive: true })
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found or inactive' });
    }

    // Get active prescriptions for this user
    const prescriptions = await Prescription.find({ worker: user._id, status: 'active' })
      .populate('item', 'name category unit image')
      .populate('prescribedBy', 'name');

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          employeeId: user.employeeId,
          department: user.department?.name
        },
        prescriptions
      }
    });
  } catch (error) { next(error); }
};

// @desc    Vending Machine Dispense
// @route   POST /api/vending/dispense
// @access  Public (Kiosk mode)
exports.vendingDispense = async (req, res, next) => {
  try {
    const { employeeId, prescriptionId, qty } = req.body;
    const amountToTake = parseInt(qty, 10);

    if (!amountToTake || amountToTake <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    const user = await User.findOne({ employeeId, isActive: true });
    if (!user) return res.status(404).json({ success: false, message: 'Employee not found' });

    const prescription = await Prescription.findById(prescriptionId).populate('item');
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' });
    
    if (prescription.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Prescription is not active' });
    }

    if (prescription.worker.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Prescription does not belong to this employee' });
    }

    if (prescription.consumedQty + amountToTake > prescription.prescribedQty) {
      return res.status(400).json({ success: false, message: 'Amount exceeds prescribed limit' });
    }

    // For the vending machine, we simulate deducting from a global box or a specific vending machine box.
    // Let's find any active First Aid Box for the company that has the item in stock.
    // In a real scenario, the vending machine would have a specific box ID.
    const box = await FirstAidBox.findOne({
      company: user.company,
      isActive: true,
      'items.item': prescription.item._id,
      'items.currentQty': { $gte: amountToTake }
    });

    if (!box) {
      return res.status(400).json({ success: false, message: 'Vending Machine out of stock for this item' });
    }

    // Deduct from box
    const itemInBox = box.items.find(i => i.item.toString() === prescription.item._id.toString());
    itemInBox.currentQty -= amountToTake;
    box.computeStatus();
    await box.save();

    // Update prescription
    prescription.consumedQty += amountToTake;
    if (prescription.consumedQty === prescription.prescribedQty) {
      prescription.status = 'completed';
    }
    await prescription.save();

    res.json({ success: true, message: 'Item dispensed successfully', data: prescription });
  } catch (error) { next(error); }
};
