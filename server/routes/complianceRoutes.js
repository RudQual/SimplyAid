const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/complianceController');

const router = express.Router();
router.use(protect);
router.use(authorize('doctor', 'manager'));

router.get('/company', c.getCompanyCompliance);
router.get('/departments', c.getDepartmentCompliance);
router.post('/check', c.runComplianceCheck);

module.exports = router;
