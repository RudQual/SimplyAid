const router = require('express').Router();
const { createBox, getBoxes, getBox, updateBox, inspectBox, replenishBox, getInventoryItems, createInventoryItem, getMedicationOptions } = require('../controllers/inventoryController');
const { generateBoxQr, scanBoxQr, downloadBoxQr } = require('../controllers/boxQrController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Public medication options — all authenticated users can access
router.get('/medication-options', getMedicationOptions);

router.get('/items', getInventoryItems);
router.post('/items', authorize('doctor'), createInventoryItem);

// Box QR routes (must be before :id routes)
router.get('/boxes/scan/:boxId', scanBoxQr);

router.route('/boxes').get(getBoxes).post(authorize('doctor'), createBox);
router.route('/boxes/:id').get(getBox).put(authorize('doctor'), updateBox);
router.put('/boxes/:id/inspect', authorize('doctor'), inspectBox);
router.put('/boxes/:id/replenish', authorize('doctor'), replenishBox);
router.post('/boxes/:id/generate-qr', authorize('doctor'), generateBoxQr);
router.get('/boxes/:id/download-qr', downloadBoxQr);

module.exports = router;
