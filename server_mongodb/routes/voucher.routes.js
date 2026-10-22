const express = require('express');
const router = express.Router();
const { Voucher } = require('../models');

// GET /api/vouchers - Lấy danh sách voucher công khai còn hạn
router.get('/', async (req, res) => {
  try {
    const { provider_id, all } = req.query;
    const filter = {};

    if (!all) {
      filter.status = 'active';
      filter.expires_at = { $gte: new Date() };
    }

    if (provider_id) {
      filter.$or = [{ provider_id }, { provider_id: null }]; // Lấy cả voucher riêng và voucher toàn sàn
    }

    const vouchers = await Voucher.find(filter)
      .populate('provider_id', 'business_name')
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: vouchers
    });
  } catch (error) {
    console.error('Error in GET /vouchers:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách voucher', error: error.message });
  }
});

// GET /api/vouchers/:code - Kiểm tra chi tiết 1 mã voucher
router.get('/:code', async (req, res) => {
  try {
    const voucher = await Voucher.findOne({
      code: req.params.code.trim().toUpperCase()
    }).populate('provider_id', 'business_name');

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại' });
    }

    if (voucher.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Mã giảm giá không còn hoạt động' });
    }

    if (new Date(voucher.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn sử dụng' });
    }

    if (voucher.used_count >= voucher.quantity) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
    }

    res.json({ success: true, data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// POST /api/vouchers/apply - Tính toán số tiền giảm giá khi áp dụng mã
router.post('/apply', async (req, res) => {
  try {
    const { code, total_amount, provider_id } = req.body;

    if (!code || total_amount === undefined) {
      return res.status(400).json({ success: false, message: 'Thiếu mã giảm giá hoặc tổng số tiền' });
    }

    const voucher = await Voucher.findOne({ code: code.trim().toUpperCase() });

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Mã giảm giá không hợp lệ' });
    }

    if (voucher.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Mã giảm giá này hiện không khả dụng' });
    }

    if (new Date(voucher.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã quá hạn sử dụng' });
    }

    if (voucher.used_count >= voucher.quantity) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt' });
    }

    const amount = Number(total_amount);
    if (amount < (voucher.min_order_value || 0)) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng tối thiểu phải từ ${voucher.min_order_value.toLocaleString('vi-VN')} VND để áp dụng voucher này`
      });
    }

    // Nếu voucher giới hạn cho 1 provider nhất định
    if (voucher.provider_id && provider_id && voucher.provider_id.toString() !== provider_id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Mã giảm giá này chỉ áp dụng cho nhà cung cấp cụ thể'
      });
    }

    let discount = 0;
    if (voucher.discount_type === 'percent') {
      discount = (amount * voucher.discount_value) / 100;
      if (voucher.max_discount && voucher.max_discount > 0 && discount > voucher.max_discount) {
        discount = voucher.max_discount;
      }
    } else {
      discount = voucher.discount_value;
    }

    // Không để giảm vượt quá tổng tiền
    discount = Math.min(discount, amount);
    const final_amount = amount - discount;

    res.json({
      success: true,
      message: 'Áp dụng mã giảm giá thành công!',
      data: {
        code: voucher.code,
        discount_amount: discount,
        original_amount: amount,
        final_amount: final_amount,
        voucher_id: voucher._id
      }
    });
  } catch (error) {
    console.error('Error in POST /vouchers/apply:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra mã giảm giá', error: error.message });
  }
});

// POST /api/vouchers - Tạo mã giảm giá mới (Admin hoặc Đối tác)
router.post('/', async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_order_value, max_discount, quantity, expires_at, provider_id } = req.body;

    if (!code || !discount_value || !expires_at) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (mã, mức giảm, hạn dùng)' });
    }

    const existing = await Voucher.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá này đã tồn tại trong hệ thống' });
    }

    const voucher = new Voucher({
      code: code.trim().toUpperCase(),
      discount_type: discount_type || 'percent',
      discount_value: Number(discount_value),
      min_order_value: Number(min_order_value) || 0,
      max_discount: Number(max_discount) || 0,
      quantity: Number(quantity) || 100,
      expires_at: new Date(expires_at),
      provider_id: provider_id || null,
      status: 'active'
    });

    await voucher.save();

    res.status(201).json({
      success: true,
      message: 'Tạo mã voucher thành công',
      data: voucher
    });
  } catch (error) {
    console.error('Error creating voucher:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// PUT /api/vouchers/:id - Cập nhật thông tin voucher
router.put('/:id', async (req, res) => {
  try {
    const updated = await Voucher.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });
    }
    res.json({ success: true, message: 'Cập nhật voucher thành công', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// DELETE /api/vouchers/:id - Vô hiệu hóa voucher
router.delete('/:id', async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndUpdate(req.params.id, { status: 'disabled' }, { new: true });
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });
    }
    res.json({ success: true, message: 'Đã vô hiệu hóa voucher' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;
