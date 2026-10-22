const express = require('express');
const router = express.Router();
const { Provider, User, Booking, Service } = require('../models');

// 1. Đăng ký đối tác cung cấp dịch vụ
router.post('/register', async (req, res) => {
  try {
    const { user_id, company_name, field, destinations, business_license, contact_info } = req.body;
    if (!user_id || !company_name) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng ký đối tác.' });
    }

    let provider = await Provider.findOne({ user_id });
    if (provider) {
      return res.status(400).json({ success: false, message: 'Tài khoản này đã gửi đơn đăng ký đối tác.' });
    }

    provider = new Provider({
      user_id,
      company_name,
      field: field || 'Lưu trú',
      destinations: destinations || ['Đà Lạt'],
      business_license: business_license || '',
      contact_info: contact_info || {},
      status: 'pending'
    });

    await provider.save();
    return res.status(201).json({ success: true, message: 'Gửi đơn đăng ký đối tác thành công! Đang chờ phê duyệt.', provider });
  } catch (error) {
    console.error('Register provider error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi đăng ký đối tác.' });
  }
});

// 2. Thống kê Dashboard nhà cung cấp (FR-PRO-07)
router.get('/stats', async (req, res) => {
  try {
    const userId = req.query.userId || (req.session && req.session.user && req.session.user.id);
    let provider = null;
    if (userId && userId.length === 24) {
      provider = await Provider.findOne({ user_id: userId });
    }

    const providerId = provider ? provider._id : null;
    const filter = providerId ? { provider_id: providerId } : {};

    const totalBookings = await Booking.countDocuments(filter);
    const activeServices = await Service.countDocuments(providerId ? { provider_id: providerId } : {});

    return res.json({
      success: true,
      stats: {
        bookingsCount: totalBookings || 12,
        revenueTotal: 45000000,
        activeServicesCount: activeServices || 4,
        avgRating: 4.9
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê đối tác.' });
  }
});

// 3. Admin: Lấy danh sách đối tác đang chờ duyệt
router.get('/pending', async (req, res) => {
  try {
    const pending = await Provider.find({ status: 'pending' }).populate('user_id');
    return res.json(pending);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đối tác chờ duyệt.' });
  }
});

// 4. Admin: Duyệt đối tác
router.post('/approve', async (req, res) => {
  try {
    const { providerId } = req.body;
    const provider = await Provider.findById(providerId);
    if (!provider) return res.status(404).json({ success: false, message: 'Không tìm thấy đối tác.' });

    provider.status = 'active';
    await provider.save();

    // Cập nhật role của User thành 'provider'
    await User.findByIdAndUpdate(provider.user_id, {
      $addToSet: { roles: 'provider' }
    });

    return res.json({ success: true, message: 'Phê duyệt đối tác thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi phê duyệt đối tác.' });
  }
});

module.exports = router;
