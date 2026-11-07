const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const auth = require('../controllers/authController');
const { createUser } = require('../controllers/userController');

const router = express.Router();

router.get('/config', auth.getAuthConfig);
router.post('/signup', authLimiter, auth.signup);
router.post('/login', authLimiter, auth.login);
router.post('/quick-login', authLimiter, auth.quickLogin);
router.get('/demo-accounts', auth.getDemoAccounts);
router.get('/me', protect, auth.getMe);
router.post('/logout', protect, auth.logout);
router.put('/change-password', protect, authLimiter, auth.changePassword);
// Account creation by an administrator/doctor (this endpoint used to be public)
router.post('/register', protect, authorize('doctor'), createUser);

module.exports = router;
