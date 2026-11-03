const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cwd = path.resolve(__dirname, '..');
test('explicit MongoDB DNS setting applies only to the backend process', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./src/config/env'); process.stdout.write(JSON.stringify(require('node:dns').getServers()))"], { cwd, encoding: 'utf8', env: { ...process.env, MONGODB_DNS_SERVERS: '1.1.1.1, 8.8.8.8' } });
  assert.equal(result.status, 0); assert.deepEqual(JSON.parse(result.stdout), ['1.1.1.1', '8.8.8.8']);
});
test('invalid explicit DNS configuration fails clearly', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./src/config/env')"], { cwd, encoding: 'utf8', env: { ...process.env, MONGODB_DNS_SERVERS: 'not-a-dns-server' } });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /MONGODB_DNS_SERVERS must contain valid/);
});
