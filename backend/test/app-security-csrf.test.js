const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { store } = require('../src/config/db.config');

test('composed API parses JWT cookies before enforcing CSRF Origin checks', async t => {
  const originalAuthenticate = store.authenticate;
  store.authenticate = async () => {};
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    store.authenticate = originalAuthenticate;
    await new Promise(resolve => server.close(resolve));
  });

  const url = `http://127.0.0.1:${server.address().port}/api/csrf-order-test`;
  const rejected = await fetch(url, { method: 'POST', headers: { Cookie: 'token=test-jwt' } });
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).code, 'CSRF_ORIGIN_REJECTED');

  const allowed = await fetch(url, { method: 'POST', headers: { Cookie: 'token=test-jwt', Origin: 'http://localhost:4200' } });
  assert.equal(allowed.status, 404);

  const settings = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/settings/booking`);
  assert.equal(settings.status, 401);
});
