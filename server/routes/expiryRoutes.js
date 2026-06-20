const router = require('express').Router();
const {
  getExpiryDashboard,
  getExpiringItems,
  checkAndGenerateExpiryAlerts
} = require('../controllers/expiryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', getExpiryDashboard);
router.get('/items', getExpiringItems);
router.post('/check-alerts', authorize('admin', 'safety_officer'), checkAndGenerateExpiryAlerts);

module.exports = router;
