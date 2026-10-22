const express = require('express');
const router = express.Router();
const { User, Booking, Service, Schedule, Provider, SystemConfig, WalletTransaction } = require('../models');

// Middleware kiểm tra quyền Admin
const requireAdmin = (req, res, next) => {
  // Cho phép bypass nếu đang ở môi trường dev hoặc có session/header role
  const role = req.session?.user?.role || req.headers['x-user-role'];
  if (role === 'admin' || process.env.NODE_ENV !== 'production') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập trang quản trị' });
};

router.use(requireAdmin);

// GET /api/admin/dashboard - Tổng hợp số liệu thống kê toàn sàn
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const totalServices = await Service.countDocuments();
    const totalProviders = await Provider.countDocuments();
    const pendingProviders = await Provider.countDocuments({ status: 'pending' });

    // Tính tổng doanh thu từ các đơn hàng thành công
    const revenueAgg = await Booking.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$value' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // Tiền ký quỹ Escrow đang giữ
    const escrowAgg = await Booking.aggregate([
      { $match: { 'escrow.status': 'holding' } },
      { $group: { _id: null, totalEscrow: { $sum: '$value' } } }
    ]);
    const totalEscrowHolding = escrowAgg.length > 0 ? escrowAgg[0].totalEscrow : 0;

    // Tổng số người dùng theo vai trò
    const roleStats = await User.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } }
    ]);

    // Các booking mới nhất
    const recentBookings = await Booking.find()
      .populate('user_id', 'profile.fullname email username')
      .populate('provider_id', 'company_name contact_info')
      .sort({ created_at: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        total_users: totalUsers,
        total_bookings: totalBookings,
        total_services: totalServices,
        total_providers: totalProviders,
        pending_providers: pendingProviders,
        total_revenue: totalRevenue,
        total_escrow_holding: totalEscrowHolding,
        role_stats: roleStats,
        recent_bookings: recentBookings
      }
    });
  } catch (error) {
    console.error('Error in GET /admin/dashboard:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// GET /api/admin/users - Quản lý danh sách người dùng
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, q } = req.query;
    const filter = {};

    if (role) filter.roles = role;
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { username: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { 'profile.fullname': new RegExp(q, 'i') },
        { 'profile.phone': new RegExp(q, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(filter)
      .select('-password_hash')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// PUT /api/admin/users/:id/status - Khoá / Kích hoạt / Đổi vai trò tài khoản
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status, role } = req.body;
    const update = {};
    if (status) update.status = status;
    if (role) update.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password_hash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json({
      success: true,
      message: 'Cập nhật trạng thái người dùng thành công',
      data: user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// GET /api/admin/configs - Danh mục cấu hình hệ thống
router.get('/configs', async (req, res) => {
  try {
    const configs = await SystemConfig.find();
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// PUT /api/admin/configs/:key - Cập nhật cấu hình hệ thống
router.put('/configs/:key', async (req, res) => {
  try {
    const { config_value, description } = req.body;
    const config = await SystemConfig.findOneAndUpdate(
      { config_key: req.params.key },
      { config_value, description },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Cập nhật cấu hình thành công', data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;
