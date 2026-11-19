const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BookingAddon, BookingSetting, Schedule, ScheduleSample } = require('../src/models');
const { Op } = require('../src/db/mongo-store');
const { calculatePricing, ensureDefaultBookingAddons } = require('../src/services/booking-pricing.service');

test('server default quote keeps SePay deposit pricing aligned with the 30% checkout amount', async () => {
  const originals = { schedule: Schedule.findByPk, sample: ScheduleSample.findByPk, settings: BookingSetting.findByPk };
  try {
    Schedule.findByPk = async id => ({ id });
    ScheduleSample.findByPk = async () => ({ cost: 1_000_000 });
    BookingSetting.findByPk = async () => ({ deposit_percent: 0 });
    const quote = await calculatePricing({ type: 'tour', targetId: 'tour-default', guestCount: 1, paymentMethod: 'sepay' });
    assert.equal(quote.total, 1_000_000);
    assert.equal(quote.deposit, 300_000);
    assert.equal(quote.amountDueNow, 300_000);
  } finally {
    Schedule.findByPk = originals.schedule;
    ScheduleSample.findByPk = originals.sample;
    BookingSetting.findByPk = originals.settings;
  }
});

test('startup seeds missing default booking add-ons without overwriting admin edits', async () => {
  const originalFindOrCreate = BookingAddon.findOrCreate;
  const calls = [];
  try {
    BookingAddon.findOrCreate = async options => { calls.push(options); return [options.defaults, true]; };
    await ensureDefaultBookingAddons();
    assert.equal(calls.length, require('../src/config/booking-addons.seed').length);
    assert.ok(calls.every(call => call.where.id === call.defaults.id));
  } finally {
    BookingAddon.findOrCreate = originalFindOrCreate;
  }
});

test('pricing uses server catalog prices, guest count, and the configured order fee', async () => {
  const originals = {
    schedule: Schedule.findByPk,
    sample: ScheduleSample.findByPk,
    addons: BookingAddon.findAll,
    settings: BookingSetting.findByPk
  };
  try {
    Schedule.findByPk = async id => ({ id });
    ScheduleSample.findByPk = async () => ({ cost: 1_000_000 });
    BookingAddon.findAll = async ({ where }) => where.id[Op.in].map(id => ({
      id,
      name: 'Dịch vụ thêm trong DB',
      unit_price: 200_000,
      active: true
    }));
    BookingSetting.findByPk = async () => ({ discount_percent: 8, service_fee_vnd: 120_000, deposit_percent: 30, collect_deposit_for: [] });

    const quote = await calculatePricing({
      type: 'tour', targetId: 'tour-1', guestCount: 2,
      addonIds: ['addon-from-db'], paymentMethod: 'bank_transfer'
    });
    assert.equal(quote.tourSubtotal, 2_000_000);
    assert.equal(quote.addonsTotal, 200_000);
    assert.equal(quote.subtotal, 2_200_000);
    assert.equal(quote.discount, 160_000);
    assert.equal(quote.serviceFee, 120_000);
    assert.equal(quote.total, 2_160_000);
    assert.equal(quote.deposit, 648_000);
    assert.equal(quote.remaining, 1_512_000);
    assert.equal(quote.amountDueNow, quote.deposit);
  } finally {
    Schedule.findByPk = originals.schedule;
    ScheduleSample.findByPk = originals.sample;
    BookingAddon.findAll = originals.addons;
    BookingSetting.findByPk = originals.settings;
  }
});

test('pricing handles multiple guests without add-ons and rounds discount down', async () => {
  const originals = { schedule: Schedule.findByPk, sample: ScheduleSample.findByPk, settings: BookingSetting.findByPk };
  try {
    Schedule.findByPk = async id => ({ id });
    ScheduleSample.findByPk = async () => ({ cost: 1_000_000 });
    BookingSetting.findByPk = async () => ({ discount_percent: 8, service_fee_vnd: 120_000, deposit_percent: 30, collect_deposit_for: [] });
    const quote = await calculatePricing({ type: 'tour', targetId: 'tour-1', guestCount: 3, addonIds: [] });
    assert.equal(quote.subtotal, 3_000_000);
    assert.equal(quote.discount, 240_000);
    assert.equal(quote.total, 2_880_000);
    assert.equal(quote.deposit, 864_000);
    assert.equal(quote.remaining, 2_016_000);
  } finally {
    Schedule.findByPk = originals.schedule;
    ScheduleSample.findByPk = originals.sample;
    BookingSetting.findByPk = originals.settings;
  }
});

test('pricing rounds percentage amounts to integer VND and ignores untrusted client amounts', async () => {
  const originals = { schedule: Schedule.findByPk, sample: ScheduleSample.findByPk, settings: BookingSetting.findByPk };
  try {
    Schedule.findByPk = async id => ({ id });
    ScheduleSample.findByPk = async () => ({ cost: 101 });
    BookingSetting.findByPk = async () => ({ discount_percent: 8, service_fee_vnd: 120_000, deposit_percent: 30, collect_deposit_for: [] });
    const quote = await calculatePricing({
      type: 'tour', targetId: 'tour-1', guestCount: 1, addonIds: [],
      paymentMethod: 'wallet', amount: 1, total: 1, value: 1
    });
    assert.equal(quote.discount, 8);
    assert.equal(quote.total, 120_093);
    assert.equal(quote.deposit, 36_028);
    assert.equal(quote.amountDueNow, 36_028);
    for (const amount of [quote.subtotal, quote.discount, quote.serviceFee, quote.total, quote.deposit, quote.remaining]) {
      assert.equal(Number.isSafeInteger(amount), true);
    }
  } finally {
    Schedule.findByPk = originals.schedule;
    ScheduleSample.findByPk = originals.sample;
    BookingSetting.findByPk = originals.settings;
  }
});
