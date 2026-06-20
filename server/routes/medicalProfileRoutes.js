const router = require('express').Router();
const {
  getMedicalProfile,
  updateMedicalProfile,
  getEmergencyCard
} = require('../controllers/medicalProfileController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Emergency card (minimal data for QR scan)
router.get('/:employeeId/emergency', getEmergencyCard);

// Full medical profile
router.route('/:employeeId')
  .get(getMedicalProfile)
  .put(updateMedicalProfile);

module.exports = router;
