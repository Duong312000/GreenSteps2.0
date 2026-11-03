// UI checks use mocked HTTP responses; Mongo persistence is covered by backend integration tests.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist/my-app/browser');
const artifacts = path.resolve(__dirname, '../../tmp/community-moderation');
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
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://localhost:${server.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const errors = [];
    const standards = [{ id: 'spam', title: 'Không spam, quảng cáo tràn lan', description: 'Không đăng nội dung lặp lại.' }, { id: 'other', title: 'Vi phạm khác', description: 'Mô tả rõ vi phạm.' }];
    const report = { id: 'report-1', targetId: 'post-1', targetType: 'post', author: 'Thành viên A', text: 'Bài viết cần xem xét', snapshot: 'Bài viết cần xem xét', reasonLabel: 'Spam', status: 'pending', createdAt: new Date().toISOString(), images: [], history: [] };
    let submittedReport, submittedReview;
    async function setup(role) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https:\/\//, route => route.abort());
      await page.route('http://localhost:5055/**', async route => {
        const url = new URL(route.request().url());
        let body = [];
        if (url.pathname.endsWith('/community/standards')) body = standards;
        else if (url.pathname.endsWith('/community/posts')) body = [{ id: 'post-1', authorId: 'owner', author: 'Thành viên A', avatar: 'A', text: 'Bài viết cần xem xét', time: new Date().toISOString(), postType: 'post', images: ['image/greensteps_logo_header.png'] }];
        else if (url.pathname.endsWith('/community/reports') && route.request().method() === 'POST') { submittedReport = route.request().postDataJSON(); body = { success: true, message: 'Đã gửi báo cáo. Quản trị viên sẽ xem xét nội dung.' }; }
        else if (url.pathname.endsWith('/community/reports')) body = [report];
        else if (url.pathname.endsWith('/review')) { submittedReview = route.request().postDataJSON(); report.status = 'hidden'; report.hidden = true; body = { success: true }; }
        else if (url.pathname.endsWith('/wallet/withdrawals')) body = { withdrawals: [] };
        else if (url.pathname.includes('/challenge/')) body = null;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.addInitScript(role => {
        const user = { id: 'viewer', username: 'viewer', fullname: 'Người kiểm tra', role };
        const payload = btoa(JSON.stringify({ id: user.id, role, exp: Math.floor(Date.now() / 1000) + 3600 }));
        localStorage.setItem('greensteps_user', JSON.stringify(user));
        localStorage.setItem('greensteps_token', `eyJhbGciOiJIUzI1NiJ9.${payload}.test`);
      }, role);
      return page;
    }
    const page = await setup('traveler');
    await page.goto(origin + '/community');
    await page.getByRole('button', { name: 'Tiêu chuẩn cộng đồng' }).first().click();
    await page.getByRole('heading', { name: 'Tiêu chuẩn cộng đồng', exact: true }).waitFor();
    await page.getByText('Không spam, quảng cáo tràn lan', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'standards-desktop.png') });
    await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.locator('.gs-post-menu summary').click();
    const menuButton = page.locator('.gs-post-menu-pop button').last();
    assert.ok(await menuButton.evaluate(button => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 3));
    }), 'post menu must stay above the post image');
    await page.screenshot({ path: path.join(artifacts, 'post-menu-above-image.png') });
    await page.getByRole('button', { name: 'Báo cáo vi phạm' }).click();
    await page.getByLabel('Không spam, quảng cáo tràn lan', { exact: true }).check();
    await page.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Đã gửi báo cáo' }).waitFor();
    assert.equal(submittedReport.reason, 'spam');
    assert.equal(submittedReport.targetId, 'post-1');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Tiêu chuẩn cộng đồng' }).first().click();
    await page.screenshot({ path: path.join(artifacts, 'standards-mobile.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'community should not overflow on mobile');
    const admin = await setup('admin');
    await admin.goto(origin + '/admin');
    await admin.screenshot({ path: path.join(artifacts, 'admin-initial.png') });
    if (errors.length) console.log('Browser errors:', errors);
    await admin.locator('.sidebar-item[title="Nội dung cộng đồng"]').click();
    await admin.getByRole('button', { name: 'Xem và xử lý', exact: true }).waitFor();
    assert.deepEqual(await admin.locator('.community-report-metric strong').allTextContents(), ['1', '1', '0', '0']);
    await admin.screenshot({ path: path.join(artifacts, 'admin-community-workspace.png') });
    await admin.getByLabel('Tìm báo cáo cộng đồng').fill('does-not-exist');
    await admin.getByText('Không có báo cáo phù hợp', { exact: true }).waitFor();
    await admin.getByLabel('Tìm báo cáo cộng đồng').fill('');
    await admin.getByLabel('Tìm báo cáo cộng đồng').blur();
    await admin.setViewportSize({ width: 390, height: 844 });
    await admin.screenshot({ path: path.join(artifacts, 'admin-community-mobile.png'), animations: 'disabled' });
    assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'admin workspace should not overflow on mobile');
    await admin.setViewportSize({ width: 1440, height: 1000 });
    await admin.getByRole('button', { name: 'Xem và xử lý', exact: true }).click();
    await admin.getByRole('heading', { name: 'Kiểm duyệt nội dung cộng đồng' }).waitFor();
    await admin.getByLabel('Lý do quyết định').fill('Vi phạm quy định chống spam');
    await admin.screenshot({ path: path.join(artifacts, 'admin-review.png') });
    await admin.getByRole('button', { name: 'Xác nhận quyết định' }).click();
    await admin.locator('.community-review-dialog').waitFor({ state: 'detached' });
    assert.equal(submittedReview.action, 'hide');
    assert.equal(submittedReview.note, 'Vi phạm quy định chống spam');
    await admin.getByLabel('Trạng thái báo cáo', { exact: true }).selectOption('hidden');
    await admin.getByRole('button', { name: 'Xem và xử lý' }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Community standards, report submission, mobile layout and admin moderation UI passed.');
  } catch (error) {
    if (browser) for (const context of browser.contexts()) for (const page of context.pages()) console.log('Page:', page.url(), (await page.locator('body').innerText()).slice(0, 1600));
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
