const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const bookingRoutes = require('./booking.routes');
const walletRoutes = require('./wallet.routes');
const aiRoutes = require('./ai.routes');
const voucherRoutes = require('./voucher.routes');
const partnerRoutes = require('./partner.routes');
const tourRoutes = require('./tour.routes');
const itineraryRoutes = require('./itinerary.routes');
const serviceRoutes = require('./service.routes');
const communityRoutes = require('./community.routes');
const reviewsRoutes = require('./reviews.routes');
const recommendationRoutes = require('./recommendation.routes');
const notificationRoutes = require('./notification.routes');
const spotRoutes = require('./spot.routes');
const changeRequestRoutes = require('./change-request.routes');
const operationsRoutes = require('./operations.routes');

router.use('/auth', authRoutes);
router.use('/bookings', bookingRoutes);
router.use('/wallet', walletRoutes);
router.use('/ai', aiRoutes);
router.use('/vouchers', voucherRoutes);
router.use('/partner', partnerRoutes);
router.use('/tours', tourRoutes);
router.use('/itineraries', itineraryRoutes);
router.use('/services', serviceRoutes);
router.use('/community', communityRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/spots', spotRoutes);
router.use('/change-requests', changeRequestRoutes);
router.use('/operations', operationsRoutes);

module.exports = router;
