const { test } = require('node:test');
const assert = require('node:assert/strict');
const serviceRoutes = require('../src/routes/service.routes');
const { authMiddleware } = require('../src/middlewares/auth.middleware');

test('personalized service recommendations authenticate the account before using the route user ID', () => {
  const route = serviceRoutes.stack.find(layer => layer.route?.path === '/recommendations/:userId')?.route;
  assert.ok(route, 'recommendation route should be registered');
  assert.equal(route.stack[0]?.handle, authMiddleware, 'JWT session middleware should run before the controller');
});
