const router = require('express').Router();
const {
  getEmployeeProfile,
  getEmployeeByQr,
  regenerateEmployeeQr,
  downloadQr,
  uploadPhoto,
  getEmployeeCard,
  getScanHistory,
  getEmployeeScanHistory,
  updateEmployeeProfile,
  getMyProfile,
  updateMyProfile,
  validateQrScan
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Scan history (must come before parameterized routes)
router.get('/scan-history', getScanHistory);
router.get('/scan-history/:employeeId', getEmployeeScanHistory);

// QR scan endpoint (by employeeId string like EMP-2026-0001)
router.get('/qr/:employeeId', getEmployeeByQr);

// QR operations (by user _id)
router.post('/qr/:id/regenerate', regenerateEmployeeQr);
router.get('/qr/:id/download', downloadQr);

// Profile operations (my profile must come before /profile/:id)
router.get('/my-profile', getMyProfile);
router.put('/my-profile', updateMyProfile);

// QR Validation
router.post('/qr/validate', validateQrScan);

// Profile & card
router.get('/profile/:id', getEmployeeProfile);
router.put('/profile/:id', updateEmployeeProfile);
router.get('/card/:id', getEmployeeCard);

// Photo upload
router.put('/:id/photo', uploadPhoto);

module.exports = router;
