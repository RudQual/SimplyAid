const router = require('express').Router();
const {
  getCompanyCompliance,
  getDepartmentCompliance,
  runComplianceCheck
} = require('../controllers/complianceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/company', getCompanyCompliance);
router.get('/departments', getDepartmentCompliance);
router.post('/check', authorize('admin', 'safety_officer'), runComplianceCheck);

module.exports = router;
