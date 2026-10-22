const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { softAuth } = require('../middlewares/auth.middleware');

router.post('/', softAuth, bookingController.createBooking);
router.post('/checkin', softAuth, bookingController.checkInEVoucher);
router.post('/cancel', softAuth, bookingController.cancelBooking);
router.get('/', softAuth, bookingController.getBookings);
router.get('/pending', softAuth, bookingController.getPendingBookings);
router.get('/lookup/phone', softAuth, bookingController.lookupBookingsByPhone);
router.get('/:id', softAuth, bookingController.getBookingDetails);
router.post('/:id/approve', softAuth, bookingController.approveBooking);
router.post('/:id/reject', softAuth, bookingController.rejectBooking);
router.post('/:id/complete', softAuth, bookingController.completeBooking);
router.post('/:id/status', softAuth, bookingController.updateBookingStatuses);

module.exports = router;
