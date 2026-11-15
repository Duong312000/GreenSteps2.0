const { createHash } = require('node:crypto');
const { store, PartnerCampaign, SavedPromotion, GreenService, Voucher } = require('../models');
function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }
function remainingClaims(row) { return Math.max(0, (row.usage_limit || 0) - Math.max(row.used_count || 0, row.claimed_count || 0)); }
function assertLive(row) {
  const now = Date.now();
  if (!row || row.archived_at || row.status !== 'active' || +new Date(row.start_at) > now || +new Date(row.end_at) <= now) fail('Mã giảm giá chưa hoạt động, đã tạm dừng hoặc hết hạn.');
}
const claimId = (userId, campaignId) => 'SP-' + createHash('sha256').update(JSON.stringify([userId, campaignId])).digest('hex');

async function claimPromotion(userId, campaignId) {
  const id = claimId(userId, campaignId);
  // These retries contain only transactional database work, with a deterministic claim ID.
  for (let attempt = 0; ; attempt++) {
    try {
      return await store.transaction(async () => {
        const options = store.options();
        const existing = await SavedPromotion.collection.findOne({ id, user_id: userId }, options);
        if (existing) return { already_saved: true, claim: existing };
        const row = await PartnerCampaign.collection.findOne({ id: campaignId, type: 'voucher' }, options);
        assertLive(row);
        if (remainingClaims(row) < 1) fail('Mã giảm giá đã hết lượt nhận.', 409);
        const query = { status: 'active', vender_id: row.vender_id, ...(row.service_id ? { id: row.service_id } : {}) };
        if (!await GreenService.collection.findOne(query, options)) fail('Dịch vụ áp dụng không còn hoạt động.');
        await PartnerCampaign.collection.updateOne({ _id: row._id }, {
          $set: { claimed_count: Math.max(row.claimed_count || 0, row.used_count || 0) + 1, updatedAt: new Date() }, $inc: { _rev: 1 },
        }, options);
        const claim = await SavedPromotion.create({ id, user_id: userId, campaign_id: campaignId, status: 'active',
          snapshot: { name: row.name, code: row.code, discount_type: row.discount_type, discount_value: row.discount_value,
            min_order: row.min_order, start_at: row.start_at, end_at: row.end_at, service_id: row.service_id, vender_id: row.vender_id } });
        return { already_saved: false, claim: claim.toJSON() };
      });
    } catch (error) {
      if (attempt < 3 && (error.hasErrorLabel?.('TransientTransactionError') || error.code === 11000)) continue;
      throw error;
    }
  }
}

async function myPromotions(userId) {
  const claims = await SavedPromotion.collection.find({ user_id: userId }).sort({ createdAt: -1 }).toArray();
  const rows = await PartnerCampaign.collection.find({ id: { $in: claims.map(item => item.campaign_id) } }).toArray();
  const services = await GreenService.collection.find({ vender_id: { $in: rows.map(row => row.vender_id).filter(Boolean) }, status: 'active' }).toArray();
  const saved = claims.map(claim => {
    const current = rows.find(row => row.id === claim.campaign_id);
    const row = current || claim.snapshot || {};
    const expired = +new Date(row.end_at) <= Date.now();
    const linked = services.filter(service => row.service_id ? service.id === row.service_id : service.vender_id === row.vender_id);
    const status = claim.status === 'used' ? 'used' : expired ? 'expired'
      : !current || current.archived_at || current.status !== 'active' || !linked.length ? 'unavailable'
      : +new Date(row.start_at) > Date.now() ? 'scheduled' : 'active';
    return { id: claim.id, campaign_id: claim.campaign_id, ...claim.snapshot,
      name: row.name, code: row.code, discount_type: row.discount_type, discount_value: row.discount_value,
      min_order: row.min_order, start_at: row.start_at, end_at: row.end_at, status,
      quantity: status === 'used' ? 0 : 1, remaining: status === 'active' ? 1 : 0,
      available_to_claim: remainingClaims(row), usage_limit: row.usage_limit,
      services: linked.map(service => ({ id: service.id, name: service.name_service, type: service.type })),
      scope: row.service_id ? linked[0]?.name_service || 'Dịch vụ đã chọn' : 'Tất cả dịch vụ của nhà cung cấp', createdAt: claim.createdAt };
  });
  const legacy = await Voucher.findAll({ where: { user_id: userId }, order: [['createdAt', 'DESC']] });
  return [...saved, ...legacy.map(item => ({ id: item.id, code: item.code, name: 'Ưu đãi đổi điểm xanh',
    discount_type: item.discount_amount ? 'fixed' : 'percent', discount_value: item.discount_amount || item.discount_percent,
    status: item.status, quantity: item.status === 'used' ? 0 : 1, remaining: item.status === 'active' ? 1 : 0,
    min_order: 0, end_at: null, scope: 'Tour và dịch vụ GreenSteps', services: [], createdAt: item.createdAt }))];
}

async function savedDiscount(userId, code, { type, targetId, total, orderTotal = total }) {
  if (typeof code !== 'string' || !code.trim()) fail('Mã giảm giá không hợp lệ.');
  const options = store.options();
  const row = await PartnerCampaign.collection.findOne({ code, type: 'voucher' }, options);
  if (!row) return null;
  const claim = await SavedPromotion.collection.findOne({ id: claimId(userId, row.id), user_id: userId }, options);
  if (!claim || claim.status !== 'active') fail('Bạn chưa nhận mã này hoặc mã đã được sử dụng.');
  assertLive(row);
  if (type !== 'service') fail('Mã này chỉ áp dụng cho dịch vụ của nhà cung cấp.');
  const service = await GreenService.collection.findOne({ id: targetId, status: 'active' }, options);
  if (!service || service.vender_id !== row.vender_id || (row.service_id && row.service_id !== targetId)) fail('Mã giảm giá không áp dụng cho dịch vụ này.');
  if (orderTotal < (row.min_order || 0)) fail(`Đơn đặt phải đạt tối thiểu ${new Intl.NumberFormat('vi-VN').format(row.min_order)}đ để dùng mã.`);
  const discount = Math.min(total, row.discount_type === 'fixed' ? row.discount_value : Math.floor(total * row.discount_value / 100));
  return { claim, campaign: row, discount };
}

async function consumeSavedPromotion(userId, code, context) {
  const result = await savedDiscount(userId, code, context);
  if (!result) return false;
  const options = store.options();
  const updated = await SavedPromotion.collection.updateOne({ id: result.claim.id, user_id: userId, status: 'active' }, {
    $set: { status: 'used', used_at: new Date(), updatedAt: new Date() }, $inc: { _rev: 1 },
  }, options);
  if (!updated.matchedCount) fail('Mã giảm giá đã được sử dụng.', 409);
  await PartnerCampaign.collection.updateOne({ id: result.campaign.id }, { $inc: { used_count: 1, _rev: 1 } }, options);
  return true;
}
module.exports = { claimPromotion, myPromotions, savedDiscount, consumeSavedPromotion, remainingClaims };
