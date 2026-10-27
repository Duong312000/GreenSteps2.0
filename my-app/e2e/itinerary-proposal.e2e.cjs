const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../dist/my-app/browser');
const artifacts = path.resolve(__dirname, '../../tmp/chat-widget-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

function activity(name) {
  return { name, time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null };
}

async function mockChat(context) {
  await context.route('**/api/support/chat', async route => {
    const body = route.request().postDataJSON();
    const days = body.message.includes('5 ngày')
      ? [
        [activity('Hồ Xuân Hương'), activity('Chợ Đà Lạt')],
        [activity('Đồi chè Cầu Đất')],
        [activity('Thác Datanla')],
        [activity('Thiền viện Trúc Lâm')],
        [activity('Vườn hoa thành phố')]
      ]
      : body.message.includes('1 ngày')
        ? [[activity('Hồ Tuyền Lâm')]]
        : [
          [activity('Hồ Tuyền Lâm'), activity('Thiền viện Trúc Lâm')],
          [activity('Langbiang'), activity('Làng Cù Lần')],
          [activity('Quảng trường Lâm Viên'), activity('Chợ Đà Lạt')]
        ];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      success: true,
      sessionId: body.sessionId,
      reply: 'Mình đã chuẩn bị lịch trình gợi ý cho Đà Lạt.',
      type: 'itinerary_proposal',
      tours: [],
      totalTours: 0,
      hasMoreTours: false,
      catalogAvailable: true,
      suggestedQuestions: [],
      itinerary: {
        name: 'Một chuyến đi Đà Lạt',
        destination: 'Đà Lạt',
        startDate: null,
        endDate: null,
        days,
        estimatedCost: 0,
        assumptions: ['Gợi ý để bạn điều chỉnh']
      }
    }) });
  });
}

async function openChat(page, base) {
  await page.goto(base + '/tours', { waitUntil: 'domcontentloaded' });
  await page.locator('.chat-launcher').click();
  await page.locator('#greensteps-chat-input').waitFor();
}

async function run() {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (fs.existsSync(chrome) ? chrome : undefined);
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await mockChat(desktop);
    const page = await desktop.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openChat(page, base);
    const panel = page.locator('#greensteps-chat-panel');
    const headerBefore = await panel.locator('.chat-header').boundingBox();
    const composerBefore = await panel.locator('.chat-composer').boundingBox();
    const input = page.locator('#greensteps-chat-input');
    await input.fill('Lập lịch trình Đà Lạt 3 ngày 2 đêm, ngân sách 5 triệu');
    await input.press('Enter');

    const itinerary = page.locator('.chat-message--assistant').last();
    const card = itinerary.locator('.gs-plan-card');
    await card.waitFor();
    assert.equal(await itinerary.locator('.message-bubble').innerText(), 'Mình đã chuẩn bị phương án Đà Lạt 3 ngày 2 đêm phù hợp với ngân sách 5.000.000 ₫ bạn nêu. Cùng xem kế hoạch nhé!');
    assert.equal(await card.locator('.gs-plan-day').count(), 3);
    assert.equal((await card.locator('.gs-plan-card__budget').innerText()).includes('5.000.000'), true);
    assert.equal((await card.locator('.gs-plan-card__cost-unverified').innerText()).includes('Chưa có dữ liệu giá dịch vụ xác thực'), true);
    assert.equal(await card.locator('.gs-plan-card__cover img').evaluate(img => img.naturalWidth > 0), true);
    assert.equal(await card.locator('.gs-plan-card__cover img').evaluate(img => getComputedStyle(img).objectFit), 'cover');
    assert.ok(Math.abs((await panel.locator('.chat-header').boundingBox()).height - headerBefore.height) < 1);
    assert.ok(Math.abs((await panel.locator('.chat-composer').boundingBox()).height - composerBefore.height) < 1);
    await page.screenshot({ path: path.join(artifacts, 'chat-itinerary-proposal.png') });

    await itinerary.getByRole('button', { name: 'Điều chỉnh phương án' }).click();
    await page.waitForFunction(() => document.querySelector('#greensteps-chat-input')?.value === 'Điều chỉnh lịch trình Đà Lạt: ');
    assert.equal(await input.inputValue(), 'Điều chỉnh lịch trình Đà Lạt: ');
    assert.deepEqual(errors, []);
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
    await mockChat(mobile);
    const phone = await mobile.newPage();
    phone.on('pageerror', error => errors.push(error.message));
    await openChat(phone, base);
    const mobileInput = phone.locator('#greensteps-chat-input');
    await mobileInput.fill('Lập lịch trình Đà Lạt 5 ngày');
    await mobileInput.press('Enter');
    const longPlan = phone.locator('.chat-message--assistant').last();
    await longPlan.locator('.gs-plan-card').waitFor();
    assert.equal(await longPlan.locator('.gs-plan-day:visible').count(), 3);
    await longPlan.locator('.gs-plan-card__more summary').click();
    assert.equal(await longPlan.locator('.gs-plan-day:visible').count(), 5);
    const planBox = await longPlan.locator('.gs-plan-card').boundingBox();
    const transcriptBox = await phone.locator('#greensteps-chat-transcript').boundingBox();
    assert.ok(planBox.x >= transcriptBox.x && planBox.x + planBox.width <= transcriptBox.x + transcriptBox.width);

    const assistantsBeforeOneDay = await phone.locator('.chat-message--assistant').count();
    await mobileInput.fill('Lập lịch trình Đà Lạt 1 ngày');
    await mobileInput.press('Enter');
    await phone.waitForFunction(count => document.querySelectorAll('.chat-message--assistant').length > count, assistantsBeforeOneDay);
    const oneDayPlan = phone.locator('.chat-message--assistant').last();
    await oneDayPlan.locator('.gs-plan-card').waitFor();
    assert.equal(await oneDayPlan.locator('.gs-plan-day:visible').count(), 1);
    assert.equal((await oneDayPlan.locator('.gs-plan-card__meta').innerText()).includes('1 ngày'), true);
    const oneDayText = await oneDayPlan.locator('.gs-plan-card').innerText();
    assert.equal(oneDayText.split('Hồ Tuyền Lâm').length - 1, 1);
    assert.equal(oneDayText.includes('Bắt đầu 08:00'), true);
    await oneDayPlan.locator('.planner-plan-actions').scrollIntoViewIfNeeded();
    const mobileActions = await oneDayPlan.locator('.planner-plan-actions').boundingBox();
    const mobileTranscript = await phone.locator('#greensteps-chat-transcript').boundingBox();
    assert.ok(mobileActions.y >= mobileTranscript.y && mobileActions.y + mobileActions.height <= mobileTranscript.y + mobileTranscript.height);
    const panelBox = await phone.locator('#greensteps-chat-panel').boundingBox();
    const composerBox = await phone.locator('.chat-composer').boundingBox();
    assert.ok(composerBox.y + composerBox.height <= panelBox.y + panelBox.height + 1);
    assert.deepEqual(errors, []);
    await phone.screenshot({ path: path.join(artifacts, 'chat-itinerary-mobile.png') });
    await mobile.close();

    const auth = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await auth.addInitScript(() => {
      const user = { id: 'itinerary-test-user', username: 'trip.test', fullname: 'Trip Test', role: 'traveler' };
      const payload = btoa(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      localStorage.setItem('greensteps_user', JSON.stringify(user));
      localStorage.setItem('greensteps_token', `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`);
    });
    await mockChat(auth);
    let savedPlan;
    await auth.route('**/api/itineraries', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      savedPlan = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, itineraryId: 'proposal-42' }) });
    });
    const savePage = await auth.newPage();
    await openChat(savePage, base);
    const saveInput = savePage.locator('#greensteps-chat-input');
    await saveInput.fill('Lập lịch trình Đà Lạt 3 ngày 2 đêm, ngân sách 5 triệu');
    await saveInput.press('Enter');
    const saveCard = savePage.locator('.chat-message--assistant').last();
    await saveCard.locator('.gs-plan-card').waitFor();
    await saveCard.getByRole('button', { name: 'Để AI tạo lịch trình' }).click();
    await savePage.waitForURL('**/schedule/proposal-42');
    assert.equal(savedPlan.source, 'ai');
    assert.equal(savedPlan.destination, 'Đà Lạt');
    assert.equal(savedPlan.days, 3);
    assert.deepEqual(errors, []);
    await auth.close();
    console.log('PASS: itinerary proposal, stated budget, verified-cost distinction, destination image, 1/3/5-day display, mobile overflow, adjust action, save and /schedule/:id navigation.');
  } catch (error) {
    for (const context of browser?.contexts() || []) for (const page of context.pages()) {
      await page.screenshot({ path: path.join(artifacts, 'chat-itinerary-failure.png') }).catch(() => {});
    }
    throw error;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
