const { test } = require('node:test');
const assert = require('node:assert/strict');
const search = require('../src/services/tour-search.service');

test('tour search expands Vietnamese diacritics and caps pagination', () => {
  assert.match(search.foldedSearchPattern('Da Lat'), /đ/iu);
  assert.deepEqual(search.parsePage({ page: '-4', pageSize: '900' }), { page: 1, pageSize: 100, offset: 0 });
});

test('tour search executes bounded database queries and returns stable page metadata', async () => {
  const calls = [];
  const schedules = [
    { id: 'tour-b', tour_name: 'Biển xanh', destination: 'Phú Quốc', catalog_status: 'editorial' },
    { id: 'tour-a', tour_name: 'Biển xanh', destination: 'Phú Quốc', catalog_status: 'bookable' }
  ];
  const models = {
    Schedule: { async findAll(query) { calls.push(['schedule', query]); return schedules; } },
    ScheduleSample: {
      async count(query) {
        calls.push(['count', query]);
        return 2;
      },
      async findAll(query) {
        calls.push(['sample', query]);
        return [{ id: 'tour-a', cost: 1200, Schedule: schedules[1] }];
      }
    },
    BadgeSchedule: { async findAll() { return []; } },
    ScheduleActivity: { async findAll() { return []; } },
    Destination: { async findAll() { return []; } },
    Region: { async findOne() { return null; } }
  };
  const result = await search.searchTours({ models, query: { q: 'bien xanh', page: '2', pageSize: '1', sort: 'cost' } });
  assert.equal(result.total, 2);
  assert.equal(result.items[0].id, 'tour-b');
  assert.equal(result.page, 2);
  assert.equal(calls[1][1].limit, 5000);
  assert.equal(calls[0][1].limit <= 5000, true);
});

test('tour search excludes draft records and returns editorial content without invented price or availability', async () => {
  const query = { page: 1 };
  const result = await search.searchTours({
    models: {
      Schedule: { async findAll() { return [{ id: 'demo', tour_name: 'Draft', catalog_status: 'draft' }, { id: 'editorial', tour_name: 'Demo', catalog_status: 'editorial' }]; } },
      ScheduleSample: { async count() { return 0; }, async findAll() { return []; } },
      BadgeSchedule: { async findAll() { return []; } },
      ScheduleActivity: { async findAll() { return []; } },
      Destination: { async findAll() { return []; } },
      Region: { async findOne() { return null; } }
    }, query
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'editorial');
  assert.equal(Object.hasOwn(result.items[0], 'cost'), false);
  assert.equal(result.items[0].bookingEnabled, false);
});

test('tour search exposes demo image credits and editorial fields without commercial or emissions claims', async () => {
  const photo = {
    path: 'image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg',
    caption: 'Núi đá vôi ở Tràng An.', author: 'Photographer', licenseId: 'CC BY 4.0'
  };
  const result = await search.searchTours({ models: {
    Schedule: { async findAll() { return [{
      id: 'demo-vn-tour-ninh-binh-1', tour_name: 'Ninh Bình', destination: 'Ninh Bình', days: 3,
      catalog_status: 'demo', image_url: photo.path, gallery: [photo.path], photo_metadata: [photo],
      tour_description: 'Editorial copy', responsible_travel: 'Care for the place', practical_notes: 'Check access',
      editorial_itinerary_notice: 'Proposed only', carbon: null
    }]; } },
    ScheduleSample: { async count() { return 0; }, async findAll() { return []; } },
    BadgeSchedule: { async findAll() { return []; } },
    ScheduleActivity: { async findAll() { return []; } },
    Destination: { async findAll() { return []; } },
    Region: { async findOne() { return null; } }
  }, query: {} });
  const [item] = result.items;
  assert.deepEqual(item.gallery, [photo.path]);
  assert.deepEqual(item.photoMetadata, [photo]);
  assert.equal(item.responsibleTravel, 'Care for the place');
  assert.equal(item.practicalNotes, 'Check access');
  assert.equal(item.editorialItineraryNotice, 'Proposed only');
  for (const inventedField of ['cost', 'rating', 'votes_count', 'maxCapacity', 'carbon']) assert.equal(Object.hasOwn(item, inventedField), false);
  assert.equal(item.is_demo, true);
  assert.equal(item.bookingEnabled, false);
});

test('tour search returns demo characteristics and explanatory content consistently', async () => {
  const result = await search.searchTours({ models: {
    Schedule: { async findAll() { return [{
      id: 'demo-vn-tour-sa-pa-1', tour_name: 'Sa Pa', destination: 'Sa Pa', days: 3,
      catalog_status: 'demo', style: 'Trekking', style_explanation: 'Đi bộ trên đường núi.',
      group_size: null, fitness_level: 'Vận động nhiều', fitness_is_estimate: true,
      fitness_explanation: 'Ước tính biên tập.', highlights: ['Thung lũng Mường Hoa'],
      responsible_travel: 'Theo lối được phép.', practical_notes: 'Kiểm tra thời tiết.',
      itinerary: []
    }]; } },
    ScheduleSample: { async count() { return 0; }, async findAll() { return []; } },
    BadgeSchedule: { async findAll() { return []; } },
    ScheduleActivity: { async findAll() { return []; } },
    Destination: { async findAll() { return []; } },
    Region: { async findOne() { return null; } }
  }, query: {} });
  const [item] = result.items;
  assert.equal(item.style, 'Trekking');
  assert.equal(item.styleExplanation, 'Đi bộ trên đường núi.');
  assert.equal(item.fitness_level, 'Vận động nhiều');
  assert.equal(item.fitnessIsEstimate, true);
  assert.equal(item.fitnessExplanation, 'Ước tính biên tập.');
  assert.deepEqual(item.highlights, ['Thung lũng Mường Hoa']);
  assert.equal(item.group_size, undefined);
  assert.equal(item.is_demo, true);
});
