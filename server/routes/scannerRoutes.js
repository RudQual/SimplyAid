const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/scannerController');

const router = express.Router();
router.use(protect);

router.route('/').get(c.getScanners).post(authorize('manager', 'doctor'), c.createScanner);
router.route('/:id').put(authorize('manager', 'doctor'), c.updateScanner).delete(authorize('manager', 'doctor'), c.deleteScanner);

module.exports = router;
