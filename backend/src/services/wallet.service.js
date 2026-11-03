const { randomUUID } = require('node:crypto');
const { store, Wallet, WalletTransaction, User, CommunityChallengeEntry, ServiceBooking, TourBooking } = require('../models');
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const points = value => { if (!Number.isSafeInteger(value) || value <= 0) throw error('Điểm phải là số nguyên dương.'); return value; };
async function walletFor(userId, transaction) {
  if (!await User.findByPk(userId, { transaction })) throw error('Tài khoản không tồn tại.', 404);
  return (await Wallet.findOrCreate({ where: { user_id: userId }, defaults: { id: `EW-${randomUUID()}`, registered: true }, transaction }))[0];
}
async function earn(booking, transaction) {
  if (booking.status !== 'completed' || !booking.user_id) return;
  const id = `points:booking:${booking.id}`;
  if (await WalletTransaction.findByPk(id, { transaction })) return;
  const amount = Math.floor(Number(booking.value) / 10000);
  if (amount <= 0) return;
  const wallet = await walletFor(booking.user_id, transaction);
  wallet.green_points = (wallet.green_points || 0) + amount;
  wallet.tier_points = (wallet.tier_points || 0) + amount;
  await wallet.save({ transaction });
  await WalletTransaction.create({ id, wallet_id: wallet.id, type: 'points_earned', amount, description: `Điểm xanh từ booking #${booking.id}`, reference_id: booking.id }, { transaction });
}
async function earnChallenge(entry, transaction) {
  const id = `points:challenge:${entry.id}`;
  if (await WalletTransaction.findByPk(id, { transaction })) return;
  const wallet = await walletFor(entry.user_id, transaction);
  wallet.green_points = (wallet.green_points || 0) + entry.points;
  wallet.tier_points = (wallet.tier_points || 0) + entry.points;
  await wallet.save({ transaction });
  await WalletTransaction.create({ id, wallet_id: wallet.id, type: 'points_earned', amount: entry.points, description: 'Điểm xanh từ thử thách cộng đồng', reference_id: entry.id }, { transaction });
}

async function syncTierHistory(wallet) {
  if (wallet.tier_history_synced) return wallet;
  return store.transaction(async transaction => {
    const current = await Wallet.findByPk(wallet.id, { transaction });
    if (current.tier_history_synced) return current;
    const options = { where: { user_id: current.user_id }, transaction };
    const entries = await CommunityChallengeEntry.findAll(options);
    const bookings = [
      ...await ServiceBooking.findAll({ ...options, where: { ...options.where, status: 'completed' } }),
      ...await TourBooking.findAll({ ...options, where: { ...options.where, status: 'completed' } })
    ];
    let restored = 0;
    for (const entry of entries) {
      const id = `points:challenge:${entry.id}`;
      if (entry.points <= 0 || await WalletTransaction.findByPk(id, { transaction })) continue;
      restored += entry.points;
      await WalletTransaction.create({ id, wallet_id: current.id, type: 'points_tier_adjustment', amount: entry.points, description: 'Khôi phục điểm xét hạng từ thử thách đã hoàn thành', reference_id: entry.id }, { transaction });
    }
    for (const booking of bookings) {
      const id = `points:tier:booking:${booking.id}`;
      const amount = Math.floor(Number(booking.value) / 10000);
      if (amount <= 0 || await WalletTransaction.findByPk(`points:booking:${booking.id}`, { transaction }) || await WalletTransaction.findByPk(id, { transaction })) continue;
      restored += amount;
      await WalletTransaction.create({ id, wallet_id: current.id, type: 'points_tier_adjustment', amount, description: `Khôi phục điểm xét hạng từ booking #${booking.id}`, reference_id: booking.id }, { transaction });
    }
    current.tier_points = (current.tier_points || 0) + restored;
    current.tier_history_synced = true;
    await current.save({ transaction });
    return current;
  });
}
module.exports = { walletFor, earn, earnChallenge, syncTierHistory, error, points };
