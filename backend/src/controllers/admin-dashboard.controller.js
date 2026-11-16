const {
  User,
  VenderContract,
  GreenService,
  ServiceBooking,
  TourBooking,
  WalletTransaction,
  CommunityReport,
  WithdrawalRequest,
  MomoPaymentAttempt,
} = require('../models');

function vietnamBusinessDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const start = new Date(`${part.year}-${part.month}-${part.day}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

async function countPendingProviderApprovals(models) {
  const { User, VenderContract } = models;
  const [result = {}] = await VenderContract.collection.aggregate([
    {
      $lookup: {
        from: User.collection.collectionName,
        localField: 'user_id',
        foreignField: 'id',
        as: 'applicant'
      }
    },
    { $match: { 'applicant.role': 'traveler' } },
    { $count: 'count' }
  ]).toArray();
  return result.count || 0;
}

async function platformRevenueForDay(models, { start, end }) {
  const { WalletTransaction, ServiceBooking, TourBooking } = models;
  const [result = {}] = await WalletTransaction.collection.aggregate([
    {
      $match: {
        type: 'deposit',
        status: { $in: ['success', 'SUCCESS'] },
        createdAt: { $gte: start, $lt: end },
        description: /^Phí hoa hồng dịch vụ 10% từ đơn #/
      }
    },
    {
      $lookup: {
        from: ServiceBooking.collection.collectionName,
        localField: 'reference_id',
        foreignField: 'id',
        as: 'serviceBooking'
      }
    },
    {
      $lookup: {
        from: TourBooking.collection.collectionName,
        localField: 'reference_id',
        foreignField: 'id',
        as: 'tourBooking'
      }
    },
    {
      $set: {
        completedBooking: {
          $arrayElemAt: [{ $concatArrays: ['$serviceBooking', '$tourBooking'] }, 0]
        }
      }
    },
    { $match: { $expr: { $and: [
      { $eq: ['$completedBooking.status', 'completed'] },
      { $eq: ['$amount', { $multiply: ['$completedBooking.value', 0.1] }] }
    ] } } },
    { $group: { _id: null, amount: { $sum: '$amount' }, transactions: { $sum: 1 } } }
  ]).toArray();
  return { amount: result.amount || 0, transactions: result.transactions || 0 };
}

async function getSummary(now = new Date(), models = require('../models')) {
  const {
    User, GreenService, ServiceBooking, TourBooking, WalletTransaction,
    CommunityReport, WithdrawalRequest, MomoPaymentAttempt, VenderContract
  } = models;
  const { start, end } = vietnamBusinessDay(now);
  const [activeUsers, pendingProviders, pendingServices, pendingServiceBookings,
    pendingTourBookings, pendingPaymentTransactions, platformRevenue, pendingReports, pendingWithdrawals,
    paymentReconciliation] = await Promise.all([
    User.collection.countDocuments({
      is_verified: true,
      $or: [{ account_status: 'active' }, { account_status: null }]
    }),
    countPendingProviderApprovals(models),
    GreenService.collection.countDocuments({ status: 'pending' }),
    ServiceBooking.collection.countDocuments({ status: 'pending' }),
    TourBooking.collection.countDocuments({ status: 'pending' }),
    WalletTransaction.collection.countDocuments({ type: 'payment', status: 'pending' }),
    platformRevenueForDay(models, { start, end }),
    CommunityReport.collection.countDocuments({ status: 'pending' }),
    WithdrawalRequest.collection.countDocuments({ status: 'pending' }),
    MomoPaymentAttempt.collection.countDocuments({
      $or: [{ status: 'reconciliation_required' }, { reconciliation_required: true }]
    })
  ]);
  const pendingBookings = pendingServiceBookings + pendingTourBookings + pendingPaymentTransactions;
  const alerts = [
    { key: 'providers', label: 'Nhà cung cấp chờ duyệt', count: pendingProviders, section: 'providers' },
    { key: 'services', label: 'Dịch vụ chờ kiểm duyệt', count: pendingServices, section: 'services' },
    { key: 'bookings', label: 'Booking chờ xử lý', count: pendingBookings, section: 'bookings' },
    { key: 'withdrawals', label: 'Yêu cầu rút tiền chờ xử lý', count: pendingWithdrawals, section: 'withdrawals' },
    { key: 'reports', label: 'Báo cáo cộng đồng chờ duyệt', count: pendingReports, section: 'community' },
    { key: 'reconciliation', label: 'Thanh toán MoMo cần đối soát', count: paymentReconciliation, section: 'deposits' }
  ].filter(alert => alert.count > 0);

  return {
    generatedAt: now.toISOString(),
    businessDay: { timeZone: 'Asia/Ho_Chi_Minh', start: start.toISOString(), end: end.toISOString() },
    activeUsers: { value: activeUsers, definition: 'Đã xác minh và account_status active hoặc chưa có trạng thái.' },
    pendingProviders: { value: pendingProviders, source: 'VenderContract nối tới User role traveler.' },
    pendingServices: { value: pendingServices, source: 'GreenService.status = pending.' },
    pendingBookings: {
      value: pendingBookings,
      service: pendingServiceBookings,
      tour: pendingTourBookings,
      walletPayments: pendingPaymentTransactions,
      source: 'ServiceBooking.status = pending + TourBooking.status = pending + WalletTransaction(type=payment,status=pending).'
    },
    platformRevenueToday: {
      value: platformRevenue.amount,
      transactions: platformRevenue.transactions,
      source: 'WalletTransaction successful platform 10% commission entries linked to completed bookings, created in Vietnam business day.'
    },
    abnormalTransactions: {
      available: false,
      reason: 'Chưa có tiêu chí nghiệp vụ phát hiện giao dịch bất thường.'
    },
    alerts: { items: alerts, available: true },
    sources: {
      activeUsers: User.collection.collectionName,
      providerApprovals: VenderContract.collection.collectionName,
      services: GreenService.collection.collectionName,
      serviceBookings: ServiceBooking.collection.collectionName,
      tourBookings: TourBooking.collection.collectionName,
      walletTransactions: WalletTransaction.collection.collectionName,
      communityReports: CommunityReport.collection.collectionName,
      withdrawals: WithdrawalRequest.collection.collectionName,
      momoPaymentAttempts: MomoPaymentAttempt.collection.collectionName
    }
  };
}

exports.getSummary = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await getSummary() });
  } catch (error) {
    next(error);
  }
};

exports._test = { vietnamBusinessDay, getSummary };
