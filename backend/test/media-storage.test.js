const { test } = require('node:test');
const assert = require('node:assert/strict');
const media = require('../src/services/media-storage.service');

test('image data URIs are content-sniffed, bounded and reject double-encoded or unsupported payloads', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const parsed = media.decodeImageDataUri(`data:image/png;base64,${png.toString('base64')}`);
  assert.equal(parsed.mimeType, 'image/png');
  assert.throws(() => media.decodeImageDataUri(`data:image/png;base64,${Buffer.from('not an image').toString('base64')}`), /signature/i);
  assert.throws(() => media.decodeImageDataUri('data:image/svg+xml;base64,PHN2Zz4=', { maxBytes: 100 }), /unsupported/i);
});

test('local adapter writes opaque keys without path traversal and returns original media metadata', async () => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'greensteps-media-'));
  try {
    const adapter = media.createLocalMediaAdapter({ rootDir: root, publicBaseUrl: '/uploads/catalog' });
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const asset = await adapter.upload({ bytes, mimeType: 'image/png' });
    assert.equal(asset.url.startsWith('/uploads/catalog/'), true);
    assert.equal((await fs.readFile(path.join(root, asset.storageKey))).equals(bytes), true);
    assert.equal(asset.storageKey.includes('..'), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('cloudinary adapter requires server configuration and keeps upload injectable for offline tests', async () => {
  assert.throws(() => media.createCloudinaryMediaAdapter({}), /configuration/i);
  let received;
  const adapter = media.createCloudinaryMediaAdapter({
    cloudName: 'demo-cloud',
    uploader: async input => { received = input; return { public_id: 'catalog/demo', secure_url: 'https://cdn.example/demo.webp', bytes: 123 }; }
  });
  const webp = Buffer.from('RIFF0000WEBP');
  const asset = await adapter.upload({ bytes: webp, mimeType: 'image/webp', publicId: 'catalog/demo' });
  assert.equal(received.publicId, 'catalog/demo');
  assert.equal(asset.storageProvider, 'cloudinary');
  assert.equal(asset.url, 'https://cdn.example/demo.webp');
});
