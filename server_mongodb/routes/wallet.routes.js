const express = require('express');
const router = express.Router();
const { User, WalletTransaction } = require('../models');

// 1. Lấy thông tin ví
const getWalletHandler = async (req, res) => {
  try {
    const userId = req.params.userId || (req.session && req.session.user && req.session.user.id) || req.query.userId;
    if (!userId || userId.length !== 24) {
      return res.json({ balance: 5000000, green_points: 150, registered: true }); // Fallback demo
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    return res.json({
      balance: user.wallet.balance || 0,
      green_points: user.wallet.green_points || 0,
      registered: user.wallet.registered || false
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tải thông tin ví.' });
  }
};

router.get('/', getWalletHandler);
router.get('/:userId', getWalletHandler);

// 2. Kích hoạt ví GreenSteps
router.post('/activate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'Thiếu userId.' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    user.wallet.registered = true;
    user.wallet.balance = (user.wallet.balance || 0) + 1000000; // Tặng 1.000.000 VND khởi tạo
    await user.save();

    const tx = new WalletTransaction({
      transaction_code: 'GD-' + Date.now(),
      user_id: user._id,
      type: 'deposit',
      amount: 1000000,
      description: 'Thưởng kích hoạt Ví GreenSteps thành công',
      status: 'success'
    });
    await tx.save();

    return res.json({ success: true, message: 'Kích hoạt ví thành công!', wallet: user.wallet });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi kích hoạt ví.' });
  }
});

// 3. Nạp tiền vào ví
router.post('/deposit', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const numAmount = Number(amount);
    if (!userId || !numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền nạp không hợp lệ.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    user.wallet.balance = (user.wallet.balance || 0) + numAmount;
    await user.save();

    const tx = new WalletTransaction({
      transaction_code: 'GD-' + Date.now(),
      user_id: user._id,
      type: 'deposit',
      amount: numAmount,
      description: `Nạp tiền vào ví GreenSteps qua ngân hàng`,
      status: 'success'
    });
    await tx.save();

    return res.json({ success: true, message: 'Nạp tiền thành công!', balance: user.wallet.balance });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi nạp tiền vào ví.' });
  }
});

// 4. Yêu cầu rút tiền về tài khoản ngân hàng (FR-ADM-07)
router.post('/withdraw', async (req, res) => {
  try {
    const { userId, amount, bank_name, account_number, account_holder } = req.body;
    const numAmount = Number(amount);

    if (!userId || !numAmount || numAmount < 50000) {
      return res.status(400).json({ success: false, message: 'Số tiền rút tối thiểu là 50.000 VND.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

    if ((user.wallet.balance || 0) < numAmount) {
      return res.status(400).json({ success: false, message: 'Số dư ví không đủ để rút.' });
    }

    // Tạm giữ số dư
    user.wallet.balance -= numAmount;
    await user.save();

    const tx = new WalletTransaction({
      transaction_code: 'WD-' + Date.now(),
      user_id: user._id,
      type: 'withdrawal',
      amount: numAmount,
      description: `Yêu cầu rút ${numAmount.toLocaleString('vi-VN')} VND về ngân hàng ${bank_name || ''}`,
      status: 'pending',
      bank_info: {
        bank_name: bank_name || 'Vietcombank',
        account_number: account_number || '',
        account_holder: account_holder || user.profile.fullname
      }
    });
    await tx.save();

    return res.json({ success: true, message: 'Yêu cầu rút tiền đã được gửi tới quản trị viên!', tx });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tạo yêu cầu rút tiền.' });
  }
});

// 5. Lịch sử giao dịch ví
const getTransactionsHandler = async (req, res) => {
  try {
    const userId = req.params.userId || (req.session && req.session.user && req.session.user.id) || req.query.userId;
    const filter = {};
    if (userId && userId.length === 24) {
      filter.user_id = userId;
    }

    const transactions = await WalletTransaction.find(filter).sort({ created_at: -1 }).limit(50);
    return res.json(transactions);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tải lịch sử giao dịch.' });
  }
};

router.get('/transactions', getTransactionsHandler);
router.get('/transactions/:userId', getTransactionsHandler);

module.exports = router;
