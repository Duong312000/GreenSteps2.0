const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchServices } = require('../src/services/service-search.service');

test('service search bounds backend pagination and excludes Google runtime content from catalog results', async () => {
  const calls = [];
  const models = {
    GreenService: {
      async count(query) { calls.push(['count', query]); return 1; },
      async findAll(query) { calls.push(['find', query]); return [{ id: 'service-1', name_service: 'Homestay', cost: 500000, source: 'partner' }]; }
    },
    Destination: { async findAll() { return []; } }
  };
  const result = await searchServices({ models, query: { q: 'homestay', type: 'stay', page: '3', pageSize: '5' } });
  assert.equal(result.items[0].id, 'service-1');
  assert.equal(result.page, 3);
  assert.equal(calls[1][1].offset, 10);
  assert.equal(calls[1][1].limit, 5);
});

test('service search applies destination region, partner and verified rating filters on the server', async () => {
  let where;
  const models = {
    GreenService: {
      async count(query) { where = query.where; return 0; },
      async findAll() { return []; }
    },
    Destination: { async findAll({ where = {} } = {}) {
      return [
        { id: 'destination:dalat', regionId: 'region:highlands', adminAreaIds: ['admin-area:68'], status: 'published' },
        { id: 'destination:other', regionId: 'region:other', adminAreaIds: ['admin-area:01'], status: 'published' }
      ].filter(row => !where.regionId || row.regionId === where.regionId);
    } }
  };
  await searchServices({ models, query: { type: 'stay', region: 'region:highlands', province: 'admin-area:68', partnerOnly: 'true', minRating: '4.5' } });
  const { Op } = require('../src/db/mongo-store');
  const [filters, ...destinationClauses] = where[Op.and];
  assert.equal(filters.status, 'active');
  assert.equal(filters.is_partner, true);
  assert.equal(filters.rating[Op.gte], 4.5);
  for (const clause of destinationClauses) assert.deepEqual(clause.destination_ids[Op.in], ['destination:dalat']);
});

test('compact service cards request map metadata without loading inline images', async () => {
  let attributes;
  await searchServices({ models: {
    GreenService: {
      async count() { return 0; },
      async findAll(options) { attributes = options.attributes; return []; }
    },
    Destination: { async findAll() { return []; } }
  }, query: { compact: '1', type: 'stay' } });

  assert.ok(attributes.includes('current_data.category'));
  assert.ok(attributes.includes('current_data.lat'));
  assert.ok(attributes.includes('current_data.lng'));
  assert.equal(attributes.includes('current_data.img'), false);
  assert.equal(attributes.includes('image_url'), false);
});
