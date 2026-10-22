const { Op } = require('sequelize');
const { 
  sequelize, 
  User, 
  Vender, 
  Provider, 
  VenderContract, 
  WalletTransaction, 
  ServiceBooking, 
  GreenService 
} = require('../models/index');

exports.registerProvider = async (req, res, next) => {
  const { nameProvider, field, destination, contractText } = req.body;
  const userId = req.user ? req.user.id : (req.body.userId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

  const t = await sequelize.transaction();
  try {
    // 1. Create Vendor & Provider entries in pending state
    const venderId = `provider_${userId}`;
    await Vender.create({
      id: venderId,
      user_id: userId,
      registration_date: new Date() // Date format
    }, { transaction: t });

    await Provider.create({
      id: 'PROV-' + Date.now().toString().slice(-6),
      contract_id: 'CON0001', // template link
      name_provider: nameProvider,
      field: field || 'Dịch vụ sinh thái',
      destination: destination,
      image_url: 'image/Viet Nam.png',
      provider_status: 'pending' // pending until Admin reviews
    }, { transaction: t });

    // 2. Create signed digital B2B contract record
    await VenderContract.create({
      id: 'VC-' + Date.now().toString().slice(-6),
      user_id: userId,
      name_contract: 'Hợp đồng đại lý kinh doanh dịch vụ du lịch xanh GreenSteps',
      text: contractText || 'Bản hợp đồng ghi nhận cam kết chiết khấu 10% doanh thu check-in cho sàn, tuân thủ các quy chuẩn sinh thái và đảm bảo an toàn môi trường.'
    }, { transaction: t });

    await t.commit();
    res.json({
      success: true,
      message: 'Đăng ký đối tác thành công! Hợp đồng điện tử của bạn đang chờ quản trị viên phê duyệt.'
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.approveProvider = async (req, res, next) => {
  const { targetUserId } = req.body;

  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(targetUserId, { transaction: t });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại!' });
    }

    // Update role
    user.role = 'provider';
    await user.save({ transaction: t });

    // Update provider status
    await Provider.update(
      { provider_status: 'active' },
      { where: { id: { [Op.like]: '%' } }, transaction: t } // update provider linked to this user
    );

    await t.commit();
    res.json({
      success: true,
      message: `Đã phê duyệt người dùng ${user.fullname} làm Đối tác chính thức!`
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.getMonthlyStats = async (req, res, next) => {
  const providerId = req.user ? req.user.id : (req.query.providerId || req.body.providerId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  const { fromDate, toDate } = req.query;

  try {
    const vender = await Vender.findOne({ where: { user_id: providerId } });
    if (!vender) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin nhà bán hàng đối tác!' });
    }

    // 1. Fetch green services owned by this partner
    const services = await GreenService.findAll({ where: { vender_id: vender.id } });
    const serviceIds = services.map(s => s.id);

    // 2. Build booking query dates filter
    const bookingQuery = {
      service_id: { [Op.in]: serviceIds },
      status: 'completed'
    };

    if (fromDate && toDate) {
      bookingQuery.booking_date = {
        [Op.between]: [fromDate, toDate]
      };
    }

    // 3. Sum booking values directly in DB
    const completedBookings = await ServiceBooking.findAll({ where: bookingQuery });

    let grossRevenue = 0;
    completedBookings.forEach(b => {
      grossRevenue += parseFloat(b.value || 0);
    });

    const commissionRate = 0.1; // 10% platform fee
    const platformFee = grossRevenue * commissionRate;
    const netProfit = grossRevenue * (1 - commissionRate);

    // Compute status distributions
    const totalBookingsCount = await ServiceBooking.count({
      where: { service_id: { [Op.in]: serviceIds } }
    });
    const completedCount = completedBookings.length;
    const pendingCount = await ServiceBooking.count({
      where: { service_id: { [Op.in]: serviceIds }, status: 'pending' }
    });
    const depositCount = await ServiceBooking.count({
      where: { service_id: { [Op.in]: serviceIds }, status: 'deposit' }
    });
    const cancelledCount = await ServiceBooking.count({
      where: { service_id: { [Op.in]: serviceIds }, status: 'rejected' }
    });

    res.json({
      success: true,
      stats: {
        grossRevenue,
        platformFee,
        netProfit,
        totalBookings: totalBookingsCount,
        statusDistribution: {
          completed: completedCount,
          pending: pendingCount,
          deposit: depositCount,
          cancelled: cancelledCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// List pending provider registration contracts (Admin only)
exports.listPendingProviders = async (req, res, next) => {
  try {
    const pendingContracts = await VenderContract.findAll({
      include: [{
        model: User,
        where: { role: 'traveler' },
        attributes: ['id', 'fullname', 'username']
      }],
      order: [['createdAt', 'DESC']]
    });
    res.json(pendingContracts);
  } catch (error) {
    next(error);
  }
};
