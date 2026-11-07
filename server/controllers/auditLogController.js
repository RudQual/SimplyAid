const AuditLog = require('../models/AuditLog');
const { ApiError, companyIdOf, qs, isValidId, searchRegex, parsePagination, paginated, dateRange } = require('../utils/http');

/** Build the activity-log filter from query params (shared by list and export). */
const buildFilter = (req) => {
  const filter = { company: companyIdOf(req) };
  const entity = qs(req.query.entity);
  if (entity) filter.entity = entity;
  const userId = qs(req.query.user);
  if (userId) { if (!isValidId(userId)) throw ApiError.badRequest('Invalid user'); filter.user = userId; }
  const entityId = qs(req.query.entityId);
  if (entityId) { if (!isValidId(entityId)) throw ApiError.badRequest('Invalid record id'); filter.entityId = entityId; }
  const range = dateRange(req.query);
  if (range) filter.createdAt = range;
  const search = qs(req.query.search);
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ action: rx }, { details: rx }, { userName: rx }, { entityLabel: rx }];
  }
  return filter;
};

// @route GET /api/audit-logs  (read-only — there are no update/delete endpoints)
exports.getAuditLogs = async (req, res) => {
  const filter = buildFilter(req);
  const pg = parsePagination(req.query, { defaultLimit: 25 });
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate('user', 'name role').sort('-createdAt').skip(pg.skip).limit(pg.limit).lean(),
    AuditLog.countDocuments(filter)
  ]);
  res.json(paginated(logs, total, pg));
};

exports.buildFilter = buildFilter;
