// Browser + real HTTP API + real MongoDB. No API responses are mocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
require('../../backend/src/config/env');
const app = require('../../backend/src/app');
const {
  User,
  Vender,
  GreenService,
  PartnerCampaign: Campaign,
  store,
} = require('../../backend/src/models');
const jwt = require('../../backend/node_modules/jsonwebtoken');
const { JWT_SECRET } = require('../../backend/src/middlewares/auth.middleware');
const root = path.resolve(__dirname, '../dist/my-app/browser');
const artifacts = path.resolve(__dirname, '../../tmp/promotions-artifacts');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};
const id = 'promotion-ui-' + randomUUID();
let browser, apiServer, staticServer;
const errors = [];
(async () => {
  try {
    fs.mkdirSync(artifacts, { recursive: true });
    await store.authenticate();
    const user = {
      id,
      username: id,
      email: id + '@example.invalid',
      role: 'provider',
      fullname: 'Đối tác kiểm thử',
      companyName: 'GreenSteps Travel',
    };
    await User.create({ ...user, password_hash: 'not-used', is_verified: true });
    await Vender.create({ id: 'v-' + id, user_id: id });
    await GreenService.create({
      id: 's-' + id,
      vender_id: 'v-' + id,
      name_service: 'Hành trình xanh Đà Lạt',
      type: 'stay',
      cost: 500000,
      destination: 'Đà Lạt',
      status: 'active',
    });
    apiServer = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;
    staticServer = http.createServer((req, res) => {
      let file = path.resolve(
        root,
        '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
      );
      if (!file.startsWith(root + path.sep) && file !== root) return res.writeHead(403).end();
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((resolve) => staticServer.listen(0, '127.0.0.1', resolve));
    const origin = `http://localhost:${staticServer.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({
      viewport: { width: 1536, height: 1024 },
      ignoreHTTPSErrors: true,
    });
  await page.route(/^https:\/\//, route => route.abort());
    page.on('pageerror', (e) => errors.push(e.message));
    // Rewrite destination to this test's real backend process, preserving actual responses.
    await page.route('http://localhost:5055/**', (route) =>
      route.continue({ url: route.request().url().replace('http://localhost:5055', apiOrigin) }),
    );
    await page.addInitScript(
      ({ user, token }) => {
        localStorage.setItem('greensteps_user', JSON.stringify(user));
        localStorage.setItem('greensteps_token', token);
      },
      { user, token: jwt.sign(user, JWT_SECRET, { expiresIn: '1h' }) },
    );
    await page.goto(origin + '/partner-promotions');
    await page.getByText('Bắt đầu chiến dịch đầu tiên', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'desktop-empty.png'), fullPage: true });
    async function create(type, name) {
      await page.getByRole('button', { name: 'Tạo chiến dịch mới', exact: true }).first().click();
      const dialog = page.locator('dialog[open]');
      await dialog.locator('[name=name]').fill(name);
      await dialog.locator('[name=type]').selectOption(type);
      await dialog.locator('[name=service]').selectOption('s-' + id);
      if (type === 'voucher')
        await dialog
          .locator('[name=code]')
          .fill('UI' + randomUUID().replace(/-/g, '').slice(0, 18));
      await dialog.getByRole('button', { name: 'Tạo chiến dịch', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      await page.getByRole('button', { name, exact: true }).waitFor();
      assert.ok(await Campaign.collection.findOne({ user_id: id, name }));
    }
    await create('promotion', 'Khám phá sương mù Đà Lạt');
    await create('flash_sale', 'Flash Sale cuối tuần xanh');
    await create('voucher', 'Ưu đãi hành trình xanh');
    await page.reload();
    await page.getByRole('button', { name: 'Ưu đãi hành trình xanh', exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'desktop-campaigns.png'), fullPage: true });
    await page
      .getByRole('button', { name: 'Thao tác: Khám phá sương mù Đà Lạt', exact: true })
      .click();
    await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    await page.locator('dialog[open] [name=name]').fill('Đà Lạt xanh đã cập nhật');
    await page.locator('dialog[open]').getByRole('button', { name: 'Lưu thay đổi' }).click();
    await page.getByRole('button', { name: 'Đà Lạt xanh đã cập nhật', exact: true }).waitFor();
    await page
      .getByRole('button', { name: 'Thao tác: Đà Lạt xanh đã cập nhật', exact: true })
      .click();
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    await page.locator('tbody .status-badge.paused').waitFor();
    await page
      .getByRole('button', { name: 'Thao tác: Đà Lạt xanh đã cập nhật', exact: true })
      .click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('tbody .status-badge.paused'));
    await page.getByRole('button', { name: 'Mã ưu đãi', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
    assert.equal(await page.locator('tbody .name-link').count(), 1);
    await page.getByLabel('Tìm kiếm chiến dịch', { exact: true }).fill('không tìm thấy');
    await page.getByText('Không tìm thấy chiến dịch', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Đặt lại', exact: true }).click();
    await page.getByRole('button', { name: 'Ưu đãi hành trình xanh', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Tất cả chiến dịch', exact: true }).click();
    await page
      .getByRole('button', { name: 'Thao tác: Ưu đãi hành trình xanh', exact: true })
      .click();
    await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
    await page.getByText('Hiệu quả được ghi nhận', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'report.png') });
    await page.locator('dialog[open]').getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'No page-level horizontal overflow on mobile',
    );
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page
      .getByRole('button', { name: 'Thao tác: Ưu đãi hành trình xanh', exact: true })
      .click();
    await page.getByRole('button', { name: 'Xóa / Lưu trữ', exact: true }).click();
    await page
      .locator('dialog[open]')
      .getByRole('button', { name: 'Xác nhận', exact: true })
      .click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await page.reload();
    await page.getByRole('button', { name: 'Đà Lạt xanh đã cập nhật', exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Ưu đãi hành trình xanh', exact: true }).count(),
      0,
    );
    const archived = await Campaign.collection.findOne({
      user_id: id,
      name: 'Ưu đãi hành trình xanh',
    });
    assert.ok(archived.archived_at);
    assert.equal(archived.status, 'cancelled');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: browser CRUD, Mongo persistence, reload, edit, pause/resume, tabs/search, report, archive, mobile; no runtime errors.',
    );
  } finally {
    if (browser) await browser.close();
    if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
    if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
    if (store.db) {
      await Campaign.collection.deleteMany({ user_id: id });
      await GreenService.collection.deleteMany({ id: 's-' + id });
      await Vender.collection.deleteMany({ user_id: id });
      await User.collection.deleteMany({ id });
    }
    await store.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
