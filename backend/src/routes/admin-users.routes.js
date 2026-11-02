const express = require('express');
const controller = require('../controllers/admin-users.controller');
const { authMiddleware, checkRole } = require('../middlewares/auth.middleware');

const router = express.Router();
const adminOnly = [authMiddleware, checkRole(['admin'])];

router.get('/users/stats', ...adminOnly, controller.getStats);
router.get('/users/export', ...adminOnly, controller.exportUsers);
router.get('/users', ...adminOnly, controller.listUsers);
router.post('/users', ...adminOnly, controller.createUser);
router.get('/users/:id/activity', ...adminOnly, controller.getActivity);
router.get('/users/:id/bookings', ...adminOnly, controller.getBookings);
router.get('/users/:id/events', ...adminOnly, controller.getUserEvents);
router.get('/users/:id', ...adminOnly, controller.getUser);
router.patch('/users/:id', ...adminOnly, controller.updateUser);
router.patch('/users/:id/role', ...adminOnly, controller.changeRole);
router.post('/users/:id/suspend', ...adminOnly, controller.suspendUser);
router.post('/users/:id/unsuspend', ...adminOnly, controller.unsuspendUser);
router.post('/users/:id/deactivate', ...adminOnly, controller.deactivateUser);
router.post('/users/:id/reactivate', ...adminOnly, controller.reactivateUser);
router.get('/providers/:userId', ...adminOnly, controller.getProvider);
router.get('/providers/:userId/services', ...adminOnly, controller.getProviderServices);
router.patch('/providers/:userId', ...adminOnly, controller.updateProvider);
router.post('/providers/:userId/suspend', ...adminOnly, controller.suspendProvider);
router.post('/providers/:userId/unsuspend', ...adminOnly, controller.unsuspendProvider);

module.exports = router;
