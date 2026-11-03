// Browser rendering uses HTTP fixtures; real MongoDB transactions are tested in backend/test/wallet-v2.integration.test.js.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist/my-app/browser');
const artifacts = path.resolve(__dirname, '../../tmp/wallet');
let server, browser;
(async () => {
  try {
    fs.mkdirSync(artifacts, { recursive: true });
    server = http.createServer((req, res) => {
      let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const data = { success: true, wallet: { id: 'EW-UI-FIXTURE', balance: 200000, available_balance: 200000, green_points: 2450, tier_points: 3000, registered: true, payment_methods: [] }, membership: { name: 'Explorer', points: 3000, next: { name: 'Voyager', threshold: 5000 } }, vouchers: [], policy: { pointValueVnd: 1, earnPerVnd: 10000, redeemMinimum: 1000 }, transactions: [{ id: 'fixture-earned', type: 'points_earned', amount: 300, status: 'success', description: 'Điểm xanh từ booking đã hoàn tất', createdAt: new Date().toISOString() }] };
    data.demo = { enabled: true, account_enabled: true, can_settle: false, balance: 200000, held: 0, available_balance: 200000, banks: [] };
    let redemption, demoRequests = 0;
    const syncDemo = () => { data.demo.available_balance = data.demo.balance - data.demo.held; };
    const makeTx = (type, amount, body = {}) => { const tx = { id: `DEMO-UI-${++demoRequests}`, mode: 'demo', type, amount, status: type === 'transfer_out' ? 'SUCCESS' : 'PENDING', description: type === 'deposit' ? 'Nạp số dư thử nghiệm' : type === 'withdrawal' ? 'Rút số dư thử nghiệm' : 'Chuyển tiền', createdAt: new Date().toISOString(), ...body }; data.transactions.unshift(tx); return tx; };
    await page.route('https://**', r => r.abort());
    await page.route('http://localhost:5055/**', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': `http://localhost:${server.address().port}`, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' } });
      const pathname = new URL(route.request().url()).pathname;
      let body = [];
      if (pathname.endsWith('/wallet/overview')) body = data;
      else if (pathname.endsWith('/demo/deposits')) body = { success: true, transaction: makeTx('deposit', route.request().postDataJSON().amount) };
      else if (pathname.endsWith('/demo/withdrawals')) { const value = route.request().postDataJSON().amount; data.demo.held += value; syncDemo(); body = { success: true, transaction: makeTx('withdrawal', -value) }; }
      else if (pathname.endsWith('/demo/recipient')) body = { success: true, recipient: { id: 'recipient-test', name: 'Người nhận thử nghiệm' } };
      else if (pathname.endsWith('/demo/transfers')) { const payload = route.request().postDataJSON(); data.demo.balance -= payload.amount; syncDemo(); body = { success: true, transaction: makeTx('transfer_out', -payload.amount, { recipient_name: 'Người nhận thử nghiệm', sender_name: 'Nguyễn Văn An', note: payload.note }) }; }
      else if (pathname.endsWith('/demo/banks')) { const bank = { id: 'bank-test', label: route.request().postDataJSON().label, demo_reference: 'DEMO-UI-TEST' }; data.demo.banks.push(bank); body = { success: true, bank }; }
      else if (pathname.endsWith('/demo/admin/pending')) body = { success: true, transactions: data.transactions.filter(tx => tx.mode === 'demo' && tx.status === 'PENDING') };
      else if (pathname.includes('/demo/admin/transactions/') && pathname.endsWith('/settle')) { const tx = data.transactions.find(tx => tx.id === pathname.split('/').at(-2)); tx.status = route.request().postDataJSON().status; if (tx.status === 'SUCCESS') data.demo.balance += tx.amount; if (tx.type === 'withdrawal') data.demo.held -= Math.abs(tx.amount); syncDemo(); body = { success: true, transaction: tx }; }
      else if (pathname.includes('/demo/transactions/') && pathname.endsWith('/cancel')) { const tx = data.transactions.find(tx => tx.id === pathname.split('/').at(-2)); tx.status = 'CANCELLED'; if (tx.type === 'withdrawal') data.demo.held -= Math.abs(tx.amount); syncDemo(); body = { success: true, transaction: tx }; }
      else if (pathname.includes('/demo/transactions/') && pathname.endsWith('/simulate')) { const tx = data.transactions.find(tx => tx.id === pathname.split('/').at(-2)); tx.status = route.request().postDataJSON().status; if (tx.status === 'SUCCESS') data.demo.balance += tx.amount; if (tx.type === 'withdrawal') data.demo.held -= Math.abs(tx.amount); syncDemo(); body = { success: true, transaction: tx }; }
      else if (pathname.includes('/demo/transactions/')) body = { success: true, transaction: data.transactions.find(tx => tx.id === pathname.split('/').at(-1)), ledger: [] };
      else if (pathname.endsWith('/demo/transactions')) body = { success: true, transactions: data.transactions.filter(tx => tx.mode === 'demo'), total: data.transactions.filter(tx => tx.mode === 'demo').length, page: 0 };
      else if (pathname.endsWith('/wallet/points/redeem')) { redemption = route.request().postDataJSON(); data.wallet.green_points -= redemption.points; body = { success: true, code: 'GREEN-UI-TEST' }; }
      else if (pathname.includes('/wallet/transactions')) body = { success: true, transactions: [] };
      else if (pathname.includes('/wallet/')) body = { success: true, wallet: data.wallet };
      else if (pathname.includes('/notifications')) body = { success: true, notifications: [] };
      await route.fulfill({ json: body, headers: { 'Access-Control-Allow-Origin': `http://localhost:${server.address().port}`, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' } });
    });
    await page.addInitScript(() => {
      localStorage.setItem('greensteps_user', JSON.stringify({ id: 'ui-user', username: 'traveler', fullname: 'Nguyễn Văn An', email: 'test@example.invalid', role: 'traveler' }));
      localStorage.setItem('greensteps_token', 'e30.' + btoa(JSON.stringify({ id: 'ui-user', exp: Math.floor(Date.now() / 1000) + 3600 })) + '.test');
    });
    await page.goto(`http://localhost:${server.address().port}/profile?section=wallet`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('app-green-wallet .columns').waitFor().catch(async e => { await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); console.error(errors, await page.locator('body').innerText()); throw e; });
    assert.equal(await page.locator('app-green-wallet .actions button').count(), 5);
    const columnHeights = await page.locator('app-green-wallet .columns > *').evaluateAll(items => items.map(item => item.getBoundingClientRect().height));
    assert.ok(Math.max(...columnHeights) - Math.min(...columnHeights) < 2, 'desktop wallet columns must align at the bottom');
    assert.equal(await page.locator('app-green-wallet .wallet-add-method').evaluate(button => getComputedStyle(button).outlineStyle), 'none', 'add-method button must not inherit the global outline utility');
    assert.equal(await page.locator('app-green-wallet').getByText('Hoàn tiền', { exact: true }).count(), 0);
    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
    await page.locator('app-green-wallet .actions button').last().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'GREEN-UI-TEST' }).waitFor();
    assert.equal(redemption.points, 1000);
    assert.ok((await page.locator('app-green-wallet .points strong').innerText()).replace(/[^0-9]/g, '').includes('1450'));
    // Creating a deposit is a separate step from review and cannot credit a balance.
    const wallet = page.locator('app-green-wallet');
    const dialog = page.locator('.demo-dialog');
    await wallet.locator('.actions button').first().click();
    await dialog.locator('input[name="demoAmount"]').fill('100000');
    await dialog.getByRole('button', { name: 'Kiểm tra thông tin', exact: true }).click();
    assert.equal(demoRequests, 0);
    await page.screenshot({ path: path.join(artifacts, 'demo-deposit-review.png') });
    await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await dialog.locator('.tx-status').filter({ hasText: 'Chờ xác nhận' }).waitFor();
    assert.equal(data.demo.balance, 200000);
    assert.equal(await dialog.getByRole('button', { name: 'Hoàn tất', exact: true }).count(), 0);
    await dialog.getByRole('button', { name: 'Hủy yêu cầu', exact: true }).click();
    await dialog.locator('.tx-status').filter({ hasText: 'Đã hủy' }).waitFor();
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await wallet.locator('.actions button').nth(3).click();
    await dialog.locator('input[name="demoBankLabel"]').fill('Ngân hàng mô phỏng UI');
    await dialog.getByRole('button', { name: 'Thêm tài khoản', exact: true }).click();
    await dialog.locator('select[name="demoBankId"]').selectOption('bank-test');
    await dialog.locator('input[name="demoAmount"]').fill('50000');
    await dialog.getByRole('button', { name: 'Kiểm tra thông tin', exact: true }).click();
    await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await dialog.locator('.tx-status').filter({ hasText: 'Chờ xác nhận' }).waitFor();
    assert.equal(data.demo.held, 50000); assert.equal(data.demo.available_balance, 150000);
    await dialog.getByRole('button', { name: 'Hủy yêu cầu', exact: true }).click();
    await dialog.locator('.tx-status').filter({ hasText: 'Đã hủy' }).waitFor();
    assert.equal(data.demo.held, 0);
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await wallet.locator('.actions button').nth(1).click();
    await dialog.locator('input[name="recipientQuery"]').fill('recipient-test');
    await dialog.getByRole('button', { name: 'Tìm người nhận', exact: true }).click();
    await dialog.locator('.recipient-preview').waitFor();
    await dialog.locator('input[name="demoAmount"]').fill('20000');
    await dialog.locator('input[name="transferNote"]').fill('Chuyển thử nghiệm UI');
    await dialog.getByRole('button', { name: 'Kiểm tra thông tin', exact: true }).click();
    await page.screenshot({ path: path.join(artifacts, 'demo-transfer-review.png') });
    await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await dialog.locator('.tx-status').filter({ hasText: 'Thành công' }).waitFor();
    assert.equal(data.demo.available_balance, 180000);
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await wallet.getByRole('button', { name: 'Lịch sử giao dịch', exact: false }).click();
    await dialog.locator('.history-item').first().waitFor();
    await dialog.locator('.history-item').first().click();
    await dialog.locator('.detail-amount').waitFor();
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    // Render the admin-only queue using an explicit admin session fixture.
    makeTx('deposit', 50000); data.demo.can_settle = true;
    await page.evaluate(() => { const user = JSON.parse(localStorage.getItem('greensteps_user')); user.role = 'admin'; localStorage.setItem('greensteps_user', JSON.stringify(user)); });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }); await wallet.locator('.columns').waitFor();
    await wallet.getByRole('button', { name: 'Quản lý giao dịch', exact: true }).click();
    await dialog.locator('.queue-item').waitFor();
    await page.screenshot({ path: path.join(artifacts, 'demo-admin-queue.png') });
    await dialog.getByRole('button', { name: 'Hoàn tất', exact: true }).click();
    await dialog.getByText('Không có yêu cầu đang chờ.', { exact: true }).waitFor();
    assert.equal(data.demo.balance, 230000);
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    data.demo.can_settle = false; data.demo.can_simulate = true;
    await page.evaluate(() => { const user = JSON.parse(localStorage.getItem('greensteps_user')); user.role = 'traveler'; localStorage.setItem('greensteps_user', JSON.stringify(user)); });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }); await wallet.locator('.columns').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('app-green-wallet').screenshot({ path: path.join(artifacts, 'mobile.png') });
    const bounds = await page.locator('app-green-wallet .columns').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'wallet must fit mobile viewport');
    await page.locator('app-green-wallet .points').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'mobile-points.png') });
    await page.locator('app-green-wallet .transaction').first().scrollIntoViewIfNeeded();
    const transaction = await page.locator('app-green-wallet .transaction').first().boundingBox();
    assert.ok(transaction.y >= 0 && transaction.y < 844, 'mobile history must be reachable by scrolling');
    await page.screenshot({ path: path.join(artifacts, 'mobile-history.png') });
    await wallet.locator('.actions button').first().click();
    const mobileDialog = await dialog.boundingBox();
    assert.ok(mobileDialog.x >= 0 && mobileDialog.x + mobileDialog.width <= 390 && mobileDialog.y >= 0 && mobileDialog.y + mobileDialog.height <= 844, 'demo popup must fit mobile viewport');
    await page.screenshot({ path: path.join(artifacts, 'demo-deposit-mobile.png') });
    await dialog.getByRole('button', { name: 'Kiểm tra thông tin', exact: true }).click();
    await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await dialog.getByRole('button', { name: 'Tôi đã chuyển khoản', exact: true }).click();
    await dialog.locator('.tx-status').filter({ hasText: 'Thành công' }).waitFor();
    assert.equal(data.demo.balance, 280000);
    assert.equal(await dialog.getByRole('button', { name: 'Hoàn tất', exact: true }).count(), 0);
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log('Wallet desktop/mobile, points, demo deposit/withdraw/transfer, history and admin queue passed.');
  } finally { await browser?.close(); if (server) await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
