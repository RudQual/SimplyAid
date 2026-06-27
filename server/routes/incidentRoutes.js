const router = require('express').Router();
const { createIncident, getIncidents, getIncident, updateIncident, getIncidentStats, managerConfirm, doctorReview } = require('../controllers/incidentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats/summary', getIncidentStats);
router.route('/').get(getIncidents).post(createIncident);
router.route('/:id').get(getIncident).put(authorize('manager', 'doctor'), updateIncident);
router.put('/:id/manager-confirm', authorize('manager'), managerConfirm);
router.put('/:id/doctor-review', authorize('doctor'), doctorReview);

module.exports = router;
