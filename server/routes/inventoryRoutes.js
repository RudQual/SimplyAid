const router = require('express').Router();
const { createBox, getBoxes, getBox, updateBox, inspectBox, replenishBox, getInventoryItems, createInventoryItem } = require('../controllers/inventoryController');
const { generateBoxQr, scanBoxQr, downloadBoxQr } = require('../controllers/boxQrController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/items', getInventoryItems);
router.post('/items', authorize('admin', 'safety_officer'), createInventoryItem);

// Box QR routes (must be before :id routes)
router.get('/boxes/scan/:boxId', scanBoxQr);

router.route('/boxes').get(getBoxes).post(authorize('admin', 'safety_officer'), createBox);
router.route('/boxes/:id').get(getBox).put(authorize('admin', 'safety_officer'), updateBox);
router.put('/boxes/:id/inspect', authorize('admin', 'safety_officer', 'first_aider'), inspectBox);
router.put('/boxes/:id/replenish', authorize('admin', 'safety_officer'), replenishBox);
router.post('/boxes/:id/generate-qr', authorize('admin', 'safety_officer'), generateBoxQr);
router.get('/boxes/:id/download-qr', downloadBoxQr);

module.exports = router;

