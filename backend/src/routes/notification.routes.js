const express = require('express');
const router = express.Router();
const notifController = require('../controllers/notification.controller');
const { softAuth, authMiddleware } = require('../middlewares/auth.middleware');

router.get('/user/:userId', authMiddleware, notifController.getNotifications);
router.post('/:id/read', authMiddleware, notifController.markNotificationRead);
router.delete('/:id', authMiddleware, notifController.deleteNotification);
router.post('/user/:userId/read-all', authMiddleware, notifController.markAllNotificationsRead);
router.delete('/user/:userId', authMiddleware, notifController.clearNotifications);

module.exports = router;
