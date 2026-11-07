const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/security');
const c = require('../controllers/departmentController');

const router = express.Router();
router.use(protect);

const rules = (isCreate) => [
  (isCreate ? body('name').exists() : body('name').optional()).isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  (isCreate ? body('code').exists() : body('code').optional()).isString().trim().matches(/^[A-Za-z0-9_-]{1,20}$/).withMessage('Code must be 1–20 letters or numbers'),
  body('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid risk level'),
  body('workerCount').optional().isInt({ min: 0 }).withMessage('Worker count must be 0 or more'),
  body('headOfDepartment').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid head of department')
];

router.route('/').get(c.getDepartments).post(authorize('doctor'), validate(rules(true)), c.createDepartment);
router.route('/:id')
  .get(c.getDepartment)
  .put(authorize('doctor'), validate(rules(false)), c.updateDepartment)
  .delete(authorize('doctor'), c.deleteDepartment);

module.exports = router;
