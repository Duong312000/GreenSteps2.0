const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('../src/db/mongo-store');
const { loadAgentCatalog, createCatalogLoader } = require('../src/services/greensteps-agent-catalog.service');
const { createCatalogModels } = require('./helpers/greensteps-catalog-models');

const scheduleRows = [
  { id: 't-dalat-3', tour_name: 'Đà Lạt Eco', destination: 'Đà Lạt', days: 3, carbon: 12, image_url: '/dalat.jpg', tour_description: 'Eco tour' },
  { id: 't-hue-2', tour_name: 'Huế Walk', destination: 'Huế', days: 2, carbon: 8 }
];
const tourRows = [
  { id: 't-dalat-3', cost: 2500000, rating: 4.9, votes_count: 20 },
  { id: 't-hue-2', cost: 1800000, rating: 4.5, votes_count: 8 }
];
const serviceRows = [
  { id: 's-live-cafe', name_service: 'Pine Cafe', type: 'food', destination: 'Đà Lạt', cost: 120000, carbon: 0.2, status: 'active' },
  { id: 's-pending-cafe', name_service: 'Pending Cafe', type: 'food', destination: 'Đà Lạt', cost: 90000, carbon: 0.1, status: 'pending' },
  { id: 's-hue-stay', name_service: 'Hue Stay', type: 'stay', destination: 'Huế', cost: 500000, carbon: 1, status: 'active' }
];

function createModels({ schedules = scheduleRows, tours = tourRows, services = serviceRows, activities = [] } = {}) {
  const calls = [];
  const repo = (name, rows) => ({
    async findAll(options = {}) {
      calls.push({ name, options });
      if (name === 'ScheduleActivity') return rows;
      if (name === 'GreenService') {
        const destination = options.where.destination?.[Op.regex];
        const destinationExpression = destination ? new RegExp(destination, 'i') : null;
        const maxCost = options.where.cost?.[Op.lte];
        return rows.filter(row => row.status === options.where.status
          && (!options.where.type || options.where.type === row.type)
          && (!destinationExpression || destinationExpression.test(row.destination))
          && (maxCost === undefined || row.cost <= maxCost));
      }
      return [];
    }
  });
  const scheduleById = new Map(schedules.map(schedule => [schedule.id, schedule]));
  const tourCollection = {
    collectionName: 'test_schedulesamples',
    aggregate(pipeline) {
      calls.push({ name: 'ScheduleSample.aggregate', pipeline });
      const match = pipeline.find(stage => stage.$match)?.$match || {};
      let results = tours.map(tour => ({ ...tour, schedule: scheduleById.get(tour.id) })).filter(row => row.schedule);
      if (match['schedule.destination']) {
        const expression = new RegExp(match['schedule.destination'].$regex, match['schedule.destination'].$options);
        results = results.filter(row => expression.test(row.schedule.destination));
      }
      if (match['schedule.days']) results = results.filter(row => row.schedule.days === match['schedule.days']);
      if (match.cost?.$lte !== undefined) results = results.filter(row => row.cost <= match.cost.$lte);
      const skip = pipeline.find(stage => stage.$skip)?.$skip || 0;
      const limit = pipeline.find(stage => stage.$limit)?.$limit || results.length;
      return { toArray: async () => results.slice(skip, skip + limit) };
    }
  };
  return {
    calls,
    models: {
      Schedule: { collection: { collectionName: 'test_schedules' } },
      ScheduleSample: { collection: tourCollection },
      ScheduleActivity: repo('ScheduleActivity', activities),
      GreenService: repo('GreenService', services)
    }
  };
}

test('catalog searches matching destination and duration in bounded Mongo queries', async () => {
  const { models, calls } = createModels();
  const result = await loadAgentCatalog({
    models,
    query: { destination: 'Đà Lạt', durationDays: 3, maxBudget: 3000000, pageSize: 8 }
  });

  assert.equal(result.available, true);
  assert.deepEqual(result.tours.map(tour => [tour.id, tour.destination, tour.days, tour.cost]), [['t-dalat-3', 'Đà Lạt', 3, 2500000]]);
  const pipeline = calls.find(call => call.name === 'ScheduleSample.aggregate').pipeline;
  const match = pipeline.find(stage => stage.$match).$match;
  assert.equal(match['schedule.days'], 3);
  assert.equal(match['schedule.destination'].$options, 'i');
  assert.equal(match.cost.$lte, 3000000);
  assert.equal(pipeline.find(stage => stage.$limit).$limit, 9);
});

test('catalog returns only active destination and service-type matches', async () => {
  const { models, calls } = createModels();
  const result = await loadAgentCatalog({ models, query: { destination: 'Đà Lạt', serviceType: 'food', pageSize: 5 } });

  assert.deepEqual(result.services.map(service => service.id), ['s-live-cafe']);
  const query = calls.find(call => call.name === 'GreenService').options;
  assert.equal(query.where.status, 'active');
  assert.equal(query.where.type, 'food');
  assert.ok(query.where.destination[Op.regex]);
  assert.equal(query.limit, 6);
});

test('catalog query parser extracts unaccented Vietnamese destination text for itinerary filtering', () => {
  const { queryFromRequest } = require('../src/services/greensteps-agent-catalog.service');
  const query = queryFromRequest({ message: 'Lap lich trinh 3 ngay o Da Lat' });

  assert.equal(query.destination, 'Da Lat');
  assert.equal(query.durationDays, 3);
});

test('catalog parser stops destination at a sentence period before the rest of the request', () => {
  const { queryFromRequest } = require('../src/services/greensteps-agent-catalog.service');
  const query = queryFromRequest({ message: 'Lap lich trinh 3 ngay o Da Lat. Hay chon dich vu GreenSteps neu phu hop.' });

  assert.equal(query.destination, 'Da Lat');
});

test('catalog matches unaccented destination query against accented Vietnamese service and tour data', async () => {
  const models = createCatalogModels({ tours: [
    { id: 'tour-dalat', title: 'Đà Lạt Eco', destination: 'Đà Lạt', days: 3, cost: 2000000 }
  ], services: [
    { id: 'service-dalat', name: 'Đà Lạt Cafe', type: 'food', destination: 'Đà Lạt', cost: 100000, status: 'active' }
  ] });

  const result = await loadAgentCatalog({ models, query: { destination: 'Da Lat' } });

  assert.deepEqual(result.tours.map(tour => tour.id), ['tour-dalat']);
  assert.deepEqual(result.services.map(service => service.id), ['service-dalat']);
});

test('catalog exposes bounded pagination and does not report an empty later page as unavailable', async () => {
  const { models } = createModels({ schedules: [], tours: [], services: [] });
  const result = await loadAgentCatalog({ models, query: { page: 2, pageSize: 1000 } });

  assert.equal(result.available, true);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 40);
  assert.deepEqual(result.tours, []);
  assert.deepEqual(result.services, []);
});

test('catalog cache is keyed by filters and uses a bounded configurable freshness window', async () => {
  const { models, calls } = createModels();
  const load = createCatalogLoader({ models, env: { N8N_CATALOG_CACHE_MS: '5000' } });
  const first = await load({ query: { destination: 'Đà Lạt', serviceType: 'food' } });
  const cached = await load({ query: { destination: 'Đà Lạt', serviceType: 'food' } });
  assert.deepEqual(cached, first);
  assert.equal(calls.filter(call => call.name === 'ScheduleSample.aggregate').length, 1);
  await load({ query: { destination: 'Huế', serviceType: 'food' } });
  assert.equal(calls.filter(call => call.name === 'ScheduleSample.aggregate').length, 2);
});

test('itinerary service candidates include filtered active matches from the next catalog page', async () => {
  const services = Array.from({ length: 23 }, (_, index) => ({
    id: `dalat-food-${index + 1}`, name: `Cafe ${index + 1}`, type: 'food', destination: 'Đà Lạt',
    cost: 100000 + index, carbon: 0.2, status: 'active'
  }));
  services.push(
    { id: 'inactive-later', name: 'Inactive Cafe', type: 'food', destination: 'Đà Lạt', cost: 50000, status: 'inactive' },
    { id: 'other-city-later', name: 'Hue Cafe', type: 'food', destination: 'Huế', cost: 50000, status: 'active' },
    { id: 'over-budget-later', name: 'Luxury Cafe', type: 'food', destination: 'Đà Lạt', cost: 500000, status: 'active' },
    { id: 'other-type-later', name: 'Dalat Stay', type: 'stay', destination: 'Đà Lạt', cost: 50000, status: 'active' }
  );
  const models = createCatalogModels({ services });

  const result = await loadAgentCatalog({
    models,
    query: { destination: 'Đà Lạt', serviceType: 'food', maxBudget: 150000 },
    includeServiceCandidates: true
  });

  assert.equal(result.available, true);
  assert.equal(result.services.length, 20);
  assert.equal(result.truncatedServices, true);
  assert.equal(result.serviceCandidates.length, 23);
  assert.ok(result.serviceCandidates.some(service => service.id === 'dalat-food-23'));
  assert.equal(result.serviceCandidatesComplete, true);
  assert.equal(result.serviceCandidates.every(service => service.status === 'active'
    && service.destination === 'Đà Lạt' && service.type === 'food' && service.cost <= 150000), true);
});

test('itinerary service candidates stay bounded and disclose an incomplete search after two pages', async () => {
  const services = Array.from({ length: 45 }, (_, index) => ({
    id: `dalat-service-${index + 1}`, name: `Service ${index + 1}`, type: 'food', destination: 'Đà Lạt',
    cost: 100000, status: 'active'
  }));
  const models = createCatalogModels({ services });

  const result = await loadAgentCatalog({ models, includeServiceCandidates: true });

  assert.equal(result.serviceCandidates.length, 40);
  assert.equal(result.serviceCandidatesComplete, false);
});
