const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/expiryController');

const router = express.Router();
router.use(protect);
router.use(authorize('doctor', 'manager'));

router.get('/dashboard', c.getExpiryDashboard);
router.get('/items', c.getExpiringItems);
router.post('/check-alerts', c.checkAndGenerateExpiryAlerts);

module.exports = router;
