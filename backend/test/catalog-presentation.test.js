const { test } = require('node:test');
const assert = require('node:assert/strict');
const { catalogMetadata, assertCatalogBookable } = require('../src/services/catalog-presentation.service');

test('unconfirmed public information cannot become a zero-price reservation', () => {
  const listing = { cost: 0, current_data: { bookingEnabled: false, priceStatus: 'on_request', carbonStatus: 'unconfirmed', capacityStatus: 'unconfirmed' } };
  assert.throws(() => assertCatalogBookable(listing), /xác nhận giá/);
  assert.deepEqual(catalogMetadata(listing), { priceStatus: 'on_request', bookingEnabled: false, sourceUrls: [], sourceCheckedAt: undefined, carbonKnown: false, capacityKnown: false });
});

test('legacy confirmed catalogs keep the existing booking path', () => {
  assert.doesNotThrow(() => assertCatalogBookable({ cost: 500000 }));
  assert.throws(() => assertCatalogBookable({ current_data: { catalogHidden: true } }), /xác nhận giá/);
});
