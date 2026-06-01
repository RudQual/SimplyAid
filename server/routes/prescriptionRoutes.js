const router = require('express').Router();
const { createPrescription, getPrescriptions, consumePrescription } = require('../controllers/prescriptionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getPrescriptions)
  .post(authorize('admin'), createPrescription);

router.route('/:id/take')
  .put(authorize('employee'), consumePrescription);

module.exports = router;
