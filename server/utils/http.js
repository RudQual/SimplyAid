const mongoose = require('mongoose');

/**
 * An error with an HTTP status code. Thrown from controllers/services and
 * converted into a JSON response by the central error handler.
 */
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    if (details) this.details = details;
  }

  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Not authorized') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg, details) { return new ApiError(409, msg, details); }
}

/** The company id of the authenticated user (works whether `company` is populated or not). */
const companyIdOf = (req) => {
  const c = req.user && req.user.company;
  if (!c) return null;
  return c._id || c;
};

/** The department id of the authenticated user, or null. */
const departmentIdOf = (req) => {
  const d = req.user && req.user.department;
  if (!d) return null;
  return d._id || d;
};

const isValidId = (id) => {
  if (id instanceof mongoose.Types.ObjectId) return true;
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
};

/** Escape user input before using it in a RegExp (prevents ReDoS / regex injection). */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" regex for search boxes. Input is truncated to 100 chars. */
const searchRegex = (value) => new RegExp(escapeRegex(String(value).trim().slice(0, 100)), 'i');

/** Read a query param as a single trimmed string (query strings can yield arrays). */
const qs = (value) => {
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
};

/** Parse page/limit query params with sane bounds. */
const parsePagination = (query, { defaultLimit = 20, maxLimit = 200 } = {}) => {
  const page = Math.max(1, parseInt(qs(query.page), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(qs(query.limit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

/** Standard paginated JSON payload. */
const paginated = (data, total, { page, limit }) => ({
  success: true,
  count: data.length,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
  currentPage: page,
  data
});

/** Parse a date query param; throws 400 when it is present but invalid. */
const parseDate = (value, name, { endOfDay = false } = {}) => {
  const s = qs(value);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`Invalid date for '${name}'`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(s)) d.setHours(23, 59, 59, 999);
  return d;
};

/** Build a `{ $gte, $lte }` range from startDate/endDate query params, or undefined. */
const dateRange = (query, startKey = 'startDate', endKey = 'endDate') => {
  const start = parseDate(query[startKey], startKey);
  const end = parseDate(query[endKey], endKey, { endOfDay: true });
  if (!start && !end) return undefined;
  const range = {};
  if (start) range.$gte = start;
  if (end) range.$lte = end;
  return range;
};

/** Copy only whitelisted keys from `source` (ignores undefined values). */
const pick = (source, keys) => {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const k of keys) {
    if (source[k] !== undefined) out[k] = source[k];
  }
  return out;
};

module.exports = {
  ApiError,
  companyIdOf,
  departmentIdOf,
  isValidId,
  escapeRegex,
  searchRegex,
  qs,
  parsePagination,
  paginated,
  parseDate,
  dateRange,
  pick
};
