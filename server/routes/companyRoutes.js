const router = require('express').Router();
const { createCompany, getCompanies, getCompany, updateCompany, deleteCompany } = require('../controllers/companyController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(authorize('doctor', 'manager'), getCompanies).post(authorize('doctor', 'manager'), createCompany);
router.route('/:id').get(getCompany).put(authorize('doctor', 'manager'), updateCompany).delete(authorize('doctor', 'manager'), deleteCompany);

module.exports = router;
