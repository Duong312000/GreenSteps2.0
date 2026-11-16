// Prepares source-backed food photographs as database JPEG data URIs.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const cache = path.resolve(__dirname, '../../tmp/food-images/cache');

let page;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function commonsUrls(source) {
  const file = decodeURIComponent(new URL(source).pathname.split('/wiki/File:')[1]).replace(/ /g, '_');
  const hash = crypto.createHash('md5').update(file).digest('hex');
  const base = `${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(file)}`;
  return [`https://upload.wikimedia.org/wikipedia/commons/thumb/${base}/960px-${encodeURIComponent(file)}`,
    `https://upload.wikimedia.org/wikipedia/commons/${base}`];
}

async function convert(value, data) {
  if (!value || value.startsWith('data:image/')) return value;
  const metadata = data.imageMetadata?.find(item => item.path === value);
  const source = /^https?:/.test(value) ? value : metadata?.sourcePage;
  const key = crypto.createHash('sha256').update(source || value).digest('hex');
  await fs.mkdir(cache, { recursive: true });
  const file = path.join(cache, key + '.json');
  try { return JSON.parse(await fs.readFile(file, 'utf8')).image; } catch {}
  let bytes, mime;
  if (!/^https?:/.test(value)) {
    try {
      bytes = await fs.readFile(path.resolve(__dirname, '../../my-app/public', value.replace(/^\//, '')));
      mime = /\.png$/i.test(value) ? 'image/png' : 'image/jpeg';
    } catch {}
  }
  if (!bytes) {
    assert.ok(source, `No recoverable source for ${value}`);
    const urls = source.includes('commons.wikimedia.org/wiki/File:') ? commonsUrls(source) : [source];
    let lastError;
    for (const url of urls) {
      try {
        let response;
        for (let attempt = 0; attempt < 4; attempt++) {
          await pause(attempt ? 15000 : 1800);
          response = await fetch(url, { headers: { 'User-Agent': 'GreenStepsImageRepair/1.0' }, signal: AbortSignal.timeout(20000) });
          if (response.status !== 429) break;
          await response.body?.cancel();
        }
        assert.ok(response.ok && response.headers.get('content-type')?.startsWith('image/'), `HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        mime = response.headers.get('content-type').split(';')[0];
        break;
      } catch (error) { lastError = error; }
    }
    assert.ok(bytes, `Unable to recover ${source}: ${lastError?.message}`);
  }
  const image = await page.evaluate(async ({ uri }) => {
    const image = new Image(); image.src = uri; await image.decode();
    const scale = Math.min(1, 1100 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.84);
  }, { uri: `data:${mime};base64,${bytes.toString('base64')}` });
  assert.ok(image.startsWith('data:image/jpeg;base64,'));
  await fs.writeFile(file, JSON.stringify({ source: source || value, image }));
  console.log(JSON.stringify({ prepared: source || value, bytes: Math.round(image.length * .75) }));
  return image;
}

module.exports = { convert, setPage(value) { page = value; } };
