const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BookingAddon, Schedule, ScheduleSample } = require('../src/models');
const { Op } = require('../src/db/mongo-store');
const { calculatePricing } = require('../src/services/booking-pricing.service');

test('pricing uses server catalog prices, guest count, and the configured order fee', async () => {
  const originals = {
    schedule: Schedule.findByPk,
    sample: ScheduleSample.findByPk,
    addons: BookingAddon.findAll
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
  }
});

test('pricing handles multiple guests without add-ons and rounds discount down', async () => {
  const originals = { schedule: Schedule.findByPk, sample: ScheduleSample.findByPk };
  try {
    Schedule.findByPk = async id => ({ id });
    ScheduleSample.findByPk = async () => ({ cost: 1_000_000 });
    const quote = await calculatePricing({ type: 'tour', targetId: 'tour-1', guestCount: 3, addonIds: [] });
    assert.equal(quote.subtotal, 3_000_000);
    assert.equal(quote.discount, 240_000);
    assert.equal(quote.total, 2_880_000);
    assert.equal(quote.deposit, 864_000);
    assert.equal(quote.remaining, 2_016_000);
  } finally {
    Schedule.findByPk = originals.schedule;
    ScheduleSample.findByPk = originals.sample;
  }
});

test('pricing rounds percentage amounts to integer VND and ignores untrusted client amounts', async () => {
  const originals = { schedule: Schedule.findByPk, sample: ScheduleSample.findByPk };
  try {
    Schedule.findByPk = async id => ({ id });
    ScheduleSample.findByPk = async () => ({ cost: 101 });
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
  }
});
