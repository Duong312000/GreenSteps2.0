const assert = require('node:assert/strict');
const test = require('node:test');
const { demoTours } = require('../src/data/demo-tours.seed');
const { legacyActivityNames, legacyDescription, legacyEditorialNote } = require('../src/data/demo-tours-legacy.seed');
const { demoTourEditorial } = require('../src/data/demo-tour-editorial');
const photoManifest = require('../../docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json');
const { enrichDemoTours } = require('../src/services/demo-tour-enrichment-migration.service');

const legacySharedResponsibleTravel = 'Đi theo lối được phép, xin phép trước khi chụp chân dung, tôn trọng không gian thờ tự và phong tục của từng cộng đồng. Mang theo chai nước có thể nạp lại, đem rác ra khỏi điểm tham quan và ưu tiên hướng dẫn viên địa phương khi tổ chức chuyến đi thực tế.';

function setVersionTwoBaseline(fixture) {
  for (const tour of demoTours) {
    const slug = tour.id.replace(/^demo-vn-tour-/, '');
    const editorial = demoTourEditorial[slug];
    const photos = photoManifest.filter(photo => photo.tourSlugs.includes(slug)).map(photo => ({
      path: photo.assetPath, caption: photo.caption, alt: photo.alt, sourcePage: photo.sourcePage,
      author: photo.author, licenseId: photo.licenseId, licenseUrl: photo.licenseUrl,
      attribution: photo.attribution, subjectLocation: photo.subjectLocation,
      verificationStatus: photo.verificationStatus, verifiedOn: photo.verifiedOn,
      modifications: photo.modifications, responsiveVariants: photo.responsiveVariants,
      width: photo.width, height: photo.height
    }));
    fixture.schedules.set(tour.id, {
      id: tour.id, tour_name: tour.tour_name, destination: tour.destination,
      destination_ids: tour.destination_ids, days: 3,
      tour_description: editorial.description, highlights: editorial.highlights,
      responsible_travel: legacySharedResponsibleTravel, practical_notes: editorial.practical_notes,
      editorial_itinerary_notice: 'Lịch trình biên tập gợi ý; chưa phải dịch vụ hay lịch khởi hành đã xác nhận.',
      image_url: photos[0].path, gallery: photos.map(photo => photo.path), photo_metadata: photos,
      carbon: null, catalog_status: 'demo', catalog_source: { kind: 'editorial/demo', seedVersion: 2 },
      style: 'Trải nghiệm địa phương'
    });
    for (const activity of tour.itinerary) fixture.activities.set(activity.id, {
      id: activity.id, schedule_id: tour.id, day_number: activity.day_number, time: activity.time,
      activity_name: activity.activity_name, activity_cost: null, carbon: null,
      coordinates: null, editorial_note: activity.editorial_note
    });
  }
}

function makeModels() {
  const schedules = new Map();
  const activities = new Map();
  const audits = new Map();
  for (const tour of demoTours) {
    const tourSlug = tour.id.replace('demo-vn-tour-', '');
    const index = Number(tourSlug.slice(-1)) - 1;
    const destinationSlug = tourSlug.replace(/-\d$/, '');
    const names = legacyActivityNames[destinationSlug][index];
    schedules.set(tour.id, {
      id: tour.id, tour_name: tour.tour_name, destination: tour.destination,
      destination_ids: tour.destination_ids, days: 3, tour_description: legacyDescription,
      catalog_status: 'demo', catalog_source: { kind: 'editorial/demo', seedVersion: 1 },
      style: 'Trải nghiệm địa phương', carbon: 0, image_url: null, gallery: null,
      photo_metadata: [], highlights: [], responsible_travel: null, practical_notes: null,
      editorial_itinerary_notice: null
    });
    names.forEach((name, activityIndex) => {
      const id = `${tour.id}-activity-${activityIndex + 1}`;
      activities.set(id, { id, schedule_id: tour.id, day_number: activityIndex + 1, time: 'Buổi sáng / chiều',
        activity_name: name, activity_cost: null, carbon: null, coordinates: null, editorial_note: legacyEditorialNote });
    });
  }
  const model = rows => ({
    async findByPk(id) { return rows.get(id) || null; },
    async findAll() { return [...rows.values()]; },
    async update(patch, { where, transaction } = {}) {
      const ids = where?.id?.in || (where?.id ? [where.id] : []);
      for (const id of ids) if (rows.has(id)) Object.assign(rows.get(id), structuredClone(patch));
      return [ids.length];
    },
    async create(row) { rows.set(row.id, structuredClone(row)); return row; }
  });
  return {
    models: { Schedule: model(schedules), ScheduleActivity: model(activities), AdminConfigAuditLog: model(audits) },
    schedules, activities, audits,
    store: { async transaction(callback) { return callback({ id: 'test-transaction' }); } }
  };
}

test('dry-run returns exact allowlisted schedule/activity diffs without writing', async () => {
  const fixture = makeModels();
  const result = await enrichDemoTours({ ...fixture, tours: demoTours });
  assert.equal(result.dryRun, true);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.schedules.updated, 12);
  assert.equal(result.activities.updated, 36);
  assert.equal(result.diff.length, 48);
  assert.equal(fixture.schedules.get(demoTours[0].id).catalog_source.seedVersion, 1);
  assert.equal(fixture.audits.size, 0);
});

test('v3 dry-run accepts only the exact v2 enriched baseline and does not write', async () => {
  const fixture = makeModels();
  setVersionTwoBaseline(fixture);
  const result = await enrichDemoTours({ ...fixture, tours: demoTours });
  assert.equal(result.dryRun, true);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.schedules.updated, 12);
  assert.equal(result.activities.updated, 0);
  assert.equal(result.activities.unchanged, 36);
  assert.equal(result.diff.length, 12);
  assert.equal(fixture.schedules.get(demoTours[0].id).catalog_source.seedVersion, 2);
  assert.equal(fixture.audits.size, 0);
});

test('v3 preflight stops when any v2 schedule value changed after the reviewed seed', async () => {
  const fixture = makeModels();
  setVersionTwoBaseline(fixture);
  fixture.schedules.get(demoTours[0].id).tour_description = 'Manual edit';
  const result = await enrichDemoTours({ ...fixture, tours: demoTours });
  assert.equal(result.conflicts.some(conflict => conflict.id === demoTours[0].id && conflict.entity === 'schedule'), true);
  assert.equal(fixture.schedules.get(demoTours[1].id).catalog_source.seedVersion, 2);
  assert.equal(fixture.audits.size, 0);
});

test('apply updates only the twelve demo schedules and their activities, audits changes, and is idempotent', async () => {
  const fixture = makeModels();
  const first = await enrichDemoTours({ ...fixture, tours: demoTours, apply: true });
  assert.equal(first.applied, true);
  assert.equal(first.schedules.updated, 12);
  assert.equal(first.activities.updated, 36);
  assert.equal(fixture.audits.size, 48);
  assert.equal(fixture.schedules.get(demoTours[0].id).catalog_status, 'demo');
  assert.equal(fixture.schedules.get(demoTours[0].id).carbon, null);
  assert.equal(fixture.schedules.get(demoTours[0].id).image_url, demoTours[0].image_url);
  assert.equal(fixture.schedules.get(demoTours[0].id).style_explanation, demoTours[0].style_explanation);
  assert.equal(fixture.schedules.get(demoTours[0].id).fitness_is_estimate, true);
  assert.equal(fixture.schedules.get(demoTours[0].id).group_size, null);
  assert.equal(fixture.schedules.get(demoTours[0].id).catalog_source.seedVersion, 3);
  const second = await enrichDemoTours({ ...fixture, tours: demoTours, apply: true });
  assert.equal(second.conflicts.length, 0);
  assert.equal(second.schedules.unchanged, 12);
  assert.equal(second.activities.unchanged, 36);
  assert.equal(fixture.audits.size, 48);
});

test('manual edits and allowlist drift stop the migration before any write', async () => {
  const fixture = makeModels();
  fixture.schedules.get(demoTours[0].id).tour_description = 'A manually edited tour';
  const conflict = await enrichDemoTours({ ...fixture, tours: demoTours, apply: true });
  assert.equal(conflict.conflicts.some(item => item.id === demoTours[0].id), true);
  assert.equal(fixture.schedules.get(demoTours[1].id).catalog_source.seedVersion, 1);
  assert.equal(fixture.audits.size, 0);
  await assert.rejects(() => enrichDemoTours({ ...makeModels(), tours: demoTours, allowlist: [demoTours[0].id] }), { code: 'DEMO_TOUR_ALLOWLIST_MISMATCH' });
});
