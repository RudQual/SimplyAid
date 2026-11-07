const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');

/**
 * Strip keys that could be interpreted as MongoDB operators ("$gt", "a.b") from
 * request bodies. Prevents NoSQL operator injection through JSON payloads.
 * (Express 5's default "simple" query parser never produces nested objects.)
 */
const stripOperators = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripOperators(v, depth + 1));
  if (value instanceof Date) return value;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
    } else {
      value[key] = stripOperators(value[key], depth + 1);
    }
  }
  return value;
};

const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') stripOperators(req.body);
  if (req.params && typeof req.params === 'object') stripOperators(req.params);
  next();
};

const isTest = () => process.env.NODE_ENV === 'test';

// Strict limit for credential endpoints (brute-force protection).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: isTest,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' }
});

// General API limit.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT) || 3000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: isTest,
  message: { success: false, message: 'Too many requests. Please slow down.' }
});

// Run express-validator chains and respond 400 with readable messages on failure.
const validate = (chains) => [
  ...chains,
  (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const errors = result.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg }));
    return res.status(400).json({ success: false, message: errors.map((e) => e.message).join(', '), errors });
  }
];

module.exports = { sanitizeBody, stripOperators, authLimiter, apiLimiter, validate };
