const router = require('express').Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  getNotificationStats,
  deleteNotification,
  deleteBulkNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getNotificationStats);
router.post('/delete-bulk', deleteBulkNotifications);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.put('/:id/archive', archiveNotification);
router.delete('/:id', deleteNotification);

module.exports = router;
