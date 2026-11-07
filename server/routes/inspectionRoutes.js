const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/security');
const c = require('../controllers/inspectionController');

const router = express.Router();
router.use(protect);
router.use(authorize('doctor', 'manager'));

router.route('/')
  .get(c.getInspections)
  .post(validate([
    body('firstAidBox').isMongoId().withMessage('Select a first aid kit'),
    body('status').optional().isIn(['adequate', 'needs_replenishment', 'items_expired', 'failed']).withMessage('Invalid status'),
    body('checklist').optional().isArray({ max: 200 }),
    body('deficiencies').optional().isArray({ max: 100 }),
    body('overallNotes').optional().isString().isLength({ max: 2000 })
  ]), c.createInspection);
router.get('/:id', c.getInspection);
router.put('/:id/deficiencies/:defId/resolve', c.resolveDeficiency);

module.exports = router;
