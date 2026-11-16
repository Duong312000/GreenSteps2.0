const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { Op } = require('../db/mongo-store');
const { legacyActivityNames, legacyDescription, legacyEditorialNote } = require('../data/demo-tours-legacy.seed');
const { demoTourEditorial } = require('../data/demo-tour-editorial');
const photoManifest = require('../../../docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json');
const legacySharedResponsibleTravel = 'Đi theo lối được phép, xin phép trước khi chụp chân dung, tôn trọng không gian thờ tự và phong tục của từng cộng đồng. Mang theo chai nước có thể nạp lại, đem rác ra khỏi điểm tham quan và ưu tiên hướng dẫn viên địa phương khi tổ chức chuyến đi thực tế.';

const DEMO_TOUR_ID_ALLOWLIST = [
  'demo-vn-tour-dalat-1', 'demo-vn-tour-dalat-2',
  'demo-vn-tour-phu-yen-1', 'demo-vn-tour-phu-yen-2',
  'demo-vn-tour-da-nang-hoi-an-1', 'demo-vn-tour-da-nang-hoi-an-2',
  'demo-vn-tour-sa-pa-1', 'demo-vn-tour-sa-pa-2',
  'demo-vn-tour-ninh-binh-1', 'demo-vn-tour-ninh-binh-2',
  'demo-vn-tour-phu-quoc-1', 'demo-vn-tour-phu-quoc-2'
];
const ABSENT = Symbol('absent');

function json(record) {
  return typeof record?.toJSON === 'function' ? record.toJSON() : record;
}

function assertExactAllowlist(tours, allowlist) {
  const ids = tours.map(tour => tour.id);
  if (!isDeepStrictEqual(ids, DEMO_TOUR_ID_ALLOWLIST)
      || !Array.isArray(allowlist)
      || !isDeepStrictEqual(allowlist, DEMO_TOUR_ID_ALLOWLIST)) {
    throw Object.assign(new Error('Demo tour enrichment must use the exact twelve-ID allowlist.'), { code: 'DEMO_TOUR_ALLOWLIST_MISMATCH' });
  }
}

function tourSlug(tour) {
  return tour.id.replace(/^demo-vn-tour-/, '');
}

function schedulePatch(tour) {
  return {
    tour_description: tour.tour_description,
    highlights: tour.highlights,
    style: tour.style,
    style_explanation: tour.style_explanation,
    group_size: tour.group_size,
    fitness_level: tour.fitness_level,
    fitness_is_estimate: tour.fitness_is_estimate,
    fitness_explanation: tour.fitness_explanation,
    responsible_travel: tour.responsible_travel,
    practical_notes: tour.practical_notes,
    editorial_itinerary_notice: tour.editorial_itinerary_notice,
    image_url: tour.image_url,
    gallery: tour.gallery,
    photo_metadata: tour.photo_metadata,
    carbon: null,
    catalog_status: 'demo',
    catalog_source: tour.catalog_source
  };
}

function activityPatch(activity) {
  return {
    activity_name: activity.activity_name,
    time: activity.time,
    editorial_note: activity.editorial_note,
    activity_cost: null,
    carbon: null,
    coordinates: null
  };
}

function fieldsMatch(current, expected) {
  return Object.entries(expected).every(([key, value]) => isDeepStrictEqual(current?.[key], value));
}

function isEmptySeedField(value) {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

function legacyScheduleMatches(current, tour) {
  const slug = tourSlug(tour);
  const destinationSlug = slug.replace(/-\d$/, '');
  const base = {
    id: tour.id,
    tour_name: tour.tour_name,
    destination: tour.destination,
    destination_ids: tour.destination_ids,
    days: 3,
    tour_description: legacyDescription,
    catalog_status: 'demo',
    catalog_source: { kind: 'editorial/demo', seedVersion: 1 },
    style: 'Trải nghiệm địa phương'
  };
  return fieldsMatch(current, base)
    && (current.carbon === undefined || current.carbon === null || current.carbon === 0)
    && ['image_url', 'gallery', 'photo_metadata', 'highlights', 'responsible_travel', 'practical_notes', 'editorial_itinerary_notice',
      'style_explanation', 'group_size', 'fitness_level', 'fitness_is_estimate', 'fitness_explanation']
      .every(key => isEmptySeedField(current[key]))
    && legacyActivityNames[destinationSlug] !== undefined;
}

function versionTwoScheduleMatches(current, tour) {
  const slug = tourSlug(tour);
  const editorial = demoTourEditorial[slug];
  const photos = photoManifest.filter(photo => photo.tourSlugs.includes(slug)).map(photo => ({
    path: photo.assetPath, caption: photo.caption, alt: photo.alt, sourcePage: photo.sourcePage,
    author: photo.author, licenseId: photo.licenseId, licenseUrl: photo.licenseUrl,
    attribution: photo.attribution, subjectLocation: photo.subjectLocation,
    verificationStatus: photo.verificationStatus, verifiedOn: photo.verifiedOn,
    modifications: photo.modifications, responsiveVariants: photo.responsiveVariants,
    width: photo.width, height: photo.height
  }));
  const baseline = {
    id: tour.id,
    tour_name: tour.tour_name,
    destination: tour.destination,
    destination_ids: tour.destination_ids,
    days: 3,
    tour_description: editorial.description,
    highlights: editorial.highlights,
    responsible_travel: legacySharedResponsibleTravel,
    practical_notes: editorial.practical_notes,
    editorial_itinerary_notice: 'Lịch trình biên tập gợi ý; chưa phải dịch vụ hay lịch khởi hành đã xác nhận.',
    image_url: photos[0]?.path,
    gallery: photos.map(photo => photo.path),
    photo_metadata: photos,
    carbon: null,
    catalog_status: 'demo',
    catalog_source: { kind: 'editorial/demo', seedVersion: 2 },
    style: 'Trải nghiệm địa phương',
    style_explanation: undefined,
    group_size: undefined,
    fitness_level: undefined,
    fitness_is_estimate: undefined,
    fitness_explanation: undefined
  };
  return Boolean(editorial) && fieldsMatch(current, baseline);
}

function legacyActivityMatches(current, expected, tourId) {
  const activityIndex = Number(expected.id.slice(-1)) - 1;
  const destinationSlug = tourSlug({ id: tourId }).replace(/-\d$/, '');
  const tourIndex = Number(tourId.slice(-1)) - 1;
  const oldName = legacyActivityNames[destinationSlug]?.[tourIndex]?.[activityIndex];
  return Boolean(oldName) && fieldsMatch(current, {
    id: expected.id,
    schedule_id: tourId,
    day_number: activityIndex + 1,
    time: 'Buổi sáng / chiều',
    activity_name: oldName,
    activity_cost: null,
    carbon: null,
    coordinates: null,
    editorial_note: legacyEditorialNote
  });
}

function versionTwoActivityMatches(current, expected, tourId) {
  return fieldsMatch(current, {
    id: expected.id,
    schedule_id: tourId,
    day_number: expected.day_number,
    ...activityPatch(expected)
  });
}

function selectedState(record, fields) {
  const source = json(record) || {};
  return Object.fromEntries(fields.map(key => [key, source[key] === undefined ? null : source[key]]));
}

function auditId(targetType, targetId) {
  return `demo_tour_enrich_${createHash('sha256').update(`${targetType}:${targetId}:3`).digest('hex').slice(0, 24)}`;
}

async function enrichDemoTours({ models, tours, store, apply = false, allowlist = DEMO_TOUR_ID_ALLOWLIST } = {}) {
  if (!models?.Schedule || !models?.ScheduleActivity) throw new TypeError('Schedule and ScheduleActivity models are required.');
  assertExactAllowlist(tours || [], allowlist);
  const scheduleChanges = [];
  const activityChanges = [];
  const conflicts = [];
  const activityRows = await models.ScheduleActivity.findAll({ where: { schedule_id: { [Op.in]: allowlist } } });
  const activityById = new Map((activityRows || []).map(row => [json(row).id, json(row)]));

  for (const tour of tours) {
    const current = json(await models.Schedule.findByPk(tour.id));
    if (!current) {
      conflicts.push({ id: tour.id, entity: 'schedule', reason: 'missing' });
      continue;
    }
    const patch = schedulePatch(tour);
    const desired = fieldsMatch(current, patch);
    const versionTwoBaseline = !desired && versionTwoScheduleMatches(current, tour);
    if (!desired && !legacyScheduleMatches(current, tour) && !versionTwoBaseline) {
      conflicts.push({ id: tour.id, entity: 'schedule', reason: 'changed_since_seed' });
    } else if (desired) {
      scheduleChanges.push({ id: tour.id, model: models.Schedule, patch, before: current, unchanged: true });
    } else {
      scheduleChanges.push({ id: tour.id, model: models.Schedule, patch, before: current, unchanged: false });
    }

    for (const [index, targetActivity] of tour.itinerary.entries()) {
      const existing = activityById.get(targetActivity.id);
      if (!existing) {
        conflicts.push({ id: targetActivity.id, tourId: tour.id, entity: 'activity', reason: 'missing' });
        continue;
      }
      const activityUpdate = activityPatch(targetActivity);
      const activityDesired = fieldsMatch(existing, activityUpdate);
      if (!activityDesired && !legacyActivityMatches(existing, targetActivity, tour.id)
          && !versionTwoActivityMatches(existing, targetActivity, tour.id)) {
        conflicts.push({ id: targetActivity.id, tourId: tour.id, entity: 'activity', reason: 'changed_since_seed' });
      } else {
        activityChanges.push({ id: targetActivity.id, tourId: tour.id, model: models.ScheduleActivity, patch: activityUpdate, before: existing, unchanged: activityDesired, index });
      }
    }
  }

  const expectedActivityCount = tours.length * 3;
  const targetActivities = activityRows.filter(row => allowlist.includes(json(row).schedule_id));
  if (targetActivities.length !== expectedActivityCount) conflicts.push({ entity: 'activity_set', reason: 'unexpected_activity_count' });

  const diff = [
    ...scheduleChanges.filter(item => !item.unchanged).map(item => ({ entity: 'schedule', id: item.id, before: selectedState(item.before, Object.keys(item.patch)), after: item.patch })),
    ...activityChanges.filter(item => !item.unchanged).map(item => ({ entity: 'activity', id: item.id, tourId: item.tourId, before: selectedState(item.before, Object.keys(item.patch)), after: item.patch }))
  ];
  const summary = {
    dryRun: !apply,
    applied: false,
    allowlist: [...allowlist],
    conflicts,
    diff,
    schedules: { updated: scheduleChanges.filter(item => !item.unchanged).length, unchanged: scheduleChanges.filter(item => item.unchanged).length },
    activities: { updated: activityChanges.filter(item => !item.unchanged).length, unchanged: activityChanges.filter(item => item.unchanged).length },
    protectedCollectionsTouched: []
  };
  if (conflicts.length || !apply) return summary;
  if (!store?.transaction || !models.AdminConfigAuditLog) throw new TypeError('Apply requires a transactional store and AdminConfigAuditLog model.');

  await store.transaction(async transaction => {
    for (const item of [...scheduleChanges, ...activityChanges]) {
      if (item.unchanged) continue;
      await item.model.update(item.patch, { where: { id: item.id }, transaction });
      const targetType = item.model === models.Schedule ? 'demo_tour_schedule' : 'demo_tour_activity';
      const audit = {
        id: auditId(targetType, item.id),
        actor_id: 'system:demo-tour-enrichment',
        action: 'demo_tour.enrich.update',
        target_type: targetType,
        target_id: item.id,
        reason: 'Versioned editorial enrichment of the allowlisted demo catalog; demo remains non-bookable.',
        previous_state: selectedState(item.before, Object.keys(item.patch)),
        new_state: item.patch,
        config_version: 2
      };
      const existingAudit = await models.AdminConfigAuditLog.findByPk(audit.id);
      if (existingAudit && !isDeepStrictEqual(json(existingAudit), audit)) {
        throw Object.assign(new Error('Demo tour enrichment audit ID conflicts with an existing record.'), { code: 'DEMO_TOUR_AUDIT_CONFLICT' });
      }
      if (!existingAudit) await models.AdminConfigAuditLog.create(audit, { transaction });
    }
  });
  summary.applied = true;
  return summary;
}

module.exports = { DEMO_TOUR_ID_ALLOWLIST, enrichDemoTours };
