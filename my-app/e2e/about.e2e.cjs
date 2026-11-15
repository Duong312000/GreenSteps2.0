// Isolated production-build browser checks. No account or database writes.
const { chromium } = require('playwright');
const express = require('../../backend/node_modules/express');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const app = express();
  const root = path.resolve(__dirname, '../dist/my-app/browser');
  const artifacts = path.resolve(__dirname, '../../tmp/about-artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  app.use(express.static(root));
  app.use((req, res) => res.sendFile(path.join(root, 'index.html')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    await context.route('**/api/**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/maintenance-status')
        return route.fulfill({ json: { maintenanceMode: false } });
      // Controlled fixtures validate rendering; these are never production statistics.
      if (pathname === '/api/tours')
        return route.fulfill({
          json: [
            { id: 'test-a', title: 'Tour test A', destination: 'Đà Lạt' },
            { id: 'test-b', title: 'Tour test B', destination: 'Phú Yên' },
          ],
        });
      return route.fulfill({ json: [] });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/about`, { waitUntil: 'networkidle' });
      await page.locator('#introduction-title').waitFor();
      assert.equal(await page.locator('.facts-section').count(), 0);
      const dimensions = await page.evaluate(() => {
        const hero = document.querySelector('.about-hero').getBoundingClientRect();
        const header = document.querySelector('header').getBoundingClientRect();
        return {
          viewport: innerWidth,
          viewportHeight: innerHeight,
          pageWidth: document.documentElement.scrollWidth,
          hero: { x: hero.x, y: hero.y, width: hero.width, height: hero.height },
          headerBottom: header.bottom,
        };
      });
      assert.ok(dimensions.pageWidth <= dimensions.viewport, `Horizontal overflow at ${width}`);
      assert.equal(dimensions.hero.width, width);
      assert.equal(dimensions.hero.x, 0);
      assert.ok(
        Math.abs(dimensions.hero.y - dimensions.headerBottom) < 2,
        `Hero must start below navbar at ${width}`,
      );
      assert.ok(
        Math.abs(dimensions.hero.height - (dimensions.viewportHeight - dimensions.headerBottom)) <
          2,
      );
      await page.locator('video').evaluate((video) => video.pause());
      await page.screenshot({ path: path.join(artifacts, `hero-${width}.png`) });
      await page.getByRole('button', { name: 'Khám phá GreenSteps' }).click();
      await page.waitForFunction(
        () => document.querySelector('#about-introduction').getBoundingClientRect().top < 160,
      );
      await page.locator('.values-section').scrollIntoViewIfNeeded();
      await page.locator('.founders-section').scrollIntoViewIfNeeded();
      await page.locator('.story-section').scrollIntoViewIfNeeded();
      await page.locator('.about-cta').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600); // Wait for requested reveal transition before visual QA.
      await page.screenshot({ path: path.join(artifacts, `full-${width}.png`), fullPage: true });
      assert.equal(await page.locator('.founder').count(), 6);
      assert.equal(await page.locator('.value-card').count(), 4);
      assert.equal(await page.locator('#story-year').inputValue(), '2026');
      assert.equal(await page.locator('.milestone').count(), 5);
      assert.equal(await page.locator('.story-navigation').count(), 0);
      assert.equal(await page.locator('.journey-link').getAttribute('href'), '/tours');
      assert.equal(await page.locator('app-footer a[href="/about"]').count(), 1);
      console.log(`PASS layout, full-bleed hero, content and links: ${width}px`);
    }
    await page.locator('.journey-link').click();
    await page.waitForURL('**/tours');
    await page.locator('app-footer a[href="/about"]').click();
    await page.waitForURL('**/about');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('video source').count(), 0);
    assert.equal(await page.locator('video').evaluate((video) => video.paused), true);
    assert.equal(await page.locator('video').evaluate((video) => video.autoplay), false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    const video = await page.locator('video').evaluate((video) => ({
      muted: video.muted,
      loop: video.loop,
      inline: video.playsInline,
      duration: video.duration,
    }));
    assert.equal(video.muted && video.loop && video.inline, true);
    assert.ok(video.duration >= 17 && video.duration <= 19);
    await page.locator('video').evaluate((video) => video.dispatchEvent(new Event('error')));
    assert.equal(
      await page.locator('video').evaluate((video) => getComputedStyle(video).visibility),
      'hidden',
    );
    assert.ok(
      await page.locator('.hero-poster').evaluate((img) => img.complete && img.naturalWidth > 0),
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS CTA/footer navigation, reduced motion, local video decode, poster fallback, no statistics section, no runtime errors.',
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
