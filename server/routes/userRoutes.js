const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/security');
const users = require('../controllers/userController');

const router = express.Router();
router.use(protect);

const ROLE_VALUES = ['admin', 'doctor', 'manager', 'employee'];

const createRules = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('role').optional().isIn(ROLE_VALUES).withMessage('Invalid role'),
  body('department').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid department'),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
  body('certificationExpiry').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid certification expiry date')
];

const updateRules = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('role').optional().isIn(ROLE_VALUES).withMessage('Invalid role'),
  body('department').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid department'),
  body('certificationExpiry').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid certification expiry date'),
  body('employeeStatus').optional().isIn(['active', 'on_leave', 'suspended', 'resigned']).withMessage('Invalid employee status')
];

router.get('/expiring-certifications', authorize('doctor', 'manager'), users.getExpiringCertifications);
router.route('/')
  .get(authorize('doctor', 'manager'), users.getUsers)
  .post(authorize('doctor'), validate(createRules), users.createUser);
router.route('/:id')
  .get(users.getUser)
  .put(authorize('doctor', 'manager'), validate(updateRules), users.updateUser)
  .delete(authorize('doctor'), users.deleteUser);
router.patch('/:id/status', authorize('doctor'), users.setUserStatus);
router.post('/:id/reset-password', authorize('doctor'), users.resetPassword);

module.exports = router;
