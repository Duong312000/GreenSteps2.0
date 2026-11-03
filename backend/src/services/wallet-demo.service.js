const { createHash, randomUUID } = require('node:crypto');
const { store, Wallet, WalletTransaction, WalletLedger, BankAccount, User } = require('../models');
const { walletFor, error } = require('./wallet.service');

// Explicit opt-in only: never enabled by a hostname, NODE_ENV=development, or a frontend flag.
function enabled() { return ['development', 'test'].includes(process.env.NODE_ENV) && process.env.WALLET_DEMO_ENABLED === 'true'; }
function allowed(id) { return enabled() && (process.env.WALLET_DEMO_ALL_USERS === 'true' || (process.env.WALLET_DEMO_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(id)); }
function selfSettlementEnabled() { return enabled() && process.env.WALLET_DEMO_SELF_SETTLE === 'true'; }
function requireMode() { if (!enabled()) throw error('Ví mô phỏng chưa được bật trong môi trường này.', 403); }
function requireAccount(id) { requireMode(); if (!allowed(id)) throw error('Tài khoản này chưa được cấp quyền dùng số dư thử nghiệm.', 403); }
async function requireAdmin(actor) {
  requireMode();
  const user = await User.findByPk(actor.id);
  if (actor.role !== 'admin' || user?.role !== 'admin') throw error('Chỉ quản trị viên được xử lý giao dịch demo.', 403);
}
function amount(value) {
  if (!Number.isSafeInteger(value) || value < 10000 || value > 20000000) throw error('Số tiền thử nghiệm phải từ 10.000đ đến 20.000.000đ, không có phần thập phân.');
  return value;
}
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw error('Thông tin không hợp lệ.');
  return value.trim();
}
const hash = value => createHash('sha256').update(value).digest('hex');
function requestId(actor, action, key) {
  if (typeof key !== 'string' || key.length < 8 || key.length > 100) throw error('Thiếu Idempotency-Key hợp lệ.');
  return `DEMO-${hash(`${actor}:${action}:${key}`)}`;
}
async function replay(id, payload, transaction) {
  const existing = await WalletTransaction.findByPk(id, { transaction });
  if (existing && existing.operation_hash !== hash(JSON.stringify(payload))) throw error('Mã yêu cầu đã được dùng với nội dung khác.', 409);
  return existing;
}
async function post(wallet, tx, phase, deltaBalance, deltaHeld, transaction) {
  wallet.demo_balance = (wallet.demo_balance || 0) + deltaBalance;
  wallet.demo_held = (wallet.demo_held || 0) + deltaHeld;
  if (!Number.isSafeInteger(wallet.demo_balance) || !Number.isSafeInteger(wallet.demo_held) || wallet.demo_held < 0 || wallet.demo_balance < wallet.demo_held) throw error('Số dư thử nghiệm khả dụng không đủ.', 409);
  await wallet.save({ transaction });
  await WalletLedger.create({ id: `${tx.id}:${phase}`, wallet_id: wallet.id, transaction_id: tx.id, mode: 'demo', phase, delta_balance: deltaBalance, delta_held: deltaHeld, balance_after: wallet.demo_balance, held_after: wallet.demo_held }, { transaction });
}
async function overview(userId, role) {
  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  return { enabled: enabled(), account_enabled: allowed(userId), can_simulate: allowed(userId) && selfSettlementEnabled(), can_settle: enabled() && role === 'admin', balance: wallet?.demo_balance || 0, held: wallet?.demo_held || 0, available_balance: (wallet?.demo_balance || 0) - (wallet?.demo_held || 0), banks: allowed(userId) ? await BankAccount.findAll({ where: { user_id: userId, is_demo: true }, order: [['createdAt', 'DESC']] }) : [] };
}
async function recipient(actor, query) {
  requireAccount(actor);
  const identifier = text(query, 100);
  const byId = await User.findByPk(identifier);
  const matches = byId ? [byId] : await User.findAll({ where: { phone: identifier }, limit: 2 });
  if (matches.length > 1) throw error('Số điện thoại có nhiều tài khoản. Vui lòng dùng mã người dùng.');
  const user = matches[0];
  if (!user || user.id === actor || !allowed(user.id)) throw error('Không tìm thấy người nhận thử nghiệm hợp lệ.', 404);
  return { id: user.id, name: user.fullname || user.username };
}
async function addBank(actor, label) {
  requireAccount(actor);
  if (await BankAccount.count({ where: { user_id: actor } }) >= 5) throw error('Tối đa 5 tài khoản giả lập.');
  return BankAccount.create({ id: `DBANK-${randomUUID()}`, user_id: actor, label: text(label, 60), demo_reference: `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`, is_demo: true });
}
async function create(actor, action, body, key) {
  requireAccount(actor);
  const value = amount(body.amount);
  const payload = action === 'deposit' ? { amount: value, method: text(body.method, 30) } : { amount: value, bankId: text(body.bankId, 100) };
  if (action === 'deposit' && !['demo_bank', 'demo_card'].includes(payload.method)) throw error('Chọn hình thức nạp mô phỏng hợp lệ.');
  const id = requestId(actor, action, key);
  return store.transaction(async transaction => {
    const existing = await replay(id, payload, transaction);
    if (existing) return existing;
    const wallet = await walletFor(actor, transaction);
    let bank;
    if (action === 'withdrawal') {
      bank = await BankAccount.findOne({ where: { id: payload.bankId, user_id: actor, is_demo: true }, transaction });
      if (!bank) throw error('Tài khoản ngân hàng giả lập không hợp lệ.');
    }
    const tx = await WalletTransaction.create({ id, wallet_id: wallet.id, type: action, mode: 'demo', operation_hash: hash(JSON.stringify(payload)), amount: action === 'deposit' ? value : -value, status: 'PENDING', description: action === 'deposit' ? 'Nạp số dư thử nghiệm' : 'Rút số dư thử nghiệm', demo_method: payload.method, bank_account_id: bank?.id, bank_label: bank ? `${bank.label} · ${bank.demo_reference}` : undefined, sender_id: actor }, { transaction });
    if (action === 'withdrawal') await post(wallet, tx, 'hold', 0, value, transaction);
    return tx;
  });
}
async function transfer(actor, body, key) {
  requireAccount(actor);
  const value = amount(body.amount);
  const recipientId = text(body.recipientId, 100);
  const note = body.note == null || body.note === '' ? '' : text(body.note, 200);
  if (actor === recipientId || !allowed(recipientId)) throw error('Người nhận thử nghiệm không hợp lệ.');
  const payload = { amount: value, recipientId, note };
  const id = requestId(actor, 'transfer', key);
  return store.transaction(async transaction => {
    const existing = await replay(id, payload, transaction);
    if (existing) return existing;
    const receiverUser = await User.findByPk(recipientId, { transaction });
    const senderUser = await User.findByPk(actor, { transaction });
    if (!receiverUser || !senderUser) throw error('Tài khoản không còn tồn tại.', 404);
    const sender = await walletFor(actor, transaction), receiver = await walletFor(recipientId, transaction);
    const shared = { mode: 'demo', operation_hash: hash(JSON.stringify(payload)), status: 'SUCCESS', sender_id: actor, recipient_id: recipientId, sender_name: senderUser.fullname || senderUser.username, recipient_name: receiverUser.fullname || receiverUser.username, note, reference_id: id, completed_at: new Date() };
    const outgoing = await WalletTransaction.create({ ...shared, id, wallet_id: sender.id, type: 'transfer_out', amount: -value, description: 'Chuyển tiền thử nghiệm' }, { transaction });
    const incoming = await WalletTransaction.create({ ...shared, id: `${id}:in`, wallet_id: receiver.id, type: 'transfer_in', amount: value, description: 'Nhận tiền thử nghiệm' }, { transaction });
    await post(sender, outgoing, 'transfer', -value, 0, transaction);
    await post(receiver, incoming, 'transfer', value, 0, transaction);
    return outgoing;
  });
}
async function settle(actor, id, status, ownerCancel = false, ownerSandbox = false) {
  if (ownerCancel) { requireAccount(actor.id); status = 'CANCELLED'; }
  else if (ownerSandbox) {
    requireAccount(actor.id);
    if (!selfSettlementEnabled()) throw error('Môi trường này chưa cho phép tự xác nhận sandbox.', 403);
    if (!['SUCCESS', 'FAILED'].includes(status)) throw error('Kết quả mô phỏng không hợp lệ.');
  } else await requireAdmin(actor);
  if (!['SUCCESS', 'FAILED', 'CANCELLED'].includes(status)) throw error('Trạng thái xử lý không hợp lệ.');
  return store.transaction(async transaction => {
    const tx = await WalletTransaction.findByPk(id, { transaction });
    if (!tx || tx.mode !== 'demo' || !['deposit', 'withdrawal'].includes(tx.type)) throw error('Không tìm thấy yêu cầu demo.', 404);
    const wallet = await Wallet.findByPk(tx.wallet_id, { transaction });
    if ((ownerCancel || ownerSandbox) && wallet.user_id !== actor.id) throw error('Không tìm thấy yêu cầu demo.', 404);
    if (tx.status === status) return tx;
    if (tx.status !== 'PENDING') throw error('Giao dịch đã kết thúc.', 409);
    const value = Math.abs(tx.amount);
    tx.status = status; tx.verified_by = actor.id; tx.completed_at = new Date();
    await tx.save({ transaction });
    await post(wallet, tx, 'settle', status === 'SUCCESS' ? tx.amount : 0, tx.type === 'withdrawal' ? -value : 0, transaction);
    return tx;
  });
}
async function detail(actor, id) {
  requireMode();
  const tx = await WalletTransaction.findByPk(id);
  const wallet = tx?.mode === 'demo' && await Wallet.findByPk(tx.wallet_id);
  if (!wallet || wallet.user_id !== actor.id) throw error('Không tìm thấy giao dịch.', 404);
  const ledger = await WalletLedger.findAll({ where: { transaction_id: tx.id }, order: [['createdAt', 'ASC']] });
  return { transaction: tx, ledger };
}
async function history(actor, page = 0) {
  requireAccount(actor);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw error('Trang không hợp lệ.');
  const wallet = await walletFor(actor);
  const where = { wallet_id: wallet.id, mode: 'demo' };
  return { transactions: await WalletTransaction.findAll({ where, order: [['createdAt', 'DESC']], offset: page * 20, limit: 20 }), total: await WalletTransaction.count({ where }), page };
}
async function queue(actor) { await requireAdmin(actor); return WalletTransaction.findAll({ where: { mode: 'demo', status: 'PENDING' }, order: [['createdAt', 'ASC']], limit: 100 }); }
module.exports = { enabled, allowed, overview, recipient, addBank, create, transfer, settle, detail, history, queue };
