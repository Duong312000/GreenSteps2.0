const { test } = require('node:test');
const assert = require('node:assert/strict');
const geography = require('../src/data/national-geography.seed');
const { demoTours } = require('../src/data/demo-tours.seed');
const catalog = require('../src/services/national-catalog.service');
const seeder = require('../src/services/national-catalog-seed.service');

test('national administrative seed contains the official 34 province and city codes', () => {
  assert.equal(geography.adminAreas.length, 34);
  assert.equal(new Set(geography.adminAreas.map(item => item.code)).size, 34);
  assert.equal(new Set(geography.adminAreas.map(item => item.id)).size, 34);
  assert.equal(geography.adminAreas.find(item => item.code === '66').name, 'Đắk Lắk');
  assert.equal(geography.adminAreas.find(item => item.code === '08').name, 'Tuyên Quang');
});

test('historical province names resolve as aliases without changing administrative IDs', () => {
  const oldPhuYen = geography.adminAreas.find(item => item.aliases.includes('Phú Yên'));
  const oldHaGiang = geography.adminAreas.find(item => item.aliases.includes('Hà Giang'));
  assert.equal(oldPhuYen.id, 'admin-area:66');
  assert.equal(oldHaGiang.id, 'admin-area:08');
  assert.equal(catalog.normalizeSearch('ĐẮK LẮK'), 'dak lak');
});

test('six destination demo seed contains twelve editorial tours and no commercial inventory', () => {
  assert.equal(demoTours.length, 12);
  assert.equal(new Set(demoTours.map(tour => tour.destination_ids[0])).size, 6);
  for (const tour of demoTours) {
    assert.equal(tour.catalog_status, 'demo');
    assert.equal(Object.hasOwn(tour, 'cost'), false);
    assert.equal(Object.hasOwn(tour, 'rating'), false);
    assert.equal(Object.hasOwn(tour, 'availability'), false);
    assert.equal(tour.itinerary.length, 3);
    assert.ok(tour.itinerary.every(activity => activity.activity_cost === null && activity.coordinates === null));
  }
});

test('catalog list is paginated, bounded, alias-aware and stably sorted', async () => {
  const rows = [
    { id: 'b', name: 'Đà Lạt', aliases: ['Dalat'], status: 'published' },
    { id: 'a', name: 'Phú Quốc', aliases: ['Phu Quoc'], status: 'published' },
    { id: 'hidden', name: 'Hidden', aliases: [], status: 'draft' }
  ];
  const result = await catalog.listCatalog({
    model: { findAll: async () => rows },
    query: { q: 'phu quoc', page: '1', pageSize: '1', sort: 'name' }
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'a');
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 1);
});

test('catalog detail only exposes published records by slug', async () => {
  const model = { findOne: async ({ where }) => where.slug === 'sa-pa' ? { id: 'sa-pa', status: 'published' } : null };
  assert.equal((await catalog.getPublishedBySlug(model, 'sa-pa')).id, 'sa-pa');
  assert.equal(await catalog.getPublishedBySlug(model, 'draft'), null);
});

test('national catalog dry-run reports changes without writing and apply is repeatable', async () => {
  const rows = new Map();
  const model = {
    async findByPk(id) { return rows.get(id) || null; },
    async create(record) { rows.set(record.id, { ...record }); },
  };
  const dryRun = await seeder.seedRecords(model, [{ id: 'one', name: 'First' }], { dryRun: true });
  assert.deepEqual(dryRun, { created: 1, preserved: 0, unchanged: 0 });
  assert.equal(rows.size, 0);
  await seeder.seedRecords(model, [{ id: 'one', name: 'First' }], { dryRun: false });
  const repeat = await seeder.seedRecords(model, [{ id: 'one', name: 'First' }], { dryRun: false });
  assert.deepEqual(repeat, { created: 0, preserved: 0, unchanged: 1 });
  const edited = { id: 'one', name: 'Edited by an admin' };
  const preserveResult = await seeder.seedRecords(model, [edited], { dryRun: false });
  assert.deepEqual(preserveResult, { created: 0, preserved: 1, unchanged: 0 });
  assert.equal(rows.get('one').name, 'First');
});

test('catalog inserts are audited in the same transaction and retries do not duplicate audit records', async () => {
  const rows = new Map();
  const audits = new Map();
  const model = {
    async findByPk(id) { return rows.get(id) || null; },
    async create(record, options = {}) {
      assert.ok(options.transaction, 'catalog insert must be transactional');
      rows.set(record.id, { ...record });
    }
  };
  const auditModel = {
    async create(record, options = {}) {
      assert.ok(options.transaction, 'audit insert must share the catalog transaction');
      audits.set(record.id, { ...record });
    }
  };
  const store = { async transaction(callback) { return callback({ id: 'transaction' }); } };
  const input = [{ id: 'destination:dalat', slug: 'da-lat', name: 'Đà Lạt' }];
  const createdRecords = [];
  const onCreated = record => createdRecords.push(record.id);

  const first = await seeder.seedRecords(model, input, { dryRun: false, auditModel, store, entityType: 'destination', onCreated });
  const retry = await seeder.seedRecords(model, input, { dryRun: false, auditModel, store, entityType: 'destination', onCreated });

  assert.deepEqual(first, { created: 1, preserved: 0, unchanged: 0 });
  assert.deepEqual(retry, { created: 0, preserved: 0, unchanged: 1 });
  assert.equal(audits.size, 1);
  assert.equal([...audits.values()][0].target_id, 'destination:dalat');
  assert.equal([...audits.values()][0].action, 'national_catalog.seed.insert');
  assert.deepEqual(createdRecords, ['destination:dalat']);
});
