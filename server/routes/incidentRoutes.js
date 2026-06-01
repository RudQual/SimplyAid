const router = require('express').Router();
const { createIncident, getIncidents, getIncident, updateIncident, getIncidentStats } = require('../controllers/incidentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats/summary', getIncidentStats);
router.route('/').get(getIncidents).post(createIncident);
router.route('/:id').get(getIncident).put(authorize('admin'), updateIncident);

module.exports = router;
