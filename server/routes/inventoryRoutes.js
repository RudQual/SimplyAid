const router = require('express').Router();
const { createBox, getBoxes, getBox, updateBox, inspectBox, replenishBox, getInventoryItems, createInventoryItem } = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/items', getInventoryItems);
router.post('/items', authorize('admin', 'safety_officer'), createInventoryItem);
router.route('/boxes').get(getBoxes).post(authorize('admin', 'safety_officer'), createBox);
router.route('/boxes/:id').get(getBox).put(authorize('admin', 'safety_officer'), updateBox);
router.put('/boxes/:id/inspect', authorize('admin', 'safety_officer', 'first_aider'), inspectBox);
router.put('/boxes/:id/replenish', authorize('admin', 'safety_officer'), replenishBox);

module.exports = router;
