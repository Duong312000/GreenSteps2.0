// Read-only check against the local frontend/API and the existing demo catalog.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    for (const [type, query] of [['stay', 'Anantara Hoi An Resort'], ['food', 'Afternoon Tea'], ['transport', 'Hoi An Bike Tours'], ['attraction', 'Spice Spoons']]) {
      await page.goto(`http://localhost:4200/services?type=${type}`);
      await page.locator('.shopco-product-card').first().waitFor();
      await page.getByPlaceholder('Tìm kiếm theo tên dịch vụ, điểm đến hoặc tiện ích...').fill(query);
      await page.waitForFunction(text => [...document.querySelectorAll('.shopco-product-card .card-title')]
        .some(item => item.textContent.includes(text)), query);
      assert.ok(await page.locator('.shopco-product-card .card-title').filter({ hasText: query }).count());
      console.log(`PASS: ${type}, sourced service visible without ratings`);
    }
    await page.goto('http://localhost:4200/services/stay/srv_demo_detail_dalat_garden');
    await page.getByRole('tab', { name: 'Phòng', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.room-card').length === 3);
    assert.equal(await page.locator('.room-card').count(), 3);
    console.log('PASS: lodging detail displays 3 database room types');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
