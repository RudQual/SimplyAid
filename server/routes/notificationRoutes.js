const router = require('express').Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  getNotificationStats
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getNotificationStats);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.put('/:id/archive', archiveNotification);

module.exports = router;
