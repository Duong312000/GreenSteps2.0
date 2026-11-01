const { Op } = require('../db/mongo-store');
const {
  BookingAddon,
  GreenService,
  Schedule,
  ScheduleSample,
  ScheduleActivity
} = require('../models');
const pricingConfig = require('../config/booking-pricing.config');
const defaultAddons = require('../config/booking-addons.seed');

function invalidPricing(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function integerVnd(value, label) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw invalidPricing(`${label} phải là số nguyên VND hợp lệ.`);
  }
  return amount;
}

async function ensureDefaultBookingAddons() {
  for (const addon of defaultAddons) {
    await BookingAddon.findOrCreate({ where: { id: addon.id }, defaults: addon });
  }
}

async function calculatePricing({ type, targetId, guestCount, addonIds = [], paymentMethod = 'bank_transfer' }) {
  const guests = Number(guestCount);
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 100) {
    throw invalidPricing('Số khách phải là số nguyên từ 1 đến 100.');
  }
  if (!Array.isArray(addonIds) || addonIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw invalidPricing('Danh sách dịch vụ thêm không hợp lệ.');
  }

  const selectedIds = [...new Set(addonIds)];
  let unitTourPrice = 0;
  let tourSubtotal;
  if (type === 'service') {
    const service = await GreenService.findByPk(targetId);
    if (!service) throw Object.assign(new Error('Dịch vụ không tồn tại.'), { statusCode: 404 });
    unitTourPrice = integerVnd(service.cost, 'Giá dịch vụ');
  } else if (type === 'tour' || type === 'itinerary') {
    const schedule = await Schedule.findByPk(targetId);
    if (!schedule) throw Object.assign(new Error('Tour hoặc lịch trình không tồn tại.'), { statusCode: 404 });
    const sample = await ScheduleSample.findByPk(targetId);
    if (sample) {
      unitTourPrice = integerVnd(sample.cost, 'Giá tour');
    } else {
      const activities = await ScheduleActivity.findAll({ where: { schedule_id: targetId } });
      let perGuest = 0;
      let shared = 0;
      for (const activity of activities) {
        const amount = integerVnd(activity.cost || 0, 'Giá hoạt động');
        if (activity.is_shared || activity.type === 'lodging') shared += amount;
        else perGuest += amount;
      }
      unitTourPrice = null;
      tourSubtotal = (perGuest * guests) + shared;
    }
  } else {
    throw invalidPricing('Loại đặt chỗ không hợp lệ.');
  }

  const selectedAddons = selectedIds.length
    ? await BookingAddon.findAll({ where: { id: { [Op.in]: selectedIds }, active: true } })
    : [];
  if (selectedAddons.length !== selectedIds.length) {
    throw invalidPricing('Một hoặc nhiều dịch vụ thêm không còn được cung cấp. Hãy tải lại báo giá.');
  }
  const addons = selectedAddons.map(addon => ({
    id: addon.id,
    name: addon.name,
    unitPrice: integerVnd(addon.unit_price, `Giá ${addon.name}`),
    quantity: 1,
    total: integerVnd(addon.unit_price, `Giá ${addon.name}`)
  }));
  const addonsTotal = addons.reduce((sum, addon) => sum + addon.total, 0);
  const tourPriceSubtotal = tourSubtotal ?? (integerVnd(unitTourPrice, 'Giá tour') * guests);
  const subtotal = tourPriceSubtotal + addonsTotal;
  const discount = Number((BigInt(tourPriceSubtotal) * BigInt(pricingConfig.DISCOUNT_PERCENT)) / 100n);
  const serviceFee = pricingConfig.SERVICE_FEE_VND * (pricingConfig.SERVICE_FEE_PER_GUEST ? guests : 1);
  const total = subtotal - discount + serviceFee;
  const deposit = Number((BigInt(total) * BigInt(pricingConfig.DEPOSIT_PERCENT) + 99n) / 100n);
  const remaining = total - deposit;
  const amountDueNow = pricingConfig.COLLECT_DEPOSIT_FOR.includes(paymentMethod) ? deposit : total;

  for (const [label, amount] of Object.entries({ subtotal, discount, serviceFee, addonsTotal, total, deposit, remaining, amountDueNow })) {
    integerVnd(amount, label);
  }

  return {
    currency: 'VND',
    policyVersion: 1,
    guestCount: guests,
    unitTourPrice: unitTourPrice ?? null,
    tourSubtotal: tourPriceSubtotal,
    addons,
    addonsTotal,
    subtotal,
    discountPercent: pricingConfig.DISCOUNT_PERCENT,
    discount,
    serviceFee,
    total,
    depositPercent: pricingConfig.DEPOSIT_PERCENT,
    deposit,
    remaining,
    amountDueNow
  };
}

module.exports = { calculatePricing, ensureDefaultBookingAddons };
