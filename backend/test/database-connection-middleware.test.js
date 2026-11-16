const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabaseConnectionMiddleware } = require('../src/middlewares/database-connection.middleware');

test('database connection failure has a safe generic response and does not leak infrastructure details', async () => {
  const middleware = createDatabaseConnectionMiddleware({ store: { authenticate: async () => { throw new Error('mongo://internal-user:secret@private-host'); } } });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await middleware({}, res, error => { throw error; });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'DatabaseUnavailable');
  assert.equal(JSON.stringify(res.body).includes('private-host'), false);
  assert.equal(JSON.stringify(res.body).includes('secret'), false);
});
