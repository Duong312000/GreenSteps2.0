const { PartnerCampaign, GreenService, store } = require('../models');
function unavailable(message = 'Flash Sale đã hết hạn, hết suất hoặc thay đổi. Vui lòng tải lại ưu đãi.') {
  return Object.assign(new Error(message), { statusCode: 409 });
}
function discountFor(row, unitPrice, units) {
  const saleUnit = row.discount_type === 'fixed' ? Math.max(0, unitPrice - row.discount_value)
    : Math.max(0, Math.round(unitPrice * (100 - row.discount_value) / 100));
  return (unitPrice - saleUnit) * units;
}
async function flashSaleFor(service, { campaignId, unitPrice = Number(service.cost), units = 1, stockUnits = 1, preview = false } = {}) {
  const now = new Date();
  const rows = await PartnerCampaign.collection.find({ type: 'flash_sale', service_id: service.id,
    vender_id: service.vender_id, status: 'active', archived_at: null,
    start_at: { $lte: now }, end_at: { $gt: now }, discount_value: { $gt: 0 },
    ...(campaignId ? { id: campaignId } : {}),
  }, store.options()).toArray();
  const eligible = service.status === 'active' ? rows.filter(row => (row.usage_limit || 0) - (row.used_count || 0) >= stockUnits
    && (preview || unitPrice * units >= (row.min_order || 0))) : [];
  eligible.sort((a, b) => discountFor(b, unitPrice, units) - discountFor(a, unitPrice, units) || +new Date(a.end_at) - +new Date(b.end_at));
  const row = eligible[0];
  if (!row) {
    if (campaignId) throw unavailable('Flash Sale không còn áp dụng hoặc đơn chưa đạt điều kiện về số lượng, giá trị tối thiểu.');
    return null;
  }
  return { id: row.id, name: row.name, service_id: service.id, discount_type: row.discount_type, discount_value: row.discount_value,
    start_at: row.start_at, end_at: row.end_at, min_order: row.min_order || 0,
    remaining: row.usage_limit - (row.used_count || 0), stockUnits,
    unit_price: unitPrice, sale_price: unitPrice - discountFor(row, unitPrice, 1),
    discount: discountFor(row, unitPrice, units) };
}

async function consumeFlashSale(sale) {
  if (!sale) return;
  const service = await GreenService.findByPk(sale.service_id);
  if (!service || service.status !== 'active') throw unavailable();
  const now = new Date();
  let result;
  try { result = await PartnerCampaign.collection.updateOne({ id: sale.id, type: 'flash_sale', service_id: sale.service_id,
    vender_id: service.vender_id, status: 'active', archived_at: null,
    start_at: { $lte: now }, end_at: { $gt: now },
    discount_type: sale.discount_type, discount_value: sale.discount_value,
    $expr: { $gte: [{ $subtract: ['$usage_limit', { $ifNull: ['$used_count', 0] }] }, sale.stockUnits] },
  }, { $inc: { used_count: sale.stockUnits, bookings: 1, _rev: 1 }, $set: { updatedAt: now } }, store.options()); }
  catch (error) { if (error.code === 112 || error.hasErrorLabel?.('TransientTransactionError')) throw unavailable(); throw error; }
  if (!result.matchedCount) throw unavailable();
}
module.exports = { flashSaleFor, consumeFlashSale, discountFor };
