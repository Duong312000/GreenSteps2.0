const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

test('CLI explains a missing explicit apply flag before attempting a database connection', () => {
  const env = { ...process.env };
  delete env.GS_ALLOW_DEMO_TOUR_ENRICHMENT;
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/enrich-demo-tours.js'), '--apply'], {
    cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Explicit enrichment apply environment flag is required/);
  assert.doesNotMatch(result.stderr, /mongodb(?:\+srv)?:\/\/|password|credential/i);
});
