const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeRole } = require('../config/roles');
const { companyIdOf } = require('../utils/http');

const unauthorized = (res, message) => res.status(401).json({ success: false, message });

// Protect routes — verify the JWT and load the user.
const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) return unauthorized(res, 'Not authorized — please sign in');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return unauthorized(res, error.name === 'TokenExpiredError'
      ? 'Your session has expired — please sign in again'
      : 'Not authorized — invalid token');
  }

  try {
    const user = await User.findById(decoded.id).populate('company', 'name code').populate('department', 'name code');
    if (!user) return unauthorized(res, 'User not found');
    if (!user.isActive) return unauthorized(res, 'Account is deactivated. Contact your administrator.');

    // Tokens issued before the last password change are no longer valid.
    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      return unauthorized(res, 'Your password was changed — please sign in again');
    }

    user.role = normalizeRole(user.role);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Authorize by role. Admins are always allowed.
const authorize = (...roles) => (req, res, next) => {
  const role = normalizeRole(req.user && req.user.role);
  if (role === 'admin' || roles.includes(role)) return next();
  return res.status(403).json({
    success: false,
    message: 'You do not have permission to perform this action'
  });
};

// Attach the company filter to the request.
const sameCompany = (req, res, next) => {
  req.companyId = companyIdOf(req);
  next();
};

module.exports = { protect, authorize, sameCompany };
