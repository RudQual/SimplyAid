const express = require('express');
const { protect } = require('../middleware/auth');
const c = require('../controllers/notificationController');

const router = express.Router();
router.use(protect);

router.get('/stats', c.getNotificationStats);
router.post('/delete-bulk', c.deleteBulkNotifications);
router.post('/read-bulk', c.markBulkRead);
router.get('/', c.getNotifications);
router.put('/read-all', c.markAllAsRead);
router.put('/:id/read', c.markAsRead);
router.put('/:id/archive', c.archiveNotification);
router.delete('/:id', c.deleteNotification);

module.exports = router;
