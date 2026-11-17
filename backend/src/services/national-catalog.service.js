const normalizeSearch = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd').toLocaleLowerCase('vi')
  .replace(/[^a-z0-9]+/g, ' ').trim();

const integer = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

async function listCatalog({ model, query = {}, allowedStatuses = ['published', 'editorial'], filterItem = () => true }) {
  const page = integer(query.page, 1, 1, 100000);
  const pageSize = integer(query.pageSize ?? query.limit, 12, 1, 100);
  const sortField = ['name', 'code', 'slug', 'createdAt'].includes(query.sort) ? query.sort : 'name';
  const direction = query.order === 'desc' ? -1 : 1;
  const rows = await model.findAll({ where: { status: allowedStatuses }, readPreference: 'primaryPreferred' });
  const needle = normalizeSearch(query.q ?? query.search);
  const matched = rows.filter(row => {
    if (!allowedStatuses.includes(row.status) || !filterItem(row, query)) return false;
    if (!needle) return true;
    return [row.name, row.slug, row.code, ...(row.aliases || [])]
      .some(value => normalizeSearch(value).includes(needle));
  });
  matched.sort((a, b) => {
    const left = String(a[sortField] ?? '').toLocaleLowerCase('vi');
    const right = String(b[sortField] ?? '').toLocaleLowerCase('vi');
    return left.localeCompare(right, 'vi') * direction || String(a.id).localeCompare(String(b.id));
  });
  const offset = (page - 1) * pageSize;
  return { items: matched.slice(offset, offset + pageSize), total: matched.length, page, pageSize, totalPages: Math.ceil(matched.length / pageSize) };
}

async function getPublishedBySlug(model, slug, allowedStatuses = ['published', 'editorial']) {
  const row = await model.findOne({ where: { slug }, readPreference: 'primaryPreferred' });
  return row && allowedStatuses.includes(row.status) ? row : null;
}

module.exports = { normalizeSearch, listCatalog, getPublishedBySlug };
