// Read-only checks against the configured MongoDB database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { store, GreenService, ScheduleSample, PartnerCampaign, ServiceBooking, TourBooking } = require('../src/models');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');

test('admin catalog reads shared MongoDB records and restricts access', { timeout: 30000 }, async () => {
  let server;
  try {
    await store.authenticate();
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
    await store.close();
  }
});
