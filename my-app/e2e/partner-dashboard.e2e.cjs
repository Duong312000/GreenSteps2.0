// Isolated UI fixtures only. All /api requests are intercepted in this test;
// no credentials are used and no records are written to the real backend.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist/my-app/browser');
const artifacts = path.resolve(__dirname, '../../tmp/partner-dashboard-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
  );
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const user = {
  id: 'ui-test-provider',
  username: 'ui_test',
  fullname: 'Tài khoản kiểm thử',
  companyName: 'Đối tác kiểm thử giao diện',
  role: 'provider',
  email: 'ui-test@example.invalid',
};
const bookings = [
  {
    id: 'UI-BOOK-1',
    service: 'Homestay kiểm thử',
    service_id: 'ui-service-1',
    date: '20/10/2026',
    guests: 2,
    value: 100000,
    status: 'pending',
    customer: 'Khách kiểm thử A',
  },
  {
    id: 'UI-BOOK-2',
    service: 'Tour kiểm thử',
    service_id: 'ui-service-2',
    date: '19/10/2026',
    guests: 2,
    value: 200000,
    status: 'deposit',
    customer: 'Khách kiểm thử B',
  },
  {
    id: 'UI-BOOK-3',
    service: 'Tour kiểm thử',
    service_id: 'ui-service-2',
    date: '15/09/2026',
    guests: 1,
    value: 300000,
    status: 'completed',
    customer: 'Khách kiểm thử C',
  },
  {
    id: 'UI-BOOK-4',
    service: 'Tour kiểm thử',
    service_id: 'ui-service-2',
    date: '14/09/2026',
    guests: 1,
    value: 400000,
    status: 'cancelled',
    customer: 'Khách kiểm thử D',
  },
];
const services = [
  {
    id: 'ui-service-1',
    provider_id: user.id,
    name: 'Homestay kiểm thử',
    type: 'stay',
    status: 'active',
    cost: 100000,
    carbon: 2,
    destination: 'Đà Lạt',
    rating: 4.6,
    views_count: 120,
  },
  {
    id: 'ui-service-2',
    provider_id: user.id,
    name: 'Tour kiểm thử',
    type: 'tour',
    status: 'pending',
    cost: 200000,
    carbon: 4,
    destination: 'Đà Lạt',
    rating: 0,
    views_count: 20,
  },
];
let browser;
const unexpectedWrites = [];
async function contextFor(
  role = 'provider',
  empty = false,
  viewport = { width: 1536, height: 1100 },
) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const profile = { ...user, role };
  const token =
    'ui-test.' +
    Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, id: user.id, role }),
    ).toString('base64url') +
    '.ui-test';
  await context.addInitScript(
    ({ profile, token }) => {
      localStorage.setItem('greensteps_user', JSON.stringify(profile));
      localStorage.setItem('greensteps_token', token);
    },
    { profile, token },
  );
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    // Existing home page auto-requests itinerary advice after a denied route.
    // Keep this outside the partner test and never invoke a live AI provider.
    if (
      route.request().method() === 'POST' &&
      url.pathname === '/api/ai/chat' &&
      role !== 'provider'
    ) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'AI disabled in isolated UI test' }),
      });
      return;
    }
    if (route.request().method() !== 'GET') {
      unexpectedWrites.push({ method: route.request().method(), path: url.pathname });
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ success: false }),
      });
      return;
    }
    let data = [];
    if (url.pathname.endsWith('/bookings')) data = empty ? [] : bookings;
    else if (url.pathname.includes('/services/provider/')) data = empty ? [] : services;
    else if (url.pathname.includes('/profile/')) data = { success: true, user: profile };
    else if (url.pathname.includes('/wallet'))
      data = { registered: false, balance: 0, transactions: [] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  return context;
}
(async () => {
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const installed = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (fs.existsSync(installed) ? installed : undefined),
  });
  const errors = [];
  const context = await contextFor();
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(base + '/partner-dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('.kpi-card').first().getByText('4', { exact: true }).waitFor();
    assert.equal(await page.locator('app-header').count(), 1);
    assert.equal(await page.locator('app-partner-layout').count(), 1);
    assert.equal(await page.locator('.kpi-card').count(), 4);
    assert.match(await page.locator('.kpi-card').nth(1).innerText(), /600\.000/);
    assert.match(await page.locator('.kpi-card').nth(3).innerText(), /4,6/);
    assert.equal(await page.locator('.analytics-chart').count(), 2);
    assert.equal(await page.locator('tbody tr').count(), 4);
    assert.equal(await page.locator('.task-row').count(), 2);
    await page.locator('.period-select select').selectOption('2026-10');
    assert.equal(await page.locator('tbody tr').count(), 2);
    assert.match(await page.locator('.kpi-card').nth(1).innerText(), /300\.000/);
    await page.locator('.period-select select').selectOption('all');
    await page.evaluate(() => {
      window.partnerNavigationMarker = 'same-spa';
    });
    const sidebar = page.locator('#partner-sidebar');
    for (const route of [
      '/partner-services',
      '/partner-bookings',
      '/partner-ads',
      '/partner-promotions',
      '/partner-dashboard',
    ]) {
      await sidebar.locator(`a[href="${route}"]`).click();
      await page.waitForURL(base + route);
      assert.equal(await page.locator('app-partner-layout').count(), 1);
      assert.equal(await page.locator('app-header').count(), 1);
      assert.equal(await sidebar.locator('a.active').getAttribute('href'), route);
      assert.equal(await page.evaluate(() => window.partnerNavigationMarker), 'same-spa');
      assert.equal(
        await page
          .locator('app-header a[href="/partner-dashboard"]')
          .first()
          .evaluate((el) => el.classList.contains('active-nav-tab')),
        true,
      );
    }
    await page.locator('.quick-grid a').first().click();
    await page.waitForURL('**/partner-services?action=add');
    assert.equal(await sidebar.locator('a.active').getAttribute('href'), '/partner-services');
    await page.getByRole('heading', { name: 'Thêm dịch vụ mới', exact: true }).waitFor();
    await page.locator('app-header a[href="/partner-dashboard"]').first().click();
    await page.waitForURL(base + '/partner-dashboard');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Tải báo cáo CSV' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'greensteps-bookings.csv');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, 'partner-desktop.png'), fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    assert.notEqual(
      await page
        .locator('.dashboard-card')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(255, 255, 255)',
    );
    assert.equal(
      await page
        .locator('.kpi-value')
        .first()
        .evaluate((el) => getComputedStyle(el).color),
      'rgb(236, 245, 239)',
    );
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('app-header .nav-tab-item')).color ===
        'rgb(188, 233, 207)',
    );
    await page.screenshot({ path: path.join(artifacts, 'partner-dark.png'), fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.setViewportSize({ width: 1024, height: 900 });
    assert.equal(
      await page
        .locator('.kpi-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      2,
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, 'partner-tablet.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page
        .locator('.kpi-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      1,
    );
    await page.getByRole('button', { name: 'Kênh đối tác', exact: true }).click();
    await page.locator('.sidebar-overlay').waitFor();
    assert.equal(await sidebar.locator('a').first().isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('.sidebar-overlay').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.sidebar-overlay').count(), 0);
    await page.getByRole('button', { name: 'Kênh đối tác', exact: true }).click();
    await sidebar.locator('a[href="/partner-services"]').click();
    await page.waitForURL(base + '/partner-services');
    await page.locator('.sidebar-overlay').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.sidebar-overlay').count(), 0);
    await page.getByRole('button', { name: 'Kênh đối tác', exact: true }).click();
    await sidebar.locator('a[href="/partner-dashboard"]').click();
    await page.waitForURL(base + '/partner-dashboard');
    await page.locator('.sidebar-overlay').waitFor({ state: 'detached' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, 'partner-mobile.png'), fullPage: true });
    await page.locator('.quick-access').scrollIntoViewIfNeeded();
    const mobileQuickBounds = await page.locator('.quick-access').boundingBox();
    assert.ok(
      mobileQuickBounds.y >= 0 && mobileQuickBounds.y + mobileQuickBounds.height <= 844,
      'Mobile users must be able to scroll to the lower dashboard actions',
    );
    await page.screenshot({ path: path.join(artifacts, 'partner-mobile-details.png') });
    const emptyContext = await contextFor('provider', true);
    const emptyPage = await emptyContext.newPage();
    await emptyPage.goto(base + '/partner-dashboard', { waitUntil: 'domcontentloaded' });
    await emptyPage.getByText('Chưa có đánh giá', { exact: true }).waitFor();
    assert.equal(await emptyPage.locator('.empty-chart').count(), 2);
    assert.equal(await emptyPage.locator('tbody tr').count(), 0);
    assert.equal(
      await emptyPage.getByRole('button', { name: 'Tải báo cáo CSV' }).isDisabled(),
      true,
    );
    assert.doesNotMatch(
      await emptyPage.locator('.partner-dashboard-page').innerText(),
      /4\.8|18\.5|\+24%|\+12%/,
    );
    await emptyContext.close();
    for (const role of ['traveler', 'admin']) {
      const deniedContext = await contextFor(role);
      const denied = await deniedContext.newPage();
      await denied.goto(base + '/partner-dashboard', { waitUntil: 'domcontentloaded' });
      await denied.waitForURL(base + '/home');
      assert.equal(await denied.locator('app-partner-layout').count(), 0);
      await deniedContext.close();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedWrites, []);
    console.log(
      'PASS: shared sidebar on 5 routes, SPA/header active, existing create modal, KPI/date filter/CSV, charts/empty data, 3 viewport sizes, drawer/Escape and existing role guard. UI fixtures only; no live data modified.',
    );
  } catch (error) {
    await page
      .screenshot({ path: path.join(artifacts, 'partner-failure.png'), fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
