const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const baseUrl = process.env.NAVBAR_SEARCH_BASE_URL || 'http://127.0.0.1:4200';

async function waitForHeader(page) {
  await page.goto(`${baseUrl}/home`, { waitUntil: 'domcontentloaded' });
  await page.locator('.navbar-search-trigger').waitFor({ state: 'visible', timeout: 30000 });
}

async function checkSearchInteractions(page) {
  const row = page.locator('.main-header-row');
  const before = await row.boundingBox();
  const input = page.locator('#navbar-search-panel input');
  await page.getByRole('button', { name: 'Mở tìm kiếm' }).click();
  await input.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Tìm tour, địa điểm, dịch vụ');
  const after = await row.boundingBox();
  assert.equal(after.height, before.height, 'opening search does not change navbar height');

  await page.keyboard.press('Escape');
  await input.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Mở tìm kiếm' }).click();
  await input.fill('Đà Lạt');
  await page.locator('body').click({ position: { x: 8, y: 8 } });
  await input.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: 'Mở tìm kiếm' }).click();
  await input.fill('Hội An');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/tours' && url.searchParams.get('search') === 'Hội An');
}

(async () => {
  const installedBrowser = [
    process.env.CHROME_PATH,
    process.env.PROGRAMFILES && `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    process.env['PROGRAMFILES(X86)'] && `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`
  ].find(candidate => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(installedBrowser ? { executablePath: installedBrowser } : {}) });
  try {
    const loggedOut = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await waitForHeader(loggedOut);
    const loggedOutControls = loggedOut.locator('.header-controls');
    assert.equal(await loggedOutControls.locator('> .navbar-search-trigger + .header-auth-actions').count(), 1, 'logged-out search is before register actions');
    await checkSearchInteractions(loggedOut);
    for (const route of ['/home', '/tours', '/services?type=stay']) {
      await loggedOut.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
      await loggedOut.locator('.navbar-search-trigger').waitFor({ state: 'visible' });
      await loggedOut.getByRole('button', { name: 'Mở tìm kiếm' }).click();
      await loggedOut.getByRole('searchbox', { name: 'Tìm tour, địa điểm, dịch vụ' }).waitFor({ state: 'visible' });
      await loggedOut.getByRole('button', { name: 'Đóng tìm kiếm' }).click();
    }
    await loggedOut.setViewportSize({ width: 390, height: 844 });
    await loggedOut.goto(`${baseUrl}/home`, { waitUntil: 'domcontentloaded' });
    await loggedOut.getByRole('button', { name: 'Mở tìm kiếm' }).click();
    const mobilePanel = loggedOut.locator('.navbar-search-panel');
    const panelBox = await mobilePanel.boundingBox();
    const headerBox = await loggedOut.locator('app-header > header').boundingBox();
    assert.ok(panelBox.y >= headerBox.height, 'mobile search expands below the header controls');
    await loggedOut.getByRole('button', { name: 'Đóng tìm kiếm' }).click();

    const loggedIn = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await loggedIn.addInitScript(() => {
      const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      localStorage.setItem('greensteps_token', `header-search.${payload}.test`);
      localStorage.setItem('greensteps_user', JSON.stringify({ id: 'header-search-user', fullname: 'Search Tester', role: 'traveler' }));
    });
    await waitForHeader(loggedIn);
    const loggedInControls = loggedIn.locator('.header-controls');
    assert.equal(await loggedInControls.locator('> .navbar-search-trigger + .header-notifications').count(), 1, 'logged-in search is before notifications');
    assert.equal(await loggedIn.locator('.header-profile-action').count(), 1, 'profile remains available');
    await loggedIn.setViewportSize({ width: 768, height: 900 });
    await loggedIn.reload({ waitUntil: 'domcontentloaded' });
    await loggedIn.getByRole('button', { name: 'Mở tìm kiếm' }).click();
    const bounds = await Promise.all([
      loggedIn.locator('.navbar-search-trigger').boundingBox(),
      loggedIn.locator('.header-notifications > button').boundingBox(),
      loggedIn.locator('.header-profile-action > button').boundingBox(),
      loggedIn.locator('.mobile-hamburger').boundingBox()
    ]);
    for (let i = 0; i < bounds.length; i++) {
      for (let j = i + 1; j < bounds.length; j++) {
        const a = bounds[i], b = bounds[j];
        assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `navbar controls ${i} and ${j} do not overlap`);
      }
    }
    await loggedIn.keyboard.press('Escape');
    await loggedIn.close();
    await loggedOut.close();
    console.log('Navbar search E2E passed: auth states, focus, close actions, route navigation, Home/Tours/Services, 390px and 768px layouts.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
