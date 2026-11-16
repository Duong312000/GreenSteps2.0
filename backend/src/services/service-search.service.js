const { Op } = require('../db/mongo-store');
const { catalogMetadata } = require('../services/catalog-presentation.service');

async function searchServices({ models, query = {} }) {
  const { GreenService } = models;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize || query.limit, 10) || 12));
  const keyword = (query.q || query.keyword || query.search || '').trim();
  const dest = (query.dest || '').trim();
  const type = (query.type || '').trim();
  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;

  const where = {};
  if (keyword) {
    where.name_service = { [Op.like]: `%${keyword}%` };
  }
  if (dest && dest !== 'all' && dest !== 'Tất cả') {
    where.destination = { [Op.like]: `%${dest}%` };
  }
  if (type && type !== 'all') {
    where.type = type;
  }
  if (minPrice != null && maxPrice != null) {
    where.cost = { [Op.between]: [minPrice, maxPrice] };
  } else if (minPrice != null) {
    where.cost = { [Op.gte]: minPrice };
  } else if (maxPrice != null) {
    where.cost = { [Op.lte]: maxPrice };
  }

  const offset = (page - 1) * pageSize;
  const [count, services] = await Promise.all([
    GreenService.count ? GreenService.count({ where }) : Promise.resolve(0),
    GreenService.findAll({
      where,
      limit: pageSize,
      offset,
      readPreference: 'secondaryPreferred'
    })
  ]);

  const formatted = (services || []).filter(s => !s.current_data?.catalogHidden).map(s => {
    return {
      id: s.id,
      provider_id: s.vender_id || 'UG26pro0001',
      name: s.name_service,
      type: s.type,
      destination: s.destination,
      cost: s.cost,
      carbon: s.carbon,
      icon: s.type === 'lodging' || s.type === 'stay' ? 'bi-house-door-fill' : (s.type === 'dining' || s.type === 'food' ? 'bi-cup-hot-fill' : 'bi-tree-fill'),
      status: s.status || 'active',
      views_count: s.views_count || 0,
      rating: s.rating,
      reviews_count: s.reviews_count,
      bookings_count: s.bookings_count,
      max_capacity: s.max_capacity || 10,
      badges: [],
      is_partner: s.is_partner !== false,
      source: s.source || (s.is_partner === false ? 'google_maps' : 'partner'),
      google_place_id: s.google_place_id || null,
      image_url: s.image_url || (s.current_data ? s.current_data.img : null),
      current_data: s.current_data || {},
      ...catalogMetadata(s)
    };
  });

  const total = typeof count === 'number' && count > 0 ? count : formatted.length;

  return {
    items: formatted,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

module.exports = {
  searchServices
};
