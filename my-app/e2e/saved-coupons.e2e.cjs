// Real API/MongoDB; these fixtures are removed in finally.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
require('../../backend/src/config/env');
const app = require('../../backend/src/app');
const { store, User, GreenService, PartnerCampaign, SavedPromotion, Wallet } = require('../../backend/src/models');
const jwt = require('../../backend/node_modules/jsonwebtoken');
const { JWT_SECRET } = require('../../backend/src/middlewares/auth.middleware');
const tag = 'coupon-ui-' + randomUUID();
const root = path.resolve(__dirname, '../dist/my-app/browser');
const artifacts = path.resolve(__dirname, '../../tmp/saved-coupons-artifacts');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
let apiServer, staticServer, browser;
(async () => {
  try {
    await store.authenticate();
    const user = { id: tag, username: tag, fullname: 'Khách kiểm thử', role: 'traveler' };
    await User.create({ ...user, email: tag + '@example.invalid', password_hash: 'not-used', is_verified: true });
    await GreenService.create({ id: tag, name_service: 'Trải nghiệm xanh Đà Lạt', type: 'food', cost: 299000, destination: 'Đà Lạt', vender_id: tag, status: 'active', max_capacity: 20 });
    await PartnerCampaign.create({ id: tag, name: `${tag} Trà chiều Đà Lạt`, type: 'voucher', code: 'TEA' + randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(),
      user_id: tag, vender_id: tag, service_id: tag, status: 'active', start_at: new Date(Date.now() - 60000), end_at: new Date(Date.now() + 86400000),
      discount_type: 'percent', discount_value: 15, min_order: 100000, usage_limit: 3 });
    apiServer = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://localhost:5055/**', route => route.continue({ url: route.request().url().replace('http://localhost:5055', apiOrigin) }));
    await page.goto(origin + '/promotions/for-you');
    await page.locator('.coupon-card').first().waitFor();
    await page.locator('.search input').fill(tag);
    await page.locator('.coupon-claim').click();
    await page.locator('.login-overlay').waitFor();
    assert.equal(await SavedPromotion.collection.countDocuments({ user_id: tag }), 0);
    const token = jwt.sign({ id: tag }, JWT_SECRET, { expiresIn: '10m' });
    await page.addInitScript(({ user, token }) => {
      localStorage.setItem('greensteps_user', JSON.stringify(user));
      localStorage.setItem('greensteps_token', token);
    }, { user, token });
    await page.reload();
    await page.locator('.coupon-card').first().waitFor();
    await page.locator('.search input').fill(tag);
    await page.locator('.coupon-claim').click();
    await page.getByRole('button', { name: 'Đã lưu', exact: true }).waitFor();
    await page.getByText('Còn 2/3 lượt nhận · Mỗi tài khoản 1 mã', { exact: true }).waitFor();
    fs.mkdirSync(artifacts, { recursive: true });
    await page.locator('[data-offer-group=coupon]').screenshot({ path: path.join(artifacts, 'coupon-saved.png') });
    await page.reload();
    await page.locator('.coupon-card').first().waitFor();
    await page.locator('.search input').fill(tag);
    await page.getByRole('button', { name: 'Đã lưu', exact: true }).waitFor();
    assert.equal((await PartnerCampaign.findByPk(tag)).claimed_count, 1);
    await page.goto(origin + '/profile?section=promotions');
    await page.locator('.saved-voucher').waitFor();
    assert.equal(await page.locator('.saved-voucher').count(), 1);
    assert.match(await page.locator('.saved-voucher-meta').innerText(), /Số lượng: 1 mã/);
    assert.match(await page.locator('.saved-voucher-meta').innerText(), /Hạn dùng:/);
    await page.locator('app-my-vouchers').screenshot({ path: path.join(artifacts, 'my-coupons-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.saved-voucher').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'my-coupons-mobile.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await PartnerCampaign.collection.updateOne({ id: tag }, { $set: { end_at: new Date(Date.now() - 1) } });
    await page.reload();
    await page.locator('.saved-voucher').waitFor();
    await page.getByText('Đã hết hạn', { exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Sao chép mã', exact: true }).isDisabled());
    assert.deepEqual(errors, []);
    console.log('PASS: login prompt, claim, remaining quantity, duplicate protection, reload persistence, profile expiry and mobile layout');
  } finally {
    if (browser) await browser.close();
    if (staticServer) await new Promise(resolve => staticServer.close(resolve));
    if (apiServer) await new Promise(resolve => apiServer.close(resolve));
    await Promise.all([SavedPromotion.collection.deleteMany({ user_id: tag }), PartnerCampaign.collection.deleteMany({ id: tag }), GreenService.collection.deleteMany({ id: tag }), Wallet.collection.deleteMany({ user_id: tag }), User.collection.deleteMany({ id: tag })]);
    await store.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
