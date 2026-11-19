const assert = require('node:assert/strict');
const test = require('node:test');
const { formatTourResponse } = require('../src/controllers/tour.controller');

test('tour list and detail formatting returns photo credits without invented demo commercial data', () => {
  const photo = { path: 'image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg', author: 'Photographer', licenseId: 'CC0 1.0' };
  const result = formatTourResponse(
    { id: 'demo-vn-tour-sa-pa-1', cost: 1500000, old_cost: 2000000, rating: 4.9, votes_count: 20 },
    {
      catalog_status: 'demo', tour_name: 'Sa Pa', destination: 'Sa Pa', days: 3,
      carbon: 0, max_capacity: 12, photo_metadata: [photo], gallery: [photo.path],
      tour_description: 'Editorial text', responsible_travel: 'Respect local communities.',
      practical_notes: 'Check conditions.', editorial_itinerary_notice: 'Proposed.'
    },
    [], [], []
  );
  assert.equal(result.id, 'demo-vn-tour-sa-pa-1');
  assert.equal(result.catalog_status, 'demo');
  assert.equal(result.bookingEnabled, false);
  assert.equal(result.cost, undefined);
  assert.equal(result.oldCost, undefined);
  assert.equal(result.rating, undefined);
  assert.equal(result.votes_count, undefined);
  assert.equal(result.carbon, undefined);
  assert.equal(result.maxCapacity, undefined);
  assert.deepEqual(result.tags, []);
  assert.deepEqual(result.gallery, [photo.path]);
  assert.deepEqual(result.photoMetadata, [photo]);
  assert.equal(result.responsibleTravel, 'Respect local communities.');
  assert.equal(result.practicalNotes, 'Check conditions.');
  assert.equal(result.editorialItineraryNotice, 'Proposed.');
});

test('tour detail formatter returns editorial characteristics without commercial defaults', () => {
  const result = formatTourResponse({ id: 'demo-vn-tour-sa-pa-1' }, {
    catalog_status: 'demo', tour_name: 'Sa Pa', destination: 'Sa Pa', days: 3, carbon: 0,
    style: 'Khám phá thiên nhiên', style_explanation: 'Theo dõi cảnh quan thung lũng.',
    group_size: null, fitness_level: 'Vận động nhiều', fitness_is_estimate: true,
    fitness_explanation: 'Ước tính biên tập do có đường núi.', highlights: ['Thung lũng Mường Hoa'],
    responsible_travel: 'Theo lối được phép.', practical_notes: 'Kiểm tra thời tiết.', itinerary: []
  }, [], [], []);
  assert.equal(result.style, 'Khám phá thiên nhiên');
  assert.equal(result.styleExplanation, 'Theo dõi cảnh quan thung lũng.');
  assert.equal(result.group_size, undefined);
  assert.equal(result.fitness_level, 'Vận động nhiều');
  assert.equal(result.fitnessIsEstimate, true);
  assert.equal(result.fitnessExplanation, 'Ước tính biên tập do có đường núi.');
  assert.deepEqual(result.highlights, ['Thung lũng Mường Hoa']);
  assert.equal(result.carbon, undefined);
  assert.equal(result.bookingEnabled, false);
});
