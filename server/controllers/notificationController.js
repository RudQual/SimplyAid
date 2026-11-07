const Notification = require('../models/Notification');
const { ApiError, qs, isValidId, searchRegex, parsePagination } = require('../utils/http');

const HISTORY_DAYS = 90;
const activeWindow = () => new Date(Date.now() - HISTORY_DAYS * 86400000);

const baseFilter = (req) => ({ recipient: req.user._id });

// @route GET /api/notifications
exports.getNotifications = async (req, res) => {
  const filter = baseFilter(req);
  if (qs(req.query.archived) === 'true') {
    filter.archivedAt = { $ne: null };
  } else {
    filter.archivedAt = null;
    filter.createdAt = { $gte: activeWindow() };
  }
  if (qs(req.query.unreadOnly) === 'true') filter.isRead = false;
  const category = qs(req.query.category);
  if (category) filter.category = category;
  const severity = qs(req.query.severity) || qs(req.query.priority);
  if (severity) filter.$or = [{ severity }, { priority: severity }];
  const search = qs(req.query.search);
  if (search) {
    const rx = searchRegex(search);
    filter.$and = [{ $or: [{ title: rx }, { message: rx }] }];
  }

  const pg = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false, archivedAt: null, createdAt: { $gte: activeWindow() } })
  ]);
  res.json({
    success: true,
    count: notifications.length,
    total,
    unreadCount,
    pages: Math.max(1, Math.ceil(total / pg.limit)),
    currentPage: pg.page,
    data: notifications
  });
};

const parseIds = (ids) => {
  if (!Array.isArray(ids) || !ids.length) throw ApiError.badRequest('Please provide an array of notification IDs');
  if (ids.length > 500) throw ApiError.badRequest('Too many notifications in one request (max 500)');
  if (!ids.every((id) => isValidId(String(id)))) throw ApiError.badRequest('Invalid notification ID');
  return ids.map(String);
};

// @route DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Notification not found');
  const n = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ success: true, message: 'Notification deleted' });
};

// @route POST /api/notifications/delete-bulk  body: { ids }
exports.deleteBulkNotifications = async (req, res) => {
  const ids = parseIds(req.body.ids);
  const result = await Notification.deleteMany({ _id: { $in: ids }, recipient: req.user._id });
  res.json({ success: true, message: `${result.deletedCount} notification(s) deleted` });
};

// @route POST /api/notifications/read-bulk  body: { ids }
exports.markBulkRead = async (req, res) => {
  const ids = parseIds(req.body.ids);
  const result = await Notification.updateMany({ _id: { $in: ids }, recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
  res.json({ success: true, message: `${result.modifiedCount} notification(s) marked as read` });
};

// @route PUT /api/notifications/:id/read  (body { isRead: false } marks as unread)
exports.markAsRead = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Notification not found');
  const isRead = req.body && req.body.isRead === false ? false : true;
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    isRead ? { isRead: true, readAt: new Date() } : { isRead: false, $unset: { readAt: 1 } },
    { returnDocument: 'after' }
  );
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: n });
};

// @route PUT /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
  const result = await Notification.updateMany({ recipient: req.user._id, isRead: false, archivedAt: null }, { isRead: true, readAt: new Date() });
  res.json({ success: true, message: `${result.modifiedCount} notification(s) marked as read` });
};

// @route PUT /api/notifications/:id/archive  (body { archived: false } restores)
exports.archiveNotification = async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Notification not found');
  const restore = req.body && req.body.archived === false;
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    restore ? { archivedAt: null } : { archivedAt: new Date(), isRead: true, readAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: n, message: restore ? 'Notification restored' : 'Notification archived' });
};

// @route GET /api/notifications/stats
exports.getNotificationStats = async (req, res) => {
  const match = { recipient: req.user._id, archivedAt: null, createdAt: { $gte: activeWindow() } };
  const [byCategory, bySeverity, totalUnread] = await Promise.all([
    Notification.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } } } }
    ]),
    Notification.aggregate([
      { $match: { ...match, isRead: false } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]),
    Notification.countDocuments({ ...match, isRead: false })
  ]);
  res.json({ success: true, data: { totalUnread, byCategory, byPriority: bySeverity, bySeverity } });
};
