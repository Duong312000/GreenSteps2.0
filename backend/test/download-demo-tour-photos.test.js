const assert = require('node:assert/strict');
const test = require('node:test');
const { getThumbnailUrl, validateDownloadedJpeg } = require('../scripts/download-demo-tour-photos');

test('uses the previously verified Wikimedia thumbnail URL without a new API lookup', () => {
  const photo = {
    sourceThumbnailUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/image.jpg/1600px-image.jpg',
    sourceFileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/image.jpg',
    sourceMime: 'image/jpeg',
    sourceSha1: 'a'.repeat(40),
    author: 'Photographer',
    licenseId: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'
  };
  assert.equal(getThumbnailUrl(photo), photo.sourceThumbnailUrl);
});

test('rejects a downloaded body that is not a valid JPEG response', () => {
  assert.throws(() => validateDownloadedJpeg(Buffer.from('not a JPEG'), 'image/jpeg'), /JPEG signature/);
  assert.throws(() => validateDownloadedJpeg(Buffer.from([0xff, 0xd8, 0xff]), 'text/html'), /image\/jpeg/);
});

test('accepts a downloaded JPEG with the expected signature and content type', () => {
  const bytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10_000)]);
  assert.equal(validateDownloadedJpeg(bytes, 'image/jpeg'), true);
});

test('accepts full-size Commons thumbnails before the local optimizer reduces them to 1600 px', () => {
  const bytes = Buffer.alloc(2_500_000);
  bytes.set([0xff, 0xd8, 0xff]);
  assert.equal(validateDownloadedJpeg(bytes, 'image/jpeg'), true);
  const oversized = Buffer.alloc(5_000_001);
  oversized.set([0xff, 0xd8, 0xff]);
  assert.throws(() => validateDownloadedJpeg(oversized, 'image/jpeg'), /Unexpected JPEG size/);
});
