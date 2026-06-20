const router = require('express').Router();
const { createBox, getBoxes, getBox, updateBox, inspectBox, replenishBox, getInventoryItems, createInventoryItem } = require('../controllers/inventoryController');
const { generateBoxQr, scanBoxQr, downloadBoxQr } = require('../controllers/boxQrController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/items', getInventoryItems);
router.post('/items', authorize('admin'), createInventoryItem);

// Box QR routes (must be before :id routes)
router.get('/boxes/scan/:boxId', scanBoxQr);

router.route('/boxes').get(getBoxes).post(authorize('admin'), createBox);
router.route('/boxes/:id').get(getBox).put(authorize('admin'), updateBox);
router.put('/boxes/:id/inspect', authorize('admin'), inspectBox);
router.put('/boxes/:id/replenish', authorize('admin'), replenishBox);
router.post('/boxes/:id/generate-qr', authorize('admin'), generateBoxQr);
router.get('/boxes/:id/download-qr', downloadBoxQr);

module.exports = router;

