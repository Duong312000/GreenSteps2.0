const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const serviceRoutes = require('./service.routes');
const tourRoutes = require('./tour.routes');
const itineraryRoutes = require('./itinerary.routes');
const bookingRoutes = require('./booking.routes');
const walletRoutes = require('./wallet.routes');
const communityRoutes = require('./community.routes');
const partnerRoutes = require('./partner.routes');
const reviewRoutes = require('./review.routes');
const voucherRoutes = require('./voucher.routes');
const notificationRoutes = require('./notification.routes');
const supportRoutes = require('./support.routes');
const aiRoutes = require('./ai.routes');
const adminRoutes = require('./admin.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/tours', tourRoutes);
router.use('/itineraries', itineraryRoutes);
router.use('/bookings', bookingRoutes);
router.use('/wallet', walletRoutes);
router.use('/community', communityRoutes);
router.use('/partners', partnerRoutes);
router.use('/reviews', reviewRoutes);
router.use('/vouchers', voucherRoutes);
router.use('/notifications', notificationRoutes);
router.use('/support', supportRoutes);
router.use('/ai', aiRoutes);
router.use('/admin', adminRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'GreenSteps Travel Backend API (MongoDB + Express)',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
