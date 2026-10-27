const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { softAuth, authMiddleware, checkRole } = require('../middlewares/auth.middleware');

router.post('/', softAuth, bookingController.createBooking);
router.post('/checkin', softAuth, bookingController.checkInEVoucher);
router.post('/cancel', softAuth, bookingController.cancelBooking);
router.get('/', authMiddleware, bookingController.getBookings);
router.get('/pending', authMiddleware, checkRole(['admin']), bookingController.getPendingBookings);
router.get('/lookup/phone', softAuth, bookingController.lookupBookingsByPhone);
router.post('/:id/simulate-payment', softAuth, bookingController.simulateBookingPayment);
router.get('/:id', softAuth, bookingController.getBookingDetails);
router.post('/:id/approve', authMiddleware, checkRole(['admin', 'provider']), bookingController.approveBooking);
router.post('/:id/reject', authMiddleware, checkRole(['admin', 'provider']), bookingController.rejectBooking);
router.post('/:id/complete', authMiddleware, checkRole(['admin', 'provider']), bookingController.completeBooking);
router.post('/:id/status', authMiddleware, checkRole(['admin', 'provider']), bookingController.updateBookingStatuses);

module.exports = router;
