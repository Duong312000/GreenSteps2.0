// Real MongoDB/API smoke test. Creates and removes only its own fixtures.
const { chromium } = require('playwright');
const { expect } = require('playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { User, store } = require('../../backend/src/models');
const m = require('../../backend/src/food/model');
const jwt = require('../../backend/node_modules/jsonwebtoken');
const { JWT_SECRET } = require('../../backend/src/middlewares/auth.middleware');
let origin = process.env.FOOD_UI_ORIGIN;
const tag = 'food-ui-' + randomUUID();
const artifacts = path.resolve(__dirname, '../../tmp/food-artifacts');
let browser, staticServer, debugPage;
const users = [];
(async () => {
  try {
    await m.init();
    fs.mkdirSync(artifacts, { recursive: true });
    if (!origin) {
      const root = path.resolve(__dirname, '../dist/my-app/browser');
      const mime = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.woff2': 'font/woff2',
      };
      staticServer = http.createServer((req, res) => {
        let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
        if (!file.startsWith(root + path.sep) && file !== root) return res.writeHead(403).end();
        if (!fs.existsSync(file) || !fs.statSync(file).isFile())
          file = path.join(root, 'index.html');
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
      await new Promise((resolve) => staticServer.listen(0, '127.0.0.1', resolve));
      origin = `http://127.0.0.1:${staticServer.address().port}`;
    }
    for (const role of ['admin', 'traveler']) {
      const user = {
        id: tag + '-' + role,
        username: tag + '-' + role,
        fullname: 'Khách kiểm thử',
        role,
      };
      await User.create({
        ...user,
        email: user.id + '@greensteps.invalid',
        password_hash: 'disabled-test-account',
      });
      users.push({
        user,
        token: jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: '15m' }),
      });
    }
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    async function context(auth) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
      await ctx.addInitScript((auth) => {
        localStorage.setItem('greensteps_tour_done', 'true');
        if (auth) {
          localStorage.setItem('greensteps_user', JSON.stringify(auth.user));
          localStorage.setItem('greensteps_token', auth.token);
        }
      }, auth || null);
      return ctx;
    }
    const guest = await context(),
      page = await guest.newPage();
    debugPage = page;
    await page.goto(origin + '/services?type=food');
    await page.locator('.food-card').first().waitFor();
    await expect(page.locator('.food-card')).toHaveCount(6);
    await page.locator('.food-page').screenshot({ path: path.join(artifacts, 'desktop.png') });
    assert.ok(
      await page
        .locator('.food-photo img')
        .evaluateAll((images) => images.every((i) => i.complete && i.naturalWidth > 0)),
    );
    await page
      .locator('.food-categories')
      .getByRole('button', { name: 'Quán chay', exact: true })
      .click();
    await expect(page.locator('.food-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Đặt lại', exact: true }).click();
    await page.getByLabel('Dưới 100.000đ', { exact: true }).check();
    await expect(page.locator('.food-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Đặt lại', exact: true }).click();
    await page.getByLabel('Tìm tên quán hoặc món ăn', { exact: true }).fill('An Nhien');
    await expect(page.locator('.food-card')).toHaveCount(1);
    await page.getByLabel('Tìm tên quán hoặc món ăn', { exact: true }).fill('');
    await page
      .locator('.food-card')
      .first()
      .getByRole('button', { name: 'Xem thực đơn', exact: true })
      .click();
    await page.locator('.food-menu li').first().waitFor();
    await page.keyboard.press('Escape');
    await expect(page.locator('.food-dialog')).toHaveCount(0);
    await page.locator('.food-heart').first().click();
    assert.ok(
      JSON.parse(await page.evaluate(() => localStorage.getItem('greensteps_food_saved'))).length,
    );
    await page.setViewportSize({ width: 973, height: 1000 });
    assert.equal(
      await page
        .locator('.food-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      3,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'mobile.png') });
    await page.locator('.food-card').first().scrollIntoViewIfNeeded();
    await expect(page.locator('.food-card').first()).toBeInViewport();
    await page.screenshot({ path: path.join(artifacts, 'mobile-cards.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page
      .locator('.food-card')
      .first()
      .getByRole('button', { name: 'Thêm vào lịch trình' })
      .click();
    await page.locator('.food-schedule-handoff').waitFor();
    await page.goto(origin + '/schedule/new');
    await page
      .locator('.food-schedule-handoff')
      .getByRole('button', { name: 'Thêm vào ngày này' })
      .click();
    await page.waitForFunction(() =>
      Object.keys(localStorage).some(
        (key) =>
          key.startsWith('greensteps_guest_draft_') &&
          JSON.parse(localStorage.getItem(key)).days.some((day) =>
            day.activities.some((a) => a.title === 'Bếp Chay Lá Phong'),
          ),
      ),
    );
    console.log(
      'PASS public cards, photos, category/budget/text filters, menu, favorites, mobile and itinerary handoff',
    );

    const traveler = await context(users[1]),
      customer = await traveler.newPage();
    debugPage = customer;
    await customer.goto(origin + '/services?type=food');
    await customer
      .locator('.food-card')
      .first()
      .getByRole('button', { name: 'Đặt bàn', exact: true })
      .click();
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await customer.locator('[name=reserveDate]').fill(date);
    await customer.locator('[name=reserveTime]').fill('12:00');
    await customer.locator('[name=fullname]').fill('Khách kiểm thử');
    await customer.locator('[name=phone]').fill('0901234567');
    await customer
      .locator('.food-dialog')
      .getByRole('button', { name: 'Gửi yêu cầu đặt bàn', exact: true })
      .click();
    await customer.locator('.food-notice').waitFor();
    const reservation = await m.reservations().findOne({ userId: users[1].user.id });
    assert.equal(reservation.status, 'pending');

    const admin = await context(users[0]),
      dashboard = await admin.newPage();
    debugPage = dashboard;
    await dashboard.goto(origin + '/admin/food');
    await dashboard.getByRole('button', { name: '+ Thêm địa điểm', exact: true }).click();
    assert.equal(await dashboard.locator('app-header').count(), 0);
    await dashboard.locator('[name=name]').fill(tag);
    await dashboard.locator('[name=address]').fill('Địa chỉ UI test');
    await dashboard.locator('textarea[name=description]').fill('Mô tả UI test');
    await dashboard.locator('[name=min]').fill('75000');
    await dashboard.locator('[name=max]').fill('150000');
    await dashboard.locator('[name=dish0]').fill('Cơm chay kiểm thử');
    await dashboard.locator('[name=price0]').fill('75000');
    await dashboard.getByRole('button', { name: 'Lưu địa điểm', exact: true }).click();
    await dashboard.locator('.success').waitFor();
    let row = dashboard.locator('tbody tr').filter({ hasText: tag });
    await row.getByRole('button', { name: 'Hiện', exact: true }).click();
    await row.getByText('Đang hiển thị', { exact: true }).waitFor();
    await customer.reload();
    await customer.locator('.food-card').first().waitFor();
    await customer.getByLabel('Tìm tên quán hoặc món ăn', { exact: true }).fill(tag);
    await expect(customer.locator('.food-card')).toHaveCount(1);
    await row.getByRole('button', { name: 'Sửa', exact: true }).click();
    await dashboard.locator('[name=min]').fill('99000');
    await dashboard.getByRole('button', { name: 'Lưu địa điểm', exact: true }).click();
    await dashboard.locator('.editor').waitFor({ state: 'hidden' });
    await customer.reload();
    await customer.locator('.food-card').first().waitFor();
    await customer.getByLabel('Tìm tên quán hoặc món ăn', { exact: true }).fill(tag);
    await expect(customer.locator('.food-price')).toContainText(/99[.,]000/);
    await dashboard.locator('.food-admin').screenshot({ path: path.join(artifacts, 'admin.png') });
    const reservationRow = dashboard.locator('tbody tr').filter({ hasText: 'Khách kiểm thử' });
    await reservationRow.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await reservationRow.getByText('Đã xác nhận', { exact: true }).waitFor();
    assert.equal((await m.reservations().findOne({ id: reservation.id })).status, 'confirmed');
    await row.getByRole('button', { name: 'Ẩn', exact: true }).click();
    await row.getByText('Đã ẩn', { exact: true }).waitFor();
    await customer.reload();
    await customer.locator('.food-card').first().waitFor();
    await customer.getByLabel('Tìm tên quán hoặc món ăn', { exact: true }).fill(tag);
    await expect(customer.locator('.food-card')).toHaveCount(0);
    await row.getByRole('button', { name: 'Xóa', exact: true }).click();
    await dashboard.getByRole('button', { name: 'Xóa địa điểm', exact: true }).click();
    await row.waitFor({ state: 'hidden' });
    console.log(
      'PASS reservation persisted/confirmed, admin create/edit/publish/hide/delete reflected on customer page',
    );
  } catch (error) {
    if (debugPage && !debugPage.isClosed()) {
      await debugPage.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(artifacts, 'failure.txt'), await debugPage.locator('body').ariaSnapshot());
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
    await m.places().deleteMany({ name: tag });
    await m.reservations().deleteMany({ userId: { $in: users.map((u) => u.user.id) } });
    for (const u of users) await User.destroy({ where: { id: u.user.id } });
    await store.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
