const { Op } = require('../db/mongo-store');

async function searchServices({ models, query }) {
  const { GreenService, Destination } = models;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 12));
  const keyword = (query.keyword || query.q || query.search || '').trim();

  const whereClause = {};
  if (keyword) {
    whereClause.name_service = { [Op.like]: `%${keyword}%` };
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await GreenService.findAndCountAll({
    where: whereClause,
    limit,
    offset
  });

  return {
    services: rows || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

module.exports = {
  searchServices
};
