const router = require('express').Router();
const { createBox, getBoxes, getBox, updateBox, inspectBox, replenishBox, getInventoryItems, createInventoryItem, getMedicationOptions } = require('../controllers/inventoryController');
const { generateBoxQr, scanBoxQr, downloadBoxQr } = require('../controllers/boxQrController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Public medication options — all authenticated users can access
router.get('/medication-options', getMedicationOptions);

router.get('/items', getInventoryItems);
router.post('/items', authorize('doctor', 'manager'), createInventoryItem);

// Box QR routes (must be before :id routes)
router.get('/boxes/scan/:boxId', scanBoxQr);

router.route('/boxes').get(getBoxes).post(authorize('doctor', 'manager'), createBox);
router.route('/boxes/:id').get(getBox).put(authorize('doctor', 'manager'), updateBox);
router.put('/boxes/:id/inspect', authorize('doctor', 'manager'), inspectBox);
router.put('/boxes/:id/replenish', authorize('doctor', 'manager'), replenishBox);
router.put('/boxes/:id/items/:itemId/stocks', authorize('doctor', 'manager'), require('../controllers/inventoryController').updateItemStocks);
router.post('/boxes/:id/generate-qr', authorize('doctor', 'manager'), generateBoxQr);
router.get('/boxes/:id/download-qr', downloadBoxQr);

module.exports = router;
