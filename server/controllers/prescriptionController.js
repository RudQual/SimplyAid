const Prescription = require('../models/Prescription');
const FirstAidBox = require('../models/FirstAidBox');

exports.createPrescription = async (req, res, next) => {
  try {
    req.body.company = req.user.company ? (req.user.company._id || req.user.company) : null;
    req.body.prescribedBy = req.user._id;
    const prescription = await Prescription.create(req.body);
    res.status(201).json({ success: true, data: prescription });
  } catch (error) { next(error); }
};

exports.getPrescriptions = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;
    const filter = { company: companyId };
    
    // If worker, only show their own prescriptions
    if (req.user.role === 'employee') {
      filter.worker = req.user._id;
    }

    const prescriptions = await Prescription.find(filter)
      .populate('worker', 'name email')
      .populate('prescribedBy', 'name email')
      .populate('item', 'name category unit')
      .sort('-createdAt');
      
    res.json({ success: true, count: prescriptions.length, data: prescriptions });
  } catch (error) { next(error); }
};

exports.consumePrescription = async (req, res, next) => {
  try {
    const { firstAidBoxId, qty } = req.body;
    const amountToTake = parseInt(qty, 10);
    
    if (!amountToTake || amountToTake <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' });
    
    if (prescription.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Prescription is not active' });
    }

    // Only the assigned worker can consume it
    if (req.user.role === 'employee' && prescription.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to consume this prescription' });
    }

    if (prescription.consumedQty + amountToTake > prescription.prescribedQty) {
      return res.status(400).json({ success: false, message: 'Amount exceeds prescribed limit' });
    }

    // Find the box and deduct
    const box = await FirstAidBox.findById(firstAidBoxId);
    if (!box) return res.status(404).json({ success: false, message: 'First Aid Box not found' });

    const itemInBox = box.items.find(i => i.item.toString() === prescription.item.toString());
    if (!itemInBox || itemInBox.currentQty < amountToTake) {
      return res.status(400).json({ success: false, message: 'Not enough items in the selected First Aid Box' });
    }

    // Deduct from box
    itemInBox.currentQty -= amountToTake;
    box.computeStatus();
    await box.save();

    // Update prescription
    prescription.consumedQty += amountToTake;
    if (prescription.consumedQty === prescription.prescribedQty) {
      prescription.status = 'completed';
    }
    await prescription.save();

    res.json({ success: true, data: prescription });
  } catch (error) { next(error); }
};
