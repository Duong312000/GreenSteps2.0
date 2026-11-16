// Official timeline interaction checks against the production bundle.
const { chromium } = require('playwright');
const express = require('../../backend/node_modules/express');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '../dist/my-app/browser');
  const artifacts = path.resolve(__dirname, '../../tmp/about-story-artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const app = express();
  app.use(express.static(root));
  app.use((req, res) => res.sendFile(path.join(root, 'index.html')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/**', (route) =>
      route.fulfill({
        json: route.request().url().includes('maintenance-status')
          ? { maintenanceMode: false }
          : [],
      }),
    );
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const width of [375, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/about', { waitUntil: 'networkidle' });
      await page.locator('.story-section').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.milestone').count(), 5);
      assert.equal(await page.locator('.story-navigation').count(), 0);
      assert.equal(await page.locator('#story-year').inputValue(), '2026');
      assert.equal(await page.locator('#story-year option').count(), 1);
      assert.equal(await page.locator('.founder').count(), 6);
      assert.equal(await page.locator('.facts-section').count(), 0);
      const geometry = await page.locator('.story-track').evaluate((track) => {
        const card = track.querySelector('.milestone');
        return {
          ratio: card.getBoundingClientRect().width / track.clientWidth,
          hiddenScrollbar: getComputedStyle(track).scrollbarWidth,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(geometry.pageOverflow, false);
      assert.equal(geometry.hiddenScrollbar, 'none');
      assert.ok(
        width < 601
          ? geometry.ratio > 0.8 && geometry.ratio < 1
          : width >= 1101
            ? geometry.ratio > 0.32 && geometry.ratio < 0.38
            : geometry.ratio > 0.5 && geometry.ratio < 0.6,
      );
      for (const index of [0, 1, 2, 3, 4]) {
        await page.locator('.story-track').evaluate((track, index) => {
          const cards = track.querySelectorAll('.milestone');
          track.scrollTo({
            left: cards[index].offsetLeft - cards[0].offsetLeft,
            behavior: 'instant',
          });
        }, index);
        await page.waitForFunction(
          (index) =>
            document.querySelector('.story-position').textContent.trim() === `${index + 1} / 5`,
          index,
        );
        assert.equal(await page.locator('#story-year').inputValue(), '2026');
        const card = page.locator('.milestone').nth(index);
        await card.locator('img').evaluate((img) => img.decode());
        const imageRatio = await card
          .locator('.milestone-image')
          .evaluate((image) => image.clientWidth / image.clientHeight);
        assert.ok(Math.abs(imageRatio - 4 / 3) < 0.02);
      }
      await page.locator('#story-year').selectOption('2026');
      await page.waitForFunction(
        () => document.querySelector('.story-position').textContent.trim() === '1 / 5',
      );
      const firstCard = page.locator('.milestone').first();
      const more = firstCard.locator('.story-read-more');
      assert.equal(await more.getAttribute('aria-expanded'), 'false');
      await more.click();
      await firstCard.locator('.milestone-description.is-expanded').waitFor();
      assert.equal(await more.getAttribute('aria-expanded'), 'true');
      assert.ok(
        (await firstCard.locator('.milestone-description').innerText()).includes(
          'bắt đầu hình thành.',
        ),
      );
      await more.click();
      await firstCard.locator('.milestone-description:not(.is-expanded)').waitFor();
      const track = page.locator('.story-track');
      await track.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(
        () => document.querySelector('.story-position').textContent.trim() === '2 / 5',
      );
      assert.equal(await page.locator('#story-year').inputValue(), '2026');
      await page.getByRole('button', { name: 'Mốc tiếp theo', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector('.story-position').textContent.trim() === '3 / 5',
      );
      await track.focus();
      await page.keyboard.press('End');
      await page.waitForFunction(
        () => document.querySelector('.story-position').textContent.trim() === '5 / 5',
      );
      assert.equal(
        await page.getByRole('button', { name: 'Mốc tiếp theo', exact: true }).isDisabled(),
        true,
      );
      await page.keyboard.press('Home');
      await page.waitForFunction(
        () => document.querySelector('.story-position').textContent.trim() === '1 / 5',
      );
      assert.equal(
        await page.getByRole('button', { name: 'Mốc trước', exact: true }).isDisabled(),
        true,
      );
      // Native scroll changes (including mobile swipes) keep year and position synchronized.
      await track.evaluate((track) => {
        const cards = track.querySelectorAll('.milestone');
        track.scrollLeft = cards[3].offsetLeft - cards[0].offsetLeft;
      });
      await page.waitForFunction(
        () => document.querySelector('.story-position').textContent.trim() === '4 / 5',
      );
      assert.equal(await page.locator('#story-year').inputValue(), '2026');
      await track.focus();
      await page.keyboard.press('Home');
      await page.waitForFunction(
        () => document.querySelector('.story-position').textContent.trim() === '1 / 5',
      );
      await page.evaluate(() => {
        const story = document.querySelector('.story-section');
        window.scrollTo({
          top: story.getBoundingClientRect().top + scrollY - 100,
          behavior: 'instant',
        });
      });
      await page.screenshot({ path: path.join(artifacts, `story-${width}.png`) });
      console.log(
        `PASS ${width}px: year dropdown, peeking cards, 4:3 images, arrows, keyboard, descriptions, scroll synchronization, no page overflow.`,
      );
    }
    // Mouse drag uses the same native scroll container, without a carousel dependency.
    const track = page.locator('.story-track');
    const box = await track.boundingBox();
    await page.mouse.move(box.x + 330, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 120, { steps: 12 });
    await page.mouse.up();
    assert.ok(await track.evaluate((track) => track.scrollLeft > 0));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await track.focus();
    await page.keyboard.press('End');
    await page.waitForFunction(
      () => document.querySelector('.story-position').textContent.trim() === '5 / 5',
    );
    assert.deepEqual(errors, []);
    console.log('PASS mouse drag, smooth navigation and no runtime errors.');
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
