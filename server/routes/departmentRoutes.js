const router = require('express').Router();
const { createDepartment, getDepartments, getDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getDepartments).post(authorize('doctor', 'manager'), createDepartment);
router.route('/:id').get(getDepartment).put(authorize('doctor', 'manager'), updateDepartment).delete(authorize('doctor', 'manager'), deleteDepartment);

module.exports = router;
