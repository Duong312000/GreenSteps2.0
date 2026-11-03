const { randomUUID, createHash } = require('node:crypto');
const { store, Wallet, WalletTransaction, WithdrawalRequest, User, Voucher } = require('../models');
const { walletFor, syncTierHistory, error, points } = require('../services/wallet.service');
const demo = require('../services/wallet-demo.service');
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
const atomic = fn => store.transaction(fn);
async function moneyTransaction(req, transaction) {
  let tx = await WalletTransaction.findByPk(req.params.id, { transaction });
  // Older pending withdrawal records did not have a matching ledger entry.
  if (!tx && req.path.includes('/withdrawals/')) {
    const request = await WithdrawalRequest.findByPk(req.params.id, { transaction });
    if (request?.status === 'pending') {
      const wallet = await walletFor(request.user_id, transaction);
      tx = await WalletTransaction.create({ id: request.id, wallet_id: wallet.id, type: 'withdrawal', amount: -request.amount, description: 'Yêu cầu rút tiền chờ xác minh', status: 'pending', reference_id: request.id }, { transaction });
    }
  }
  return tx;
}
const tiers = [{ name: 'Explorer', threshold: 0 }, { name: 'Voyager', threshold: 5000 }, { name: 'Guardian', threshold: 15000 }];
exports.overview = wrap(async (req, res) => {
  const wallet = await syncTierHistory(await walletFor(req.user.id));
  const transactions = await WalletTransaction.findAll({ where: { wallet_id: wallet.id }, order: [['createdAt', 'DESC']], limit: 100 });
  const tier = [...tiers].reverse().find(t => (wallet.tier_points || 0) >= t.threshold);
  const vouchers = await Voucher.findAll({ where: { user_id: req.user.id, status: 'active' } });
  res.json({ success: true, demo: await demo.overview(req.user.id, req.user.role), wallet: { ...wallet.toJSON(), available_balance: wallet.balance - (wallet.reserved_balance || 0) }, transactions, vouchers, membership: { ...tier, points: wallet.tier_points || 0, next: tiers[tiers.indexOf(tier) + 1] || null }, policy: { earnPerVnd: 10000, pointValueVnd: 1, redeemMinimum: 1000 } });
});
exports.activate = wrap(async (req, res) => { const wallet = await walletFor(req.user.id); wallet.registered = true; await wallet.save(); res.json({ success: true, wallet, balance: wallet.balance }); });
exports.request = wrap(async (req, res) => {
  const amount = req.body.amount;
  if (!Number.isSafeInteger(amount) || amount < 50000 || amount > 20000000) throw error('Số tiền từ 50.000đ đến 20.000.000đ.');
  const withdrawal = req.path === '/withdraw';
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || key.length < 8 || key.length > 100) throw error('Thiếu mã yêu cầu giao dịch.');
  const requestId = createHash('sha256').update(`${req.user.id}:${req.path}:${key}`).digest('hex');
  await atomic(async t => {
    if (await WalletTransaction.findByPk(requestId, { transaction: t })) return;
    const wallet = await walletFor(req.user.id, t);
    if (withdrawal) {
      for (const key of ['bankName', 'bankAccount', 'accountHolder']) if (typeof req.body[key] !== 'string' || !req.body[key].trim() || req.body[key].length > 120) throw error('Vui lòng nhập đầy đủ tài khoản ngân hàng.');
      const reserved = await WithdrawalRequest.sum('amount', { where: { user_id: req.user.id, status: 'pending' }, transaction: t });
      if (wallet.balance - reserved < amount) throw error('Số dư khả dụng không đủ.');
      wallet.reserved_balance = (wallet.reserved_balance || 0) + amount;
      await wallet.save({ transaction: t });
      const id = requestId;
      await WithdrawalRequest.create({ id, user_id: req.user.id, amount, bank_name: req.body.bankName, bank_account: req.body.bankAccount, account_holder: req.body.accountHolder }, { transaction: t });
      await WalletTransaction.create({ id, wallet_id: wallet.id, type: 'withdrawal', amount: -amount, reserved_amount: amount, description: 'Yêu cầu rút tiền chờ xác minh', status: 'pending', reference_id: id }, { transaction: t });
    } else await WalletTransaction.create({ id: requestId, wallet_id: wallet.id, type: 'deposit', amount, description: 'Nạp tiền chờ đối soát ngân hàng', status: 'pending' }, { transaction: t });
  });
  res.status(202).json({ success: true, pending: true, message: 'Đã ghi nhận yêu cầu. Số dư chỉ thay đổi sau khi đối soát thanh toán.' });
});
exports.verify = wrap(async (req, res) => {
  const reference = req.body.verificationReference;
  if (typeof reference !== 'string' || reference.trim().length < 8 || reference.length > 150) throw error('Cần mã đối soát thực tế từ ngân hàng (ít nhất 8 ký tự).');
  await atomic(async t => {
    const withdrawal = req.path.includes('/withdrawals/');
    const tx = await moneyTransaction(req, t);
    if (!tx || tx.type !== (withdrawal ? 'withdrawal' : 'deposit')) throw error('Không tìm thấy giao dịch.', 404);
    if (tx.status !== 'pending') throw error('Giao dịch đã được xử lý.', 409);
    const wallet = await Wallet.findByPk(tx.wallet_id, { transaction: t });
    if (wallet.balance + tx.amount < 0) throw error('Số dư không đủ.');
    tx.status = 'success'; tx.verification_reference = reference.trim(); tx.verified_by = req.user.id;
    wallet.balance += tx.amount;
    if (withdrawal) wallet.reserved_balance = Math.max(0, (wallet.reserved_balance || 0) - (tx.reserved_amount || 0));
    await tx.save({ transaction: t }); await wallet.save({ transaction: t });
    if (withdrawal) { const request = await WithdrawalRequest.findByPk(tx.reference_id, { transaction: t }); request.status = 'approved'; await request.save({ transaction: t }); }
  });
  res.json({ success: true });
});
exports.redeem = wrap(async (req, res) => {
  const amount = points(req.body.points);
  if (amount < 1000) throw error('Đổi tối thiểu 1.000 điểm.');
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || key.length < 8 || key.length > 100) throw error('Thiếu mã yêu cầu giao dịch.');
  const id = createHash('sha256').update(`${req.user.id}:redeem:${key}`).digest('hex');
  await atomic(async t => {
    if (await WalletTransaction.findByPk(id, { transaction: t })) return;
    const wallet = await walletFor(req.user.id, t);
    if (wallet.green_points < amount) throw error('Không đủ điểm xanh.');
    wallet.green_points -= amount; await wallet.save({ transaction: t });
    await Voucher.create({ id, code: `GREEN-${id.slice(0, 16).toUpperCase()}`, user_id: req.user.id, discount_amount: amount, discount_percent: 0 }, { transaction: t });
    await WalletTransaction.create({ id, wallet_id: wallet.id, type: 'points_redeemed', amount: -amount, description: 'Đổi điểm thành ưu đãi thanh toán', reference_id: id }, { transaction: t });
  });
  const wallet = await walletFor(req.user.id);
  const code = `GREEN-${id.slice(0, 16).toUpperCase()}`;
  res.json({ success: true, code, voucher: { code, discount_amount: amount, status: 'active' }, remainingPoints: wallet.green_points, message: `Đã đổi ưu đãi ${code}.` });
});
exports.transfer = wrap(async (req, res) => {
  const amount = points(req.body.points);
  const recipient = await User.findOne({ where: { email: String(req.body.email || '').trim().toLowerCase() } });
  if (!recipient || recipient.id === req.user.id) throw error('Người nhận không hợp lệ.');
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || key.length < 8 || key.length > 100) throw error('Thiếu mã yêu cầu giao dịch.');
  const id = createHash('sha256').update(`${req.user.id}:transfer:${key}`).digest('hex');
  await atomic(async t => {
    if (await WalletTransaction.findByPk(id, { transaction: t })) return;
    const sender = await walletFor(req.user.id, t), receiver = await walletFor(recipient.id, t);
    if (sender.green_points < amount) throw error('Không đủ điểm xanh.');
    sender.green_points -= amount; receiver.green_points = (receiver.green_points || 0) + amount;
    await sender.save({ transaction: t }); await receiver.save({ transaction: t });
    await WalletTransaction.create({ id, wallet_id: sender.id, type: 'points_sent', amount: -amount, description: 'Chuyển điểm xanh' }, { transaction: t });
    await WalletTransaction.create({ id: `${id}:received`, wallet_id: receiver.id, type: 'points_received', amount, description: 'Nhận điểm xanh' }, { transaction: t });
  });
  res.json({ success: true });
});
// Store bank-account references only. Card PAN/CVV must go through a PCI payment provider.
exports.addMethod = wrap(async (req, res) => {
  const { bankName, bankAccount, accountHolder } = req.body;
  if (![bankName, bankAccount, accountHolder].every(v => typeof v === 'string' && v.trim().length > 1 && v.length <= 120) || !/^\d{6,30}$/.test(bankAccount)) throw error('Thông tin ngân hàng không hợp lệ.');
  await atomic(async t => { const w = await walletFor(req.user.id, t); if ((w.payment_methods || []).length >= 5) throw error('Tối đa 5 phương thức.'); w.payment_methods = [...(w.payment_methods || []), { id: randomUUID(), bankName, last4: bankAccount.slice(-4), accountHolder, kind: 'bank', verified: false }]; await w.save({ transaction: t }); });
  res.status(201).json({ success: true });
});
exports.removeMethod = wrap(async (req, res) => { await atomic(async t => { const w = await walletFor(req.user.id, t); w.payment_methods = (w.payment_methods || []).filter(m => m.id !== req.params.id); await w.save({ transaction: t }); }); res.json({ success: true }); });
exports.reject = wrap(async (req, res) => {
  await atomic(async t => {
    const tx = await moneyTransaction(req, t);
    const withdrawal = req.path.includes('/withdrawals/');
    if (!tx || tx.type !== (withdrawal ? 'withdrawal' : 'deposit')) throw error('Không tìm thấy giao dịch.', 404);
    if (tx.status !== 'pending') throw error('Giao dịch đã được xử lý.', 409);
    tx.status = 'failed'; tx.verified_by = req.user.id; await tx.save({ transaction: t });
    if (withdrawal) { const request = await WithdrawalRequest.findByPk(tx.reference_id, { transaction: t }); request.status = 'rejected'; await request.save({ transaction: t }); const wallet = await Wallet.findByPk(tx.wallet_id, { transaction: t }); wallet.reserved_balance = Math.max(0, (wallet.reserved_balance || 0) - (tx.reserved_amount || 0)); await wallet.save({ transaction: t }); }
  });
  res.json({ success: true });
});
