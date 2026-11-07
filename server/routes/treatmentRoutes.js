const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/security');
const c = require('../controllers/treatmentController');

const router = express.Router();
router.use(protect);

// Stats must come before parameterized routes
router.get('/stats', authorize('doctor'), c.getTreatmentStats);

// Treatment history of one employee (the employee themself, managers and doctors)
router.get('/employee/:employeeId', c.getEmployeeTreatments);

router.route('/')
  .get(authorize('doctor'), c.getTreatments)
  .post(authorize('doctor'), validate([
    body('employee').isMongoId().withMessage('Select the employee who was treated'),
    body('injurySeverity').isIn(['minor', 'moderate', 'serious', 'critical']).withMessage('Select a severity'),
    body('treatmentProvided').isString().trim().isLength({ min: 3, max: 5000 }).withMessage('Describe the treatment provided'),
    body('medicinesUsed').optional().isArray({ max: 50 })
  ]), c.createTreatment);

router.get('/:id', authorize('doctor'), c.getTreatment);

module.exports = router;
