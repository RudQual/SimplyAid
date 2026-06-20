const router = require('express').Router();
const {
  createTreatment,
  getTreatments,
  getTreatment,
  getEmployeeTreatments,
  getTreatmentStats
} = require('../controllers/treatmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Stats must come before parameterized routes
router.get('/stats', getTreatmentStats);

// Employee treatment history
router.get('/employee/:employeeId', getEmployeeTreatments);

// CRUD
router.route('/')
  .get(getTreatments)
  .post(authorize('admin', 'safety_officer', 'first_aider'), createTreatment);

router.route('/:id')
  .get(getTreatment);

module.exports = router;
