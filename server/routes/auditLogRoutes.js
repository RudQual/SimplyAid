const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getAuditLogs } = require('../controllers/auditLogController');

const router = express.Router();
router.use(protect);

// Read-only: activity log entries cannot be created, changed or deleted through the API.
router.get('/', authorize('doctor'), getAuditLogs);

module.exports = router;
