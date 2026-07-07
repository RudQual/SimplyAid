const router = require('express').Router();
const {
  getScanners,
  createScanner,
  updateScanner,
  deleteScanner
} = require('../controllers/scannerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getScanners)
  .post(authorize('manager', 'doctor'), createScanner);

router.route('/:id')
  .put(authorize('manager', 'doctor'), updateScanner)
  .delete(authorize('manager', 'doctor'), deleteScanner);

module.exports = router;
