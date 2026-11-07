const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/companyController');

const router = express.Router();
router.use(protect);

router.route('/').get(c.getCompanies).post(authorize('admin'), c.createCompany);
router.route('/:id').get(c.getCompany).put(authorize('doctor'), c.updateCompany).delete(authorize('admin'), c.deleteCompany);

module.exports = router;
