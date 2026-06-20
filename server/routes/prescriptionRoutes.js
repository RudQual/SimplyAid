const router = require('express').Router();
const {
  createPrescription,
  getPrescriptions,
  getPrescription,
  updatePrescription,
  getActivePrescriptions
} = require('../controllers/prescriptionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Active prescriptions for employee (smart dispenser API)
router.get('/employee/:id/active', getActivePrescriptions);

// CRUD
router.route('/')
  .get(getPrescriptions)
  .post(authorize('admin', 'safety_officer'), createPrescription);

router.route('/:id')
  .get(getPrescription)
  .put(authorize('admin', 'safety_officer'), updatePrescription);

module.exports = router;
