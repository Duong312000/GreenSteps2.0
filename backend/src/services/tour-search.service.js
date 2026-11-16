const { Op } = require('../db/mongo-store');

async function searchTours({ models, query = {} }) {
  const { Schedule, ScheduleSample, ScheduleActivity, BadgeSchedule, Destination } = models;
  const { formatTourResponse } = require('../controllers/tour.controller');

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize || query.limit, 10) || 12));
  const keyword = (query.q || query.keyword || query.search || '').trim().toLowerCase();
  const dest = (query.dest || '').trim();
  const style = (query.style || '').trim();
  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;

  // 1. Fetch active samples with their schedules and activities
  const samples = await ScheduleSample.findAll({
    include: [
      {
        model: Schedule,
        include: [{
          model: ScheduleActivity,
          order: [['day_number', 'ASC'], ['time', 'ASC']]
        }]
      }
    ]
  });

  const sampleIds = samples.map(s => s.id);
  const allBadges = sampleIds.length > 0
    ? await BadgeSchedule.findAll({ where: { schedule_id: { [Op.in]: sampleIds } } })
    : [];
  const badgeMap = {};
  allBadges.forEach(bs => {
    if (!badgeMap[bs.schedule_id]) badgeMap[bs.schedule_id] = [];
    badgeMap[bs.schedule_id].push(bs.badge_name);
  });

  let tours = samples
    .filter(s => s.Schedule)
    .map(s => formatTourResponse(
      s,
      s.Schedule,
      badgeMap[s.id] || [],
      s.Schedule.ScheduleActivities
    ));

  // 2. Also include editorial / demo schedules if present
  try {
    const editorialSchedules = await Schedule.findAll({
      where: { catalog_status: { [Op.in]: ['demo', 'editorial'] } },
      include: [{ model: ScheduleActivity }]
    });
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
  } catch (e) {
    // Ignore non-fatal editorial lookup
  }

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
    const dNorm = dest.toLowerCase();
    tours = tours.filter(t => {
      const td = (t.destination || '').toLowerCase();
      return td.includes(dNorm) || dNorm.includes(td);
    });
  }

  if (style && style !== 'all') {
    tours = tours.filter(t => {
      if (t.type === style) return true;
      if (Array.isArray(t.tags) && t.tags.includes(style)) return true;
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
