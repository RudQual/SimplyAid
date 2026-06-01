const router = require('express').Router();
const { createBox, getBoxes, getBox, updateBox, inspectBox, replenishBox, getInventoryItems, createInventoryItem } = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/items', getInventoryItems);
router.post('/items', authorize('admin'), createInventoryItem);
router.route('/boxes').get(getBoxes).post(authorize('admin'), createBox);
router.route('/boxes/:id').get(getBox).put(authorize('admin'), updateBox);
router.put('/boxes/:id/inspect', authorize('admin'), inspectBox);
router.put('/boxes/:id/replenish', authorize('admin'), replenishBox);

module.exports = router;
