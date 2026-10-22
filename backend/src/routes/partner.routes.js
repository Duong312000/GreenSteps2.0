const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partner.controller');
const { authMiddleware, softAuth, checkRole } = require('../middlewares/auth.middleware');

router.post('/register', softAuth, partnerController.registerProvider);
router.get('/stats', softAuth, partnerController.getMonthlyStats);

// Admin-only endpoints
router.get('/pending', authMiddleware, checkRole(['admin']), partnerController.listPendingProviders);
router.post('/approve', authMiddleware, checkRole(['admin']), partnerController.approveProvider);

module.exports = router;
