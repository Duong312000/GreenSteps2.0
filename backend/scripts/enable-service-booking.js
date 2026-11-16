// Enable the existing GreenSteps checkout for priced, imported day services.
// Run without --apply to preview. Preserve descriptions, rooms and ownership.
const assert = require('node:assert/strict');
const { store, GreenService } = require('../src/models');
const { calculatePricing } = require('../src/services/booking-pricing.service');

async function main() {
  try {
    await store.authenticate();
    const records = await GreenService.collection.find({
      status: 'active', type: { $in: ['food', 'transport', 'attraction'] },
      cost: { $gt: 0 }, 'current_data.catalogSource': 'official-public-catalog-2026-11-05',
      'current_data.bookingEnabled': false, 'current_data.catalogHidden': { $ne: true },
    }).toArray();
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview',
      services: records.map(({ id, name_service, cost }) => ({ id, name: name_service, cost })) }));
    if (!process.argv.includes('--apply')) return;
    const backups = store.db.collection(`${store.prefix}catalog_import_backups`);
    for (const record of records) {
      await backups.updateOne({ _id: `internal-service-booking-v1:${record.id}` }, {
        $setOnInsert: { service: record, savedAt: new Date(), reason: 'internal-service-booking-v1' },
      }, { upsert: true });
      await GreenService.collection.updateOne({ _id: record._id, 'current_data.bookingEnabled': false }, {
        $set: { 'current_data.bookingEnabled': true, updatedAt: new Date() }, $inc: { _rev: 1 },
      });
      const saved = await GreenService.findByPk(record.id);
      assert.equal(saved.current_data.bookingEnabled, true);
      const quote = await calculatePricing({ type: 'service', targetId: record.id, guestCount: 2 });
      assert.equal(quote.tourSubtotal, record.cost * 2);
      console.log(JSON.stringify({ id: record.id, bookingEnabled: true, verifiedSubtotal: quote.tourSubtotal }));
    }
  } finally { await store.close(); }
}

main().catch(error => { console.error(error.name); process.exitCode = 1; });
