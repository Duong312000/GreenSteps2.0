const express = require('express');
const router = express.Router();
const notifController = require('../controllers/notification.controller');
const { softAuth, authMiddleware } = require('../middlewares/auth.middleware');

router.get('/user/:userId', softAuth, notifController.getNotifications);
router.post('/:id/read', authMiddleware, notifController.markNotificationRead);
router.delete('/:id', authMiddleware, notifController.deleteNotification);
router.post('/user/:userId/read-all', softAuth, notifController.markAllNotificationsRead);
router.delete('/user/:userId', softAuth, notifController.clearNotifications);

module.exports = router;
