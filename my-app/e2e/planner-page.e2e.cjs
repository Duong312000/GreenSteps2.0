const { chromium } = require('playwright');
const express = require('../../backend/node_modules/express');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

// Exercise the existing chat/save contract without writing a real itinerary.
(async () => {
  const app = express(), root = path.resolve(__dirname, '../dist/my-app/browser');
  app.use(express.static(root));
  app.use((req, res) => res.sendFile(path.join(root, 'index.html')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const artifacts = path.resolve(__dirname, '../../tmp/planner-page');
  fs.mkdirSync(artifacts, { recursive: true });
  let browser;
  const plan = { name: 'Hành trình Đà Lạt', destination: 'Đà Lạt', startDate: null, endDate: null,
    days: [[{ name: 'Hồ Xuân Hương', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }]], estimatedCost: 0, assumptions: [] };
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
      const errors = [], requests = [], saves = [];
      let failNext = false;
      await context.route('**/api/**', async route => {
        const p = new URL(route.request().url()).pathname;
        let json = [];
        if (p === '/api/support/chat') {
          const body = route.request().postDataJSON(); requests.push(body);
          if (failNext) { failNext = false; return route.abort('failed'); }
          json = { success: true, sessionId: body.sessionId, reply: 'Cùng khám phá Đà Lạt theo cách của bạn.', type: 'itinerary_proposal', itinerary: plan, tours: [], totalTours: 0, hasMoreTours: false, catalogAvailable: true, suggestedQuestions: [] };
        } else if (p === '/api/itineraries' && route.request().method() === 'POST') {
          saves.push(route.request().postDataJSON()); json = { success: true, itineraryId: 'planner-ui-check' };
        } else if (p === '/api/itineraries/planner-ui-check') json = { id: 'planner-ui-check', name: plan.name, destination: plan.destination, days: 1, daysData: plan.days };
        await route.fulfill({ json });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/ai-planner', { waitUntil: 'domcontentloaded' });
      await page.locator('.planner-page .welcome-state').waitFor();
      await page.locator('.planner-sidebar img').evaluate(img => img.decode());
      assert.equal(await page.locator('.chat-launcher').count(), 0);
      assert.equal(await page.locator('app-footer').count(), 0);
      const layout = await page.locator('.planner-page .chat-panel').boundingBox();
      assert.equal(layout.y >= 88, true);
      assert.equal(layout.width > (width === 390 ? 380 : 1100), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(artifacts, `planner-${width}.png`), fullPage: true });
      if (width === 390) {
        await page.setViewportSize({ width: 390, height: 500 });
        await page.waitForFunction(() => document.querySelector('.composer-box').getBoundingClientRect().bottom <= innerHeight);
        await page.setViewportSize({ width: 390, height: 844 });
      }
      const input = page.locator('#greensteps-chat-input');
      await input.fill('Lập lịch trình Đà Lạt 1 ngày cho 2 người');
      await input.press('Enter');
      await page.locator('.gs-plan-card').waitFor();
      const create = page.getByRole('button', { name: 'Để AI tạo lịch trình', exact: true });
      assert.equal(await create.evaluate(button => getComputedStyle(button).color), 'rgb(255, 255, 255)');
      await create.click();
      await page.locator('app-login-modal input').first().waitFor();
      assert.equal(saves.length, 0);
      // Reopening the route keeps the conversation in the shared chat service.
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
        localStorage.setItem('greensteps_token', `e30.${payload}.planner-ui`);
        localStorage.setItem('greensteps_user', JSON.stringify({ id: 'planner-ui', fullname: 'Planner Check', role: 'traveler' }));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.planner-page .welcome-state').waitFor();
      await input.fill('Lập lịch trình Đà Lạt 1 ngày cho 2 người'); await input.press('Enter');
      await page.locator('.gs-plan-card').waitFor();
      await page.getByRole('button', { name: 'Điều chỉnh phương án', exact: true }).click();
      assert.match(await input.inputValue(), /Điều chỉnh lịch trình/);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.planner-page .chat-panel.is-open').isVisible(), true);
      await page.screenshot({ path: path.join(artifacts, `planner-result-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Lịch sử trò chuyện', exact: true }).click();
      await page.locator('.history-item').first().waitFor();
      await page.getByRole('button', { name: 'Đóng lịch sử', exact: true }).click();
      await create.click();
      await page.waitForURL('**/schedule/planner-ui-check');
      assert.equal(saves[0].source, 'ai');
      assert.equal(saves[0].destination, 'Đà Lạt');
      assert.equal(saves[0].days, 1);
      await page.goto(base + '/ai-planner', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Lên kế hoạch mới', exact: true }).click();
      await page.locator('.welcome-state').waitFor();
      failNext = true;
      await input.fill('Lập lịch trình Đà Lạt 1 ngày'); await input.press('Enter');
      await page.locator('.chat-error').waitFor();
      await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await page.locator('.gs-plan-card').waitFor();
      assert.equal(requests.length >= 4, true);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}px: full page, no popup, chat/proposal, login gate, adjust, history, save/editor, new chat and retry.`);
    }
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
