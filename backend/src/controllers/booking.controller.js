const { Op } = require('sequelize');
const { sendBookingConfirmationEmail } = require('../services/email.service');
const {
  sequelize,
  User,
  Wallet,
  WalletTransaction,
  ServiceBooking,
  TourBooking,
  GreenService,
  Schedule,
  ScheduleSample,
  ScheduleCustom,
  ScheduleActivity,
  Vender,
  Voucher,
  Notification
} = require('../models/index');

// Helper for terminal interactive transaction approval (preserving original codebase prompt)
function promptTerminalApproval(message) {
  return new Promise((resolve) => {
    console.log('\n==================================================');
    console.log(`[GREENSTEPS ADMIN APPROVAL REQUEST]`);
    console.log(message);
    console.log('Nhấn "y" (và Enter) để DUYỆT, hoặc phím khác để TỪ CHỐI.');
    console.log('==================================================');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Duyệt giao dịch? (y/n): ', (answer) => {
      rl.close();
      const approved = answer.trim().toLowerCase() === 'y';
      resolve(approved);
    });
  });
}

async function syncCustomItineraryStatus(itineraryId, transaction = null) {
  try {
    const opts = transaction ? { transaction } : {};
    const scheduleCustom = await ScheduleCustom.findOne({
      where: { id: itineraryId },
      ...opts
    });
    if (scheduleCustom) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + 7);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');

      scheduleCustom.status = 'deposited';
      scheduleCustom.deposit_deadline = `${yyyy}-${mm}-${dd}`;
      await scheduleCustom.save(opts);
    }
  } catch (err) {
    console.error('Failed to sync custom itinerary status:', err);
  }
}

exports.createBooking = async (req, res, next) => {
  const { type, targetId, bookingDate, guests, paymentMethod, voucherCode, customerPhone, customerEmail } = req.body;
  let userId = req.user ? req.user.id : req.body.customerId;
  const fullname = (req.user && req.user.fullname) ? req.user.fullname : (req.body.customerName || 'Khách hàng');
  const email = customerEmail || (req.user ? req.user.email : null);

  let autoCreatedCredentials = null;
  let emailAlreadyExists = false;

  try {
    if (!userId && email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        userId = existingUser.id;
        emailAlreadyExists = true;
      } else {
        const newUserId = 'UG' + Math.floor(10000000 + Math.random() * 90000000);
        const generatedUsername = fullname
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd').replace(/Đ/g, 'd')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        let finalUsername = generatedUsername || 'traveler';
        let count = 1;
        while (await User.findOne({ where: { username: finalUsername } })) {
          finalUsername = (generatedUsername || 'traveler') + count;
          count++;
        }

        const defaultPassword = finalUsername + '123';
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        await User.create({
          id: newUserId,
          role: 'traveler',
          username: finalUsername,
          password_hash: passwordHash,
          email: email,
          fullname: fullname,
          phone: customerPhone || null,
          gender: 'Khác',
          address: '',
          job: '',
          is_verified: true
        });

        userId = newUserId;
        autoCreatedCredentials = {
          username: finalUsername,
          password: defaultPassword
        };
      }
    }

    if (userId) {
      const user = await User.findByPk(userId);
      if (user) {
        let updated = false;
        if (!user.fullname || user.fullname.trim() === '' || user.fullname === 'Khách hàng' || user.fullname === 'Khách hàng phục hồi') {
          user.fullname = fullname;
          updated = true;
        }
        if ((!user.phone || user.phone.trim() === '') && customerPhone) {
          user.phone = customerPhone;
          updated = true;
        }
        if (updated) {
          await user.save();
        }
      }
    }
    let bookingId;
    let totalValue = 0;
    let tourNameOrServiceName = '';
    let discount = 0;

    // 1. Calculate prices, validate availability and vouchers
    if (type === 'service') {
      const service = await GreenService.findByPk(targetId);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Dịch vụ xanh không tồn tại!' });
      }

      // Check capacity in CSDL
      const bookedGuests = await ServiceBooking.sum('guests', {
        where: {
          service_id: targetId,
          booking_date: bookingDate,
          status: { [Op.in]: ['deposit', 'completed'] }
        }
      }) || 0;

      if (service.max_capacity - bookedGuests < guests) {
        return res.status(400).json({
          success: false,
          message: `Dịch vụ chỉ còn ${service.max_capacity - bookedGuests} chỗ trống cho ngày ${bookingDate}.`
        });
      }

      totalValue = service.cost * guests;
      tourNameOrServiceName = service.name_service;
      bookingId = 'BKS-' + Date.now();
    } else if (type === 'tour' || type === 'itinerary') {
      const baseTour = await Schedule.findByPk(targetId);
      if (!baseTour) {
        return res.status(404).json({ success: false, message: 'Lịch trình hoặc Tour không tồn tại!' });
      }

      const sampleTour = await ScheduleSample.findOne({ where: { id: targetId } });
      if (sampleTour) {
        totalValue = sampleTour.cost * guests;
      } else {
        // It's a custom itinerary! Fetch costs of activities
        const activities = await ScheduleActivity.findAll({ where: { schedule_id: targetId } });
        let perPersonCost = 0;
        let flatCost = 0;
        activities.forEach(act => {
          if (act.cost) {
            if (act.is_shared || act.type === 'lodging') {
              flatCost += act.cost;
            } else {
              perPersonCost += act.cost;
            }
          }
        });
        totalValue = (perPersonCost * guests) + flatCost;
      }
      tourNameOrServiceName = baseTour.tour_name || 'Lịch trình tự chọn';
      bookingId = 'BKT-' + Date.now();
    } else {
      return res.status(400).json({ success: false, message: 'Loại đặt chỗ không hợp lệ (yêu cầu service hoặc tour/itinerary)!' });
    }

    // 2. Validate voucher if applied
    if (voucherCode) {
      const voucher = await Voucher.findOne({
        where: { code: voucherCode, user_id: userId, status: 'active' }
      });
      if (voucher) {
        discount = totalValue * (voucher.discount_percent / 100);
        totalValue -= discount;
      }
    }

    // 3. Process Payment based on paymentMethod
    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ where: { user_id: userId } });
      if (!wallet || wallet.balance < totalValue) {
        return res.status(400).json({ success: false, message: 'Số dư ví không đủ để thanh toán cọc đơn đặt!' });
      }

      // Start transaction to execute payment and book
      await sequelize.transaction(async (t) => {
        const lockedWallet = await Wallet.findOne({
          where: { user_id: userId },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        // Deduct balance immediately as escrow hold
        lockedWallet.balance -= totalValue;
        await lockedWallet.save({ transaction: t });

        const evoucherCode = 'EV-' + Math.floor(1000000000 + Math.random() * 9000000000);

        if (type === 'service') {
          await ServiceBooking.create({
            id: bookingId,
            user_id: userId,
            service_id: targetId,
            fullname: fullname,
            name_service: tourNameOrServiceName,
            booking_date: bookingDate,
            guests: guests,
            value: totalValue,
            status: 'pending', // Pending admin approval on Admin page
            evoucher_code: evoucherCode,
            escrow_status: 'none',
            voucher_code: voucherCode || null,
            customer_phone: customerPhone || null,
            customer_email: email || null
          }, { transaction: t });
        } else {
          await TourBooking.create({
            id: bookingId,
            user_id: userId,
            schedule_id: targetId,
            fullname: fullname,
            tour_name: tourNameOrServiceName,
            booking_date: bookingDate,
            guests: guests,
            value: totalValue,
            payment_method: 'wallet',
            evoucher_code: evoucherCode,
            status: 'pending', // Pending admin approval on Admin page
            escrow_status: 'none',
            customer_phone: customerPhone || null,
            customer_email: email || null
          }, { transaction: t });
        }

        await syncCustomItineraryStatus(targetId, t);

        // Set voucher status to used
        if (voucherCode) {
          await Voucher.update(
            { status: 'used' },
            { where: { code: voucherCode, user_id: userId }, transaction: t }
          );
        }

        // Save wallet transaction as pending escrow hold
        await WalletTransaction.create({
          id: 'GD-' + Date.now(),
          wallet_id: lockedWallet.id,
          type: 'escrow_hold',
          amount: totalValue,
          description: `Thanh toán cọc ví cho đơn #${bookingId}`,
          status: 'pending', // Pending admin approval
          reference_id: bookingId
        }, { transaction: t });

        // Create pending notification
        if (userId) {
          await Notification.create({
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            user_id: userId,
            title: 'Đang chờ duyệt giao dịch',
            message: `Giao dịch thanh toán bằng ví cho đơn ${bookingId} đang chờ quản trị viên phê duyệt.`,
            type: 'booking',
            read: false
          }, { transaction: t });
        }
      });

      return res.json({
        success: true,
        pending: true,
        message: 'Đơn đặt chỗ bằng ví đã được tạo thành công và đang chờ Admin phê duyệt.'
      });

    } else if (paymentMethod === 'card') {
      // Direct Credit Card payment (success without OTP simulator)
      await sequelize.transaction(async (t) => {
        const wallet = await Wallet.findOne({ where: { user_id: userId }, transaction: t });
        const evoucherCode = 'EV-' + Math.floor(1000000000 + Math.random() * 9000000000);

        if (type === 'service') {
          await ServiceBooking.create({
            id: bookingId,
            user_id: userId,
            service_id: targetId,
            fullname: fullname,
            name_service: tourNameOrServiceName,
            booking_date: bookingDate,
            guests: guests,
            value: totalValue,
            status: 'deposit',
            evoucher_code: evoucherCode,
            escrow_status: 'holding',
            voucher_code: voucherCode || null,
            customer_phone: customerPhone || null,
            customer_email: email || null
          }, { transaction: t });
        } else {
          await TourBooking.create({
            id: bookingId,
            user_id: userId,
            schedule_id: targetId,
            fullname: fullname,
            tour_name: tourNameOrServiceName,
            booking_date: bookingDate,
            guests: guests,
            value: totalValue,
            payment_method: 'card',
            evoucher_code: evoucherCode,
            status: 'deposit',
            escrow_status: 'holding',
            customer_phone: customerPhone || null,
            customer_email: email || null
          }, { transaction: t });
        }

        await syncCustomItineraryStatus(targetId, t);

        // Set voucher status to used
        if (voucherCode) {
          await Voucher.update(
            { status: 'used' },
            { where: { code: voucherCode, user_id: userId }, transaction: t }
          );
        }

        // Record successful transaction in wallet if it exists
        if (wallet) {
          await WalletTransaction.create({
            id: 'GD-' + Date.now(),
            wallet_id: wallet.id,
            type: 'payment',
            amount: totalValue,
            description: `Thanh toán cọc bằng Thẻ Tín Dụng cho đơn #${bookingId}`,
            status: 'success',
            reference_id: bookingId
          }, { transaction: t });
        }
      });
    } else if (paymentMethod === 'bank_transfer') {
      // Direct QR transfer (Pending admin verification, no terminal block)
      await sequelize.transaction(async (t) => {
        const wallet = await Wallet.findOne({ where: { user_id: userId }, transaction: t });
        const evoucherCode = 'EV-' + Math.floor(1000000000 + Math.random() * 9000000000);

        if (type === 'service') {
          await ServiceBooking.create({
            id: bookingId,
            user_id: userId,
            service_id: targetId,
            fullname: fullname,
            name_service: tourNameOrServiceName,
            booking_date: bookingDate,
            guests: guests,
            value: totalValue,
            status: 'pending', // Pending admin approval
            evoucher_code: evoucherCode,
            escrow_status: 'none',
            voucher_code: voucherCode || null,
            customer_phone: customerPhone || null,
            customer_email: email || null
          }, { transaction: t });
        } else {
          await TourBooking.create({
            id: bookingId,
            user_id: userId,
            schedule_id: targetId,
            fullname: fullname,
            tour_name: tourNameOrServiceName,
            booking_date: bookingDate,
            guests: guests,
            value: totalValue,
            payment_method: 'bank_transfer',
            evoucher_code: evoucherCode,
            status: 'pending', // Pending admin approval
            escrow_status: 'none',
            voucher_code: voucherCode || null,
            customer_phone: customerPhone || null,
            customer_email: email || null
          }, { transaction: t });
        }

        // Set voucher status to used
        if (voucherCode) {
          await Voucher.update(
            { status: 'used' },
            { where: { code: voucherCode, user_id: userId }, transaction: t }
          );
        }

        // Record pending transaction in wallet if it exists
        if (wallet) {
          await WalletTransaction.create({
            id: 'GD-' + Date.now(),
            wallet_id: wallet.id,
            type: 'payment',
            amount: totalValue,
            description: `Thanh toán cọc QR trực tiếp cho đơn #${bookingId}`,
            status: 'pending', // Pending admin approval
            reference_id: bookingId
          }, { transaction: t });
        }

        // Create pending notification
        if (userId) {
          await Notification.create({
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            user_id: userId,
            title: 'Đang chờ duyệt giao dịch',
            message: `Giao dịch chuyển khoản đặt cọc cho đơn ${bookingId} đang chờ quản trị viên phê duyệt.`,
            type: 'booking',
            read: false
          }, { transaction: t });
        }
      });
    } else {
      // Just save booking as pending/unpaid
      const evoucherCode = 'EV-' + Math.floor(1000000000 + Math.random() * 9000000000);
      if (type === 'service') {
        await ServiceBooking.create({
          id: bookingId,
          user_id: userId,
          service_id: targetId,
          fullname: fullname,
          name_service: tourNameOrServiceName,
          booking_date: bookingDate,
          guests: guests,
          value: totalValue,
          status: 'pending',
          evoucher_code: evoucherCode,
          escrow_status: 'none',
          voucher_code: voucherCode || null,
          customer_phone: customerPhone || null,
          customer_email: email || null
        });
      } else {
        await TourBooking.create({
          id: bookingId,
          user_id: userId,
          schedule_id: targetId,
          fullname: fullname,
          tour_name: tourNameOrServiceName,
          booking_date: bookingDate,
          guests: guests,
          value: totalValue,
          payment_method: paymentMethod || 'counter',
          evoucher_code: evoucherCode,
          status: 'pending',
          escrow_status: 'none',
          voucher_code: voucherCode || null,
          customer_phone: customerPhone || null,
          customer_email: email || null
        });
      }
    }

    if (email) {
      const user = await User.findByPk(userId);
      const token = user ? localSignAuthToken(user) : '';

      const redirectPath = '/schedule';

      const origin = req.headers.origin || 'http://localhost:4200';
      const lookupUrl = `${origin}${redirectPath}${token ? `?token=${token}` : ''}`;

      sendBookingConfirmationEmail({
        to: email,
        bookingId,
        tourName: tourNameOrServiceName,
        bookingDate,
        guests,
        depositAmount: totalValue,
        paymentMethod: paymentMethod || 'counter',
        lookupUrl,
        credentials: autoCreatedCredentials
      }).catch(err => console.error('Booking confirmation email sending error:', err));
    }

    const responsePayload = {
      success: true,
      message: 'Đặt chỗ thành công!',
      bookingId,
      emailAlreadyExists: !!emailAlreadyExists
    };

    if (userId && !emailAlreadyExists && autoCreatedCredentials) {
      const user = await User.findByPk(userId);
      if (user) {
        responsePayload.autoCreatedUser = {
          username: user.username,
          defaultPassword: autoCreatedCredentials.password,
          token: localSignAuthToken(user),
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullname: user.fullname,
            phone: user.phone
          }
        };
      }
    }

    res.json(responsePayload);
  } catch (error) {
    next(error);
  }
};

exports.checkInEVoucher = async (req, res, next) => {
  const { evoucherCode } = req.body;
  const providerId = req.user ? req.user.id : (req.body.providerId || null);

  const t = await sequelize.transaction();
  try {
    // 1. Locate booking (Service or Tour Booking)
    let booking = await ServiceBooking.findOne({
      where: { evoucher_code: evoucherCode, status: 'deposit', escrow_status: 'holding' },
      transaction: t
    });
    let isService = true;

    if (!booking) {
      booking = await TourBooking.findOne({
        where: { evoucher_code: evoucherCode, status: 'deposit', escrow_status: 'holding' },
        transaction: t
      });
      isService = false;
    }

    if (!booking) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'E-Voucher không tồn tại hoặc đã được check-in!' });
    }

    // 2. Locate Provider vender_id or details
    let vendorUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // fallback partner
    let carbonSaved = 1.0;

    if (isService) {
      const service = await GreenService.findByPk(booking.service_id, { transaction: t });
      if (service) {
        const vender = await Vender.findByPk(service.vender_id, { transaction: t });
        if (vender) vendorUserId = vender.user_id;
        carbonSaved = (service.carbon || 0.5) * booking.guests;
      }
    } else {
      const tour = await Schedule.findByPk(booking.schedule_id, { transaction: t });
      if (tour) carbonSaved = (tour.carbon || 5.0) * booking.guests;
    }

    // 3. Update booking status
    booking.status = 'completed';
    booking.escrow_status = 'released';
    await booking.save({ transaction: t });

    // 4. Distribute funds: 90% Provider, 10% Platform fee (EW26admin001)
    const providerWallet = await Wallet.findOne({
      where: { user_id: vendorUserId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    const adminWallet = await Wallet.findOne({
      where: { id: 'EW26admin001' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const netProfit = booking.value * 0.9;
    const platformFee = booking.value * 0.1;

    providerWallet.balance += netProfit;
    await providerWallet.save({ transaction: t });

    adminWallet.balance += platformFee;
    await adminWallet.save({ transaction: t });

    // 5. Add green points to traveler
    const travelerWallet = await Wallet.findOne({
      where: { user_id: booking.user_id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    const earnedPoints = Math.round(carbonSaved * 10);
    travelerWallet.green_points += earnedPoints;
    await travelerWallet.save({ transaction: t });

    // 6. Record transactions
    await WalletTransaction.bulkCreate([
      {
        id: 'GD-P-' + Date.now(),
        wallet_id: providerWallet.id,
        type: 'escrow_release',
        amount: netProfit,
        description: `Check-in E-Voucher đơn #${booking.id}: Thực nhận 90%`,
        status: 'success',
        reference_id: booking.id
      },
      {
        id: 'GD-A-' + Date.now(),
        wallet_id: adminWallet.id,
        type: 'deposit',
        amount: platformFee,
        description: `Phí hoa hồng dịch vụ 10% từ đơn #${booking.id}`,
        status: 'success',
        reference_id: booking.id
      }
    ], { transaction: t });

    await t.commit();
    res.json({
      success: true,
      message: 'Check-in E-Voucher thành công! Tiền đã chuyển đối soát đối tác, điểm xanh đã cộng vào tài khoản khách hàng.'
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.cancelBooking = async (req, res, next) => {
  const { bookingId } = req.body;
  const userId = req.user ? req.user.id : req.body.userId;

  const t = await sequelize.transaction();
  try {
    let booking = await ServiceBooking.findOne({
      where: { id: bookingId, user_id: userId },
      transaction: t
    });
    let isService = true;

    if (!booking) {
      booking = await TourBooking.findOne({
        where: { id: bookingId, user_id: userId },
        transaction: t
      });
      isService = false;
    }

    if (!booking) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Đơn đặt chỗ không tồn tại!' });
    }

    if (booking.status === 'pending') {
      booking.status = 'rejected';
      booking.escrow_status = 'none';
      await booking.save({ transaction: t });

      await WalletTransaction.update(
        { status: 'failed' },
        { where: { reference_id: bookingId, status: 'pending' }, transaction: t }
      );

      await t.commit();
      return res.json({ success: true, message: 'Đã hủy đơn đặt chỗ thành công!' });
    }

    if (booking.status !== 'deposit' || booking.escrow_status !== 'holding') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Chỉ đơn đặt ở trạng thái đặt cọc tạm giữ mới có thể hủy!' });
    }

    // Check cancellation deadline: free cancel if >= 3 days before booking_date
    const today = new Date();
    const tourDate = new Date(booking.booking_date);
    const diffTime = tourDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 3) {
      // 100% Refund to Traveler
      booking.status = 'rejected';
      booking.escrow_status = 'refunded';
      await booking.save({ transaction: t });

      const travelerWallet = await Wallet.findOne({
        where: { user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      travelerWallet.balance += booking.value;
      await travelerWallet.save({ transaction: t });

      await WalletTransaction.create({
        id: 'GD-' + Date.now(),
        wallet_id: travelerWallet.id,
        type: 'refund',
        amount: booking.value,
        description: `Hoàn tiền đặt cọc 100% do hủy đơn trước hạn #${booking.id}`,
        status: 'success',
        reference_id: booking.id
      }, { transaction: t });

      await t.commit();
      res.json({ success: true, message: 'Đã hủy đơn thành công. Toàn bộ tiền cọc đã được hoàn về ví của bạn!' });
    } else {
      // Compensation penalty to Provider: escrow released to Provider
      booking.status = 'rejected';
      booking.escrow_status = 'released';
      await booking.save({ transaction: t });

      let providerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      if (isService) {
        const service = await GreenService.findByPk(booking.service_id, { transaction: t });
        if (service) {
          const vender = await Vender.findByPk(service.vender_id, { transaction: t });
          if (vender) providerId = vender.user_id;
        }
      }

      const providerWallet = await Wallet.findOne({
        where: { user_id: providerId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      providerWallet.balance += booking.value;
      await providerWallet.save({ transaction: t });

      await WalletTransaction.create({
        id: 'GD-' + Date.now(),
        wallet_id: providerWallet.id,
        type: 'escrow_release',
        amount: booking.value,
        description: `Nhận 100% tiền bồi thường hủy đơn muộn #${booking.id}`,
        status: 'success',
        reference_id: booking.id
      }, { transaction: t });

      await t.commit();
      res.json({ success: true, message: 'Đã hủy đơn. Do đơn hủy muộn (dưới 3 ngày), tiền đặt cọc đã được chuyển làm bồi thường cho nhà cung cấp.' });
    }
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.getBookings = async (req, res, next) => {
  try {
    const { providerId, customerId } = req.query;
    let serviceBookings = [];
    let tourBookings = [];

    if (providerId) {
      const vender = await Vender.findOne({ where: { user_id: providerId } });
      const venderId = vender ? vender.id : '';

      const services = await GreenService.findAll({ where: { vender_id: venderId } });
      const serviceIds = services.map(s => s.id);

      serviceBookings = await ServiceBooking.findAll({
        where: { service_id: { [Op.in]: serviceIds } },
        order: [['createdAt', 'DESC']]
      });

      // TourBookings do not have vender/owner fields, so providers only manage their own green services
      tourBookings = [];
    } else if (customerId) {
      serviceBookings = await ServiceBooking.findAll({
        where: { user_id: customerId },
        order: [['createdAt', 'DESC']]
      });
      tourBookings = await TourBooking.findAll({
        where: { user_id: customerId },
        order: [['createdAt', 'DESC']]
      });
    } else {
      serviceBookings = await ServiceBooking.findAll({ order: [['createdAt', 'DESC']] });
      tourBookings = await TourBooking.findAll({ order: [['createdAt', 'DESC']] });
    }

    const mappedServices = serviceBookings.map(row => ({
      id: row.id,
      customer: row.fullname,
      service: row.name_service,
      date: row.booking_date,
      guests: row.guests,
      value: row.value,
      status: row.status,
      evoucher: row.evoucher_code,
      type: 'service',
      escrow: row.escrow_status,
      booking_status: row.booking_status,
      payment_status: row.payment_status,
      operation_status: row.operation_status,
      confirm_deadline: row.confirm_deadline,
      payment_deadline: row.payment_deadline,
      special_requests: row.special_requests,
      rejection_reason: row.rejection_reason
    }));

    const mappedTours = tourBookings.map(row => ({
      id: row.id,
      customer: row.fullname,
      service: row.tour_name,
      date: row.booking_date,
      guests: row.guests,
      value: row.value,
      status: row.status,
      evoucher: row.evoucher_code,
      type: 'tour',
      escrow: row.escrow_status,
      booking_status: row.booking_status,
      payment_status: row.payment_status,
      operation_status: row.operation_status,
      confirm_deadline: row.confirm_deadline,
      payment_deadline: row.payment_deadline,
      special_requests: row.special_requests,
      rejection_reason: row.rejection_reason
    }));

    res.json([...mappedServices, ...mappedTours]);
  } catch (error) {
    next(error);
  }
};

exports.approveBooking = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (id.startsWith('iti_') || id.startsWith('GD-')) {
      const tx = await WalletTransaction.findOne({
        where: {
          [Op.or]: [{ id: id }, { reference_id: id }],
          type: 'payment',
          status: 'pending'
        }
      });
      if (!tx) {
        return res.status(404).json({ success: false, message: 'Yêu cầu thanh toán lịch trình không tồn tại hoặc đã xử lý!' });
      }
      const itineraryId = tx.reference_id;
      const t = await sequelize.transaction();
      try {
        tx.status = 'success';
        await tx.save({ transaction: t });

        // Update custom itinerary status & deadline (+7 days)
        await ScheduleCustom.update(
          {
            status: 'deposited',
            deposit_deadline: sequelize.literal("CURRENT_DATE + 7")
          },
          { where: { id: itineraryId }, transaction: t }
        );

        await t.commit();
        return res.json({ success: true, message: 'Đã phê duyệt đặt cọc lịch trình thành công!' });
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    let booking = await ServiceBooking.findByPk(id);
    if (!booking) {
      booking = await TourBooking.findByPk(id);
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Đơn đặt chỗ không tồn tại!' });
    }
    booking.status = 'deposit';
    booking.escrow_status = 'holding';
    booking.booking_status = 'accepted';
    booking.payment_status = 'deposit_paid';
    booking.operation_status = 'preparing';
    await booking.save();

    if (booking.schedule_id) {
      await syncCustomItineraryStatus(booking.schedule_id);
    }

    // Sync pending QR transfer transaction
    await WalletTransaction.update(
      { status: 'success' },
      { where: { reference_id: id, status: 'pending' } }
    );

    // Create success notification
    if (booking.user_id) {
      await Notification.create({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: booking.user_id,
        title: 'Giao dịch thành công',
        message: `Giao dịch chuyển khoản đặt cọc cho đơn ${id} đã được phê duyệt thành công!`,
        type: 'booking',
        read: false
      });
    }

    res.json({ success: true, message: 'Đã phê duyệt đơn đặt chỗ thành công!' });
  } catch (error) {
    next(error);
  }
};

exports.rejectBooking = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (id.startsWith('iti_') || id.startsWith('GD-')) {
      const tx = await WalletTransaction.findOne({
        where: {
          [Op.or]: [{ id: id }, { reference_id: id }],
          type: 'payment',
          status: 'pending'
        }
      });
      if (!tx) {
        return res.status(404).json({ success: false, message: 'Yêu cầu thanh toán lịch trình không tồn tại hoặc đã xử lý!' });
      }
      tx.status = 'failed';
      await tx.save();
      return res.json({ success: true, message: 'Đã từ chối đặt cọc lịch trình!' });
    }

    let booking = await ServiceBooking.findByPk(id);
    if (!booking) {
      booking = await TourBooking.findByPk(id);
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Đơn đặt chỗ không tồn tại!' });
    }
    booking.status = 'rejected';
    booking.escrow_status = 'refunded';
    booking.booking_status = 'rejected';
    booking.payment_status = 'pending';
    booking.rejection_reason = req.body.reason || 'Dịch vụ đã hết chỗ';
    await booking.save();

    // Sync pending transaction & process wallet refund if type is escrow_hold
    const pendingTx = await WalletTransaction.findOne({
      where: { reference_id: id, status: 'pending' }
    });

    if (pendingTx) {
      if (pendingTx.type === 'escrow_hold') {
        const t = await sequelize.transaction();
        try {
          const travelerWallet = await Wallet.findOne({
            where: { id: pendingTx.wallet_id },
            transaction: t,
            lock: t.LOCK.UPDATE
          });
          if (travelerWallet) {
            travelerWallet.balance += Math.abs(pendingTx.amount);
            await travelerWallet.save({ transaction: t });
          }
          pendingTx.status = 'failed';
          await pendingTx.save({ transaction: t });
          await t.commit();
        } catch (err) {
          await t.rollback();
          throw err;
        }
      } else {
        pendingTx.status = 'failed';
        await pendingTx.save();
      }
    }

    res.json({ success: true, message: 'Đã từ chối đơn đặt chỗ thành công!' });
  } catch (error) {
    next(error);
  }
};

exports.getPendingBookings = async (req, res, next) => {
  try {
    const serviceBookings = await ServiceBooking.findAll({
      where: { status: 'pending' },
      include: [User],
      order: [['createdAt', 'DESC']]
    });

    const tourBookings = await TourBooking.findAll({
      where: { status: 'pending' },
      include: [User],
      order: [['createdAt', 'DESC']]
    });

    const itineraryPayments = await WalletTransaction.findAll({
      where: { type: 'payment', status: 'pending' },
      include: [{
        model: Wallet,
        include: [User]
      }],
      order: [['createdAt', 'DESC']]
    });

    const mappedServices = serviceBookings.map(row => ({
      id: row.id,
      customer: row.fullname,
      service: row.name_service,
      date: row.booking_date,
      guests: row.guests,
      value: row.value,
      status: row.status,
      type: 'service',
      escrow: row.escrow_status,
      createdAt: row.createdAt
    }));

    const mappedTours = tourBookings.map(row => ({
      id: row.id,
      customer: row.fullname,
      service: row.tour_name,
      date: row.booking_date,
      guests: row.guests,
      value: row.value,
      status: row.status,
      type: 'tour',
      escrow: row.escrow_status,
      createdAt: row.createdAt
    }));

    const mappedItineraries = itineraryPayments.map(row => ({
      id: row.id,
      itineraryId: row.reference_id,
      customer: row.Wallet?.User?.fullname || 'Khách hàng',
      service: `Đặt cọc Lịch trình tự chọn (#${row.reference_id ? row.reference_id.substring(4, 12) : ''})`,
      date: new Date(row.createdAt).toLocaleDateString('vi-VN'),
      guests: 1,
      value: Math.abs(row.amount),
      status: row.status,
      type: 'itinerary',
      escrow: 'none',
      createdAt: row.createdAt
    }));

    res.json([...mappedServices, ...mappedTours, ...mappedItineraries]);
  } catch (error) {
    next(error);
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'greensteps_secret_key_123456';
const jwt = require('jsonwebtoken');

function localSignAuthToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullname: user.fullname },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

exports.getBookingDetails = async (req, res, next) => {
  const { id } = req.params;
  try {
    let booking = await ServiceBooking.findByPk(id, { include: [User] });
    let type = 'service';
    if (!booking) {
      booking = await TourBooking.findByPk(id, { include: [User] });
      type = 'tour';
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Đơn đặt chỗ không tồn tại!' });
    }

    let autoCreatedUser = null;
    let emailAlreadyExists = false;
    if (booking.User && (booking.status === 'deposit' || booking.status === 'confirmed' || booking.status === 'accepted')) {
      const user = booking.User;
      const userCreatedTime = new Date(user.createdAt).getTime();
      const bookingCreatedTime = new Date(booking.createdAt).getTime();
      if (Math.abs(userCreatedTime - bookingCreatedTime) < 15 * 60 * 1000) {
        autoCreatedUser = {
          username: user.username,
          defaultPassword: user.username + '123',
          token: localSignAuthToken(user),
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullname: user.fullname,
            phone: user.phone
          }
        };
      } else {
        emailAlreadyExists = true;
      }
    }

    res.json({
      success: true,
      booking: {
        ...booking.toJSON(),
        type
      },
      autoCreatedUser,
      emailAlreadyExists
    });
  } catch (error) {
    next(error);
  }
};

exports.completeBooking = async (req, res, next) => {
  const { id } = req.params;
  try {
    let booking = await ServiceBooking.findByPk(id);
    if (!booking) {
      booking = await TourBooking.findByPk(id);
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Đơn đặt chỗ không tồn tại!' });
    }
    booking.booking_status = 'accepted';
    booking.payment_status = 'fully_paid';
    booking.operation_status = 'completed';
    booking.status = 'completed';
    await booking.save();
    res.json({ success: true, message: 'Đã hoàn thành booking thành công!', booking });
  } catch (error) {
    next(error);
  }
};

exports.updateBookingStatuses = async (req, res, next) => {
  const { id } = req.params;
  const { booking_status, payment_status, operation_status, confirm_deadline, payment_deadline } = req.body;
  try {
    let booking = await ServiceBooking.findByPk(id);
    if (!booking) {
      booking = await TourBooking.findByPk(id);
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Đơn đặt chỗ không tồn tại!' });
    }
    if (booking_status !== undefined) booking.booking_status = booking_status;
    if (payment_status !== undefined) booking.payment_status = payment_status;
    if (operation_status !== undefined) booking.operation_status = operation_status;
    if (confirm_deadline !== undefined) booking.confirm_deadline = confirm_deadline;
    if (payment_deadline !== undefined) booking.payment_deadline = payment_deadline;

    // Map to legacy status for safety/backward-compat
    if (booking.booking_status === 'rejected') {
      booking.status = 'rejected';
      if (booking.schedule_id) {
        const sc = await ScheduleCustom.findByPk(booking.schedule_id);
        if (sc) {
          sc.status = 'draft';
          await sc.save();
        }
      }
    } else if (booking.booking_status === 'cancelled') {
      booking.status = 'refunded';
      if (booking.schedule_id) {
        const sc = await ScheduleCustom.findByPk(booking.schedule_id);
        if (sc) {
          sc.status = 'draft';
          await sc.save();
        }
      }
    } else if (booking.operation_status === 'completed') {
      booking.status = 'completed';
    } else if (booking.payment_status === 'deposit_paid') {
      booking.status = 'deposit';
    }

    await booking.save();
    res.json({ success: true, message: 'Cập nhật trạng thái thành công!', booking });
  } catch (error) {
    next(error);
  }
};

exports.lookupBookingsByPhone = async (req, res, next) => {
  const { phone, email } = req.query;
  if (!phone && !email) {
    return res.status(400).json({ success: false, message: 'Số điện thoại hoặc email không hợp lệ!' });
  }

  try {
    const whereClause = {};
    if (phone) {
      whereClause.customer_phone = phone.trim();
    }
    if (email) {
      whereClause.customer_email = email.trim();
    }

    const serviceBookings = await ServiceBooking.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    const tourBookings = await TourBooking.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    const mappedServices = serviceBookings.map(row => ({
      ...row.toJSON(),
      type: 'service'
    }));

    const mappedTours = tourBookings.map(row => ({
      ...row.toJSON(),
      type: 'tour'
    }));

    const allBookings = [...mappedServices, ...mappedTours].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json({
      success: true,
      bookings: allBookings
    });
  } catch (error) {
    next(error);
  }
};
