// Isolated fixtures are required because authentication validates stored accounts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('../src/config/env');
const configured = process.env.TEST_MONGODB_URI;
if (configured) {
  const uri = new URL(configured);
  uri.pathname = `/CatalogTest_${randomUUID().replaceAll('-', '')}`;
  process.env.MONGODB_URI = uri.toString();
}
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { store, User, GreenService, ScheduleSample, PartnerCampaign, ServiceBooking, TourBooking } = require('../src/models');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');

test('admin catalog reads shared MongoDB records and restricts access', { skip: !configured, timeout: 30000 }, async () => {
  let server;
  try {
    await store.sync();
    for (const [id, role] of [['read-only-catalog-check', 'admin'], ['read-only-traveler-check', 'traveler']]) {
      await User.create({ id, role, username: id, email: `${id}@example.invalid`, password_hash: 'unused' });
    }
    await GreenService.create({ id: 'catalog-service', name_service: 'Catalog service', type: 'stay', cost: 100000, destination: 'Da Lat' });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/admin/catalog`;
    const headers = { Authorization: `Bearer ${jwt.sign({ id: 'read-only-catalog-check', role: 'admin' }, JWT_SECRET, { expiresIn: '1m' })}` };
    assert.equal((await fetch(`${base}/services`)).status, 401);
    const travelerHeaders = { Authorization: `Bearer ${jwt.sign({ id: 'read-only-traveler-check', role: 'traveler' }, JWT_SECRET, { expiresIn: '1m' })}` };
    assert.equal((await fetch(`${base}/services`, { headers: travelerHeaders })).status, 403);
    for (const [kind, models] of [['services', [GreenService]], ['tours', [ScheduleSample]], ['promotions', [PartnerCampaign]], ['allBookings', [ServiceBooking, TourBooking]]]) {
      const response = await fetch(`${base}/${kind}`, { headers });
      assert.equal(response.status, 200, kind);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const rows = await response.json();
      const source = (await Promise.all(models.map(model => model.findAll()))).flat();
      assert.deepEqual(rows.map(row => row.id).sort(), source.map(row => row.id).sort(), kind);
      assert.ok(rows.every(row => !('password_hash' in row) && !('customer_email' in row)));
      if (kind === 'services') for (const row of rows) {
        const original = source.find(item => item.id === row.id);
        assert.equal(row.status, original.status);
        assert.equal(row.value, original.cost);
      }
      if (kind === 'tours') assert.ok(rows.every(row => row.name));
      console.log(`${kind}: ${rows.length} records match MongoDB`);
    }
    assert.equal((await fetch(`${base}/unknown`, { headers })).status, 404);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (store.db?.databaseName.startsWith('CatalogTest_')) await store.db.dropDatabase();
    await store.close();
  }
});
