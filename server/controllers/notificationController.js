const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly, category, priority, search, archived } = req.query;
    const filter = { recipient: req.user._id };

    const showArchived = archived === 'true';
    if (showArchived) {
      filter.archivedAt = { $ne: null };
    } else {
      filter.archivedAt = null;
      // Only keep 30 days history for standard active notifications
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filter.createdAt = { $gte: thirtyDaysAgo };
    }

    if (unreadOnly === 'true') filter.isRead = false;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Notification.countDocuments(filter);
    
    // Count active unread notifications
    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user._id, 
      isRead: false, 
      archivedAt: null,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const notifications = await Notification.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit));
    res.json({ success: true, count: notifications.length, total, unreadCount, pages: Math.ceil(total / parseInt(limit)), currentPage: parseInt(page), data: notifications });
  } catch (error) { next(error); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) { next(error); }
};

exports.deleteBulkNotifications = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Please provide an array of notification IDs' });
    }
    await Notification.deleteMany({ _id: { $in: ids }, recipient: req.user._id });
    res.json({ success: true, message: `${ids.length} notifications deleted successfully` });
  } catch (error) { next(error); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: notification });
  } catch (error) { next(error); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) { next(error); }
};

exports.archiveNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { archivedAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: notification, message: 'Notification archived' });
  } catch (error) { next(error); }
};

exports.getNotificationStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const stats = await Notification.aggregate([
      { $match: { recipient: userId, archivedAt: null } },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } }
        }
      }
    ]);

    const totalUnread = await Notification.countDocuments({ recipient: userId, isRead: false, archivedAt: null });

    const priorityStats = await Notification.aggregate([
      { $match: { recipient: userId, isRead: false, archivedAt: null } },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalUnread,
        byCategory: stats,
        byPriority: priorityStats
      }
    });
  } catch (error) { next(error); }
};
