// Navigation-only browser checks: isolate unrelated APIs and never write account data.
const { chromium } = require('playwright');
const express = require('../../backend/node_modules/express');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const app = express();
  const root = path.resolve(__dirname, '../dist/my-app/browser');
  app.use(express.static(root));
  app.use((req, res) => res.sendFile(path.join(root, 'index.html')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const signedIn of [false, true]) {
      const context = await browser.newContext();
      if (signedIn) await context.addInitScript(() => {
        const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
        localStorage.setItem('greensteps_token', `e30.${payload}.navigation-check`);
        localStorage.setItem('greensteps_user', JSON.stringify({ id: 'navigation-check', fullname: 'Navigation Check', role: 'traveler' }));
      });
      await context.route('**/api/**', route => route.fulfill({ json: [] }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const width of [1600, 390]) {
        console.log(`Checking ${signedIn ? 'account' : 'guest'} at ${width}px`);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(base + '/tours', { waitUntil: 'domcontentloaded' });
        if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        const planner = width < 768
          ? page.getByRole('link', { name: 'AI Planner', exact: true }).last()
          : page.locator('header nav').getByRole('link', { name: 'AI Planner', exact: true });
        await planner.click();
        await page.waitForURL('**/ai-planner');
        await page.locator('app-ai-planner .planner-page .chat-panel.is-open').waitFor();
        assert.equal(await page.locator('.chat-launcher').count(), 0);
        assert.equal(await page.locator('app-footer').count(), 0);
        assert.equal(await page.locator('header nav').getByText('Lịch trình của tôi', { exact: true }).count(), 0);
        await page.goto(base + '/tours', { waitUntil: 'domcontentloaded' });
        if (signedIn) {
          if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
          const account = width < 768
            ? page.getByRole('button', { name: 'Tài khoản', exact: true }).last()
            : page.locator('header').getByRole('button', { name: 'Tài khoản', exact: true });
          await account.click();
          const saved = width < 768
            ? page.locator('a[href="/schedule"]').last()
            : page.locator('header a[href="/schedule"]');
          assert.match(await saved.innerText(), /Lịch trình của tôi/);
          assert.equal(await saved.getAttribute('href'), '/schedule');
          await saved.click();
          await page.waitForURL('**/schedule');
          await page.getByText('Quản lý và tùy chỉnh các lịch trình du lịch cá nhân hóa của bạn', { exact: true }).waitFor();
          // The schedule shell does not mount the floating chat; the header
          // must navigate to a customer shell before opening it.
          if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
          await planner.click();
          await page.waitForURL('**/ai-planner');
          await page.locator('#greensteps-chat-panel.is-open').waitFor();
        } else {
          assert.equal(await page.locator('header a[href="/schedule"]').count(), 0);
          if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
          const login = width < 768
            ? page.getByRole('button', { name: 'Đăng nhập', exact: true }).last()
            : page.locator('header').getByRole('button', { name: 'Đăng nhập', exact: true });
          await login.click();
          await page.locator('app-login-modal input').first().waitFor();
        }
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: desktop/mobile AI Planner opens the full-page AI Planner, opens from the schedule shell; account dropdown keeps /schedule; guest login remains available; no browser runtime errors.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
