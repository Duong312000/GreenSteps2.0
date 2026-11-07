// Isolated UI fixtures; every API request is intercepted. No real records are written.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = path.resolve(__dirname, '../../tmp/detail-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const service = {
  id: 'srv-detail-test', name_service: 'Chốn Xanh Homestay', type: 'lodging',
  destination: 'Hà Nội', cost: 500000, carbon: 2, max_capacity: 10,
  image_url: 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg',
  current_data: {
    description: 'Không gian lưu trú xanh, yên tĩnh và gần gũi thiên nhiên.',
    address: 'Ba Đình, Hà Nội', lat: 21.04, lng: 105.82,
    amenityGroups: [{ name: 'Kết nối & tiện ích', items: ['WiFi miễn phí', 'Bếp chung'] }],
    popularAmenities: [{ name: 'WiFi miễn phí', fee: 'free' }],
    policyGroups: [{ title: 'Thời gian nhận và trả phòng', lines: ['Nhận phòng từ 14:00; trả phòng trước 12:00.'] }],
    greenFeatures: [{ title: 'Giảm rác nhựa', description: 'Sử dụng bình nước dùng lại.' }],
    nearbyGroups: [{ name: 'Điểm nổi bật', items: [{ name: 'Hồ gần khu nghỉ', distance: '1,2 km' }] }],
    rooms: [
      { id: 'studio', name: 'Studio', images: ['image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg'], area: 25, capacity: 2, beds: '1 giường đôi', amenities: ['WiFi miễn phí', 'Điều hòa'], policies: ['Thanh toán theo xác nhận của đối tác'], price_per_night: 500000, available_rooms: 3 },
      { id: 'family', name: 'Family', area: 40, capacity: 4, beds: '2 giường đôi', amenities: ['WiFi miễn phí', 'Bếp riêng'], price_per_night: 900000, available_rooms: 2 }
    ]
  }
};
async function open(browser, fixture, width) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/services/srv-detail-test') ? fixture
      : url.pathname.endsWith('/bookings/quote') ? { success: true, pricing: { discountPercent: 8, serviceFee: 120000, depositPercent: 30 } } : [];
    await route.fulfill({ json: body });
  });
  await page.route('https://maps.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Map test</p>' }));
  await page.goto(`${process.env.DETAIL_TEST_URL || 'http://localhost:4200'}/services/stay/srv-detail-test`);
  await page.locator('.detail-tabs').waitFor();
  return { page, errors };
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    for (const width of [1440, 1024, 768, 390]) {
      const { page, errors } = await open(browser, service, width);
      assert.equal(await page.getByRole('tab').count(), 6);
      await page.getByRole('tab', { name: 'Phòng', exact: true }).click();
      await page.locator('.room-card').first().waitFor();
      assert.equal(await page.locator('.room-card').count(), 2);
      await page.locator('#detail-rooms input').first().fill('2027-01-02');
      await page.locator('#detail-rooms input').first().dispatchEvent('change');
      await page.locator('#detail-rooms input').nth(1).fill('2027-01-05');
      await page.locator('#detail-rooms input').nth(1).dispatchEvent('change');
      const size = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(size.body <= size.viewport + 1, JSON.stringify({ width, ...size }));
      await page.locator('.content-shell').screenshot({ path: path.join(artifacts, `rooms-${width}.png`) });
      if (width === 390) {
        await page.locator('.room-card').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(artifacts, 'mobile-room-viewport.png') });
      }
      await page.getByRole('tab', { name: 'Tiện nghi & Dịch vụ', exact: true }).click();
      await page.getByText('Bếp chung', { exact: true }).waitFor();
      assert.ok(await page.getByText('Bếp chung', { exact: true }).isVisible());
      await page.locator('.amenity-fee.free').first().waitFor();
      assert.ok(await page.locator('.green-practices-grid').isVisible());
      await page.getByRole('tab', { name: 'Chính Sách', exact: true }).click();
      await page.locator('.policy-detail-row').first().waitFor();
      assert.ok(await page.getByText('Nhận phòng từ 14:00; trả phòng trước 12:00.', { exact: true }).isVisible());
      await page.getByRole('tab', { name: 'Vị trí', exact: true }).click();
      await page.locator('.location-map-layout iframe').waitFor();
      await page.locator('.surroundings-group').first().waitFor();
      assert.ok(await page.getByText('1,2 km', { exact: true }).isVisible());
      await page.getByRole('tab', { name: 'Đánh Giá Của Khách', exact: true }).click();
      await page.locator('.review-summary-card').waitFor();
      await page.getByRole('tab', { name: 'Phòng', exact: true }).click();
      await page.locator('.room-filter-row button').filter({ hasText: 'Bếp riêng' }).click();
      await page.waitForFunction(() => document.querySelectorAll('.room-card').length === 1);
      assert.equal(await page.locator('.room-card').count(), 1);
      await page.locator('.room-price select').selectOption({ label: '2 phòng' });
      await page.locator('.room-book-button').first().click();
      await page.waitForURL('**/booking?**');
      assert.equal(new URL(page.url()).searchParams.get('roomId'), 'family');
      assert.equal(new URL(page.url()).searchParams.get('roomCount'), '2');
      assert.equal(new URL(page.url()).searchParams.get('checkOut'), '2027-01-05');
      await page.locator('.price-card').first().waitFor();
      await page.waitForFunction(() => document.querySelector('.price-card')?.textContent.includes('5.400.000'));
      assert.equal(errors.length, 0, errors.join('\n'));
      await page.close();
      console.log(`PASS lodging tabs, layout and booking context at ${width}px`);
    }
    const empty = structuredClone(service);
    empty.current_data.rooms = [];
    const { page } = await open(browser, empty, 390);
    await page.getByRole('tab', { name: 'Phòng', exact: true }).click();
    await page.getByText('Thông tin phòng đang được cập nhật', { exact: true }).waitFor();
    assert.ok(await page.getByText('Thông tin phòng đang được cập nhật', { exact: true }).isVisible());
    assert.equal(await page.locator('.room-card').count(), 0);
    await page.close();
    const transport = structuredClone(empty);
    transport.type = 'transport';
    const other = await open(browser, transport, 390);
    assert.equal(await other.page.getByRole('tab').count(), 5);
    assert.equal(await other.page.getByRole('tab', { name: 'Phòng', exact: true }).count(), 0);
    await other.page.close();
    console.log('PASS empty catalog and non-lodging service');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
