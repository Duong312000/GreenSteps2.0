const { sequelize, Wallet, Voucher } = require('../models/index');

exports.redeemVoucher = async (req, res, next) => {
  const userId = req.user ? req.user.id : req.body.userId;

  const t = await sequelize.transaction();
  try {
    // 1. Lock Traveler wallet
    const wallet = await Wallet.findOne({
      where: { user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!wallet || wallet.green_points < 1000) {
      await t.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Bạn cần tích lũy tối thiểu 1000 điểm xanh để quy đổi! Điểm hiện tại của bạn: ${wallet ? wallet.green_points : 0} điểm.`
      });
    }

    // 2. Deduct points
    wallet.green_points -= 1000;
    await wallet.save({ transaction: t });

    // 3. Generate Voucher Promo Code
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const voucherCode = `GREEN10-${randomSuffix}`;

    const voucher = await Voucher.create({
      id: 'VOU-' + Date.now(),
      code: voucherCode,
      discount_percent: 10,
      status: 'active',
      user_id: userId
    }, { transaction: t });

    await t.commit();
    res.json({
      success: true,
      message: `Đổi điểm thành công! Mã Voucher của bạn là: ${voucherCode}`,
      voucher: {
        code: voucher.code,
        discount: voucher.discount_percent,
        status: voucher.status
      },
      remainingPoints: wallet.green_points
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.validateVoucher = async (req, res, next) => {
  const { code } = req.body;
  const userId = req.user ? req.user.id : req.body.userId;

  try {
    const voucher = await Voucher.findOne({
      where: { code, user_id: userId }
    });

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Mã Voucher không tồn tại!' });
    }

    if (voucher.status === 'used') {
      return res.status(400).json({ success: false, message: 'Voucher này đã được sử dụng trước đó!' });
    }

    if (voucher.status === 'expired') {
      return res.status(400).json({ success: false, message: 'Voucher này đã hết hạn sử dụng!' });
    }

    res.json({
      success: true,
      message: 'Mã Voucher hợp lệ!',
      discount: voucher.discount_percent
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyVouchers = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : (req.query.userId || req.body.userId);
    const vouchers = await Voucher.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, vouchers });
  } catch (error) {
    next(error);
  }
};
