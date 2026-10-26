const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { Booking, User, WalletTransaction, Notification } = require('../models');

const publicBooking = (booking) => ({
  id: booking._id,
  _id: booking._id,
  booking_code: booking.evoucher_code,
  evoucher_code: booking.evoucher_code,
  booking_date: booking.booking_date,
  customer_fullname: booking.customer.fullname,
  customer_email: booking.customer.email,
  customer_phone: booking.customer.phone,
  guests: booking.guests,
  value: booking.value,
  status: booking.booking_status,
  payment: booking.payment,
  escrow: booking.escrow
});

const requireAdmin = (req, res, next) => {
  const roles = req.session?.user?.roles || [];
  const isAdmin = roles.includes('admin') || req.session?.user?.role === 'admin';
  if (isAdmin || process.env.NODE_ENV !== 'production') return next();
  return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt đơn thanh toán.' });
};

async function expireIfNeeded(booking) {
  if (booking.payment.status === 'pending' && booking.payment.expires_at && booking.payment.expires_at <= new Date()) {
    booking.payment.status = 'failed';
    booking.booking_status = 'cancelled';
    booking.escrow.status = 'none';
    await booking.save();
  }
  return booking;
}

// Create a booking. Bank transfers remain pending until the bank webhook or an admin confirms receipt.
router.post('/', async (req, res) => {
  let debitedUserId = null;
  let walletTransactionCode = null;
  try {
    const body = req.body || {};
    const userId = body.user_id || body.userId || body.customerId || null;
    const targetId = body.target_id || body.targetId || body.service_id || body.serviceId || body.tour_id || body.tourId;
    const customer = body.customer || {};
    const fullname = customer.fullname || body.customerName || [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    const email = customer.email || body.customerEmail || '';
    const phone = customer.phone || body.customerPhone || '';
    const value = Number(body.value ?? body.amount ?? body.depositAmount);
    const requestedMethod = body.payment_method || body.paymentMethod || 'wallet';
    const method = requestedMethod === 'bank' ? 'bank_transfer' : requestedMethod;
    const kind = (body.kind || body.type) === 'service' ? 'service' : 'tour';
    const guests = Math.max(1, Math.floor(Number(body.guests || 1)));

    if (!targetId || !fullname || !email || !phone || !Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đặt chỗ hoặc số tiền thanh toán không hợp lệ.' });
    }
    if (!['wallet', 'bank_transfer', 'counter', 'card'].includes(method)) {
      return res.status(400).json({ success: false, message: 'Phương thức thanh toán này hiện chưa được hỗ trợ.' });
    }
    if (method === 'card' && (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MODE === 'live')) {
      return res.status(503).json({ success: false, message: 'Cổng thanh toán thẻ thật chưa được cấu hình.' });
    }
    if (userId && !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: 'Mã tài khoản không hợp lệ.' });
    }

    const evoucherCode = `GS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const isPaid = method === 'wallet';
    let user = null;

    if (isPaid) {
      if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thanh toán bằng ví.' });
      user = await User.findOneAndUpdate(
        { _id: userId, 'wallet.balance': { $gte: value }, 'wallet.registered': true },
        { $inc: { 'wallet.balance': -value, 'wallet.green_points': Math.floor(value / 10000) } },
        { new: true }
      );
      if (!user) return res.status(400).json({ success: false, message: 'Ví chưa kích hoạt hoặc số dư không đủ.' });
      debitedUserId = user._id;
      walletTransactionCode = `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await WalletTransaction.create({
        transaction_code: walletTransactionCode,
        user_id: user._id,
        type: 'payment',
        amount: value,
        description: `Thanh toán đặt chỗ ${evoucherCode}`,
        status: 'success',
        reference_id: evoucherCode
      });
    }

    const expiresAt = ['bank_transfer', 'card'].includes(method) ? new Date(Date.now() + 10 * 60 * 1000) : undefined;
    const booking = await Booking.create({
      evoucher_code: evoucherCode,
      user_id: userId,
      kind,
      target_id: targetId,
      customer: { fullname, email, phone },
      booking_date: body.booking_date || body.bookingDate || new Date().toISOString().slice(0, 10),
      check_out_date: body.check_out_date || body.checkOutDate || '',
      guests,
      value,
      voucher_code: body.voucher_code || body.voucherCode || '',
      payment: {
        method,
        status: isPaid ? 'paid' : 'pending',
        paid_at: isPaid ? new Date() : undefined,
        expires_at: expiresAt,
        transfer_reference: method === 'bank_transfer' ? evoucherCode : ''
      },
      escrow: { status: isPaid ? 'holding' : 'none' },
      booking_status: isPaid ? 'confirmed' : 'new'
    });

    return res.status(201).json({
      success: true,
      message: isPaid ? 'Thanh toán và đặt chỗ thành công.' : 'Đã tạo yêu cầu, đang chờ xác nhận thanh toán.',
      booking: publicBooking(booking),
      payment: booking.payment
    });
  } catch (error) {
    if (debitedUserId) {
      const failedAmount = Number(req.body?.value ?? req.body?.amount ?? req.body?.depositAmount) || 0;
      await User.updateOne({ _id: debitedUserId }, { $inc: { 'wallet.balance': failedAmount, 'wallet.green_points': -Math.floor(failedAmount / 10000) } }).catch(() => {});
      if (walletTransactionCode) await WalletTransaction.deleteOne({ transaction_code: walletTransactionCode }).catch(() => {});
    }
    console.error('Create booking error:', error);
    return res.status(500).json({ success: false, message: 'Không thể tạo đơn đặt chỗ lúc này.' });
  }
});

// Pending transfers are reviewed from the existing admin screen.
router.get('/pending', requireAdmin, async (_req, res) => {
  try {
    const expired = await Booking.find({ 'payment.status': 'pending', 'payment.expires_at': { $lte: new Date() } });
    await Promise.all(expired.map(expireIfNeeded));
    const bookings = await Booking.find({ 'payment.status': 'pending', booking_status: 'new' }).sort({ created_at: -1 }).limit(100);
    return res.json(bookings.map(publicBooking));
  } catch (error) {
    console.error('Pending bookings error:', error);
    return res.status(500).json({ success: false, message: 'Không tải được danh sách thanh toán đang chờ.' });
  }
});

router.get('/lookup', async (req, res) => {
  try {
    const { code, phone, email } = req.query;
    const filter = {};
    if (code) {
      filter.$or = [{ evoucher_code: code }];
      if (mongoose.Types.ObjectId.isValid(String(code))) filter.$or.push({ _id: code });
    } else {
      if (phone) filter['customer.phone'] = phone;
      if (email) filter['customer.email'] = new RegExp(String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (!Object.keys(filter).length) return res.status(400).json({ success: false, message: 'Nhập mã đặt chỗ, số điện thoại hoặc email để tra cứu.' });
    const bookings = await Booking.find(filter).sort({ created_at: -1 });
    return res.json(bookings.map(publicBooking));
  } catch (error) {
    console.error('Lookup booking error:', error);
    return res.status(500).json({ success: false, message: 'Không tra cứu được đơn đặt chỗ.' });
  }
});

router.post('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ.' });
    await expireIfNeeded(booking);
    if (booking.payment.status !== 'pending' || booking.booking_status !== 'new') return res.status(409).json({ success: false, message: 'Đơn không còn ở trạng thái chờ xác nhận.' });
    const isExternalPayment = ['bank_transfer', 'card'].includes(booking.payment.method);
    if (isExternalPayment) {
      booking.payment.status = 'paid';
      booking.payment.paid_at = new Date();
      booking.escrow.status = 'holding';
    }
    booking.booking_status = 'confirmed';
    await booking.save();
    if (booking.user_id && isExternalPayment) {
      await Notification.create({
        user_id: booking.user_id,
        title: 'Đã xác nhận thanh toán',
        message: `Thanh toán ${booking.value.toLocaleString('vi-VN')}đ cho đơn ${booking.evoucher_code} đã được xác nhận.`,
        type: 'booking',
        link_url: `/booking/confirm?code=${encodeURIComponent(booking.evoucher_code)}`
      }).catch((error) => console.error('Payment notification error:', error.message));
    }
    return res.json({ success: true, message: 'Đã xác nhận thanh toán.', booking: publicBooking(booking) });
  } catch (error) {
    console.error('Approve booking error:', error);
    return res.status(500).json({ success: false, message: 'Không xác nhận được thanh toán.' });
  }
});

router.post('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ.' });
    if (booking.payment.status !== 'pending') return res.status(409).json({ success: false, message: 'Đơn không còn ở trạng thái chờ thanh toán.' });
    booking.payment.status = 'failed';
    booking.booking_status = 'rejected';
    booking.escrow.status = 'none';
    await booking.save();
    if (booking.user_id) {
      await Notification.create({
        user_id: booking.user_id,
        title: 'Chưa xác nhận được thanh toán',
        message: `Đơn ${booking.evoucher_code} chưa được xác nhận. Vui lòng kiểm tra thông tin chuyển khoản hoặc liên hệ GreenSteps.`,
        type: 'booking',
        link_url: '/profile'
      }).catch((error) => console.error('Payment notification error:', error.message));
    }
    return res.json({ success: true, message: 'Đã từ chối yêu cầu thanh toán.', booking: publicBooking(booking) });
  } catch (error) {
    console.error('Reject booking error:', error);
    return res.status(500).json({ success: false, message: 'Không từ chối được yêu cầu thanh toán.' });
  }
});

router.post('/:id/simulate-payment', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MODE === 'live') {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phương thức thanh toán này.' });
  }
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ.' });
    await expireIfNeeded(booking);
    if (booking.payment.status !== 'pending' || booking.booking_status !== 'new') {
      return res.status(409).json({ success: false, message: 'Đơn không còn chờ thanh toán.' });
    }
    if (!['bank_transfer', 'card'].includes(booking.payment.method)) {
      return res.status(400).json({ success: false, message: 'Chỉ hỗ trợ mô phỏng QR hoặc thẻ sandbox.' });
    }
    booking.payment.status = 'paid';
    booking.payment.paid_at = new Date();
    booking.booking_status = 'confirmed';
    booking.escrow.status = 'holding';
    await booking.save();
    if (booking.user_id) {
      await Notification.create({
        user_id: booking.user_id,
        title: 'Đã xác nhận thanh toán (mô phỏng)',
        message: `Thanh toán thử nghiệm cho đơn ${booking.evoucher_code} đã được xác nhận.`,
        type: 'booking',
        link_url: `/booking/confirm?code=${encodeURIComponent(booking.evoucher_code)}`
      }).catch((error) => console.error('Payment notification error:', error.message));
    }
    return res.json({ success: true, message: 'Mô phỏng thanh toán thành công.', booking: publicBooking(booking) });
  } catch (error) {
    console.error('Simulate payment error:', error);
    return res.status(500).json({ success: false, message: 'Không thể mô phỏng thanh toán lúc này.' });
  }
});

router.post('/cancel', async (req, res) => {
  try {
    const booking = await Booking.findById(req.body?.bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ.' });
    if (booking.payment.status !== 'pending' || !['new', 'deposit'].includes(booking.booking_status)) {
      return res.status(409).json({ success: false, message: 'Không thể hủy đơn đã thanh toán hoặc đã xử lý.' });
    }
    booking.payment.status = 'failed';
    booking.booking_status = 'cancelled';
    booking.escrow.status = 'none';
    await booking.save();
    return res.json({ success: true, message: 'Đã hủy yêu cầu đặt chỗ.' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return res.status(500).json({ success: false, message: 'Không thể hủy yêu cầu đặt chỗ.' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const bookings = await Booking.find({ user_id: req.params.userId }).sort({ created_at: -1 });
    return res.json(bookings.map(publicBooking));
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không tải được đơn đặt chỗ.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    let booking = mongoose.Types.ObjectId.isValid(req.params.id) ? await Booking.findById(req.params.id) : null;
    if (!booking) booking = await Booking.findOne({ evoucher_code: req.params.id });
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ.' });
    booking = await expireIfNeeded(booking);
    return res.json({ success: true, booking: publicBooking(booking) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không tải được đơn đặt chỗ.' });
  }
});

router.post('/:id/change-request', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ.' });
    const { type, old_data, new_data, price_diff, notes } = req.body || {};
    booking.change_requests.push({ type: type || 'date_change', old_data, new_data, price_diff: Number(price_diff) || 0, notes: notes || '', status: 'pending' });
    await booking.save();
    return res.json({ success: true, message: 'Đã gửi yêu cầu thay đổi.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không gửi được yêu cầu thay đổi.' });
  }
});

module.exports = router;
