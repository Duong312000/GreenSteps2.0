const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partner.controller');
const analyticsService = require('../services/analytics.service');
const { authMiddleware, checkRole } = require('../middlewares/auth.middleware');

router.post('/register', authMiddleware, partnerController.registerProvider);
router.get('/stats', authMiddleware, checkRole(['provider', 'admin']), partnerController.getMonthlyStats);
router.get('/analytics', authMiddleware, checkRole(['provider', 'admin']), async (req, res, next) => {
  try {
    const report = await analyticsService.getProviderAnalytics({
      requestUser: req.user,
      queryProviderId: req.query.providerId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });
    res.json({ success: true, ...report });
  } catch (error) { next(error); }
});

// Admin-only endpoints
router.get('/pending', authMiddleware, checkRole(['admin']), partnerController.listPendingProviders);
router.post('/approve', authMiddleware, checkRole(['admin']), partnerController.approveProvider);

module.exports = router;
