// Browser regression checks for API failures that must not redirect to /500.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const origin = process.env.GREENSTEPS_UI_ORIGIN || 'http://localhost:4200';
const api = process.env.GREENSTEPS_API_ORIGIN || 'http://localhost:5055';
const user = { id: 'resilience-user', username: 'resilience-user', fullname: 'Test traveler', role: 'traveler' };
const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;

async function createPage(browser, authenticated = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    window.__greenstepsUnhandledRejections = [];
    window.addEventListener('unhandledrejection', event => {
      window.__greenstepsUnhandledRejections.push(String(event.reason?.message || event.reason || 'unknown rejection'));
    });
  });
  await context.addInitScript(({ user, token, authenticated }) => {
    if (authenticated) {
      localStorage.setItem('greensteps_user', JSON.stringify(user));
      localStorage.setItem('greensteps_token', token);
    }
  }, { user, token, authenticated });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.route('**/api/maintenance-status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ maintenanceMode: false })
  }));
  return { context, page, pageErrors };
}

async function assertNoUncaughtBrowserErrors(page, pageErrors) {
  assert.deepEqual(pageErrors, []);
  const unhandled = await page.evaluate(() => window.__greenstepsUnhandledRejections || []);
  assert.deepEqual(unhandled, []);
}

async function mockFailure(route, status) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: status === 503 ? 'DatabaseUnavailable' : 'InternalServerError' })
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const checks = [];
  try {
    const rootResponse = await fetch(`${api}/api`);
    assert.equal(rootResponse.status, 200, 'GET /api should return 200');
    checks.push('GET /api: 200');

    for (const path of [
      '/api/tours/search?sort=popular&page=1&pageSize=6&compact=1',
      '/api/services/search?type=stay&page=1&pageSize=6&compact=1',
      '/api/food/places',
      '/api/destinations?page=1&pageSize=100'
    ]) {
      const response = await fetch(`${api}${path}`);
      assert.equal(response.status, 200, `${path} should return 200 while Atlas is reachable`);
    }
    checks.push('Tours, Services, Food, Destinations: 200 with MongoDB available');

    {
      const { context, page, pageErrors } = await createPage(browser);
      await context.route('**/api/tours/search*', route => mockFailure(route, 503));
      await page.goto(`${origin}/tours`);
      await page.locator('.no-results-box[role="alert"]').waitFor();
      assert.equal(new URL(page.url()).pathname, '/tours');
      assert.equal(await page.locator('.no-results-box[role="alert"]').isVisible(), true);
      await assertNoUncaughtBrowserErrors(page, pageErrors);
      checks.push('Tours 503: inline retry state, URL preserved, no page exception');
      await context.close();
    }

    {
      const { context, page, pageErrors } = await createPage(browser);
      await context.route('**/api/services/search*', route => mockFailure(route, 500));
      await page.goto(`${origin}/services?type=stay&dest=Sa%20Pa`);
      await page.locator('.no-results-box[role="alert"]').waitFor();
      assert.equal(new URL(page.url()).pathname, '/services');
      assert.equal(new URL(page.url()).searchParams.get('dest'), 'Sa Pa');
      await assertNoUncaughtBrowserErrors(page, pageErrors);
      checks.push('Services 500: local error state, filter/query preserved');
      await context.close();
    }

    {
      const { context, page, pageErrors } = await createPage(browser);
      await context.route('**/api/food/places', route => route.abort('timedout'));
      await page.goto(`${origin}/local-food`);
      await page.locator('.food-state.error').waitFor();
      assert.equal(new URL(page.url()).pathname, '/local-food');
      assert.equal(await page.locator('.food-state').filter({ hasText: 'Đang tìm' }).count(), 0);
      await assertNoUncaughtBrowserErrors(page, pageErrors);
      checks.push('Food network timeout: loading ended, inline error, URL preserved');
      await context.close();
    }

    {
      const { context, page, pageErrors } = await createPage(browser, true);
      await context.route('**/api/notifications/user/resilience-user', route => mockFailure(route, 503));
      await page.goto(`${origin}/home`);
      const notificationRequest = page.waitForRequest(request => request.url().includes('/api/notifications/user/resilience-user'));
      await page.locator('.header-notifications > button').click();
      await notificationRequest;
      assert.equal(new URL(page.url()).pathname, '/home');
      assert.equal(await page.evaluate(() => localStorage.getItem('greensteps_token')), token);
      await assertNoUncaughtBrowserErrors(page, pageErrors);
      checks.push('Notifications 503: navbar remains usable, session retained');
      await context.close();
    }

    {
      const { context, page, pageErrors } = await createPage(browser, true);
      await context.route('**/api/auth/profile/resilience-user', route => mockFailure(route, 503));
      const profileRequest = page.waitForRequest(request => request.url().includes('/api/auth/profile/resilience-user'));
      await page.goto(`${origin}/profile?section=overview`);
      await profileRequest;
      await page.waitForTimeout(250);
      assert.equal(new URL(page.url()).pathname, '/profile');
      assert.equal(await page.evaluate(() => localStorage.getItem('greensteps_token')), token);
      await assertNoUncaughtBrowserErrors(page, pageErrors);
      checks.push('Auth profile 503: no logout or /500 redirect, token retained');
      await context.close();
    }

    {
      const { context, page } = await createPage(browser, true);
      await page.goto(`${origin}/admin/catalog`);
      await page.waitForURL('**/home');
      assert.equal(new URL(page.url()).pathname, '/home');
      await context.close();
      checks.push('Protected admin route: traveler remains denied and returns home');
    }

    {
      const { context, page, pageErrors } = await createPage(browser);
      let attempts = 0;
      await context.route('**/api/tours/search*', async route => {
        attempts++;
        if (attempts === 1) return mockFailure(route, 503);
        return route.continue();
      });
      await page.goto(`${origin}/tours`);
      await page.locator('.no-results-box[role="alert"]').waitFor();
      await page.getByRole('button', { name: 'Thử lại' }).click();
      await page.locator('.shopco-product-card').first().waitFor({ timeout: 20000 });
      assert.equal(new URL(page.url()).pathname, '/tours');
      await assertNoUncaughtBrowserErrors(page, pageErrors);
      checks.push('Recovery after mocked 503: retry restores real catalog data without reload');
      await context.close();
    }

    for (const path of ['/tours', '/services?type=stay']) {
      const { context, page, pageErrors } = await createPage(browser);
      const selector = path.startsWith('/tours') ? '.shopco-product-card' : '.shopco-product-card';
      await page.goto(`${origin}${path}`);
      await page.locator(selector).first().waitFor({ timeout: 20000 });
      await page.reload();
      await page.locator(selector).first().waitFor({ timeout: 20000 });
      await page.reload();
      await page.locator(selector).first().waitFor({ timeout: 20000 });
      assert.equal(new URL(page.url()).pathname, path.split('?')[0]);
      await assertNoUncaughtBrowserErrors(page, pageErrors);
      checks.push(`${path}: repeated refresh stays on route and renders data`);
      await context.close();
    }

    console.log(checks.map(check => `PASS ${check}`).join('\n'));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
