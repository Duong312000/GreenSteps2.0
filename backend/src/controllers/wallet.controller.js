const { 
  sequelize, 
  Wallet, 
  WalletTransaction, 
  WithdrawalRequest, 
  User 
} = require('../models/index');

// Helper for terminal interactive transaction approval
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
        balance: wallet.balance,
        green_points: wallet.green_points,
        registered: wallet.registered
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.activateWallet = async (req, res, next) => {
  const userId = req.user ? req.user.id : req.body.userId;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại!' });
    }

    const t = await sequelize.transaction();
    try {
      let wallet = await Wallet.findOne({ where: { user_id: userId }, transaction: t });
      
      if (!wallet) {
        wallet = await Wallet.create({
          id: 'EW' + Math.floor(10000000 + Math.random() * 90000000),
          user_id: userId,
          balance: 0.0,
          registered: false,
          green_points: 0
        }, { transaction: t });
      }

      if (wallet.registered) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Ví của bạn đã được kích hoạt từ trước!' });
      }

      // Check if a pending activation transaction already exists
      const existingPending = await WalletTransaction.findOne({
        where: {
          wallet_id: wallet.id,
          type: 'deposit',
          description: 'Yêu cầu kích hoạt ví GreenSteps',
          status: 'pending'
        },
        transaction: t
      });

      if (existingPending) {
        await t.rollback();
        return res.json({ success: true, message: 'Yêu cầu kích hoạt ví của bạn đang chờ quản trị viên duyệt!', pending: true });
      }

      // Create pending activation transaction
      await WalletTransaction.create({
        id: 'GD-' + Date.now(),
        wallet_id: wallet.id,
        type: 'deposit',
        description: 'Yêu cầu kích hoạt ví GreenSteps',
        amount: 200000.00,
        status: 'pending'
      }, { transaction: t });

      await t.commit();
      res.json({
        success: true,
        message: 'Đã gửi yêu cầu kích hoạt ví GreenSteps. Vui lòng chờ quản trị viên duyệt!',
        pending: true
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

exports.deposit = async (req, res, next) => {
  const { amount } = req.body;
  const userId = req.user ? req.user.id : req.body.userId;

  try {
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }

    if (!wallet.registered) {
      return res.status(400).json({ success: false, message: 'Ví của bạn chưa được kích hoạt. Vui lòng kích hoạt ví trước khi sử dụng tính năng này!' });
    }

    const isCloud = !process.stdin.isTTY;
    const status = isCloud ? 'success' : 'pending';

    const t = await sequelize.transaction();
    try {
      const lockedWallet = await Wallet.findOne({
        where: { user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (isCloud) {
        lockedWallet.balance += parseFloat(amount);
        await lockedWallet.save({ transaction: t });
      }

      const txId = 'GD-' + Date.now();
      await WalletTransaction.create({
        id: txId,
        wallet_id: lockedWallet.id,
        type: 'deposit',
        description: isCloud ? `Nạp tiền tài khoản thành công #${txId}` : `Yêu cầu nạp tiền tài khoản đang chờ phê duyệt #${txId}`,
        amount: parseFloat(amount),
        status: status
      }, { transaction: t });

      await t.commit();
      
      if (isCloud) {
        res.json({ success: true, balance: lockedWallet.balance, message: `Nạp thành công ${amount.toLocaleString('vi-VN')}đ` });
      } else {
        res.json({ success: true, pending: true, balance: lockedWallet.balance, message: `Yêu cầu nạp tiền đã được gửi. Vui lòng phê duyệt trên trang Quản trị viên.` });
      }
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

exports.requestWithdrawal = async (req, res, next) => {
  const { amount, bankName, bankAccount, accountHolder } = req.body;
  const userId = req.user ? req.user.id : req.body.userId;

  try {
    // 1. Check if user wallet has sufficient funds
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }

    if (!wallet.registered) {
      return res.status(400).json({ success: false, message: 'Ví của bạn chưa được kích hoạt. Vui lòng kích hoạt ví trước khi sử dụng tính năng này!' });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Số dư ví khả dụng không đủ để yêu cầu rút tiền!' });
    }

    // 2. Create withdrawal request (status: pending)
    const withdrawal = await WithdrawalRequest.create({
      id: 'WD-' + Date.now(),
      user_id: userId,
      amount,
      bank_name: bankName,
      bank_account: bankAccount,
      account_holder: accountHolder,
      status: 'pending'
    });

    res.json({
      success: true,
      message: 'Yêu cầu rút tiền đã được gửi và đang chờ Quản trị viên duyệt!',
      withdrawal
    });
  } catch (error) {
    next(error);
  }
};

exports.approveWithdrawal = async (req, res, next) => {
  const { id } = req.params;

  try {
    const withdrawal = await WithdrawalRequest.findByPk(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Yêu cầu rút tiền không tồn tại!' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Yêu cầu rút tiền này đã được xử lý trước đó!' });
    }

    // Admin request is already verified by checkRole(['admin']) middleware
    const approved = true;

    const t = await sequelize.transaction();
    try {
      // Lock provider wallet
      const providerWallet = await Wallet.findOne({
        where: { user_id: withdrawal.user_id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (providerWallet.balance < withdrawal.amount) {
        await t.rollback();
        withdrawal.status = 'rejected';
        await withdrawal.save();
        return res.status(400).json({ success: false, message: 'Số dư ví đối tác không còn đủ để thực hiện giao dịch!' });
      }

      // Deduct wallet balance
      providerWallet.balance -= withdrawal.amount;
      await providerWallet.save({ transaction: t });

      // Update withdrawal status to approved
      withdrawal.status = 'approved';
      await withdrawal.save({ transaction: t });

      // Record transaction history
      await WalletTransaction.create({
        id: 'GD-' + Date.now(),
        wallet_id: providerWallet.id,
        type: 'withdrawal',
        amount: -withdrawal.amount,
        description: `Rút tiền thành công về tài khoản ${withdrawal.bank_account} (${withdrawal.bank_name})`,
        status: 'success',
        reference_id: withdrawal.id
      }, { transaction: t });

      await t.commit();
      res.json({
        success: true,
        message: 'Duyệt yêu cầu rút tiền thành công! Số dư đối tác đã được cập nhật.',
        withdrawal
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
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

    const t = await sequelize.transaction();
    try {
      const lockedWallet = await Wallet.findOne({
        where: { user_id: userId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (lockedWallet.balance < amount) {
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

  try {
    const wallet = await Wallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }

    const t = await sequelize.transaction();
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
exports.approveDeposit = async (req, res, next) => {
  const { id } = req.params;
  const t = await sequelize.transaction();
  try {
    const tx = await WalletTransaction.findByPk(id, { transaction: t });
    if (!tx) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại!' });
    }
    if (tx.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Giao dịch này đã được xử lý!' });
    }

    const wallet = await Wallet.findByPk(tx.wallet_id, { transaction: t });
    if (!wallet) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
    }

    wallet.balance += tx.amount;
    await wallet.save({ transaction: t });

    tx.status = 'success';
    await tx.save({ transaction: t });

    await t.commit();
    res.json({ success: true, message: 'Đã phê duyệt nạp tiền thành công!' });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Reject deposit (Admin only)
exports.rejectDeposit = async (req, res, next) => {
  const { id } = req.params;
  try {
    const tx = await WalletTransaction.findByPk(id);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại!' });
    }
    if (tx.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Giao dịch này đã được xử lý!' });
    }

    tx.status = 'failed';
    await tx.save();

    res.json({ success: true, message: 'Đã từ chối yêu cầu nạp tiền!' });
  } catch (error) {
    next(error);
  }
};

// Reject withdrawal (Admin only)
exports.rejectWithdrawal = async (req, res, next) => {
  const { id } = req.params;
  try {
    const withdrawal = await WithdrawalRequest.findByPk(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Yêu cầu rút tiền không tồn tại!' });
    }
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Yêu cầu này đã được xử lý!' });
    }

    withdrawal.status = 'rejected';
    await withdrawal.save();

    res.json({ success: true, message: 'Đã từ chối yêu cầu rút tiền!' });
  } catch (error) {
    next(error);
  }
};

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

exports.approveWalletActivation = async (req, res, next) => {
  const { txId } = req.params;

  try {
    const tx = await WalletTransaction.findByPk(txId, {
      include: [Wallet]
    });

    if (!tx || tx.status !== 'pending' || tx.description !== 'Yêu cầu kích hoạt ví GreenSteps') {
      return res.status(404).json({ success: false, message: 'Yêu cầu kích hoạt ví không tồn tại hoặc đã được xử lý!' });
    }

    const t = await sequelize.transaction();
    try {
      const wallet = await Wallet.findOne({
        where: { id: tx.wallet_id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!wallet) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'Ví không tồn tại!' });
      }

      wallet.registered = true;
      wallet.balance += parseFloat(tx.amount || 200000.00); // 200k welcome gift
      await wallet.save({ transaction: t });

      tx.status = 'success';
      tx.description = 'Quà tặng chào mừng kích hoạt ví GreenSteps'; // Update description
      await tx.save({ transaction: t });

      await t.commit();
      res.json({ success: true, message: 'Duyệt kích hoạt ví thành công!' });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    next(error);
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
