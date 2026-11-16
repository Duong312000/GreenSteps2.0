// Local presentation check only. All API requests are intercepted with the checked-in demo seed.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { demoTours } = require('../../backend/src/data/demo-tours.seed');

const tour = demoTours.find(item => item.id === 'demo-vn-tour-sa-pa-1');
if (!tour) throw new Error('Sa Pa demo fixture is missing.');
const detail = {
  id: tour.id, title: tour.tour_name, destination: tour.destination, days: tour.days,
  catalog_status: 'demo', is_demo: true, bookingEnabled: false,
  image: tour.image_url, image_url: tour.image_url, gallery: tour.gallery,
  photoMetadata: tour.photo_metadata, description: tour.tour_description,
  highlights: tour.highlights, responsibleTravel: tour.responsible_travel,
  practicalNotes: tour.practical_notes, editorialItineraryNotice: tour.editorial_itinerary_notice,
  style: tour.style, styleExplanation: tour.style_explanation,
  group_size: tour.group_size, fitness_level: tour.fitness_level,
  fitnessIsEstimate: tour.fitness_is_estimate, fitnessExplanation: tour.fitness_explanation,
  data: Array.from({ length: tour.days }, (_, index) => tour.itinerary
    .filter(activity => activity.day_number === index + 1)
    .map(activity => ({ id: activity.id, name: activity.activity_name, time: activity.time, description: activity.editorial_note })))
};

const outputDirectory = path.resolve(__dirname, '../../docs/plans/greensteps-tour-enrichment-v2/screenshots');
fs.mkdirSync(outputDirectory, { recursive: true });

async function capture(browser, width, name) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith(`/tours/${tour.id}`)
      ? detail
      : pathname.includes('/reviews/tour/') || pathname.includes('/bookings') ? [] : [];
    await route.fulfill({ json: body });
  });
  await page.goto(`${process.env.TOUR_DETAIL_TEST_URL || 'http://127.0.0.1:4200'}/tour-detail/${tour.id}`);
  await page.locator('.gs-overview-cards-grid .gs-ov-card').first().waitFor();
  assert.equal(await page.locator('.gs-overview-cards-grid .gs-ov-card').count(), 4);
  assert.equal(await page.getByRole('tab').count(), 5);
  if (width <= 500) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(outputDirectory, `${name}.png`) });
  }

  await page.getByRole('tab', { name: 'Bao gồm & Tiện ích' }).click();
  await page.getByText('Dịch vụ bao gồm chưa được xác nhận.').waitFor();
  await page.getByRole('tab', { name: 'Chính sách đặt cọc' }).click();
  await page.getByText('Tour tham khảo — chưa áp dụng đặt cọc hoặc thanh toán.').waitFor();
  await page.getByRole('tab', { name: 'Lịch trình' }).click();
  await page.getByText('Ngày 1 · Cảnh quan thung lũng và ruộng bậc thang').waitFor();
  await page.getByRole('tab', { name: 'Tổng quan' }).click();
  if (width <= 500) {
    await page.locator('.gs-tabs-section').evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(outputDirectory, `${name}-overview.png`) });
  } else {
    await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true });
  }
  assert.deepEqual(errors, [], errors.join('\n'));
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    await capture(browser, 1440, 'sa-pa-detail-desktop');
    await capture(browser, 390, 'sa-pa-detail-mobile');
    console.log('Captured desktop and mobile demo-detail screenshots with intercepted seed data; no live API was used.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
