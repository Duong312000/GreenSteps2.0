// Replace only the six agent-created sample listings with sourced public information.
// Stable IDs preserve existing links. No user, vendor or account data is modified.
const assert = require('node:assert/strict');
const catalog = require('../data/official-service-catalog.json');
const { store, GreenService } = require('../src/models');
const importTag = 'official-public-catalog-2026-11-05';
const placeholder = 'image/service-photo-pending.svg';

function prepare(item) {
  const data = structuredClone(item.current_data);
  assert.ok(data.sourceUrls?.length && data.sourceUrls.every(url => new URL(url).protocol === 'https:'));
  data.sourceCheckedAt = '2026-11-05';
  data.catalogSource = importTag;
  data.verificationStatus = 'public_source';
  data.bookingEnabled = false;
  data.priceStatus = item.cost > 0 ? 'reference' : 'on_request';
  data.carbonStatus = 'unconfirmed';
  data.capacityStatus = 'unconfirmed';
  data.shortDesc = data.description;
  data.itinerary = data.description;
  data.policy = (data.policyGroups || []).flatMap(group => group.lines).join('\n');
  data.popularAmenities = (data.amenityGroups || []).flatMap(group => group.items).slice(0, 6);
  data.img = data.imageSource || placeholder;
  data.images = [...new Set([data.imageSource, ...(data.rooms || []).map(room => room.imageSource)].filter(Boolean))].filter(url => url !== data.img);
  for (const room of data.rooms || []) {
    assert.equal(room.price_per_night, undefined);
    assert.equal(room.available_rooms, undefined);
    room.images = room.imageSource ? [room.imageSource] : [];
  }
  return { ...item, image_url: data.img, carbon: 0, max_capacity: 0, status: 'active', current_data: data };
}

async function main() {
  const prepared = catalog.map(prepare);
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'validate-only', records: prepared.map(item => ({ id: item.id, name: item.name_service, sources: item.current_data.sourceUrls.length, rooms: item.current_data.rooms?.length || 0 })) }, null, 2));
    return;
  }
  assert.ok(/\.mongodb\.net(?:[/:?]|$)/.test(process.env.MONGODB_URI || ''), 'This import requires the configured MongoDB Atlas connection.');
  await store.authenticate();
  const existing = [];
  for (const item of prepared) {
    const record = await GreenService.findByPk(item.id);
    assert.ok(record, `Missing sample record: ${item.id}`);
    assert.ok(record.current_data?.seedSource === 'greensteps-detail-demo-v1' || record.current_data?.catalogSource === importTag, `Refusing to replace unrelated service: ${item.id}`);
    assert.equal(Number(record.reviews_count || 0), 0, `Existing reviews require manual review before changing listing identity: ${item.id}`);
    existing.push(record);
  }
  const backups = store.db.collection(`${store.prefix}catalog_import_backups`);
  // Snapshot every affected record before any service change. The backup is idempotent.
  for (const record of existing) {
    await backups.updateOne({ _id: `${importTag}:${record.id}` }, { $setOnInsert: { service: await GreenService.collection.findOne({ _id: record.id }), savedAt: new Date(), reason: importTag } }, { upsert: true });
  }
  for (let index = 0; index < prepared.length; index++) {
    await existing[index].update(prepared[index]);
    const saved = await GreenService.findByPk(prepared[index].id);
    assert.equal(saved.current_data.catalogSource, importTag);
    assert.equal(saved.current_data.isDemo, undefined);
    assert.equal(saved.current_data.bookingEnabled, false);
  }
  // Keep legacy sample records for their owners/history, but remove them from the public catalog.
  const all = await GreenService.findAll();
  const archived = [];
  for (const record of all.filter(item => /^demo-/i.test(item.id) && /\[DEMO\]/i.test(item.name_service))) {
    await backups.updateOne({ _id: `${importTag}:${record.id}` }, { $setOnInsert: { service: await GreenService.collection.findOne({ _id: record.id }), savedAt: new Date(), reason: importTag } }, { upsert: true });
    await record.update({ status: 'suspended', name_service: 'Dịch vụ chưa xác minh — đã lưu trữ', current_data: { catalogHidden: true, bookingEnabled: false, verificationStatus: 'unverified', catalogSource: importTag } });
    archived.push(record.id);
  }
  console.log(JSON.stringify({ database: store.db.databaseName, connection: 'MongoDB Atlas', updated: prepared.map(item => ({ id: item.id, name: item.name_service })), archivedSamples: archived.length, remainingUnreviewed: all.filter(item => !prepared.some(row => row.id === item.id) && !archived.includes(item.id) && item.current_data?.verificationStatus !== 'public_source').length, backupCollection: backups.collectionName }, null, 2));
}

const timeout = setTimeout(() => { console.error('Database operation timed out.'); process.exit(1); }, 60000);
main().catch(error => { console.error(error.name + ': ' + String(error.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; })
  .finally(async () => { clearTimeout(timeout); await store.close(); });
