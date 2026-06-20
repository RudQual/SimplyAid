const router = require('express').Router();
const {
  getInjuryAnalytics,
  getTreatmentAnalytics,
  getInventoryAnalytics,
  getComplianceAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/injuries', getInjuryAnalytics);
router.get('/treatments', getTreatmentAnalytics);
router.get('/inventory', getInventoryAnalytics);
router.get('/compliance', getComplianceAnalytics);

module.exports = router;
