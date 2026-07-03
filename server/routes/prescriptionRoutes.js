const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');

// Prescription routes — placeholder for future implementation
router.use(protect);

// GET /api/prescriptions — list prescriptions for the logged-in user's company
router.get('/', authorize('doctor'), async (req, res) => {
  res.json({ success: true, data: [], message: 'Prescriptions endpoint — coming soon' });
});

// GET /api/prescriptions/:id — get a single prescription
router.get('/:id', authorize('doctor'), async (req, res) => {
  res.status(404).json({ success: false, message: 'Prescription not found' });
});

// POST /api/prescriptions — create a new prescription
router.post('/', authorize('doctor'), async (req, res) => {
  res.status(501).json({ success: false, message: 'Create prescription — not yet implemented' });
});

// PUT /api/prescriptions/:id — update a prescription
router.put('/:id', authorize('doctor'), async (req, res) => {
  res.status(501).json({ success: false, message: 'Update prescription — not yet implemented' });
});

// DELETE /api/prescriptions/:id — delete a prescription
router.delete('/:id', authorize('doctor'), async (req, res) => {
  res.status(501).json({ success: false, message: 'Delete prescription — not yet implemented' });
});

module.exports = router;
