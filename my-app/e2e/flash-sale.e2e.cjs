// Real API/MongoDB fixtures; only this run's records are removed afterwards.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
require('../../backend/src/config/env');
const app = require('../../backend/src/app');
const { store, User, GreenService, PartnerCampaign } = require('../../backend/src/models');
const jwt = require('../../backend/node_modules/jsonwebtoken');
const { JWT_SECRET } = require('../../backend/src/middlewares/auth.middleware');
const nearby = require('../../backend/data/service-nearby-landmarks.json')[0];
const tag = 'flash-ui-' + randomUUID();
const root = path.resolve(__dirname, '../dist/my-app/browser');
const artifacts = path.resolve(__dirname, '../../tmp/flash-sale-artifacts');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
let apiServer, staticServer, browser;
(async () => {
  try {
    await store.authenticate();
    const user = { id: tag, username: tag, fullname: 'Admin kiểm thử', role: 'admin' };
    await User.create({ ...user, email: tag + '@example.invalid', password_hash: 'not-used', is_verified: true });
    const services = [
      ['Thuê xe đạp – Hội An Bike Tours', 'transport', 50000, 'Hội An', 'transport_green_bike'],
      ['Afternoon Tea – Ana Mandara Villas Dalat', 'food', 299000, 'Đà Lạt', 'food_local_cafe'],
      ['Anantara Hội An Resort', 'stay', 2850000, 'Hội An', 'stay_hoi_an_eco'],
      ['Ana Mandara Villas Dalat Resort & Spa', 'stay', 1850000, 'Đà Lạt', 'stay_green_boutique'],
      ['Combo nghỉ dưỡng Đà Lạt', 'stay', 3200000, 'Đà Lạt', 'stay_pine_hill'],
      ['Tour chèo SUP ngắm bình minh', 'attraction', 650000, 'Đà Lạt', 'attraction_kayaking'],
    ];
    for (const [i, [name, type, cost, destination, image]] of services.entries()) {
      await GreenService.create({ id: `${tag}-s${i}`, name_service: name, type, cost, destination,
        vender_id: tag, status: 'active', image_url: `image/services/${image}.png`,
        ...(type === 'stay' ? { current_data: {
          ...(i === 3 ? { address: 'Đường Lê Lai, Đà Lạt, Lâm Đồng, Việt Nam', nearbyGroups: nearby.groups, nearbySources: nearby.sources, nearbyCheckedAt: nearby.checkedAt, nearbyOrigin: nearby.origin } : {}),
          greenFeatures: [{ title: 'Sản phẩm vệ sinh hữu cơ', description: 'Danh mục tiện nghi phòng của cơ sở có sản phẩm vệ sinh hữu cơ.' }],
          policyGroups: [
            { title: 'Thời gian nhận và trả phòng', lines: ['Nhận phòng từ 14:00; trả phòng trước 12:00. Nhận sớm hoặc trả muộn có thể phát sinh phí.'] },
            { title: 'Giấy tờ nhận phòng', lines: ['Xuất trình giấy tờ tùy thân hoặc hộ chiếu hợp lệ khi làm thủ tục.'] },
            { title: 'Quy định tại khu nghỉ dưỡng', lines: ['Không mang thú cưng. Không nấu ăn hoặc giặt đồ trong phòng. Khách thăm cần đăng ký với lễ tân và không lưu lại sau 22:00.'] },
          ], rooms: [{ id: 'room', name: 'Phòng nghỉ', price_per_night: cost, capacity: 2, available_rooms: 3 }],
        } } : {}) });
      await PartnerCampaign.create({ id: `${tag}-c${i}`, name: `${tag} ${i}`, type: 'flash_sale',
        user_id: tag, vender_id: tag, service_id: `${tag}-s${i}`, status: 'active',
        start_at: new Date(Date.now() - 60000), end_at: new Date(Date.now() + (i === 3 ? 3600000 : 153000000)),
        discount_type: i === 2 ? 'fixed' : 'percent', discount_value: [30, 15, 500000, 20, 25, 30][i],
        usage_limit: 20, used_count: [12, 0, 16, 2, 11, 0][i] });
    }
    apiServer = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;
    const token = jwt.sign({ id: tag }, JWT_SECRET, { expiresIn: '10m' });
    const endpoint = `${apiOrigin}/api/admin/promotions/${tag}-c0`;
    const fixture = await PartnerCampaign.collection.findOne({ id: `${tag}-c0` });
    const edit = { version: fixture._rev || 0, usage_limit: 30, discount_type: 'percent', discount_value: 30,
      start_at: fixture.start_at.toISOString(), end_at: fixture.end_at.toISOString(), status: 'active' };
    assert.equal((await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) })).status, 401);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    assert.equal((await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify({ ...edit, usage_limit: 1 }) })).status, 400);
    assert.equal((await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify({ ...edit, version: 999 }) })).status, 409);
    staticServer = http.createServer((req, res) => {
      let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!file.startsWith(root + path.sep) && file !== root) return res.writeHead(403).end();
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
    const origin = `http://localhost:${staticServer.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://localhost:5055/**', route => route.continue({ url: route.request().url().replace('http://localhost:5055', apiOrigin) }));
    await page.addInitScript(({ user, token }) => {
      localStorage.setItem('greensteps_user', JSON.stringify(user));
      localStorage.setItem('greensteps_token', token);
    }, { user, token });
    fs.mkdirSync(artifacts, { recursive: true });
    await page.goto(origin + '/promotions/for-you');
    await page.locator('.flash-card').first().waitFor();
    await page.locator('.search input').fill(tag);
    assert.equal(await page.locator('.flash-card').count(), 6);
    await page.locator('.flash-sale').scrollIntoViewIfNeeded();
    await page.locator('.flash-sale').screenshot({ path: path.join(artifacts, 'flash-desktop.png') });
    const before = await page.locator('.flash-countdown').innerText();
    await page.waitForTimeout(1200);
    assert.notEqual(await page.locator('.flash-countdown').innerText(), before);
    assert.match(await page.locator('.flash-sale').innerText(), /chỉ còn 4/i);
    await page.locator('.flash-view-all').click();
    await page.locator('.flash-track.expanded').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.flash-view-all').click();
    await page.locator('.flash-sale').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'flash-mobile.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.flash-controls button').last().click();
    await page.waitForFunction(() => document.querySelector('.flash-track').scrollLeft > 0);
    await page.setViewportSize({ width: 1536, height: 1024 });
    // The price selected on a Flash Sale card must survive both navigations.
    await page.locator('.flash-card h4 a').filter({ hasText: 'Thuê xe đạp' }).click();
    await page.waitForURL(/\/services\/transport\/.*flashSale=/);
    await page.locator('.price-sale-label').waitFor();
    await page.waitForFunction(() => document.querySelector('.price-block strong')?.textContent?.replace(/\s/g, '').includes('70.000'));
    await page.locator('.primary-booking-button').first().click();
    await page.waitForURL(/\/booking\?.*flashSaleId=/);
    await page.waitForFunction(() => document.querySelector('.choice-total strong')?.textContent?.replace(/\s/g, '').includes('57.000'));
    assert.match(await page.locator('.choice-summary-card').innerText(), /Flash Sale/);
    await page.screenshot({ path: path.join(artifacts, 'flash-checkout.png') });
    await page.goto(origin + `/services/stay/${tag}-s2?flashSale=${tag}-c2`);
    await page.locator('.price-sale-label').waitFor();
    const pane = page.locator('.booking-card');
    const bounds = await pane.boundingBox();
    const buttonBounds = await pane.locator('.primary-booking-button').boundingBox();
    assert.ok(buttonBounds.y + buttonBounds.height <= bounds.y + bounds.height - 12, 'Room button must stay inside the booking card');
    assert.equal(await page.locator('.price-block.has-sale strong').evaluate(el => getComputedStyle(el).color), 'rgb(217, 54, 34)');
    await pane.screenshot({ path: path.join(artifacts, 'stay-booking-card.png') });
    await page.locator('.gs-green-story').screenshot({ path: path.join(artifacts, 'green-details-desktop.png') });
    await page.locator('#tab-policy').click();
    await page.locator('.gs-policy-guide').waitFor();
    assert.match(await page.locator('.gs-policy-times').innerText(), /14:00/);
    assert.match(await page.locator('.gs-policy-times').innerText(), /12:00/);
    assert.equal(await page.locator('.gs-policy-entry').count(), 3);
    await page.locator('.gs-policy-guide').screenshot({ path: path.join(artifacts, 'policies-desktop.png') });
    await page.locator('.gs-policy-entry summary').first().click();
    assert.equal(await page.locator('.gs-policy-entry').first().evaluate(el => el.open), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.gs-policy-guide').screenshot({ path: path.join(artifacts, 'policies-mobile.png') });
    await page.locator('#tab-overview').click();
    await page.locator('.gs-green-story').screenshot({ path: path.join(artifacts, 'green-details-mobile.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.goto(origin + `/services/stay/${tag}-s3?flashSale=${tag}-c3`);
    await page.locator('.price-sale-label').waitFor();
    assert.equal(await page.locator('.gs-nearby-place').count(), 7, 'Nearby HTML must exist before the location tab is opened');
    assert.ok(!(await page.locator('link[rel=canonical]').getAttribute('href')).includes('flashSale'));
    const schema = await page.locator('#greensteps-service-schema').textContent();
    assert.equal(JSON.parse(schema)['@graph'].find(row => row['@type'] === 'ItemList').numberOfItems, 7);
    assert.ok((await page.title()).includes('Ana Mandara'));
    await page.locator('#tab-location').click();
    await page.locator('.gs-location-hub').screenshot({ path: path.join(artifacts, 'location-desktop.png') });
    assert.match(await page.locator('.gs-location-hub').innerText(), /2,3 km/);
    assert.match(await page.locator('.gs-location-hub').innerText(), /30,9 km/);
    const directions = new URL(await page.locator('.gs-nearby-place>a').first().getAttribute('href'));
    assert.equal(directions.searchParams.get('origin'), nearby.origin);
    assert.equal(directions.searchParams.get('travelmode'), 'walking');
    await page.locator('.gs-nearby-filters button').last().click();
    await page.waitForFunction(() => document.querySelectorAll('.gs-nearby-group:not([hidden])').length === 1);
    await page.locator('.gs-nearby-filters button').first().click();
    await page.setViewportSize({ width: 390, height: 1600 });
    await page.locator('.gs-location-hub').screenshot({ path: path.join(artifacts, 'location-mobile.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.goto(origin + '/admin?tab=promotions');
    assert.equal(await page.locator('#greensteps-service-schema').count(), 0, 'Service SEO must clear after navigation');
    await page.locator('.queue-search input').fill(`${tag} 0`);
    const row = page.locator('tbody tr').filter({ hasText: `${tag} 0` });
    await row.getByRole('button', { name: 'Chỉnh sửa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Chỉnh sửa Flash Sale' });
    await dialog.locator('[name=flashLimit]').fill('30');
    await dialog.screenshot({ path: path.join(artifacts, 'admin-edit.png') });
    await dialog.getByRole('button', { name: 'Lưu Flash Sale' }).click();
    await dialog.waitFor({ state: 'hidden' });
    const saved = await PartnerCampaign.collection.findOne({ id: `${tag}-c0` });
    assert.equal(saved.usage_limit, 30);
    assert.equal(saved.used_count, 12);
    await page.reload();
    await page.locator('.queue-search input').fill(`${tag} 0`);
    await row.getByRole('button', { name: 'Chỉnh sửa' }).waitFor();
    assert.ok((await row.innerText()).includes('18'));
    await page.goto(origin + '/promotions/for-you');
    await page.locator('.flash-card').first().waitFor();
    await page.locator('.search input').fill(tag);
    assert.ok((await page.locator('.flash-sale').innerText()).includes('Còn 18/30 suất'));
    await page.waitForLoadState('networkidle');
    assert.deepEqual(errors, []);
    console.log('PASS: countdown, cards, stock, mobile, Flash Sale detail/checkout prices, admin persistence and API validation');
  } finally {
    if (browser) await browser.close();
    if (staticServer) await new Promise(resolve => staticServer.close(resolve));
    if (apiServer) await new Promise(resolve => apiServer.close(resolve));
    await Promise.all([User.collection.deleteMany({ id: tag }), GreenService.collection.deleteMany({ vender_id: tag }), PartnerCampaign.collection.deleteMany({ user_id: tag })]);
    await store.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
