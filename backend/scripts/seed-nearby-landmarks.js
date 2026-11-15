// Preview by default; --apply writes only researched nearby information.
const assert = require('node:assert/strict');
const definitions = require('../data/service-nearby-landmarks.json');
const { store, GreenService } = require('../src/models');

async function main() {
  try {
    for (const definition of definitions) for (const group of definition.groups) for (const place of group.items) {
      assert.ok(Number.isFinite(place.distanceKm) && place.distanceKm > 0);
      assert.ok(definition.sources.some(source => source.url === place.sourceUrl));
      assert.equal(new URL(place.sourceUrl).protocol, 'https:');
    }
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ mode: 'preview', targets: definitions.map(row => ({ services: row.serviceIds, landmarks: row.groups.flatMap(group => group.items).length, checkedAt: row.checkedAt })) }));
      return;
    }
    await store.authenticate();
    const changes = [];
    for (const definition of definitions) for (const id of definition.serviceIds) {
      const record = await GreenService.collection.findOne({ id });
      assert.ok(record && new RegExp(definition.namePattern, 'i').test(record.name_service), `Unexpected service: ${id}`);
      changes.push({ record, definition });
    }
    const backups = store.db.collection(`${store.prefix}catalog_import_backups`);
    for (const { record, definition } of changes) {
      await backups.updateOne({ _id: `${definition.key}:${record.id}` }, { $setOnInsert: { service: record, savedAt: new Date(), reason: definition.key } }, { upsert: true });
      const existing = record.current_data?.nearbyGroups || [];
      const groups = [...existing.filter(group => !definition.groups.some(added => added.name === group.name)), ...definition.groups];
      await GreenService.collection.updateOne({ _id: record._id }, { $set: {
        'current_data.nearbyGroups': groups, 'current_data.nearbySources': definition.sources,
        'current_data.nearbyCheckedAt': definition.checkedAt, 'current_data.nearbyOrigin': definition.origin,
        'current_data.nearbySeedKey': definition.key, updatedAt: new Date(),
      }, $inc: { _rev: 1 } });
      const saved = await GreenService.collection.findOne({ id: record.id });
      assert.equal(saved.current_data.nearbyGroups.flatMap(group => group.items).filter(place => place.distanceKm).length,
        groups.flatMap(group => group.items).filter(place => place.distanceKm).length);
      console.log(JSON.stringify({ updated: record.id, landmarks: definition.groups.flatMap(group => group.items).length }));
    }
  } finally { await store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
