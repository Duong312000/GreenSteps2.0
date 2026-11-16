const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.GREENSTEPS_URL || 'http://localhost:4200';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(`${baseUrl}/home`, { waitUntil: 'commit' });
    await page.locator('.gs-home-redesign').waitFor();
    await page.locator('.gs-motion-ready .gs-home-redesign').waitFor();
    const proofBeforeScroll = await page.locator('.gs-proof-intro[data-reveal]').evaluate(element => ({
      visible: element.classList.contains('is-visible'),
      opacity: Number(getComputedStyle(element).opacity),
      top: element.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
    }));
    assert.ok(proofBeforeScroll.top > proofBeforeScroll.viewportHeight, 'proof strip should still be below the viewport at page load');
    assert.equal(proofBeforeScroll.visible, false, 'off-screen content should wait for the user to approach it');
    assert.ok(proofBeforeScroll.opacity < 0.05, `off-screen content should be visually hidden until revealed (got ${proofBeforeScroll.opacity})`);

    const sequenceTargets = [
      '.gs-hero h1[data-reveal]',
      '.gs-proof-intro[data-reveal]',
      '.gs-itinerary-preview[data-reveal]',
      '.gs-ai-intro h2[data-reveal]',
      '.gs-review-gallery[data-reveal]',
      '.gs-final-cta-copy a[data-reveal]',
    ];

    for (const selector of sequenceTargets) {
      const target = page.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      await target.waitFor({ state: 'visible' });
      await page.waitForFunction(element => element.classList.contains('is-visible'), await target.elementHandle());
      await page.waitForFunction(element => Number(getComputedStyle(element).opacity) > 0.95, await target.elementHandle());
      const opacity = Number(await target.evaluate(element => getComputedStyle(element).opacity));
      assert.ok(opacity > 0.95, `${selector} should finish its reveal at full opacity (got ${opacity})`);
    }

    const destinationCenters = await page.locator('.gs-destination-card').evaluateAll(cards => {
      const stage = document.querySelector('.gs-destination-cards').getBoundingClientRect();
      return cards.map(card => {
        const rect = card.getBoundingClientRect();
        return { position: ['left', 'center', 'right'].find(name => card.classList.contains(name)), center: ((rect.left + rect.width / 2 - stage.left) / stage.width) * 100 };
      }).sort((a, b) => a.center - b.center);
    });
    for (const [index, expectedCenter] of [16, 50, 84].entries()) {
      assert.ok(Math.abs(destinationCenters[index].center - expectedCenter) < 5, `destination card ${destinationCenters[index].position} should stay centered at ${expectedCenter}% (got ${destinationCenters[index].center.toFixed(1)}%)`);
    }

    const widthCheck = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.equal(widthCheck, true, 'landing page should not scroll horizontally at 1366×768');

    for (const [width, height] of [[360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1920, 1080], [2560, 1440]]) {
      await page.setViewportSize({ width, height });
      const homeWidthCheck = await page.locator('.gs-home-redesign').evaluate(element => element.scrollWidth <= element.clientWidth + 1);
      assert.equal(homeWidthCheck, true, `home content should not overflow horizontally at ${width}×${height}`);
    }

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.locator('a[href="#trip-search"]').first().click();
    const anchorVisible = await page.locator('#trip-search').evaluate(element => element.getBoundingClientRect().top < window.innerHeight);
    assert.equal(anchorVisible, true, 'hero anchor should still scroll to the booking rail');

    const finalCta = page.locator('.gs-final-cta');
    await finalCta.scrollIntoViewIfNeeded();
    const finalCtaMetrics = await page.evaluate(async () => {
      const section = document.querySelector('.gs-final-cta');
      const image = section.querySelector(':scope > img');
      await image.decode();
      return {
        sectionHeight: section.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
        imageWidth: image.naturalWidth,
        imageFit: getComputedStyle(image).objectFit,
      };
    });
    assert.ok(finalCtaMetrics.sectionHeight >= finalCtaMetrics.viewportHeight - 1, `final CTA should fill viewport height (got ${finalCtaMetrics.sectionHeight}px for ${finalCtaMetrics.viewportHeight}px)`);
    assert.ok(finalCtaMetrics.imageWidth >= 1500, `final CTA should use the sharper wide image (got ${finalCtaMetrics.imageWidth}px)`);
    assert.equal(finalCtaMetrics.imageFit, 'cover', 'final CTA image should cover the whole section');

    const reducedMotionPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    await reducedMotionPage.goto(`${baseUrl}/home`, { waitUntil: 'commit' });
    await reducedMotionPage.locator('.gs-home-redesign').waitFor();
    await reducedMotionPage.locator('.gs-home-redesign').waitFor();
    const reducedMotionVisible = await reducedMotionPage.locator('[data-reveal]').evaluateAll(elements =>
      elements.every(element => element.classList.contains('is-visible'))
    );
    assert.equal(reducedMotionVisible, true, 'reduced-motion mode should reveal every target immediately');

    console.log('PASS: scroll reveal sequence, reduced motion, and desktop horizontal overflow');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
