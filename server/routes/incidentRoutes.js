const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/security');
const c = require('../controllers/incidentController');

const router = express.Router();
router.use(protect);

const createRules = [
  body('severity').isIn(['minor', 'moderate', 'serious', 'fatal']).withMessage('Select a severity'),
  body('description').isString().trim().isLength({ min: 5, max: 5000 }).withMessage('Description must be at least 5 characters'),
  body('location').optional().isString().isLength({ max: 200 }),
  body('incidentType').optional().isIn(['injury', 'illness', 'near_miss', 'dangerous_occurrence']).withMessage('Invalid incident type'),
  body('itemsUsed').optional().isArray({ max: 50 })
];

router.get('/stats/summary', c.getIncidentStats);
router.post('/sos', c.createSOSIncident);
router.route('/').get(c.getIncidents).post(validate(createRules), c.createIncident);
router.route('/:id').get(c.getIncident).put(authorize('manager', 'doctor'), c.updateIncident);
router.get('/:id/form18', authorize('manager', 'doctor'), c.generateForm18);
router.put('/:id/manager-confirm', authorize('manager'), c.managerConfirm);
router.put('/:id/doctor-review', authorize('doctor'), c.doctorReview);
router.put('/:id/manager-fill', authorize('manager'), c.managerFillIncident);

module.exports = router;
