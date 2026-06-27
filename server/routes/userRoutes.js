const router = require('express').Router();
const { getUsers, getUser, updateUser, deleteUser, getExpiringCertifications } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/expiring-certifications', authorize('doctor', 'manager'), getExpiringCertifications);
router.get('/', getUsers);
router.get('/:id', getUser);
router.put('/:id', authorize('doctor', 'manager'), updateUser);
router.delete('/:id', authorize('doctor', 'manager'), deleteUser);

module.exports = router;
