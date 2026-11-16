const express = require('express');
const controller = require('../controllers/admin-settings.controller');
const { authMiddleware, checkRole } = require('../middlewares/auth.middleware');

const router = express.Router();
const adminOnly = [authMiddleware, checkRole(['admin'])];

router.get('/categories', ...adminOnly, controller.listCategories);
router.post('/categories', ...adminOnly, controller.createCategory);
router.patch('/categories/:id', ...adminOnly, controller.updateCategory);
router.post('/categories/:id/archive', ...adminOnly, controller.archiveCategory);
router.get('/booking', ...adminOnly, controller.getBookingSettings);
router.patch('/booking/pricing', ...adminOnly, controller.updateBookingPricing);
router.post('/booking/addons', ...adminOnly, controller.createAddon);
router.patch('/booking/addons/:id', ...adminOnly, controller.updateAddon);
router.get('/audit', ...adminOnly, controller.listAudit);

module.exports = router;
