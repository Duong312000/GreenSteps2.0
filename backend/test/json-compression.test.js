const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { gunzipSync } = require('node:zlib');
const { compressPublicCatalogJson } = require('../src/middlewares/json-compression');

test('compresses public catalog JSON for gzip clients without changing the decoded response', async t => {
  const payload = {
    success: true,
    items: [{ id: 'service-1', name: 'Eco stay', description: 'local sustainable travel '.repeat(100), current_data: { images: ['cover.jpg'], rooms: [{ capacity: 2 }] } }]
  };
  const app = express();
  app.use(compressPublicCatalogJson);
  app.get('/api/services/search', (req, res) => res.json(payload));
  const server = app.listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();

  const response = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: address.port, path: '/api/services/search', headers: { 'Accept-Encoding': 'gzip' } }, result => {
      const chunks = [];
      result.on('data', chunk => chunks.push(chunk));
      result.on('end', () => resolve({ headers: result.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });

  assert.equal(response.headers['content-encoding'], 'gzip');
  assert.match(response.headers.vary, /Accept-Encoding/i);
  assert.ok(response.body.length < Buffer.byteLength(JSON.stringify(payload)));
  assert.deepEqual(JSON.parse(gunzipSync(response.body).toString('utf8')), payload);
});

test('leaves non-catalog JSON and clients without gzip support unchanged', async t => {
  const app = express();
  app.use(compressPublicCatalogJson);
  app.get('/api/auth/session', (req, res) => res.json({ token: 'private' }));
  app.get('/api/tours/search', (req, res) => res.json({ items: [{ title: 'Tour' }] }));
  const server = app.listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const get = path => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path, headers: { 'Accept-Encoding': 'gzip' } }, result => {
      const chunks = [];
      result.on('data', chunk => chunks.push(chunk));
      result.on('end', () => resolve({ headers: result.headers, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });

  const privateResponse = await get('/api/auth/session');
  const catalogResponse = await get('/api/tours/search');
  assert.equal(privateResponse.headers['content-encoding'], undefined);
  assert.equal(privateResponse.body, JSON.stringify({ token: 'private' }));
  assert.equal(catalogResponse.headers['content-encoding'], undefined);
  assert.equal(catalogResponse.body, JSON.stringify({ items: [{ title: 'Tour' }] }));
});
