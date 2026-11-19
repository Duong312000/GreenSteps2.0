const { Op } = require('../db/mongo-store');

const tourCatalogCache = { data: null, expiresAt: 0, refreshing: false };
const TOUR_CATALOG_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL with SWR

async function loadAllToursForSearch({ Schedule, ScheduleSample, ScheduleActivity, BadgeSchedule, formatTourResponse }) {
  const [samples, editorialSchedules] = await Promise.all([
    ScheduleSample.findAll({
      readPreference: 'primaryPreferred',
      include: [
        {
          model: Schedule,
          include: [{
            model: ScheduleActivity,
            order: [['day_number', 'ASC'], ['time', 'ASC']]
          }]
        }
      ]
    }),
    Schedule.findAll({
      where: { catalog_status: { [Op.in]: ['demo', 'editorial'] } },
      readPreference: 'primaryPreferred',
      include: [{ model: ScheduleActivity }]
    }).catch(() => [])
  ]);

  const sampleIds = samples.map(s => s.id);
  const allBadges = sampleIds.length > 0
    ? await BadgeSchedule.findAll({ where: { schedule_id: { [Op.in]: sampleIds } } })
    : [];
  const badgeMap = {};
  allBadges.forEach(bs => {
    if (!badgeMap[bs.schedule_id]) badgeMap[bs.schedule_id] = [];
    badgeMap[bs.schedule_id].push(bs.badge_name);
  });

  const tours = samples
    .filter(s => s.Schedule)
    .map(s => formatTourResponse(
      s,
      s.Schedule,
      badgeMap[s.id] || [],
      s.Schedule.ScheduleActivities
    ));

  if (editorialSchedules && editorialSchedules.length > 0) {
    const existingIds = new Set(tours.map(t => t.id));
    for (const ed of editorialSchedules) {
      if (!existingIds.has(ed.id)) {
        tours.push({
          ...formatTourResponse({ id: ed.id }, ed, [], ed.ScheduleActivities || []),
          catalog_status: ed.catalog_status,
          is_demo: true,
          bookingEnabled: false,
          priceStatus: 'on_request'
        });
      }
    }
  }

  return tours;
}

async function searchTours({ models, query = {} }) {
  const { Schedule, ScheduleSample, ScheduleActivity, BadgeSchedule } = models;
  const { formatTourResponse } = require('../controllers/tour.controller');

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize || query.limit, 10) || 12));
  const keyword = (query.q || query.keyword || query.search || '').trim().toLowerCase();
  const dest = (query.dest || query.destination || '').trim();
  const style = (query.style || '').trim();
  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;

  const now = Date.now();
  let baseTours;
  if (tourCatalogCache.data) {
    baseTours = tourCatalogCache.data;
    if (now > tourCatalogCache.expiresAt && !tourCatalogCache.refreshing) {
      tourCatalogCache.refreshing = true;
      loadAllToursForSearch({ Schedule, ScheduleSample, ScheduleActivity, BadgeSchedule, formatTourResponse })
        .then(fresh => {
          tourCatalogCache.data = fresh;
          tourCatalogCache.expiresAt = Date.now() + TOUR_CATALOG_TTL_MS;
        })
        .catch(() => {})
        .finally(() => { tourCatalogCache.refreshing = false; });
    }
  } else {
    baseTours = await loadAllToursForSearch({ Schedule, ScheduleSample, ScheduleActivity, BadgeSchedule, formatTourResponse });
    tourCatalogCache.data = baseTours;
    tourCatalogCache.expiresAt = now + TOUR_CATALOG_TTL_MS;
  }

  let tours = baseTours.slice();

  // 3. In-memory matching for rich metadata
  if (keyword) {
    tours = tours.filter(t =>
      (t.title && t.title.toLowerCase().includes(keyword)) ||
      (t.destination && t.destination.toLowerCase().includes(keyword)) ||
      (t.description && t.description.toLowerCase().includes(keyword)) ||
      (t.highlights && t.highlights.some(h => String(h).toLowerCase().includes(keyword))) ||
      ((t.data || []).some(day => (day || []).some(act => (act.name || '').toLowerCase().includes(keyword))))
    );
  }

  if (dest && dest !== 'all' && dest !== 'Tất cả') {
    const dNorm = dest.replace(/\u2013|\u2014/g, '-').trim().toLowerCase();
    tours = tours.filter(t => {
      const td = (t.destination || '').replace(/\u2013|\u2014/g, '-').trim().toLowerCase();
      return td.includes(dNorm) || dNorm.includes(td);
    });
  }

  if (style && style !== 'all') {
    const sNorm = style.trim().toLowerCase();
    tours = tours.filter(t => {
      if (String(t.type || '').toLowerCase().includes(sNorm)) return true;
      if (String(t.style || '').toLowerCase().includes(sNorm)) return true;
      if (Array.isArray(t.tags) && t.tags.some(tag => String(tag).toLowerCase().includes(sNorm))) return true;
      return false;
    });
  }

  if (minPrice != null) {
    tours = tours.filter(t => t.cost != null && t.cost >= minPrice);
  }
  if (maxPrice != null) {
    tours = tours.filter(t => t.cost != null && t.cost <= maxPrice);
  }

  // 4. Sort
  const sort = query.sort || 'popular';
  if (sort === 'price_asc' || sort === 'cost_asc') {
    tours.sort((a, b) => (a.cost || 0) - (b.cost || 0));
  } else if (sort === 'price_desc' || sort === 'cost_desc') {
    tours.sort((a, b) => (b.cost || 0) - (a.cost || 0));
  } else if (sort === 'rating') {
    tours.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'name') {
    tours.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }

  const total = tours.length;
  const offset = (page - 1) * pageSize;
  const paginated = tours.slice(offset, offset + pageSize);

  return {
    items: paginated,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

module.exports = {
  searchTours
};

// Warm up tour search catalog cache on server startup
setTimeout(() => {
  try {
    const models = require('../models/index');
    searchTours({ models, query: { page: 1, pageSize: 6 } }).catch(() => {});
  } catch {}
}, 400);
