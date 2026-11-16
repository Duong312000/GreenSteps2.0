const { test } = require('node:test');
const assert = require('node:assert/strict');
const adminCatalog = require('../src/services/admin-national-catalog.service');

function modelsWith({ areas = ['admin-area:68'], region = 'region:central-highlands', media } = {}) {
  const rows = new Map();
  return {
    rows,
    AdminArea: { async findByPk(id) { return areas.includes(id) ? { id } : null; } },
    Region: { async findByPk(id) { return id === region ? { id } : null; } },
    Destination: {
      async findOne({ where }) { return [...rows.values()].find(row => row.slug === where.slug) || null; },
      async findByPk(id) { return rows.get(id) || null; },
      async create(record) { rows.set(record.id, { ...record, async update(next) { Object.assign(this, next); } }); return rows.get(record.id); }
    },
    MediaAsset: { async findByPk(id) { return media?.[id] || null; } },
    Schedule: {
      async findByPk(id) { return rows.get(id) || null; },
      async create(record) { rows.set(record.id, { ...record }); return rows.get(record.id); }
    }
  };
}

test('admin destination creation uses stable IDs and defaults to unpublished editorial content', async () => {
  const models = modelsWith();
  const destination = await adminCatalog.saveDestination(models, null, {
    name: 'Điểm thử', slug: 'diem-thu', regionId: 'region:central-highlands',
    adminAreaIds: ['admin-area:68'], coordinates: { lat: 11.9, lng: 108.4 },
    coordinateVerification: 'pending', status: 'editorial'
  });
  assert.match(destination.id, /^destination:/);
  assert.equal(destination.status, 'editorial');
});

test('admin cannot publish a destination until its coordinates are verified and source is recorded', async () => {
  const models = modelsWith();
  await assert.rejects(adminCatalog.saveDestination(models, null, {
    name: 'Điểm thử', slug: 'diem-thu', regionId: 'region:central-highlands',
    adminAreaIds: ['admin-area:68'], coordinates: { lat: 11.9, lng: 108.4 },
    coordinateVerification: 'pending', status: 'published'
  }), /verified coordinates and source/i);
});

test('admin cannot set tour content to bookable from CMS', async () => {
  const models = modelsWith();
  await assert.rejects(adminCatalog.createEditorialTour(models, { title: 'Tour', destinationIds: ['destination:dalat'], status: 'bookable' }), /cannot set a tour to bookable/i);
});

test('destination gallery preserves order and exposes only rights-verified media', async () => {
  const models = modelsWith({ media: {
    'media:verified': { id: 'media:verified', publicUrl: 'https://media.test/cover.webp', variants: [{ url: 'https://media.test/card.webp', width: 640 }], verificationStatus: 'verified', attributionText: 'Photo credit' },
    'media:pending': { id: 'media:pending', publicUrl: 'https://media.test/pending.webp', verificationStatus: 'pending_review' }
  } });
  const destination = await adminCatalog.saveDestination(models, null, {
    name: 'Diem thu', slug: 'diem-thu', regionId: 'region:central-highlands',
    adminAreaIds: ['admin-area:68'], status: 'editorial',
    mediaAssetIds: ['media:verified', 'media:pending'], coverMediaAssetId: 'media:verified'
  });
  assert.deepEqual(destination.mediaAssetIds, ['media:verified', 'media:pending']);
  assert.deepEqual(destination.gallery.map(image => image.id), ['media:verified']);
  assert.equal(destination.coverMediaVerified, true);
  assert.equal(destination.image_url, 'https://media.test/cover.webp');
});

test('tour media requires an asset in its ordered gallery and keeps demo status non-bookable', async () => {
  const models = modelsWith({ media: {
    'media:verified': { id: 'media:verified', publicUrl: 'https://media.test/tour.webp', variants: [], verificationStatus: 'verified' }
  } });
  models.rows.set('destination:dalat', { id: 'destination:dalat', name: 'Da Lat' });
  const tour = await adminCatalog.createEditorialTour(models, {
    title: 'Demo xanh', destinationIds: ['destination:dalat'], days: 2, status: 'demo',
    mediaAssetIds: ['media:verified'], coverMediaAssetId: 'media:verified'
  });
  assert.equal(tour.catalog_status, 'demo');
  assert.equal(tour.coverMediaVerified, true);
  assert.deepEqual(tour.gallery, ['https://media.test/tour.webp']);
  await assert.rejects(adminCatalog.createEditorialTour(models, {
    title: 'Bad media', destinationIds: ['destination:dalat'], days: 2,
    mediaAssetIds: ['media:verified'], coverMediaAssetId: 'media:missing'
  }), /selected from its gallery/i);
});
