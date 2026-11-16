const crypto = require('node:crypto');
const { ServiceCategory, GreenService } = require('../models');

const TYPE_DEFAULTS = Object.freeze({
  food: 'Ăn uống',
  dining: 'Ăn uống',
  stay: 'Lưu trú',
  lodging: 'Lưu trú',
  transport: 'Di chuyển',
  attraction: 'Khám phá',
  tour: 'Tour'
});
const DEFAULT_CATEGORIES = [TYPE_DEFAULTS.food, TYPE_DEFAULTS.stay, TYPE_DEFAULTS.attraction];

function categoryNameForService(service) {
  const legacyName = String(service.current_data?.category || '').trim();
  if (legacyName) return legacyName;
  return TYPE_DEFAULTS[String(service.type || '').toLowerCase()] || 'Khám phá';
}

function categoryIdForName(name) {
  const slug = String(name).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'legacy';
  const digest = crypto.createHash('sha256').update(name).digest('hex').slice(0, 12);
  return `cat_${slug}-${digest}`;
}

function createServiceCategoryService({ ServiceCategory: categoryModel = ServiceCategory, GreenService: serviceModel = GreenService } = {}) {
  async function ensureServiceCategories() {
    const [categories, services] = await Promise.all([
      categoryModel.findAll(),
      serviceModel.findAll({
        where: { category_id: null },
        // Record.update validates the full model, so keep every required
        // GreenService field in the projection used by this migration.
        attributes: ['id', 'name_service', 'type', 'cost', 'destination', 'status', 'current_data', 'category_id', '_rev']
      })
    ]);
    const byName = new Map(categories.map(category => [String(category.name || '').trim(), category]));
    const ordered = [...categories].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    let nextSortOrder = ordered.length ? Number(ordered[ordered.length - 1].sort_order || 0) + 1 : 0;

    for (const name of DEFAULT_CATEGORIES) {
      if (byName.has(name)) continue;
      const category = await categoryModel.create({ id: categoryIdForName(name), name, active: true, sort_order: nextSortOrder++, icon: null });
      byName.set(name, category);
      categories.push(category);
    }

    const updates = [];
    for (const service of services) {
      if (service.category_id) continue;
      const name = categoryNameForService(service);
      let category = byName.get(name);
      if (!category) {
        category = await categoryModel.create({
          id: categoryIdForName(name),
          name,
          active: true,
          sort_order: nextSortOrder++,
          icon: null
        });
        byName.set(name, category);
        categories.push(category);
      }
      if (typeof service.update === 'function') updates.push(service.update({ category_id: category.id }));
      else updates.push(serviceModel.update({ category_id: category.id }, { where: { id: service.id } }));
    }
    await Promise.all(updates);

    return categories.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || '').localeCompare(String(b.name || '')));
  }

  async function countServicesByCategory(categoryRows) {
    const categories = categoryRows || await categoryModel.findAll();
    const idByName = new Map(categories.map(category => [String(category.name || '').trim(), category.id]));
    if (typeof serviceModel.collection?.aggregate === 'function') {
      await serviceModel.store?.authenticate?.();
      const rows = await serviceModel.collection.aggregate([
        { $project: {
          id: 1,
          category_id: 1,
          legacy_name: { $trim: { input: { $ifNull: ['$current_data.category', ''] } } }
        } },
        { $group: {
          _id: { $cond: [
            { $and: [{ $ne: ['$category_id', null] }, { $ne: ['$category_id', ''] }] },
            '$category_id',
            '$legacy_name'
          ] },
          serviceIds: { $addToSet: '$id' }
        } },
        { $project: { serviceCount: { $size: '$serviceIds' } } }
      ]).toArray();
      const counts = Object.fromEntries(categories.map(category => [category.id, 0]));
      for (const row of rows) {
        const categoryId = counts[row._id] !== undefined ? row._id : idByName.get(String(row._id || '').trim());
        if (categoryId && counts[categoryId] !== undefined) counts[categoryId] += Number(row.serviceCount || 0);
      }
      return counts;
    }

    const services = await serviceModel.findAll({ attributes: ['id', 'category_id', 'current_data'] });
    const serviceIdsByCategory = new Map();

    for (const service of services) {
      const categoryId = service.category_id || idByName.get(String(service.current_data?.category || '').trim());
      if (!categoryId || !service.id) continue;
      if (!serviceIdsByCategory.has(categoryId)) serviceIdsByCategory.set(categoryId, new Set());
      serviceIdsByCategory.get(categoryId).add(String(service.id));
    }

    return Object.fromEntries(categories.map(category => [category.id, serviceIdsByCategory.get(category.id)?.size || 0]));
  }

  return { ensureServiceCategories, countServicesByCategory };
}

const defaultService = createServiceCategoryService();
module.exports = {
  categoryIdForName,
  categoryNameForService,
  createServiceCategoryService,
  ensureServiceCategories: defaultService.ensureServiceCategories,
  countServicesByCategory: defaultService.countServicesByCategory
};
