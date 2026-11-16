const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isIsolatedLoopbackMongoUri } = require('./helpers/test-mongodb-guard');

test('Mongo write tests accept only an explicit loopback disposable test port', () => {
  assert.equal(isIsolatedLoopbackMongoUri('mongodb://127.0.0.1:27019/GreenStepsIntegrationTest?replicaSet=rs0'), true);
  assert.equal(isIsolatedLoopbackMongoUri('mongodb://localhost:27019/GreenStepsIntegrationTest?replicaSet=rs0'), true);
  assert.equal(isIsolatedLoopbackMongoUri('mongodb://localhost:27017/GreenStepsDataMigrated'), false);
  assert.equal(isIsolatedLoopbackMongoUri('mongodb://localhost:27019/GreenStepsDataMigrated'), false);
  assert.equal(isIsolatedLoopbackMongoUri('mongodb://localhost:27019/?replicaSet=rs0'), false);
  assert.equal(isIsolatedLoopbackMongoUri('mongodb://testuser:testpass@localhost:27019/GreenStepsIntegrationTest'), false);
  assert.equal(isIsolatedLoopbackMongoUri('mongodb://db.example.com:27019/GreenStepsTest'), false);
  assert.equal(isIsolatedLoopbackMongoUri('mongodb+srv://cluster.example.com/GreenStepsTest'), false);
});
