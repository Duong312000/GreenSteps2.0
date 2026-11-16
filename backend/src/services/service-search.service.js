const { Op } = require('../db/mongo-store');
const { catalogMetadata } = require('../services/catalog-presentation.service');

const serviceSearchCache = { data: null, expiresAt: 0, refreshing: false };
const SERVICE_SEARCH_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL with SWR

async function loadAllServicesForSearch(GreenService) {
  const services = await GreenService.findAll({
    where: {},
    readPreference: 'secondaryPreferred'
  });

  return (services || []).filter(s => s.status !== 'deleted' && !s.current_data?.catalogHidden).map(s => ({
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
  }));
}

async function searchServices({ models, query = {} }) {
  const { GreenService } = models;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize || query.limit, 10) || 12));
  const keyword = (query.q || query.keyword || query.search || '').trim().toLowerCase();
  const dest = (query.dest || '').trim().toLowerCase();
  const type = (query.type || '').trim();
  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;

  const now = Date.now();
  let allFormatted;
  if (serviceSearchCache.data) {
    allFormatted = serviceSearchCache.data;
    if (now > serviceSearchCache.expiresAt && !serviceSearchCache.refreshing) {
      serviceSearchCache.refreshing = true;
      loadAllServicesForSearch(GreenService)
        .then(fresh => {
          serviceSearchCache.data = fresh;
          serviceSearchCache.expiresAt = Date.now() + SERVICE_SEARCH_TTL_MS;
        })
        .catch(() => {})
        .finally(() => { serviceSearchCache.refreshing = false; });
    }
  } else {
    allFormatted = await loadAllServicesForSearch(GreenService);
    serviceSearchCache.data = allFormatted;
    serviceSearchCache.expiresAt = now + SERVICE_SEARCH_TTL_MS;
  }

  let filtered = allFormatted.filter(s => {
    if (keyword && !String(s.name || '').toLowerCase().includes(keyword) && !String(s.destination || '').toLowerCase().includes(keyword)) return false;
    if (dest && dest !== 'all' && dest !== 'tất cả' && !String(s.destination || '').toLowerCase().includes(dest)) return false;
    if (type && type !== 'all' && s.type !== type) return false;
    if (minPrice != null && (s.cost == null || s.cost < minPrice)) return false;
    if (maxPrice != null && (s.cost == null || s.cost > maxPrice)) return false;
    return true;
  });

  const total = filtered.length;
  const offset = (page - 1) * pageSize;
  const formatted = filtered.slice(offset, offset + pageSize);

  return {
    items: formatted,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

function removeServiceFromSearchCache(serviceId) {
  if (Array.isArray(serviceSearchCache.data)) {
    serviceSearchCache.data = serviceSearchCache.data.filter(service => service.id !== serviceId);
  }
  serviceSearchCache.expiresAt = 0;
}

module.exports = {
  searchServices,
  removeServiceFromSearchCache
};

// Warm up service search catalog cache on server startup
setTimeout(() => {
  try {
    const models = require('../models/index');
    searchServices({ models, query: { page: 1, pageSize: 6 } }).catch(() => {});
  } catch {}
}, 600);
