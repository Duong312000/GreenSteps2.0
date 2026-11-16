const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../dist/my-app/browser');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) && file !== root) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

async function run() {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (fs.existsSync(installedChrome) ? installedChrome : undefined) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const requests = [];
    await context.route('**/api/support/chat', async route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      const base = { success: true, sessionId: body.sessionId, catalogAvailable: true };
      if (body.message === 'Tui muốn đi Đà Nẵng') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          ...base, reply: 'Mình tìm thấy tour trong danh mục GreenSteps tại Đà Nẵng:', type: 'tour_recommendations',
          tours: [{ id: 'tour-danang-fixture', name: 'Tour Đà Nẵng 3 ngày', destination: 'Đà Nẵng', durationDays: 3, durationNights: 2, price: 1790000, currency: 'VND', imageUrl: '/images/dalat.jpg', highlights: [], ecoLabels: [], bookingAvailable: false }],
          totalTours: 1, hasMoreTours: false, suggestedQuestions: ['Tự tạo lịch trình tại Đà Nẵng']
        }) });
      }
      if (body.message === 'Tự tạo lịch trình tại Đà Nẵng') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          ...base, reply: 'Bạn muốn đi Đà Nẵng trong bao lâu?', type: 'clarification', tours: [], itinerary: null,
          totalTours: 0, hasMoreTours: false, suggestedQuestions: ['3 ngày']
        }) });
      }
      if (body.message === '2 ngày') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          ...base, reply: 'Mình đã chuẩn bị lịch trình tham khảo 2 ngày cho Hà Giang.', type: 'itinerary_proposal', tours: [],
          totalTours: 0, hasMoreTours: false, suggestedQuestions: [],
          itinerary: { name: 'Hà Giang 2 ngày', destination: 'Hà Giang', days: [
            [{ name: 'Cột cờ Lũng Cú', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }],
            [{ name: 'Đèo Mã Pí Lèng', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }]
          ], estimatedCost: 0, assumptions: ['Hoạt động là gợi ý tham khảo, chưa xác minh.'] }
        }) });
      }
      if (body.message === 'Có tour Hà Giang không?') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          ...base, reply: 'Mình chưa tìm thấy tour tại Hà Giang trong danh mục hiện có.', type: 'tour_recommendations',
          tours: [], totalTours: 0, hasMoreTours: false, suggestedQuestions: ['Lập lịch trình riêng tại Hà Giang']
        }) });
      }
      if (body.message === 'Lập lịch trình riêng tại Hà Giang') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          ...base, reply: 'Bạn muốn đi Hà Giang trong bao lâu?', type: 'clarification', tours: [], itinerary: null,
          totalTours: 0, hasMoreTours: false, suggestedQuestions: ['2 ngày']
        }) });
      }
      if (body.message === '3 ngày') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          ...base, reply: 'Mình đã chuẩn bị lịch trình tham khảo cho Đà Nẵng.', type: 'itinerary_proposal', tours: [],
          totalTours: 0, hasMoreTours: false, suggestedQuestions: [],
          itinerary: { name: 'Đà Nẵng 3 ngày', destination: 'Đà Nẵng', days: [
            [{ name: 'Sơn Trà', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }],
            [{ name: 'Bảo tàng Chăm', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }],
            [{ name: 'Biển Mỹ Khê', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }]
          ], estimatedCost: 0, assumptions: [] }
        }) });
      }
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false }) });
    });

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port + '/tours', { waitUntil: 'domcontentloaded' });
    await page.locator('app-greensteps-chat .chat-launcher').click();
    const input = page.locator('#greensteps-chat-input');
    await input.fill('Tui muốn đi Đà Nẵng');
    await input.press('Enter');
    const discovery = page.locator('.chat-message--assistant').last();
    await discovery.locator('.gs-tour-card').waitFor();
    assert.equal(await discovery.locator('.gs-tour-card').count(), 1);
    assert.equal(await discovery.locator('.gs-tour-card h3').innerText(), 'Tour Đà Nẵng 3 ngày');
    const createButton = discovery.getByRole('button', { name: 'Tự tạo lịch trình' });
    await createButton.waitFor();
    await createButton.click();

    const clarification = page.locator('.chat-message--assistant').last();
    await clarification.locator('.clarification-result').waitFor();
    assert.match(await clarification.innerText(), /Đà Nẵng/);
    await clarification.getByRole('button', { name: '3 ngày' }).click();
    const plan = page.locator('.chat-message--assistant').last();
    await plan.locator('.gs-plan-card').waitFor();
    assert.match(await plan.locator('.gs-plan-card').innerText(), /Đà Nẵng/);
    assert.equal(await plan.locator('.gs-plan-day').count(), 3);
    assert.deepEqual(requests.map(item => item.message), ['Tui muốn đi Đà Nẵng', 'Tự tạo lịch trình tại Đà Nẵng', '3 ngày']);
    assert.equal(new Set(requests.map(item => item.sessionId)).size, 1);

    await page.locator('#greensteps-new-chat').click();
    await input.fill('Có tour Hà Giang không?');
    await input.press('Enter');
    const empty = page.locator('.chat-message--assistant').last();
    await empty.locator('.planner-empty-state').waitFor();
    await empty.getByRole('button', { name: 'Tự tạo lịch trình' }).click();
    const emptyClarification = page.locator('.chat-message--assistant').last();
    await emptyClarification.locator('.clarification-result').waitFor();
    assert.match(await emptyClarification.innerText(), /Hà Giang/);
    assert.deepEqual(requests.slice(-2).map(item => item.message), ['Có tour Hà Giang không?', 'Lập lịch trình riêng tại Hà Giang']);
    await emptyClarification.getByRole('button', { name: '2 ngày' }).click();
    const twoDayPlan = page.locator('.chat-message--assistant').last();
    await twoDayPlan.locator('.gs-plan-card').waitFor();
    assert.match(await twoDayPlan.locator('.gs-plan-card').innerText(), /Hà Giang/);
    assert.equal(await twoDayPlan.locator('.gs-plan-day').count(), 2);
    assert.equal(requests.at(-1).message, '2 ngày');
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
    await mobileContext.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, conversations: [], data: [] }) }));
    const phone = await mobileContext.newPage();
    await phone.goto('http://127.0.0.1:' + server.address().port + '/tours', { waitUntil: 'domcontentloaded' });
    await phone.locator('app-greensteps-chat .chat-launcher').click();
    await phone.waitForFunction(() => {
      const panel = document.querySelector('#greensteps-chat-panel')?.getBoundingClientRect();
      return !!panel && panel.width > 0 && panel.top >= 0 && panel.bottom <= window.innerHeight;
    });
    const mobilePanel = await phone.locator('#greensteps-chat-panel').boundingBox();
    assert.ok(mobilePanel.x >= 0 && mobilePanel.x + mobilePanel.width <= 390);
    assert.ok(mobilePanel.y >= 0 && mobilePanel.y + mobilePanel.height <= 844);
    assert.ok((await phone.locator('.chat-composer').boundingBox()).y < 844);
    await mobileContext.close();
    console.log('PASS: FLOW-01; FLOW-02 (empty discovery → CTA → two-day itinerary); UI-001, UI-002, UI-003, UI-004, CTX-001, CTX-002, CTX-005, CTX-006, UI-006, UI-013. Local Angular browser with API fixture interception; no MongoDB or n8n calls.');
    await context.close();
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
