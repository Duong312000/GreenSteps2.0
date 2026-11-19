const models = require('../models');
const { Op } = require('../db/mongo-store');
const defaultAddons = require('../config/booking-addons.seed');
const { BookingAddon, BookingSetting, GreenService, Schedule, ScheduleSample, ScheduleActivity } = models;
const { lodgingPrice } = require('./lodging-pricing.service');

const DEFAULT_SETTINGS = Object.freeze({
  id: 'booking_pricing', discount_percent: 0, service_fee_vnd: 0,
  service_fee_per_guest: false, deposit_percent: 30, collect_deposit_for: Object.freeze([]), version: 1
});

function invalidPricing(message) { return Object.assign(new Error(message), { statusCode: 400 }); }
function integerVnd(value, label) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw invalidPricing(label + ' ph?i l? s? nguy?n VND h?p l?.');
  return amount;
}

function createBookingPricingService({ BookingSettingModel = BookingSetting } = {}) {
  async function getBookingPricingSettings(options = {}) {
    const stored = await BookingSettingModel.findByPk(DEFAULT_SETTINGS.id, options);
    if (!stored) return { ...DEFAULT_SETTINGS, collect_deposit_for: [...DEFAULT_SETTINGS.collect_deposit_for] };
    const data = typeof stored.toJSON === 'function' ? stored.toJSON() : stored;
    return { ...DEFAULT_SETTINGS, ...data };
  }
  return { getBookingPricingSettings };
}

async function ensureDefaultBookingAddons({ BookingAddonModel = BookingAddon } = {}) {
  for (const addon of defaultAddons) await BookingAddonModel.findOrCreate({ where: { id: addon.id }, defaults: addon });
}

async function calculatePricing({ type, targetId, guestCount, addonIds = [], paymentMethod = 'bank_transfer', roomId, roomCount, bookingDate, checkOutDate, flashSaleId } = {}) {
  const guests = Number(guestCount);
  if (!['tour', 'service', 'itinerary'].includes(type) || typeof targetId !== 'string' || !targetId.trim()) throw invalidPricing('Tour/d?ch v? c?n ??t kh?ng h?p l?.');
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 100) throw invalidPricing('S? kh?ch ph?i l? s? nguy?n t? 1 ??n 100.');
  if (!Array.isArray(addonIds) || addonIds.some(id => typeof id !== 'string' || !id.trim())) throw invalidPricing('Danh s?ch d?ch v? th?m kh?ng h?p l?.');

  let unitTourPrice = 0;
  let tourSubtotal;
  let flashSale = null;
  if (type === 'service') {
    const service = await GreenService.findByPk(targetId);
    if (!service) throw Object.assign(new Error('D?ch v? kh?ng t?n t?i.'), { statusCode: 404 });
    require('./catalog-presentation.service').assertCatalogBookable(service);
    unitTourPrice = integerVnd(service.cost, 'Gi? d?ch v?');
    if (roomId) {
      const stay = await lodgingPrice(service, { roomId, roomCount, bookingDate, checkOutDate, guests });
      tourSubtotal = stay.total;
      flashSale = await require('./flash-sale-pricing.service').flashSaleFor(service, {
        campaignId: flashSaleId, unitPrice: stay.room.price_per_night, units: stay.nights * roomCount, stockUnits: roomCount
      });
      unitTourPrice = null;
    } else {
      flashSale = await require('./flash-sale-pricing.service').flashSaleFor(service, { campaignId: flashSaleId, units: guests, stockUnits: guests });
    }
  } else {
    const schedule = await Schedule.findByPk(targetId);
    if (!schedule) throw Object.assign(new Error('Kh?ng t?m th?y tour.'), { statusCode: 404 });
    const isCustom = type === 'itinerary'
      || schedule.catalog_status === 'personal'
      || Boolean(schedule.user_id);
    require('./catalog-presentation.service').assertTourBookable(schedule, { allowPersonal: isCustom });
    const sample = await ScheduleSample.findByPk(targetId);
    if (sample) {
      unitTourPrice = integerVnd(sample.cost, 'Gi? tour');
    } else {
      const activities = await ScheduleActivity.findAll({ where: { schedule_id: targetId } });
      let perGuest = 0;
      let shared = 0;
      for (const activity of activities) {
        const amount = integerVnd(activity.cost || 0, 'Gi? ho?t ??ng');
        if (activity.is_shared || activity.type === 'lodging') shared += amount;
        else perGuest += amount;
      }
      unitTourPrice = null;
      tourSubtotal = perGuest * guests + shared;
    }
  }

  const selectedIds = [...new Set(addonIds)];
  const selectedAddons = selectedIds.length ? await BookingAddon.findAll({ where: { id: { [Op.in]: selectedIds }, active: true } }) : [];
  if (selectedAddons.length !== selectedIds.length) throw invalidPricing('M?t ho?c nhi?u d?ch v? th?m kh?ng c?n ???c cung c?p. H?y t?i l?i b?o gi?.');
  const addons = selectedAddons.map(addon => ({ id: addon.id, name: addon.name, unitPrice: integerVnd(addon.unit_price, 'Gi? ' + addon.name), quantity: 1, total: integerVnd(addon.unit_price, 'Gi? ' + addon.name) }));
  const addonsTotal = addons.reduce((sum, addon) => sum + addon.total, 0);
  const tourPriceSubtotal = tourSubtotal ?? integerVnd(unitTourPrice, 'Gi? tour') * guests;
  const subtotal = tourPriceSubtotal + addonsTotal;
  const settings = await createBookingPricingService().getBookingPricingSettings();
  const discount = flashSale ? flashSale.discount : Math.floor(tourPriceSubtotal * Number(settings.discount_percent || 0) / 100);
  const serviceFee = Number(settings.service_fee_vnd || 0) * (settings.service_fee_per_guest ? guests : 1);
  const total = subtotal - discount + serviceFee;
  const shouldCollectDeposit = !settings.collect_deposit_for?.length || settings.collect_deposit_for.includes(type);
  const shouldChargeDeposit = shouldCollectDeposit || paymentMethod === 'sepay';
  const depositPercent = Number(settings.deposit_percent || 30);
  const deposit = shouldChargeDeposit ? Math.round(total * depositPercent / 100) : 0;
  const remaining = total - deposit;
  const amountDueNow = deposit > 0 && (!paymentMethod || shouldChargeDeposit) ? deposit : total;
  for (const [label, amount] of Object.entries({ subtotal, discount, serviceFee, addonsTotal, total, deposit, remaining, amountDueNow })) integerVnd(amount, label);
  return {
    type, targetId, currency: 'VND', policyVersion: 1, guestCount: guests, paymentMethod: paymentMethod || null,
    unitTourPrice: unitTourPrice ?? null, tourSubtotal: tourPriceSubtotal, addons, addonsTotal, subtotal,
    discountPercent: flashSale ? (flashSale.discount_type === 'percent' ? flashSale.discount_value : null) : Number(settings.discount_percent || 0),
    flashSale, discount, serviceFee, total, depositPercent, deposit, remaining, amountDueNow
  };
}

module.exports = { createBookingPricingService, calculatePricing, ensureDefaultBookingAddons, DEFAULT_SETTINGS };
