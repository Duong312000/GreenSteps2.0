const { store, Wallet, Voucher } = require('../models/index');
const saved = require('../services/saved-promotions.service');

exports.claimPromotion = async (req, res, next) => {
  try { res.json({ success: true, ...await saved.claimPromotion(req.user.id, req.params.campaignId) }); }
  catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error); }
};
exports.getSavedPromotions = async (req, res, next) => {
  try { res.json({ success: true, vouchers: await saved.myPromotions(req.user.id) }); } catch (error) { next(error); }
};

exports.validateVoucher = async (req, res, next) => {
  const { code } = req.body;
  const userId = req.user?.id;

  try {
    const voucher = await Voucher.findOne({
      where: { code, user_id: userId }
    });

    if (!voucher) {
      const item = (await saved.myPromotions(userId)).find(item => item.campaign_id && item.code === code);
      if (item?.status === 'active') return res.json({ success: true, message: 'Mã đã lưu hợp lệ. Điều kiện đơn và dịch vụ sẽ được kiểm tra khi đặt.',
        discount: item.discount_type === 'percent' ? item.discount_value : 0, discount_amount: item.discount_type === 'fixed' ? item.discount_value : 0 });
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
    const userId = req.user?.id;
    const vouchers = await Voucher.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, vouchers });
  } catch (error) {
    next(error);
  }
};
