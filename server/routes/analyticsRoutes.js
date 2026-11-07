const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/analyticsController');

const router = express.Router();
router.use(protect);
router.use(authorize('doctor', 'manager'));

router.get('/injuries', c.getInjuryAnalytics);
router.get('/treatments', authorize('doctor'), c.getTreatmentAnalytics);
router.get('/inventory', c.getInventoryAnalytics);
router.get('/compliance', c.getComplianceAnalytics);

module.exports = router;
