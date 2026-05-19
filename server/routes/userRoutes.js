const router = require('express').Router();
const { getUsers, getUser, updateUser, deleteUser, getExpiringCertifications } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/expiring-certifications', authorize('admin', 'safety_officer'), getExpiringCertifications);
router.get('/', authorize('admin', 'safety_officer', 'department_head'), getUsers);
router.get('/:id', authorize('admin', 'safety_officer', 'department_head'), getUser);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
