const router = require('express').Router();
const {
  createInspection,
  getInspections,
  getInspection
} = require('../controllers/inspectionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getInspections)
  .post(authorize('doctor'), createInspection);

router.route('/:id')
  .get(getInspection);

module.exports = router;
