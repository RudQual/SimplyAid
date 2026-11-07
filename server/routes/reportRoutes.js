const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/reportController');

const router = express.Router();
router.use(protect);
router.use(authorize('doctor', 'manager'));

router.get('/', c.listReports);
router.get('/accident-register', c.getAccidentRegister);
router.get('/department-summary', c.getDepartmentSummary);
router.get('/compliance-status', c.getComplianceStatus);
router.get('/:type', c.getReport);

module.exports = router;
