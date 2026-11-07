// Simulated rates for the imported lodging listings. No UI demo label is added.
// Preview: node scripts/seed-room-prices.js; write: add --apply.
const assert = require('node:assert/strict');
const { store, GreenService } = require('../src/models');
const { calculatePricing } = require('../src/services/booking-pricing.service');

const rates = {
  srv_demo_detail_dalat_garden: {
    ana_villa_room: [1850000, 5],
    ana_villa_studio: [2450000, 4],
    ana_villa_suite: [3250000, 2]
  },
  srv_demo_detail_hoian_riverside: {
    anantara_deluxe_balcony: [2850000, 5],
    anantara_deluxe_garden: [3650000, 3]
  },
  srv_demo_detail_phuyen_seaside: {
    zannier_greenfield: [6200000, 4]
  }
};
const tag = 'simulated-room-prices-v1';

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'preview', rates }, null, 2));
    return;
  }
  await store.authenticate();
  // Validate all targets before writing and preserve the imported descriptions/photos.
  const changes = [];
  for (const [id, roomRates] of Object.entries(rates)) {
    const record = await GreenService.findByPk(id);
    assert.ok(record && record.type === 'stay', `Missing lodging: ${id}`);
    assert.equal(record.current_data?.catalogSource, 'official-public-catalog-2026-11-05');
    const rooms = record.current_data.rooms.map(room => {
      const rate = roomRates[room.id];
      assert.ok(rate, `Unexpected room: ${room.id}`);
      return { ...room, price_per_night: rate[0], available_rooms: rate[1] };
    });
    assert.equal(rooms.length, Object.keys(roomRates).length);
    changes.push({ record, rooms });
  }
  const backups = store.db.collection(`${store.prefix}catalog_import_backups`);
  for (const { record } of changes) {
    await backups.updateOne({ _id: `${tag}:${record.id}` }, { $setOnInsert: {
      service: await GreenService.collection.findOne({ _id: record.id }),
      savedAt: new Date(), reason: tag
    } }, { upsert: true });
  }
  for (const { record, rooms } of changes) {
    await record.update({
      cost: Math.min(...rooms.map(room => room.price_per_night)),
      max_capacity: rooms.reduce((total, room) => total + room.capacity * room.available_rooms, 0),
      current_data: { ...record.current_data, rooms, bookingEnabled: true,
        priceStatus: 'reference', pricingSource: tag }
    });
    const saved = await GreenService.findByPk(record.id);
    assert.equal(saved.current_data.bookingEnabled, true);
    assert.deepEqual(saved.current_data.rooms, rooms);
    for (const room of rooms) {
      const quote = await calculatePricing({ type: 'service', targetId: record.id,
        guestCount: 2, roomId: room.id, roomCount: 1,
        bookingDate: '2099-01-10', checkOutDate: '2099-01-12' });
      assert.equal(quote.tourSubtotal, room.price_per_night * 2);
    }
  }
  console.log(JSON.stringify({ updated: changes.map(({ record, rooms }) => ({
    id: record.id, rooms: rooms.map(({ id, price_per_night, available_rooms }) => ({ id, price_per_night, available_rooms }))
  })), verified: 'Saved rates and two-night quotes for every room' }, null, 2));
}

const timeout = setTimeout(() => { console.error('Database operation timed out.'); process.exit(1); }, 30000);
main().catch(error => {
  console.error(error.name + ': ' + String(error.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[redacted]'));
  process.exitCode = 1;
}).finally(async () => { clearTimeout(timeout); await store.close(); });
