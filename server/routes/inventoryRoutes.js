const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { INVENTORY_CATEGORIES } = require('../config/constants');
const inv = require('../controllers/inventoryController');
const qr = require('../controllers/boxQrController');
const { recordInspection } = require('../controllers/inspectionController');

const router = express.Router();
router.use(protect);

const MANAGE = ['doctor', 'manager'];
const int0 = (field, label) => body(field).optional().isInt({ min: 0, max: 100000 }).withMessage(`${label} must be a whole number of 0 or more`);

const itemRules = (isCreate) => [
  (isCreate ? body('name').exists() : body('name').optional()).isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2–120 characters'),
  (isCreate ? body('category').exists() : body('category').optional()).isIn(INVENTORY_CATEGORIES).withMessage('Invalid category'),
  (isCreate ? body('unit').exists() : body('unit').optional()).isString().trim().isLength({ min: 1, max: 30 }).withMessage('Unit is required'),
  body('description').optional().isString().isLength({ max: 1000 }),
  int0('requiredQty.classA', 'Class A quantity'), int0('requiredQty.classB', 'Class B quantity'), int0('requiredQty.classC', 'Class C quantity'),
  body('isMandatory').optional().isBoolean(),
  body('requiresExpiryTracking').optional().isBoolean(),
  int0('defaultShelfLifeDays', 'Shelf life')
];

const boxRules = (isCreate) => [
  ...(isCreate ? [body('boxId').isString().trim().matches(/^[A-Za-z0-9_-]{2,40}$/).withMessage('Kit ID must be 2–40 letters, numbers, - or _')] : []),
  (isCreate ? body('location').exists() : body('location').optional()).isString().trim().isLength({ min: 2, max: 200 }).withMessage('Location is required'),
  (isCreate ? body('department').exists() : body('department').optional()).isMongoId().withMessage('Department is required'),
  body('classType').optional().isIn(['A', 'B', 'C']).withMessage('Class must be A, B or C'),
  body('inspectionFrequencyDays').optional().isInt({ min: 1, max: 365 }).withMessage('Inspection frequency must be 1–365 days'),
  body('inCharge').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid person in charge'),
  body('riskCategory').optional().isIn(['low', 'medium', 'high', 'critical'])
];

const qty = (min) => body('quantity').isInt({ min, max: 100000 }).withMessage(`Quantity must be a whole number of at least ${min}`);

// Catalog
router.get('/medication-options', inv.getMedicationOptions);
router.get('/summary', inv.getInventorySummary);
router.get('/transactions', authorize(...MANAGE), inv.getTransactions);
router.route('/items')
  .get(inv.getInventoryItems)
  .post(authorize(...MANAGE), validate(itemRules(true)), inv.createInventoryItem);
router.route('/items/:id')
  .get(inv.getInventoryItem)
  .put(authorize(...MANAGE), validate(itemRules(false)), inv.updateInventoryItem)
  .delete(authorize('doctor'), inv.deleteInventoryItem);

// Kits (first aid boxes)
router.get('/boxes/scan/:boxId', qr.scanBoxQr);
router.route('/boxes')
  .get(inv.getBoxes)
  .post(authorize(...MANAGE), validate(boxRules(true)), inv.createBox);
router.route('/boxes/:id')
  .get(inv.getBox)
  .put(authorize(...MANAGE), validate(boxRules(false)), inv.updateBox)
  .delete(authorize('doctor'), inv.deleteBox);
router.post('/boxes/:id/generate-qr', authorize(...MANAGE), qr.generateBoxQr);
router.get('/boxes/:id/download-qr', qr.downloadBoxQr);

// Quick inspection (records a full inspection)
router.put('/boxes/:id/inspect', authorize(...MANAGE),
  validate([
    body('status').optional().isIn(['adequate', 'needs_replenishment', 'items_expired', 'failed']).withMessage('Invalid status'),
    body('notes').optional().isString().isLength({ max: 2000 })
  ]),
  async (req, res) => {
    await recordInspection(req, { boxId: req.params.id, status: req.body.status, overallNotes: req.body.notes });
    const box = await inv.findKit(req, req.params.id);
    res.json({ success: true, data: inv.presentBox(box, { detailed: true }), message: 'Inspection recorded' });
  });

// Kit contents & stock
router.put('/boxes/:id/replenish', authorize(...MANAGE), validate([body('items').isArray({ min: 1, max: 100 }).withMessage('Provide at least one item')]), inv.replenishBox);
router.post('/boxes/:id/remove-expired', authorize(...MANAGE), inv.removeExpired);
router.post('/boxes/:id/items', authorize(...MANAGE),
  validate([body('itemId').isMongoId().withMessage('Select an item'), int0('requiredQty', 'Required quantity')]), inv.addBoxItem);
router.route('/boxes/:id/items/:itemId')
  .put(authorize(...MANAGE), validate([body('requiredQty').isInt({ min: 0, max: 100000 }).withMessage('Required quantity must be 0 or more')]), inv.updateBoxItem)
  .delete(authorize(...MANAGE), inv.removeBoxItem);
router.post('/boxes/:id/items/:itemId/restock', authorize(...MANAGE),
  validate([
    qty(1),
    body('expiryDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid expiry date'),
    body('batchNumber').optional().isString().isLength({ max: 60 })
  ]),
  inv.restockItem);
router.post('/boxes/:id/items/:itemId/dispense', authorize(...MANAGE),
  validate([qty(1), body('reason').optional().isString().isLength({ max: 500 })]), inv.dispenseItem);
router.post('/boxes/:id/items/:itemId/adjust', authorize(...MANAGE),
  validate([
    body('stockId').isMongoId().withMessage('Select a batch'),
    qty(0),
    body('reason').isString().trim().isLength({ min: 3, max: 500 }).withMessage('A reason is required for adjustments')
  ]),
  inv.adjustItem);
router.post('/boxes/:id/items/:itemId/remove-expired', authorize(...MANAGE), inv.removeExpired);
router.put('/boxes/:id/items/:itemId/stocks', authorize(...MANAGE),
  validate([body('stocks').isArray({ max: 100 }).withMessage('stocks must be a list')]), inv.updateItemStocks);

module.exports = router;
