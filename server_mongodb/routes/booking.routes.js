const express = require('express');
const router = express.Router();
const { Booking, User, WalletTransaction, Service, Schedule } = require('../models');

// 1. Tạo mới đơn đặt chỗ (Tour hoặc Dịch vụ lẻ)
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      kind,
      target_id,
      service_id,
      tour_id,
      customer,
      booking_date,
      check_out_date,
      guests,
      value,
      voucher_code,
      payment_method
    } = req.body;

    const actualTargetId = target_id || service_id || tour_id;
    if (!actualTargetId || !customer || !customer.fullname || !customer.phone) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin người liên hệ và điểm đặt.' });
    }

    const orderValue = Number(value) || 0;
    const finalMethod = payment_method || 'wallet';

    // Sinh mã vé điện tử duy nhất (evoucher_code)
    const evoucher_code = 'EV-' + Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000);

    // Nếu thanh toán qua Ví GreenSteps, kiểm tra số dư và trừ tiền
    if (finalMethod === 'wallet' && user_id && user_id.length === 24) {
      const user = await User.findById(user_id);
      if (user) {
        if ((user.wallet.balance || 0) < orderValue) {
          return res.status(400).json({ success: false, message: 'Số dư ví GreenSteps không đủ để thanh toán đơn này.' });
        }

        // Trừ số dư ví
        user.wallet.balance -= orderValue;
        // Tích điểm xanh (10.000 VND = 1 điểm xanh)
        const earnedPoints = Math.floor(orderValue / 10000);
        user.wallet.green_points = (user.wallet.green_points || 0) + earnedPoints;
        await user.save();

        // Ghi nhận lịch sử giao dịch ví
        const tx = new WalletTransaction({
          transaction_code: 'GD-' + Date.now(),
          user_id: user._id,
          type: 'payment',
          amount: orderValue,
          description: `Thanh toán đơn đặt ${kind === 'tour' ? 'Tour' : 'Dịch vụ'} [${evoucher_code}]`,
          status: 'success',
          reference_id: evoucher_code
        });
        await tx.save();
      }
    }

    const booking = new Booking({
      evoucher_code,
      user_id: user_id && user_id.length === 24 ? user_id : null,
      kind: kind || 'service',
      target_id: actualTargetId,
      customer: {
        fullname: customer.fullname || (customer.firstName + ' ' + customer.lastName),
        email: customer.email,
        phone: customer.phone
      },
      booking_date: booking_date || new Date().toISOString().split('T')[0],
      check_out_date: check_out_date || '',
      guests: Number(guests) || 1,
      value: orderValue,
      voucher_code: voucher_code || '',
      payment: {
        method: finalMethod,
        status: 'paid',
        paid_at: new Date()
      },
      escrow: {
        status: 'holding' // Tiền được giữ trung gian an toàn
      },
      booking_status: 'confirmed'
    });

    await booking.save();

    return res.status(201).json({
      success: true,
      message: 'Đặt chỗ thành công!',
      booking: {
        id: booking._id,
        _id: booking._id,
        evoucher_code: booking.evoucher_code,
        booking_code: booking.evoucher_code,
        booking_date: booking.booking_date,
        guests: booking.guests,
        value: booking.value,
        status: booking.booking_status,
        customer_fullname: booking.customer.fullname,
        customer_email: booking.customer.email,
        customer_phone: booking.customer.phone
      }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo đơn đặt.' });
  }
});

// 2. Tra cứu đơn đặt theo Mã vé điện tử hoặc Số điện thoại / Email
router.get('/lookup', async (req, res) => {
  try {
    const { code, phone, email } = req.query;
    const filter = {};

    if (code) {
      filter.$or = [
        { evoucher_code: code },
        { _id: code.length === 24 ? code : null }
      ].filter(f => Object.values(f)[0] !== null);
    } else {
      if (phone) filter['customer.phone'] = phone;
      if (email) filter['customer.email'] = new RegExp(email, 'i');
    }

    if (Object.keys(filter).length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã vé, số điện thoại hoặc email.' });
    }

    const bookings = await Booking.find(filter).sort({ created_at: -1 });
    const mapped = bookings.map(b => ({
      id: b._id,
      _id: b._id,
      booking_code: b.evoucher_code,
      evoucher_code: b.evoucher_code,
      booking_date: b.booking_date,
      customer_fullname: b.customer.fullname,
      customer_phone: b.customer.phone,
      customer_email: b.customer.email,
      guests: b.guests,
      value: b.value,
      status: b.booking_status
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('Lookup error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tra cứu đơn đặt chỗ.' });
  }
});

// 3. Chi tiết đơn đặt theo ID hoặc Mã vé
router.get('/:id', async (req, res) => {
  try {
    const idOrCode = req.params.id;
    let booking = null;

    if (idOrCode.length === 24) {
      booking = await Booking.findById(idOrCode);
    }
    if (!booking) {
      booking = await Booking.findOne({ evoucher_code: idOrCode });
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ.' });
    }

    return res.json({
      success: true,
      booking: {
        id: booking._id,
        _id: booking._id,
        booking_code: booking.evoucher_code,
        evoucher_code: booking.evoucher_code,
        booking_date: booking.booking_date,
        customer_fullname: booking.customer.fullname,
        customer_phone: booking.customer.phone,
        customer_email: booking.customer.email,
        guests: booking.guests,
        value: booking.value,
        status: booking.booking_status,
        payment: booking.payment,
        escrow: booking.escrow,
        change_requests: booking.change_requests
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tải đơn đặt chỗ.' });
  }
});

// 4. Lấy danh sách booking của một User
router.get('/user/:userId', async (req, res) => {
  try {
    const bookings = await Booking.find({ user_id: req.params.userId }).sort({ created_at: -1 });
    return res.json(bookings);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tải đơn của người dùng.' });
  }
});

// 5. Thêm yêu cầu thay đổi (Change Request) cho đơn đặt chỗ
router.post('/:id/change-request', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const { type, old_data, new_data, price_diff, notes } = req.body;
    booking.change_requests.push({
      type: type || 'date_change',
      old_data,
      new_data,
      price_diff: Number(price_diff) || 0,
      notes: notes || '',
      status: 'pending'
    });

    await booking.save();
    return res.json({ success: true, message: 'Đã gửi yêu cầu thay đổi thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi gửi yêu cầu thay đổi.' });
  }
});

module.exports = router;
