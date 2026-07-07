const FirstAidBox = require('../models/FirstAidBox');
const InventoryItem = require('../models/InventoryItem');

exports.createBox = async (req, res, next) => {
  try {
    req.body.company = req.user.company ? (req.user.company._id || req.user.company) : null;
    const box = await FirstAidBox.create(req.body);
    res.status(201).json({ success: true, data: box });
  } catch (error) { next(error); }
};

exports.getBoxes = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;
    const { department, status } = req.query;
    const filter = { company: companyId, isActive: true };
    if (department) filter.department = department;
    if (status) filter.status = status;
    const boxes = await FirstAidBox.find(filter)
      .populate('department', 'name code')
      .populate('inCharge', 'name email phone')
      .populate('items.item', 'name category unit')
      .sort('boxId');
    res.json({ success: true, count: boxes.length, data: boxes });
  } catch (error) { next(error); }
};

exports.getBox = async (req, res, next) => {
  try {
    const box = await FirstAidBox.findById(req.params.id)
      .populate('department', 'name code')
      .populate('inCharge', 'name email phone firstAidCertified certificationExpiry')
      .populate('items.item', 'name category unit isPrescribed')
      .populate('inspectionLogs.inspectedBy', 'name');
    if (!box) return res.status(404).json({ success: false, message: 'First aid box not found' });
    res.json({ success: true, data: box });
  } catch (error) { next(error); }
};

exports.updateBox = async (req, res, next) => {
  try {
    const box = await FirstAidBox.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!box) return res.status(404).json({ success: false, message: 'First aid box not found' });
    res.json({ success: true, data: box });
  } catch (error) { next(error); }
};

exports.inspectBox = async (req, res, next) => {
  try {
    const box = await FirstAidBox.findById(req.params.id);
    if (!box) return res.status(404).json({ success: false, message: 'First aid box not found' });
    box.inspectionLogs.push({ inspectedBy: req.user._id, status: req.body.status || 'adequate', notes: req.body.notes });
    box.lastInspectionDate = new Date();
    box.nextInspectionDue = new Date(Date.now() + box.inspectionFrequencyDays * 24 * 60 * 60 * 1000);
    box.computeStatus();
    await box.save();
    res.json({ success: true, data: box });
  } catch (error) { next(error); }
};

exports.replenishBox = async (req, res, next) => {
  try {
    const box = await FirstAidBox.findById(req.params.id);
    if (!box) return res.status(404).json({ success: false, message: 'First aid box not found' });
    const { items } = req.body; // [{ itemId, quantity }]
    if (items && items.length) {
      items.forEach(update => {
        const boxItem = box.items.find(i => i.item.toString() === update.itemId);
        if (boxItem) { boxItem.currentQty = update.quantity; boxItem.lastRestocked = new Date(); }
      });
    }
    box.computeStatus();
    await box.save();
    res.json({ success: true, data: box });
  } catch (error) { next(error); }
};

exports.updateItemStocks = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;
    const { stocks } = req.body; // Array of stock batches
    
    if (!stocks || !Array.isArray(stocks)) {
      return res.status(400).json({ success: false, message: 'Invalid stocks data provided' });
    }

    const box = await FirstAidBox.findById(id);
    if (!box) return res.status(404).json({ success: false, message: 'First aid box not found' });

    const itemIndex = box.items.findIndex(i => i.item.toString() === itemId);
    if (itemIndex === -1) return res.status(404).json({ success: false, message: 'Item not found in this box' });

    // Ensure addedAt is set for new stocks
    const updatedStocks = stocks.map(stock => ({
      ...stock,
      addedAt: stock.addedAt || new Date()
    }));

    box.items[itemIndex].stocks = updatedStocks;
    
    // Recalculate total quantity from stocks
    box.items[itemIndex].currentQty = updatedStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    box.items[itemIndex].lastRestocked = new Date();
    
    box.computeStatus();
    await box.save();
    
    const updatedBox = await FirstAidBox.findById(id)
      .populate('department', 'name code')
      .populate('inCharge', 'name email phone')
      .populate('items.item', 'name category unit');

    res.json({ success: true, data: updatedBox });
  } catch (error) { next(error); }
};

// Inventory Item types
exports.getInventoryItems = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;
    const items = await InventoryItem.find({ $or: [{ isGlobal: true }, { company: companyId }] }).sort('category name');
    res.json({ success: true, count: items.length, data: items });
  } catch (error) { next(error); }
};

exports.createInventoryItem = async (req, res, next) => {
  try {
    req.body.company = req.user.company ? (req.user.company._id || req.user.company) : null;
    const item = await InventoryItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
};

// @desc    Get simplified box + item lists for employee medication self-report
// @route   GET /api/inventory/medication-options
// @access  All authenticated users
exports.getMedicationOptions = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;

    const [boxes, items] = await Promise.all([
      FirstAidBox.find({ company: companyId, isActive: true })
        .select('boxId location floor department')
        .populate('department', 'name')
        .sort('boxId'),
      InventoryItem.find({ $or: [{ isGlobal: true }, { company: companyId }] })
        .select('name category unit')
        .sort('category name')
    ]);

    res.json({ success: true, data: { boxes, items } });
  } catch (error) { next(error); }
};
