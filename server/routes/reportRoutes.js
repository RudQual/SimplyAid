const router = require('express').Router();
const { getAccidentRegister, getDepartmentSummary, getComplianceStatus } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('doctor', 'manager'));
router.get('/accident-register', getAccidentRegister);
router.get('/department-summary', getDepartmentSummary);
router.get('/compliance-status', getComplianceStatus);

module.exports = router;
