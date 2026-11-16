// Read-only checks against the local API and running frontend.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
(async () => {
 const places = await (await fetch('http://localhost:5055/api/food/places')).json();
 assert.equal(places.length, 9);
 for (const place of places) {
  assert.equal(place.isDemo, false); assert.equal(place.rating, null);
  assert.equal(place.reviewCount, null); assert.equal(place.bookingEnabled, false);
  assert.ok(place.image.startsWith('data:image/')); assert.ok(place.mapsUrl.includes('maps'));
  assert.ok(place.sources.length > 0);
  const r = await fetch(`http://localhost:5055/api/food/places/${place.id}`);
  assert.equal(r.status, 200); assert.equal((await r.json()).name, place.name);
 }
 const b = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const origin = process.env.FOOD_UI_ORIGIN || 'http://localhost:4200';
  await p.goto(origin + '/services?type=food', { waitUntil: 'domcontentloaded' });
  const first = p.locator('.food-card').first(); await first.waitFor({ timeout: 30000 });
  assert.equal(await p.locator('.food-card').count(), 6);
  const destinationFilters = p.locator('.food-filters fieldset').first();
  for (const destination of ['Đà Lạt', 'Đà Nẵng', 'Hội An', 'Phú Yên']) {
   await destinationFilters.getByRole('button', { name: destination, exact: true }).click();
   await p.waitForTimeout(250);
   const expected = places.filter(place => place.destination === destination);
   assert.equal(await p.locator('.food-card').count(), Math.min(expected.length, 6));
   for (const name of await p.locator('.food-card h3').allTextContents()) {
    assert.ok(expected.some(place => place.name === name.trim()));
   }
  }
  await p.locator('.food-filters header').getByRole('button', { name: 'Đặt lại', exact: true }).click();
  await p.waitForTimeout(250);
  assert.ok((await destinationFilters.getByRole('button', { name: 'Tất cả', exact: true }).getAttribute('class')).includes('active'));
  assert.equal(await p.locator('.food-card').count(), 6);
  const name = (await first.locator('h3').textContent()).trim();
  await first.locator('.food-photo-link').click(); await p.waitForURL('**/local-food/*');
  await p.locator('.detail-heading h1').waitFor();
  assert.equal((await p.locator('.detail-heading h1').textContent()).trim(), name);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.locator('.detail-heading h1').waitFor();
  const artifacts = path.resolve(__dirname, '../../tmp/food-detail-artifacts'); fs.mkdirSync(artifacts, { recursive: true });
  await p.locator('.detail-photo img').evaluate(i => i.decode());
  await p.screenshot({ path: path.join(artifacts, 'real-food-desktop.png'), fullPage: true });
  await p.locator('.detail-breadcrumb a').click(); await first.waitFor();
  await first.locator('.food-title-link').focus(); await p.keyboard.press('Enter');
  await p.waitForURL('**/local-food/*'); await p.locator('.detail-heading h1').waitFor();
  await p.goBack(); await first.waitFor(); await first.locator('.food-actions .primary').click();
  await p.waitForURL('**/local-food/*#booking'); await p.locator('.contact-map').waitFor();
  for (const place of places) {
   await p.goto(origin + '/local-food/' + place.id, { waitUntil: 'domcontentloaded' });
   await p.locator('.detail-heading h1').waitFor();
   assert.equal((await p.locator('.detail-heading h1').textContent()).trim(), place.name);
   assert.equal(await p.locator('.contact-map').getAttribute('href'), place.mapsUrl);
   assert.equal(await p.locator('.reservation-card form').count(), 0);
   assert.equal(await p.locator('.detail-rating, .demo-note').count(), 0);
   assert.equal(await p.locator('.source-links a').count(), place.sources.length);
   await p.locator('.detail-photo img').evaluate(i => i.decode());
   if (place.priceMin === null) assert.equal(await p.locator('.contact-price').count(), 1);
  }
  await p.goto(origin + '/local-food/demo-food-bep-chay-la-phong', { waitUntil: 'domcontentloaded' });
  await p.locator('.detail-heading h1').waitFor();
  assert.equal((await p.locator('.detail-heading h1').textContent()).trim(), places[0].name);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: path.join(artifacts, 'real-food-mobile.png'), fullPage: true });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS: nine real places, four destinations and reset, base64 photos, source links, navigation, reload, legacy links and mobile');
 } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
