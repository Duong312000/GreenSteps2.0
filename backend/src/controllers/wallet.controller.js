const {
  store,
  Wallet,
  WalletTransaction,
  WithdrawalRequest,
  User
} = require('../models/index');

exports.getWallet = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : (req.params.userId || req.body.userId);
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }
    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: wallet.balance - (wallet.reserved_balance || 0),
        total_balance: wallet.balance,
        reserved_balance: wallet.reserved_balance || 0,
        green_points: wallet.green_points,
        registered: wallet.registered
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransactionStatus = async (req, res, next) => {
  try {
    const transaction = await WalletTransaction.findByPk(req.params.txId);
    const wallet = transaction && await Wallet.findByPk(transaction.wallet_id);
    if (!wallet || (wallet.user_id !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
    }
    res.json({ success: true, status: transaction.status, balance: wallet.balance });
  } catch (error) { next(error); }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : req.params.userId;
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }

    const list = await WalletTransaction.findAll({
      where: { wallet_id: wallet.id },
      order: [['createdAt', 'DESC']]
    });

    const formatted = list.map(tx => ({
      id: tx.id,
      type: tx.type,
      desc: tx.description,
      amount: tx.amount,
      status: tx.status,
      date: new Date(tx.createdAt).toLocaleDateString('vi-VN')
    }));

    res.json({ success: true, transactions: formatted });
  } catch (error) {
    next(error);
  }
};

exports.listAllWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, withdrawals });
  } catch (error) {
    next(error);
  }
};

exports.payItinerary = async (req, res, next) => {
  const { userId, itineraryId, amount } = req.body;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Số tiền thanh toán phải lớn hơn 0.' });
  }

  try {
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }

    if (!wallet.registered) {
      return res.status(400).json({ success: false, message: 'Ví của bạn chưa được kích hoạt. Vui lòng kích hoạt ví trước khi sử dụng tính năng này!' });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Số dư ví không đủ để thanh toán lịch trình!' });
    }

    const t = await store.transaction();
    try {
      const lockedWallet = await Wallet.findOne({
        where: { user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (lockedWallet.balance - (lockedWallet.reserved_balance || 0) < amount) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Số dư ví thay đổi, không đủ thanh toán!' });
      }

      lockedWallet.balance -= parseFloat(amount);
      await lockedWallet.save({ transaction: t });

      const txId = 'GD-' + Date.now();
      await WalletTransaction.create({
        id: txId,
        wallet_id: lockedWallet.id,
        type: 'payment',
        description: `Thanh toán cọc ví cho lịch trình #${itineraryId}`,
        amount: -parseFloat(amount),
        status: 'success',
        reference_id: itineraryId
      }, { transaction: t });

      await t.commit();
      res.json({ success: true, balance: lockedWallet.balance });
    } catch (txErr) {
      await t.rollback();
      throw txErr;
    }
  } catch (error) {
    next(error);
  }
};

exports.payItineraryQr = async (req, res, next) => {
  const { userId, itineraryId, amount } = req.body;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Số tiền thanh toán phải lớn hơn 0.' });
  }

  try {
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }

    const t = await store.transaction();
    try {
      const txId = 'GD-' + Date.now();
      await WalletTransaction.create({
        id: txId,
        wallet_id: wallet.id,
        type: 'payment',
        description: `Thanh toán cọc QR trực tiếp cho lịch trình #${itineraryId}`,
        amount: -parseFloat(amount),
        status: 'pending', // Pending admin approval
        reference_id: itineraryId
      }, { transaction: t });

      await t.commit();
      res.json({ success: true, balance: parseFloat(wallet.balance), message: `Đang chờ quản trị viên xác nhận giao dịch chuyển khoản ${amount.toLocaleString('vi-VN')}đ` });
    } catch (txErr) {
      await t.rollback();
      throw txErr;
    }
  } catch (error) {
    next(error);
  }
};

// Get pending deposits (Admin only)
exports.listPendingDeposits = async (req, res, next) => {
  try {
    const deposits = await WalletTransaction.findAll({
      where: { type: 'deposit', status: 'pending' },
      include: [{
        model: Wallet,
        include: [{ model: User, attributes: ['id', 'fullname', 'username'] }]
      }],
      order: [['createdAt', 'DESC']]
    });
    res.json(deposits);
  } catch (error) {
    next(error);
  }
};

// Approve deposit (Admin only)

exports.listPendingWallets = async (req, res, next) => {
  try {
    const pendingTxs = await WalletTransaction.findAll({
      where: {
        type: 'deposit',
        description: 'Yêu cầu kích hoạt ví GreenSteps',
        status: 'pending'
      },
      include: [{
        model: Wallet,
        include: [User]
      }],
      order: [['createdAt', 'ASC']]
    });
    res.json(pendingTxs);
  } catch (err) {
    next(err);
  }
};

exports.rejectWalletActivation = async (req, res, next) => {
  const { txId } = req.params;

  try {
    const tx = await WalletTransaction.findByPk(txId);
    if (!tx || tx.status !== 'pending' || tx.description !== 'Yêu cầu kích hoạt ví GreenSteps') {
      return res.status(404).json({ success: false, message: 'Yêu cầu kích hoạt ví không tồn tại hoặc đã được xử lý!' });
    }

    tx.status = 'failed';
    await tx.save();

    res.json({ success: true, message: 'Đã từ chối kích hoạt ví!' });
  } catch (error) {
    next(error);
  }
};
