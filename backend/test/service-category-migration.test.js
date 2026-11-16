const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createServiceCategoryService } = require('../src/services/service-category.service');

function createHarness(serviceRows) {
  const categories = new Map();
  const services = serviceRows.map(row => ({
    ...row,
    current_data: row.current_data ? { ...row.current_data } : null,
    updates: 0,
    async update(values) {
      Object.assign(this, values);
      this.updates++;
    }
  }));
  const categoryRepository = {
    async findAll() { return [...categories.values()]; },
    async create(values) {
      if (categories.has(values.id)) throw new Error('duplicate category');
      const category = { ...values };
      categories.set(values.id, category);
      return category;
    }
  };
  const serviceQueries = [];
  const serviceRepository = {
    async findAll(options) {
      serviceQueries.push(options);
      return options?.where?.category_id === null ? services.filter(service => !service.category_id) : services;
    }
  };
  serviceRepository.collection = {
    aggregate() {
      const groups = new Map();
      for (const service of services) {
        const key = service.category_id || String(service.current_data?.category || '').trim();
        if (!key || !service.id) continue;
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key).add(String(service.id));
      }
      return { async toArray() { return [...groups].map(([_id, ids]) => ({ _id, serviceCount: ids.size })); } };
    }
  };
  return {
    categories,
    services,
    serviceQueries,
    service: createServiceCategoryService({ ServiceCategory: categoryRepository, GreenService: serviceRepository })
  };
}

test('category migration reads only unlinked services and projects migration fields', async () => {
  const harness = createHarness([{ id: 'srv-1', name_service: 'Green hotel', type: 'stay', cost: 100, destination: 'Da Lat', current_data: { category: 'LÆ°u trÃº' } }]);
  await harness.service.ensureServiceCategories();
  assert.deepEqual(harness.serviceQueries[0], {
    where: { category_id: null },
    attributes: ['id', 'name_service', 'type', 'cost', 'destination', 'status', 'current_data', 'category_id', '_rev']
  });
});

test('legacy category migration preserves distinct names and assigns stable links without rewriting labels', async () => {
  const rows = [
    { id: 'srv-1', type: 'food', current_data: { category: 'Ăn uống' } },
    { id: 'srv-2', type: 'attraction', current_data: { category: 'Khám phá' } },
    { id: 'srv-3', type: 'attraction', current_data: { category: 'Khám phá xanh' } }
  ];
  const first = createHarness(rows);
  await first.service.ensureServiceCategories();

  assert.equal(first.categories.size, 4);
  assert.equal(first.services[0].current_data.category, 'Ăn uống');
  assert.equal(first.services[1].current_data.category, 'Khám phá');
  assert.equal(first.services[2].current_data.category, 'Khám phá xanh');
  assert.equal(new Set(first.services.map(row => row.category_id)).size, 3);

  const second = createHarness(rows);
  await second.service.ensureServiceCategories();
  assert.deepEqual(
    [...first.categories.keys()].sort(),
    [...second.categories.keys()].sort()
  );
});

test('legacy category migration is idempotent and leaves an existing category link unchanged', async () => {
  const harness = createHarness([
    { id: 'srv-1', type: 'stay', category_id: 'cat-existing', current_data: { category: 'Lưu trú' } },
    { id: 'srv-2', type: 'food', current_data: { category: 'Ăn uống' } }
  ]);
  harness.categories.set('cat-existing', { id: 'cat-existing', name: 'Lưu trú', active: true });

  await harness.service.ensureServiceCategories();
  const createdCount = harness.categories.size;
  const firstUpdates = harness.services.map(row => row.updates);
  await harness.service.ensureServiceCategories();

  assert.equal(harness.categories.size, createdCount);
  assert.equal(harness.services[0].category_id, 'cat-existing');
  assert.deepEqual(harness.services.map(row => row.updates), firstUpdates);
});

test('category counts aggregate in MongoDB, deduplicate service IDs, and prefer category_id over legacy text', async () => {
  const harness = createHarness([
    { id: 'srv-1', category_id: 'cat-food', current_data: { category: 'Ăn uống' } },
    { id: 'srv-1', category_id: 'cat-food', current_data: { category: 'Ăn uống' } },
    { id: 'srv-2', current_data: { category: 'Ăn uống' } },
    { id: 'srv-3', category_id: 'cat-stay', current_data: { category: 'Ăn uống' } }
  ]);
  harness.categories.set('cat-food', { id: 'cat-food', name: 'Ăn uống' });
  harness.categories.set('cat-stay', { id: 'cat-stay', name: 'Lưu trú' });

  const counts = await harness.service.countServicesByCategory();
  assert.equal(harness.serviceQueries.length, 0, 'counting must not hydrate service documents into Node');
  assert.deepEqual(counts, { 'cat-food': 2, 'cat-stay': 1 });
});

test('category ID is deterministic for one exact legacy name', async () => {
  const harness = createHarness([{ id: 'srv-1', type: 'food', current_data: { category: 'Ăn uống' } }]);
  await harness.service.ensureServiceCategories();

  const digest = crypto.createHash('sha256').update('Ăn uống').digest('hex').slice(0, 12);
  assert.ok(harness.categories.has(`cat_an-uong-${digest}`));
});
