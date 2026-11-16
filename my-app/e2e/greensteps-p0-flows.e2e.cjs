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

const makePlan = (destination, dayCount, verified = false) => ({
  name: `${destination} ${dayCount} day plan`, destination,
  days: Array.from({ length: dayCount }, (_, index) => [{
    name: verified ? 'GreenSteps stay' : `${destination} activity ${index + 1}`,
    time: '09:00', cost: verified ? 500000 : 0, carbon: verified ? 1.2 : 0,
    type: verified ? 'lodging' : 'attraction', verified, serviceId: verified ? 'svc-dn-verified' : null
  }]),
  estimatedCost: verified ? 500000 : 0, assumptions: []
});

async function run() {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (fs.existsSync(installedChrome) ? installedChrome : undefined) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    context.setDefaultTimeout(20000);
    const requests = [];
    let releaseOldResponse;
    const oldResponseGate = new Promise(resolve => { releaseOldResponse = resolve; });
    await context.route('**/api/support/chat', async route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      const base = { success: true, sessionId: body.sessionId, catalogAvailable: true, tours: [], totalTours: 0, hasMoreTours: false };
      const message = body.message.trim();
      const plain = message.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      if (message === 'Slow Da Nang') {
        await oldResponseGate;
        try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Old response', type: 'itinerary_proposal', itinerary: makePlan('Phu Yen', 1) }) }); } catch {}
        return;
      }
      if (/multiple places|da lat\/phu yen\/da nang/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Choose one destination.', type: 'clarification', suggestedQuestions: ['Da Nang', 'Phu Yen'] }) });
      }
      if (/^create itinerary(?: for me)?$|^tao lich trinh cho tui$/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Where do you want to go?', type: 'clarification', suggestedQuestions: ['Phu Yen'] }) });
      }
      if (/^phu yen$/i.test(plain) && body.history?.some(turn => /create itinerary|tao lich trinh cho tui/i.test(turn.content.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()))) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'How many days?', type: 'clarification', suggestedQuestions: ['2 days'] }) });
      }
      if (/^da nang$/i.test(plain) && body.history?.some(turn => /multiple places|da lat\/phu yen\/da nang/i.test(turn.content.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()))) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Tours in Da Nang', type: 'tour_recommendations', tours: [{ id: 'tour-dn-1', name: 'Da Nang real fixture tour', destination: 'Da Nang', durationDays: 3, durationNights: 2, price: 1000000, currency: 'VND', imageUrl: null, highlights: [], ecoLabels: [], bookingAvailable: false }], totalTours: 1, suggestedQuestions: ['Create itinerary'] }) });
      }
      if (/lich trinh|create itinerary/i.test(plain) && body.history?.some(turn => /multiple places|da lat\/phu yen\/da nang/i.test(turn.content.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()))) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'How many days in Da Nang?', type: 'clarification', suggestedQuestions: ['3 days'] }) });
      }
      if (/^3 days$|^3 ngay$/i.test(plain) && body.history?.some(turn => /multiple places|da lat\/phu yen\/da nang/i.test(turn.content.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()))) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Da Nang plan', type: 'itinerary_proposal', itinerary: makePlan('Da Nang', 3) }) });
      }
      if (/^2 days$|^2 ngay$/i.test(plain) && body.history?.some(turn => /phu yen/i.test(turn.content.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()))) {
        return route.fulfill({ ...base, contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Phu Yen plan', type: 'itinerary_proposal', itinerary: makePlan('Phu Yen', 2) }) });
      }
      if (/budget|ngan sach|remove budget|bo ngan sach/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Da Nang budget updated', type: 'itinerary_proposal', itinerary: makePlan('Da Nang', 3) }) });
      }
      if (/change to da nang|thoi doi sang da nang/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Da Nang plan', type: 'itinerary_proposal', itinerary: makePlan('Da Nang', 2) }) });
      }
      if (/verified service|luu tru xanh/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Plan with a verified GreenSteps service', type: 'itinerary_proposal', itinerary: makePlan('Da Nang', 3, true) }) });
      }
      if (/tao lich trinh da nang 1 ngay$/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Phu Yen plan', type: 'itinerary_proposal', itinerary: makePlan('Phu Yen', 1) }) });
      }
      if (/tao lich trinh di da nang 3 ngay mismatch/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Phu Yen plan', type: 'itinerary_proposal', itinerary: makePlan('Phu Yen', 1) }) });
      }
      const explicit = message.match(/(?:plan|schedule)\s+(?:a\s+)?(\d+)\s+day(?:s)?\s+(?:in\s+)?(da nang|phu yen)/i)
        || message.match(/(?:in|to)\s+(da nang|phu yen)\s+(\d+)\s+days/i);
      if (/lap ke hoach di da nang$/i.test(plain)) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'How many days in Da Nang?', type: 'clarification', suggestedQuestions: ['3 ngày'] }) });
      }
      if (/^3 ngay$/i.test(plain) && body.history?.some(turn => /lap ke hoach di da nang/i.test(turn.content.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()))) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Da Nang plan', type: 'itinerary_proposal', itinerary: makePlan('Da Nang', 3) }) });
      }
      if (/tao lich trinh di da nang 3 ngay|xay dung lich trinh da nang 3 ngay|tao lich da nang 3 ngay|lich trinh phu yen 2 ngay/i.test(plain)) {
        const destination = /phu yen/i.test(plain) ? 'Phu Yen' : 'Da Nang';
        const dayCount = Number(plain.match(/(\d+) ngay/)?.[1] || 3);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: `${destination} plan`, type: 'itinerary_proposal', itinerary: makePlan(destination, dayCount) }) });
      }
      if (explicit) {
        const destination = explicit[1].match(/^\d+$/) ? explicit[2] : explicit[1];
        const days = Number(explicit[1].match(/^\d+$/) ? explicit[1] : explicit[2]);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: `${destination} plan`, type: 'itinerary_proposal', itinerary: makePlan(destination, days) }) });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...base, reply: 'Please clarify.', type: 'clarification', suggestedQuestions: ['3 days'] }) });
    });

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/tours`, { waitUntil: 'domcontentloaded' });
    await page.locator('app-greensteps-chat .chat-launcher').click();
    const input = page.locator('#greensteps-chat-input');
    const send = async message => {
      const previousRequestCount = requests.length;
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/support/chat')
        && response.request().postDataJSON()?.message === message);
      await input.fill(message);
      await input.press('Enter');
      await responsePromise;
      await page.waitForFunction(() => !document.querySelector('#greensteps-chat-input')?.disabled
        && !document.querySelector('.chat-pending'));
      assert.equal(requests.length, previousRequestCount + 1, 'one API request must complete for each submitted turn');
    };
    const reset = async () => { await page.locator('#greensteps-new-chat').click(); };
    const planCard = () => page.locator('.chat-message--assistant').last().locator('.gs-plan-card');

    // FLOW-03: equivalent creation phrases each produce a matching three-day plan.
    for (const phrase of ['Plan 3 days in Da Nang', 'Create schedule 3 days in Da Nang', 'Build schedule 3 days in Da Nang']) {
      await reset(); await send(phrase);
      await planCard().waitFor();
      assert.match(await planCard().innerText(), /Da Nang/);
      assert.equal(await planCard().locator('.gs-plan-day').count(), 3);
    }

    // FLOW-04: fill destination, then duration; the browser sends prior turns in one session.
    await reset(); await send('Create itinerary for me');
    await page.locator('.clarification-result').last().getByRole('button', { name: 'Phu Yen' }).click();
    await page.locator('.clarification-result').last().getByRole('button', { name: '2 days' }).click();
    await planCard().waitFor();
    assert.match(await planCard().innerText(), /Phu Yen/);
    assert.equal(await planCard().locator('.gs-plan-day').count(), 2);

    // FLOW-05: budget changes stay in the same conversation and plan destination/duration.
    await reset(); await send('Plan 3 days in Da Nang');
    await send('Budget 2 million');
    await send('Remove budget');
    assert.equal(requests.at(-1).history.filter(turn => turn.role === 'user').length, 2);
    assert.match(await planCard().innerText(), /Da Nang/);
    assert.equal(await planCard().locator('.gs-plan-day').count(), 3);

    // FLOW-06: correction changes destination while retaining the two-day duration.
    await reset(); await send('Plan 2 days in Phu Yen');
    await send('Change to Da Nang');
    assert.match(await planCard().innerText(), /Da Nang/);
    assert.equal(await planCard().locator('.gs-plan-day').count(), 2);

    // FLOW-07: ambiguous destination -> choice -> discovery -> create plan.
    await reset(); await send('Multiple places: Da Lat, Phu Yen, Da Nang');
    await page.locator('.clarification-result').last().getByRole('button', { name: 'Da Nang' }).click();
    await page.locator('.gs-tour-card').last().waitFor();
    await page.locator('.planner-create').last().click();
    await page.locator('.clarification-result').last().getByRole('button', { name: '3 days' }).click();
    await planCard().waitFor();
    assert.match(await planCard().innerText(), /Da Nang/);
    assert.equal(await planCard().locator('.gs-plan-day').count(), 3);

    // FLOW-09: renderer distinguishes the selected verified service from ordinary suggestions.
    await reset(); await send('Plan with a verified service');
    await planCard().waitFor();
    assert.equal(await planCard().locator('.gs-plan-card__label').count(), 1);
    assert.equal(await planCard().locator('.gs-plan-day__verification').count(), 3);

    // FLOW-10: a mismatched proposal is rejected and no plan card is rendered.
    await reset(); await send('Tao lich trinh Da Nang 1 ngay');
    assert.equal(await page.locator('.chat-message--assistant').last().locator('.gs-plan-card').count(), 0);

    // FLOW-G: cancel an old response, start a fresh chat, and ensure the old turn cannot replace it.
    await reset();
    await input.fill('Slow Da Nang'); await input.press('Enter');
    await page.locator('.chat-pending').waitFor();
    await page.locator('.stop-button').click();
    await page.waitForFunction(() => !document.querySelector('#greensteps-chat-input')?.disabled);
    await reset(); await send('Plan 1 day in Da Nang');
    releaseOldResponse();
    await page.waitForTimeout(300);
    assert.match(await planCard().innerText(), /Da Nang/);
    assert.equal(await planCard().locator('.gs-plan-day').count(), 1);

    console.log('PASS_UI_FIXTURE: FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-09, FLOW-10, FLOW-G. All API responses are intercepted; no MongoDB, n8n, Gemini, or production webhook calls.');
    await context.close();
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
