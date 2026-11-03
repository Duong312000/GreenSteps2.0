const { store, Wallet, Voucher } = require('../models/index');

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
      discount: voucher.discount_percent,
      discount_amount: voucher.discount_amount || 0
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
