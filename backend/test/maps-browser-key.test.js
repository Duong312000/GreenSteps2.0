const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('browser Maps credentials are supplied at deployment and no key is embedded in the HTML source', () => {
  const indexPath = path.resolve(__dirname, '../../my-app/src/index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(html), false);
  assert.equal(/<meta name="google-maps-browser-key" content="">/.test(html), true);
});
