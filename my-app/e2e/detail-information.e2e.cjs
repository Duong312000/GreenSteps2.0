// Read-only verification of the information tabs using the saved demo catalog.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = path.resolve(__dirname, '../../tmp/detail-information');
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const saved = await (await fetch('http://localhost:5055/api/services/srv_demo_detail_hoian_riverside')).json();
    const data = saved.current_data;
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } });
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:4200/tour-detail/srv_demo_detail_hoian_riverside');
      await page.locator('#detail-overview').waitFor();
      assert.equal(await page.locator('.demo-data-note').count(), 0);
      assert.ok(await page.locator('.catalog-sources').isVisible());
      assert.ok(await page.getByRole('heading', { name: 'Xem xung quanh đây', exact: true }).isVisible());
      assert.equal(await page.locator('.green-practices-grid article').count(), data.greenFeatures.length);
      for (const [tab, selector] of [['Tiện nghi & Dịch vụ', '#detail-included'], ['Chính Sách', '#detail-policy'], ['Vị trí', '#detail-location']]) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.locator(selector).waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${tab}: horizontal overflow at ${width}`);
        if (selector === '#detail-included') {
          assert.equal(await page.locator('.clear-amenity-group').count(), data.amenityGroups.length);
          assert.ok(await page.locator('.amenity-fee.free').count());
        }
        if (selector === '#detail-policy') assert.equal(await page.locator('.policy-detail-row').count(), data.policyGroups.length);
        if (selector === '#detail-location') assert.equal(await page.locator('.surroundings-group').count(), data.nearbyGroups?.length || (data.nearby?.length ? 1 : 0));
        await page.locator('.detail-tabs').evaluate(element => element.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: path.join(artifacts, `${selector.slice(1)}-${width}.png`), animations: 'disabled' });
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS structured amenities, policies, green features and location at ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
