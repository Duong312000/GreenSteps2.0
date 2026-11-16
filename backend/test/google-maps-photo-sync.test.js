const { test } = require('node:test');
const assert = require('node:assert/strict');
const photoSync = require('../src/services/google-maps-photo-sync.service');

test('Google Places photo rehosting remains disabled unless a separate rights workflow is approved', async () => {
  assert.equal(photoSync.PHOTO_SYNC_ENABLED, false);
  assert.deepEqual(await photoSync.syncServicePhotoFromGoogle({ id: 'service-1' }), {
    success: false,
    blocked: true,
    code: 'GOOGLE_PHOTO_REHOSTING_DISABLED'
  });
  assert.deepEqual(await photoSync.syncAllGooglePlacesPhotos(), {
    success: false,
    blocked: true,
    code: 'GOOGLE_PHOTO_REHOSTING_DISABLED',
    results: []
  });
});
