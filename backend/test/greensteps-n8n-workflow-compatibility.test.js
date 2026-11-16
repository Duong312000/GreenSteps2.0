const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.resolve(__dirname, '../../integrations/n8n/GreenSteps_Agent_V4_DB_Compatible.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const byName = name => workflow.nodes.find(node => node.name === name);

test('V4 workflow is a separate inactive import without source instance or credential IDs', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.name, 'GreenSteps Agent V4 DB Compatible');
  assert.equal(Object.hasOwn(workflow, 'id'), false);
  assert.equal(Object.hasOwn(workflow, 'versionId'), false);
  assert.equal(workflow.nodes.every(node => !Object.hasOwn(node, 'credentials')), true);
  const nodeNames = new Set(workflow.nodes.map(node => node.name));
  for (const [name, connection] of Object.entries(workflow.connections)) {
    assert.ok(nodeNames.has(name), `missing source node ${name}`);
    for (const edges of Object.values(connection)) {
      for (const branch of edges) for (const edge of branch) assert.ok(nodeNames.has(edge.node), `missing target node ${edge.node}`);
    }
  }
});

test('Validate Input preserves backend page metadata and admits only active services', () => {
  const input = {
    message: 'Tìm quán ăn', sessionId: 'n8n-v4-test-session', history: [],
    context: { catalog: {
      available: true, fetchedAt: '2026-11-10T00:00:00.000Z', page: 1, pageSize: 20, nextPage: 2,
      truncated: true, truncatedTours: false, truncatedServices: true,
      tours: [{ id: 'tour-1', title: 'Tour One', destination: 'Huế', days: 3, cost: 2000000 }],
      services: [
        { id: 'active', name: 'Pine Cafe', type: 'food', destination: 'Đà Lạt', cost: 80000, status: 'active' },
        { id: 'suspended', name: 'Hidden', type: 'food', destination: 'Đà Lạt', cost: 70000, status: 'suspended' },
        { id: 'approved', name: 'Legacy', type: 'food', destination: 'Đà Lạt', cost: 60000, status: 'approved' },
        { id: 'missing-status', name: 'Unverified', type: 'food', destination: 'Đà Lạt', cost: 50000 }
      ]
    } }
  };
  const validate = new Function('$input', byName('Validate Input1').parameters.jsCode);
  const result = validate({ first: () => ({ json: { body: input } }) })[0].json;
  assert.deepEqual(result.catalog.services.map(service => service.id), ['active']);
  assert.equal(result.catalog.page, 1);
  assert.equal(result.catalog.pageSize, 20);
  assert.equal(result.catalog.nextPage, 2);
  assert.equal(result.catalog.truncatedTours, false);
  assert.equal(result.catalog.truncatedServices, true);
});

test('Validate Input preserves bounded active itinerary candidates and their completeness status', () => {
  const validate = new Function('$input', byName('Validate Input1').parameters.jsCode);
  const result = validate({ first: () => ({ json: { body: {
    message: 'Lập lịch trình Đà Lạt', requestIntent: 'itinerary', sessionId: 'n8n-v4-test-session', history: [],
    context: { catalog: {
      available: true, page: 1, pageSize: 20, nextPage: 2,
      serviceCandidatesComplete: false,
      serviceCandidates: [
        { id: 'candidate-page-two', name: 'Dalat Walk', type: 'attraction', destination: 'Đà Lạt', cost: 100000, carbon: 0.2, status: 'active' },
        { id: 'candidate-inactive', name: 'Hidden Stay', type: 'stay', destination: 'Đà Lạt', cost: 50000, carbon: 0.4, status: 'inactive' },
        { name: 'Missing ID', type: 'food', destination: 'Đà Lạt', cost: 50000, status: 'active' }
      ]
    } }
  } } }) })[0].json;

  assert.equal(result.catalog.serviceCandidatesComplete, false);
  assert.deepEqual(result.catalog.serviceCandidates.map(service => service.id), ['candidate-page-two']);
  assert.equal(result.catalog.serviceCandidates[0].status, 'active');
});

test('workflow search tools distinguish a page miss from a complete-catalog miss', () => {
  const validator = new Function('$input', byName('Validate Input1').parameters.jsCode);
  const validated = validator({ first: () => ({ json: { body: {
    message: 'Tìm cafe Đà Lạt', sessionId: 'n8n-v4-test-session', history: [],
    context: { catalog: {
      available: true, fetchedAt: '2026-11-10T00:00:00.000Z', page: 1, pageSize: 20, nextPage: 2,
      truncated: true, truncatedTours: false, truncatedServices: true, tours: [],
      services: [
        { id: 'cafe-1', name: 'Pine Cafe', type: 'food', destination: 'Đà Lạt', cost: 80000, status: 'active' },
        { id: 'cafe-2', name: 'Hill Cafe', type: 'food', destination: 'Đà Lạt', cost: 120000, status: 'active' }
      ]
    } }
  } } }) })[0].json;
  const select = name => ({ first: () => ({ json: validated }) });
  const search = new Function('$', 'query', byName('search_services1').parameters.jsCode);
  const result = JSON.parse(search(select, { destination: 'Đà Lạt', type: 'ăn uống', maxBudget: 100000 }));
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.matches.map(service => service.id), ['cafe-1']);
  assert.equal(result.searchComplete, false);
  assert.equal(result.nextPage, 2);

  const noMatch = JSON.parse(search(select, { search: 'not in this page' }));
  assert.equal(noMatch.status, 'partial_no_match');
  assert.equal(noMatch.noMatchStatus, 'not_found_in_current_page');
});

test('itinerary service tool searches backend candidates including later-page matches', () => {
  const validate = new Function('$input', byName('Validate Input1').parameters.jsCode);
  const validated = validate({ first: () => ({ json: { body: {
    message: 'Lập lịch trình Đà Lạt', requestIntent: 'itinerary', sessionId: 'n8n-v4-test-session', history: [],
    context: { catalog: {
      available: true, page: 1, pageSize: 20, nextPage: 2, truncatedServices: true,
      services: [], serviceCandidatesComplete: false,
      serviceCandidates: [
        { id: 'page-two-match', name: 'Dalat Forest Walk', type: 'attraction', destination: 'Đà Lạt', cost: 80000, status: 'active' },
        { id: 'wrong-destination', name: 'Hue Walk', type: 'attraction', destination: 'Huế', cost: 50000, status: 'active' }
      ]
    } }
  } } }) })[0].json;
  const search = new Function('$', 'query', byName('search_services1').parameters.jsCode);
  const result = JSON.parse(search(() => ({ first: () => ({ json: validated }) }), {
    destination: 'Đà Lạt', type: 'attraction', maxBudget: 100000
  }));

  assert.equal(result.status, 'partial');
  assert.deepEqual(result.matches.map(service => service.id), ['page-two-match']);
  assert.equal(result.searchComplete, false);
  assert.equal(result.noMatchStatus, null);
});

test('V4 itinerary prompt requires structured service IDs and separates unverified suggestions', () => {
  const agent = byName('AI Agent1');
  assert.match(agent.parameters.text, /serviceCandidates/);
  assert.match(agent.parameters.options.systemMessage, /exact.*ID|exact string ID/i);
  assert.match(agent.parameters.options.systemMessage, /serviceId/);
  assert.match(agent.parameters.options.systemMessage, /omit.*serviceId|null.*serviceId/i);
  assert.match(agent.parameters.options.systemMessage, /unverified/);
});

test('tour tool filters days and budget within the loaded page and reports further pages', () => {
  const validate = new Function('$input', byName('Validate Input1').parameters.jsCode);
  const validated = validate({ first: () => ({ json: { body: {
    message: 'Tìm tour Huế', sessionId: 'n8n-v4-test-session', history: [],
    context: { catalog: {
      available: true, page: 1, pageSize: 20, nextPage: 2, truncated: true, truncatedTours: true, truncatedServices: false,
      tours: [
        { id: 'tour-1', title: 'Hue Walk', destination: 'Huế', days: 3, cost: 900000 },
        { id: 'tour-2', title: 'Hue Long', destination: 'Huế', days: 4, cost: 1200000 }
      ], services: []
    } }
  } } }) })[0].json;
  const search = new Function('$', 'query', byName('search_tours1').parameters.jsCode);
  const result = JSON.parse(search(() => ({ first: () => ({ json: validated }) }), { search: 'Huế', days: 3, maxBudget: 1000000 }));
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.matches.map(tour => tour.id), ['tour-1']);
  assert.equal(result.nextPage, 2);
  assert.equal(result.searchComplete, false);
});
