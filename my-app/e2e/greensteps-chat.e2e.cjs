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

function makeTour(index, bookingAvailable = false) {
  return {
    id: `tour-real-${index}`, name: index === 1 ? 'Đà Lạt xanh 3 ngày' : `Khám phá Đà Lạt ${index}`,
    destination: 'Đà Lạt', durationDays: 3, durationNights: 2, price: 3200000 + index * 100000,
    currency: 'VND', imageUrl: '/images/dalat.jpg', highlights: ['Rừng thông', 'Hồ tự nhiên'],
    ecoLabels: ['Du lịch xanh'], bookingAvailable
  };
}

function installChatMock(context, calls, requests) {
  let networkFailed = false;
  return context.route('**/api/support/chat', async route => {
    calls.count++;
    const body = route.request().postDataJSON();
    requests.push(body);
    const base = { success: true, sessionId: body.sessionId };
    if (body.message === 'Câu hỏi trong cuộc trò chuyện mới') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Mình sẵn lòng giúp bạn.', type: 'text' }) });
    }
    if (body.message === 'Tìm tour có thể đặt') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ...base, reply: 'Tour này đã xác nhận trạng thái có thể đặt.', type: 'tour_recommendations',
        tours: [{ ...makeTour(5, true), id: 'tour-bookable-1', name: 'Tour Đà Lạt có chỗ xác nhận' }],
        totalTours: 1, hasMoreTours: false, catalogAvailable: true, suggestedQuestions: []
      }) });
    }
    if (body.message === 'Tìm tour không có kết quả') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ...base, reply: 'Mình chưa tìm thấy tour phù hợp.', type: 'tour_recommendations', tours: [],
        totalTours: 0, hasMoreTours: false, catalogAvailable: true, suggestedQuestions: []
      }) });
    }
    if (body.message === 'Thử lại sau lỗi mạng' && !networkFailed) {
      networkFailed = true;
      return route.abort('failed');
    }
    if (body.message === 'Thử lại sau lỗi mạng') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Mạng đã kết nối lại.', type: 'text' }) });
    }
    if (body.message === 'Lập lịch trình Đà Lạt 3 ngày 2 đêm') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ...base, reply: 'Mình đã chuẩn bị lịch trình gợi ý cho Đà Lạt.', type: 'itinerary_proposal', tours: [],
        totalTours: 0, hasMoreTours: false, catalogAvailable: true, suggestedQuestions: [],
        itinerary: {
          name: 'Một chuyến đi Đà Lạt', destination: 'Đà Lạt', startDate: null, endDate: null,
          days: [
            [{ name: 'Hồ Tuyền Lâm', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }],
            [{ name: 'Đồi chè Cầu Đất', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }],
            [{ name: 'Hồ Xuân Hương', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }]
          ],
          estimatedCost: 0, assumptions: ['Gợi ý để bạn điều chỉnh']
        }
      }) });
    }
    if (body.message === 'So sánh các tour này') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ...base, reply: 'Bạn có thể so sánh thời lượng và mức giá.', type: 'tour_recommendations',
        tours: [1, 2, 3, 4].map(index => makeTour(index)), totalTours: 4, hasMoreTours: false, catalogAvailable: true
      }) });
    }

    const tours = [1, 2, 3, 4].map(index => makeTour(index));
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      ...base,
      reply: '**GreenSteps** tìm thấy tour phù hợp từ danh mục. <script>window.chatInjected = true</script>',
      type: 'tour_recommendations', tours, totalTours: 5, hasMoreTours: true, catalogAvailable: true,
      suggestedQuestions: ['So sánh các tour này']
    }) });
  });
}

async function run() {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (fs.existsSync(installedChrome) ? installedChrome : undefined);
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));

    const calls = { count: 0 };
    const requests = [];
    await installChatMock(context, calls, requests);
    await page.goto(base + '/tours', { waitUntil: 'domcontentloaded' });
    const launcher = page.locator('app-greensteps-chat .chat-launcher');
    const panel = page.locator('#greensteps-chat-panel');
    await launcher.waitFor();
    assert.equal(await page.locator('aura-chat').count(), 0);
    assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
    assert.equal(calls.count, 0);

    await launcher.click();
    const input = page.locator('#greensteps-chat-input');
    await input.waitFor();
    assert.equal(await panel.locator('h1').count(), 1);
    assert.equal(await page.getByText('Một chuyến đi đáng nhớ, một dấu chân xanh.', { exact: true }).count(), 1);
    assert.equal(await page.locator('.welcome-prompts button').count(), 3);
    await page.screenshot({ path: path.join(artifacts, 'chat-angular-welcome.png') });
    assert.equal(calls.count, 0);

    await input.fill('Bạn có thể tư vấn chuyến Đà Lạt không?');
    await input.press('Enter');
    const firstAssistant = page.locator('.chat-message--assistant').first();
    const firstResult = firstAssistant.locator('.chat-structured-result');
    await firstResult.waitFor();
    assert.equal(await page.locator('.chat-message--user').count(), 1);
    assert.equal(await page.locator('.chat-message--assistant').count(), 1);
    assert.equal(await firstAssistant.locator('.gs-tour-card').count(), 3);
    assert.equal(await firstAssistant.locator('.message-bubble').innerText(), 'Mình tìm thấy 5 tour phù hợp với bạn:');
    const firstTourBox = await firstAssistant.locator('.gs-tour-card').first().boundingBox();
    const firstTourImageBox = await firstAssistant.locator('.gs-tour-card__image').first().boundingBox();
    assert.ok(firstTourImageBox.width >= 220 && firstTourImageBox.width <= 280, 'desktop tour card image should keep the fixed 220–280px column');
    assert.equal(firstTourImageBox.height, 168, 'desktop tour card image should keep a fixed 168px frame');
    assert.equal(await firstAssistant.locator('.planner-tour-rail').evaluate(element => getComputedStyle(element).display), 'grid');
    assert.equal(await firstAssistant.locator('.gs-tour-card h3').first().innerText(), 'Đà Lạt xanh 3 ngày');
    assert.equal((await firstAssistant.locator('.gs-tour-card__price').first().innerText()).includes('3.300.000'), true);
    assert.equal((await firstAssistant.locator('.gs-tour-card img').first().getAttribute('src')).includes('/images/dalat.jpg'), true);
    assert.equal(await firstAssistant.locator('.gs-tour-card__book').count(), 0);
    assert.equal(await firstAssistant.locator('.gs-tour-card__detail').first().getAttribute('href'), '/tours/tour-real-1');
    assert.equal(await firstResult.innerText().then(text => text.includes('Đà Lạt')), true);
    assert.equal(await page.evaluate(() => window.chatInjected), undefined);
    assert.equal(calls.count, 1);
    const firstSession = requests[0].sessionId;

    await firstAssistant.getByRole('button', { name: 'Xem thêm tour' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.gs-tour-card').length === 4);
    assert.equal(await firstAssistant.locator('.gs-tour-card').count(), 4);
    await firstAssistant.getByRole('button', { name: /Xem tất cả tour tại Đà Lạt/ }).click();
    await page.waitForURL('**/tours?dest=*');
    assert.equal(new URL(page.url()).searchParams.get('dest'), 'Đà Lạt');
    await page.goBack();
    await page.waitForURL('**/tours');
    assert.equal(await page.locator('.chat-message--user').count(), 1);
    assert.equal(calls.count, 1);

    await page.locator('#greensteps-chat-close').click();
    await page.waitForTimeout(250);
    assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('aura-chat').count(), 0);
    await launcher.click();
    assert.equal(await page.locator('.chat-message--user').count(), 1);
    assert.equal(calls.count, 1);

    await page.locator('#greensteps-new-chat').click();
    await page.waitForFunction(() => document.querySelectorAll('.chat-message').length === 0);
    assert.equal(await page.locator('.chat-message').count(), 0);
    await input.fill('Câu hỏi trong cuộc trò chuyện mới');
    await input.press('Enter');
    await page.getByText('Mình sẵn lòng giúp bạn.', { exact: true }).waitFor();
    assert.equal(calls.count, 2);
    assert.notEqual(requests[1].sessionId, firstSession);

    await page.locator('#greensteps-chat-history').click();
    const history = page.locator('#greensteps-chat-history-list');
    await history.waitFor();
    await history.getByRole('button', { name: 'Bạn có thể tư vấn chuyến Đà Lạt không?' }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'greensteps-chat-input');
    assert.equal(await page.locator('.chat-message--user').count(), 1);
    assert.equal(await page.locator('.chat-structured-result').count(), 1);
    await input.fill('So sánh các tour này');
    await input.press('Enter');
    await page.locator('.chat-message--assistant').nth(1).waitFor();
    assert.equal(requests[2].sessionId, firstSession);
    assert.deepEqual(requests[2].currentTours.map(tour => tour.id), ['tour-real-1', 'tour-real-2', 'tour-real-3', 'tour-real-4']);
    assert.equal(await page.locator('.chat-structured-result').count(), 2);

    const assistantsBeforeBookable = await page.locator('.chat-message--assistant').count();
    await input.fill('Tìm tour có thể đặt');
    await input.press('Enter');
    await page.waitForFunction(expected => document.querySelectorAll('.chat-message--assistant').length === expected, assistantsBeforeBookable + 1);
    const bookableAssistant = page.locator('.chat-message--assistant').last();
    await bookableAssistant.locator('.gs-tour-card').waitFor();
    assert.equal(await bookableAssistant.locator('.gs-tour-card__book').count(), 1);
    const bookingUrl = new URL(await bookableAssistant.locator('.gs-tour-card__book').getAttribute('href'), base);
    assert.equal(bookingUrl.pathname, '/booking');
    assert.equal(bookingUrl.searchParams.get('tourId'), 'tour-bookable-1');
    assert.equal(bookingUrl.searchParams.get('bookingType'), 'tour');
    assert.equal(bookingUrl.searchParams.get('guestCount'), '1');

    await input.fill('Tìm tour không có kết quả');
    await input.press('Enter');
    const emptyAssistant = page.locator('.chat-message--assistant').last();
    await emptyAssistant.locator('.planner-empty-state').waitFor();
    assert.equal(await emptyAssistant.locator('.gs-tour-card').count(), 0);
    assert.equal(await emptyAssistant.locator('.planner-empty-state strong').innerText(), 'Chưa tìm thấy tour phù hợp');
    assert.equal(await page.locator('.gs-tour-card').count(), 8);

    await input.fill('Thử lại sau lỗi mạng');
    await input.press('Enter');
    await page.locator('.chat-error').waitFor();
    const usersBeforeRetry = await page.locator('.chat-message--user').count();
    await page.locator('.chat-error button').click();
    await page.getByText('Mạng đã kết nối lại.', { exact: true }).waitFor();
    assert.equal(await page.locator('.chat-message--user').count(), usersBeforeRetry);
    assert.equal(calls.count, 7);

    await input.fill('Lập lịch trình Đà Lạt 3 ngày 2 đêm');
    await input.press('Enter');
    const itineraryAssistant = page.locator('.chat-message--assistant').last();
    await itineraryAssistant.locator('.gs-plan-card').waitFor();
    assert.equal(await itineraryAssistant.locator('.gs-plan-card').innerText().then(text => text.includes('Đà Lạt')), true);
    assert.equal(await itineraryAssistant.locator('.planner-plan-actions').count(), 1);
    await itineraryAssistant.getByRole('button', { name: 'Để AI tạo lịch trình' }).click();
    const loginModal = page.locator('app-login-modal');
    await loginModal.locator('.login-overlay').waitFor();
    assert.equal(await loginModal.locator('.login-modal h2').first().innerText(), 'Đăng nhập');
    await loginModal.locator('#loginUsername').click();
    assert.equal((await panel.getAttribute('class')).includes('is-open'), true);
    await loginModal.locator('.login-modal__close').click();
    assert.equal((await panel.getAttribute('class')).includes('is-open'), true);

    await page.screenshot({ path: path.join(artifacts, 'chat-angular-conversation.png') });
    const userCountBeforeRoute = await page.locator('.chat-message--user').count();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    assert.equal(await launcher.evaluate(element => document.activeElement === element), true);
    await launcher.click();
    assert.equal(calls.count, 8);
    await page.mouse.click(24, 200);
    await page.waitForTimeout(250);
    assert.equal(await launcher.getAttribute('aria-expanded'), 'false');

    await page.evaluate(() => {
      history.pushState({}, '', '/admin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(250);
    assert.equal(await page.locator('app-greensteps-chat').isVisible(), false);
    await page.evaluate(() => {
      history.pushState({}, '', '/tours');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(250);
    assert.equal(await page.locator('app-greensteps-chat').isVisible(), true);
    await launcher.click();
    assert.equal(await page.locator('.chat-message--user').count(), userCountBeforeRoute);
    assert.equal(calls.count, 8);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
    const phone = await mobile.newPage();
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(base + '/tours', { waitUntil: 'domcontentloaded' });
    await phone.locator('.chat-launcher').click();
    await phone.locator('#greensteps-chat-input').waitFor();
    const mobilePanel = await phone.locator('#greensteps-chat-panel').boundingBox();
    const composer = await phone.locator('.chat-composer').boundingBox();
    assert.ok(mobilePanel.x >= 0 && mobilePanel.x + mobilePanel.width <= 390);
    assert.ok(mobilePanel.y >= 0 && mobilePanel.y + mobilePanel.height <= 844);
    assert.ok(composer.y + composer.height <= mobilePanel.y + mobilePanel.height + 1);
    const transcriptStyle = await phone.locator('#greensteps-chat-transcript').evaluate(element => getComputedStyle(element).overflowY);
    assert.ok(['auto', 'scroll'].includes(transcriptStyle));
    await phone.setViewportSize({ width: 390, height: 500 });
    const resizedPanel = await phone.locator('#greensteps-chat-panel').boundingBox();
    const resizedComposer = await phone.locator('.chat-composer').boundingBox();
    assert.ok(resizedComposer.y + resizedComposer.height <= resizedPanel.y + resizedPanel.height + 1);
    await phone.screenshot({ path: path.join(artifacts, 'chat-angular-mobile.png') });
    await mobile.close();

    const authContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await authContext.addInitScript(() => {
      const user = { id: 'user-e2e-1', username: 'trip.test', fullname: 'Trip Test', role: 'traveler' };
      const payload = btoa(JSON.stringify({ id: user.id, username: user.username, fullname: user.fullname, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      localStorage.setItem('greensteps_user', JSON.stringify(user));
      localStorage.setItem('greensteps_token', `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`);
    });
    const authPage = await authContext.newPage();
    authPage.on('pageerror', error => errors.push(error.message));
    await installChatMock(authContext, { count: 0 }, []);
    let itineraryPost;
    await authContext.route('**/api/itineraries', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      itineraryPost = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, itineraryId: 'e2e-itinerary-42' }) });
    });
    await authPage.goto(base + '/tours', { waitUntil: 'domcontentloaded' });
    await authPage.locator('.chat-launcher').click();
    const authInput = authPage.locator('#greensteps-chat-input');
    await authInput.fill('Lập lịch trình Đà Lạt 3 ngày 2 đêm');
    await authInput.press('Enter');
    const authPlan = authPage.locator('.chat-message--assistant').last();
    await authPlan.locator('.gs-plan-card').waitFor();
    await authPlan.getByRole('button', { name: 'Để AI tạo lịch trình' }).click();
    await authPage.waitForURL('**/schedule/e2e-itinerary-42');
    assert.equal(itineraryPost.source, 'ai');
    assert.equal(itineraryPost.destination, 'Đà Lạt');
    assert.equal(itineraryPost.days, 3);
    assert.equal(errors.length, 0);
    await authContext.close();

    console.log('PASS: Angular shell, catalog-backed inline tour cards, explicit booking availability, real routes, history/session context, empty/error/retry, itinerary login/save, focus behavior and mobile fixed composer.');
  } catch (error) {
    console.error('Browser errors:', errors);
    for (const context of browser?.contexts() || []) for (const page of context.pages()) await page.screenshot({ path: path.join(artifacts, 'chat-browser-failure.png') }).catch(() => {});
    throw error;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
