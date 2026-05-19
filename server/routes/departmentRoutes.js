const router = require('express').Router();
const { createDepartment, getDepartments, getDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getDepartments).post(authorize('admin'), createDepartment);
router.route('/:id').get(getDepartment).put(authorize('admin'), updateDepartment).delete(authorize('admin'), deleteDepartment);

module.exports = router;
