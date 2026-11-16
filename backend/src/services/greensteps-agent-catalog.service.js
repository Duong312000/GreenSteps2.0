const { Op } = require('../db/mongo-store');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 40;
const MAX_PAGE = 10000;
const SERVICE_CANDIDATE_PAGE_SIZE = DEFAULT_PAGE_SIZE;
const SERVICE_CANDIDATE_MAX_PAGES = 2;
const MAX_SERVICE_CANDIDATES = SERVICE_CANDIDATE_PAGE_SIZE * SERVICE_CANDIDATE_MAX_PAGES;
const MAX_DESTINATION_LENGTH = 80;
const SERVICE_TYPES = new Set(['stay', 'food', 'transport', 'attraction', 'tour']);

const short = (value, max = 150) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeNumber = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1e9 ? number : null;
};
const normalizeText = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, c => c === 'đ' ? 'd' : 'D').toLowerCase();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const destinationRegex = value => {
  const groups = {
    a: 'aàáạảãâầấậẩẫăằắặẳẵ', e: 'eèéẹẻẽêềếệểễ', i: 'iìíịỉĩ',
    o: 'oòóọỏõôồốộổỗơờớợởỡ', u: 'uùúụủũưừứựửữ', y: 'yỳýỵỷỹ', d: 'dđ'
  };
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  return Array.from(normalized, character => {
    const variants = groups[character.toLowerCase()];
    if (!variants) return escapeRegex(character);
    return `[${variants}]`;
  }).join('');
};

function parseMoney(message) {
  const normalized = normalizeText(message);
  const match = normalized.match(/(?:\b(?:duoi|toi da|khong qua|ngan sach(?: toi da)?|budget)\s*)?(\d+(?:[.,]\d{1,2})?)\s*(trieu|tr|nghin|ngan|k|vnd|dong|d)\b/);
  if (!match) return null;
  const multiplier = { trieu: 1e6, tr: 1e6, nghin: 1000, ngan: 1000, k: 1000, vnd: 1, dong: 1, d: 1 }[match[2]];
  const amount = Number(match[1].replace(',', '.')) * multiplier;
  return Number.isFinite(amount) && amount > 0 && amount <= 1e9 ? amount : null;
}

function parseDestination(message, explicitDestination) {
  const explicit = short(explicitDestination, MAX_DESTINATION_LENGTH);
  if (explicit) return explicit;
  const value = String(message || '');
  if (/(?:muon|muốn)\s+(?:di|đi|den|đến|toi|tới)\s+.+?\s+(?:hay|hoac|hoặc|\/).+/iu.test(value)) return '';
  // Casual discovery wording commonly introduces the destination with
  // "muon di". Prefer a selected/requested destination over an origin phrase.
  const selected = [...value.matchAll(/(?:^|[,;]\s*|(?:toi|tôi|minh|mình)\s+)(?:chon|chọn)\s+([\p{L}][\p{L}\s.'’-]{1,58}?)(?=\s+(?:trong|voi|với|ngan sach|budget|nhung|nhưng|ma|mà|tu|tự|lap|lập|tao|tạo)|[,;!?]|$)/giu)].at(-1);
  const wanted = [...value.matchAll(/(?:muon|muốn)\s+(?<![\p{L}])(?:di|đi|den|đến|toi|tới)(?![\p{L}])\s+([\p{L}][\p{L}\s.'’-]{1,58}?)(?=\s+(?:trong|voi|với|ngan sach|budget|nhung|nhưng|ma|mà|tu|tự|lap|lập|tao|tạo)|[,;!?]|$)/giu)].at(-1);
  const direct = [...value.matchAll(/(?<![\p{L}])(?:di|đi|den|đến)(?![\p{L}])\s+([\p{L}][\p{L}\s.'’-]{1,58}?)(?=\s+(?:trong|voi|với|ngan sach|budget|nhung|nhưng|ma|mà|tu|tự|lap|lập|tao|tạo)|[,;!?]|$)/giu)].at(-1);
  const chosenValue = selected?.[1]?.trim();
  const wantedValue = wanted?.[1]?.trim();
  const directValue = direct?.[1]?.trim();
  const normalizedMessage = normalizeText(value);
  const isRejected = candidate => candidate && new RegExp(`(?:khong muon di|khong chon|khong phai)\\s+${escapeRegex(normalizeText(candidate))}`, 'i').test(normalizedMessage);
  const cleanCandidate = candidate => short(String(candidate || '')
    .replace(/\s+(?:nÃ o|nao|khÃ´ng|khong|cÆ¡|co)$/iu, '')
    .replace(/\s+\d{1,2}\s*(?:ngÃ y|ngay|Ä‘Ãªm|dem)\b.*$/iu, '')
    .replace(/\s+(?:budget|ngÃ¢n sÃ¡ch|ngan sach)\b.*$/iu, '').trim(), MAX_DESTINATION_LENGTH);
  if (chosenValue && !isRejected(chosenValue)) return cleanCandidate(chosenValue);
  if (wantedValue && !isRejected(wantedValue)) return cleanCandidate(wantedValue);
  if (directValue && !isRejected(directValue)) return cleanCandidate(directValue);
  const location = value.match(/(?:^|\s)(?:tại|ở|đến)\s+([\p{L}\p{N}][\p{L}\p{N}\s.'’-]{1,58}?)(?=\s+\d{1,2}\s*(?:ngày|đêm)|[.,;!?]|$)/iu);
  if (location) return short(location[1], MAX_DESTINATION_LENGTH);
  const unaccentedLocation = value.match(/(?:^|\s)(?:tai|o|den)\s+([\p{L}\p{N}][\p{L}\p{N}\s.'-]{1,58}?)(?=\s+\d{1,2}\s*(?:ngay|dem)|[.,;!?]|$)/iu);
  if (unaccentedLocation) return short(unaccentedLocation[1], MAX_DESTINATION_LENGTH);
  const matches = [
    value.match(/\b(?:tại|ở|đến|destination\s*:)\s+([\p{L}\p{N}][\p{L}\p{N}\s.'’-]{1,78}?)(?=\s+(?:\d{1,2}\s*(?:ngày|đêm)|dưới|tối đa|không quá|ngân sách|budget|với)|[.,;!?]|$)/iu),
    value.match(/\b(?:tour|dịch vụ|homestay|khách sạn|lưu trú|quán|nhà hàng|cafe|cà phê)\s+([\p{L}][\p{L}\s.'’-]{1,58}?)(?=\s+(?:\d{1,2}\s*(?:ngày|đêm)|dưới|tối đa|không quá|ngân sách|budget)|[.,;!?]|$)/iu)
  ];
  return cleanCandidate(matches.find(Boolean)?.[1]);
}

function parseServiceType(message, explicitType) {
  const type = String(explicitType || '').trim().toLowerCase();
  if (SERVICE_TYPES.has(type)) return type;
  const value = normalizeText(message);
  if (/\b(?:homestay|khach san|luu tru|noi o|phong nghi|hotel|stay|lodging)\b/.test(value)) return 'stay';
  if (/\b(?:quan cafe|ca phe|cafe|an uong|nha hang|food|dining)\b/.test(value)) return 'food';
  if (/\b(?:di chuyen|van chuyen|xe buyt|xe may|transport)\b/.test(value)) return 'transport';
  if (/\b(?:tham quan|diem tham quan|attraction)\b/.test(value)) return 'attraction';
  return null;
}

function normalizeCatalogQuery(query = {}) {
  const pageValue = Number(query.page);
  const pageSizeValue = Number(query.pageSize);
  const duration = Number(query.durationDays);
  const type = String(query.serviceType || '').trim().toLowerCase();
  return {
    destination: short(query.destination, MAX_DESTINATION_LENGTH),
    maxBudget: safeNumber(query.maxBudget),
    ...(query.budgetScope === 'per_person' ? { budgetScope: 'per_person' } : {}),
    durationDays: Number.isInteger(duration) && duration > 0 && duration <= 14 ? duration : null,
    serviceType: SERVICE_TYPES.has(type) ? type : null,
    page: Number.isInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, MAX_PAGE) : 1,
    pageSize: Number.isInteger(pageSizeValue) && pageSizeValue > 0 ? Math.min(pageSizeValue, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE
  };
}

function requestedRevisedDestination(message) {
  const matches = [...String(message || '').matchAll(/(?:đổi sang|sửa thành|chuyển sang|thay bằng|(?:giờ|nay)\s+(?:lập|tạo))\s+([\p{L}][\p{L}\s.'-]{1,58}?)(?=\s+(?:trong|với|ngân sách|budget|dưới|tối đa|\d{1,2}\s*(?:ngày|đêm))|[,;!?]|$)/giu)];
  return matches.at(-1)?.[1]?.trim().replace(/\s+(?:cÆ¡|co)$/iu, '') || '';
}

function requestedItineraryDestination(message) {
  const matches = [...String(message || '').matchAll(/(?:lịch trình|kế hoạch|hành trình)\s+(?:(?:đi|tại|ở)\s+)?([\p{L}][\p{L}\s.'-]{1,58}?)(?=\s+(?:trong|với|ngân sách|budget|dưới|tối đa|không|\d{1,2}\s*(?:ngày|đêm))|[,;!?]|$)/giu)];
  const candidate = matches.at(-1)?.[1]?.trim().replace(/^(?:the\s+)?(?:card|tour|nut)\s+/i, '');
  if (!candidate || /^(?:cho|tui|minh|toi|giup|nhe|nha|vay|do|nua)\b/i.test(normalizeText(candidate))) return '';
  return candidate;
}

function queryFromRequest(input = {}) {
  const message = String(input.message || '');
  const normalized = normalizeText(message);
  const duration = normalized.match(/\b(\d{1,2})\s*ngay\b/);
  const correction = message.match(/(?:kh\u00f4ng|khong)\s*,\s*([\p{L}][\p{L}\s.'-]{1,58}?)(?:\s+(?:c\u01a1|co))?\s*$/iu)?.[1]?.trim();
  const positiveMessage = message.replace(/(?:,\s*|\s+)kh(?:\u00f4ng|ong)\s+(?:\u0111i|di|gh[e\u00e9]|\u0111[e\u00e9]n|den|tham quan)\s+.+$/iu, '')
    .replace(/(?:,\s*|\s+)khong\s+(?:di|ghe|den|tham quan)\s+.+$/iu, '');
  const leadingDestination = positiveMessage.match(/^\s*(?:(?:tui|tôi|toi|mình|minh)\s+)?(?:\u0111i|di)\s+([\p{L}][\p{L}\s.'-]{1,58}?)(?=\s+\d{1,2}\s*(?:ngày|ngay)|\s+(?:budget|ngân sách|ngan sach)|[,;!?]|$)/iu)?.[1]?.trim();
  const explicitDestination = typeof input.destination === 'string' ? input.destination : '';
  let parsedDestination = explicitDestination || requestedRevisedDestination(message) || correction || requestedItineraryDestination(positiveMessage) || parseDestination(positiveMessage) || leadingDestination;
  if (typeof parsedDestination === 'string') {
    let words = parsedDestination.trim().split(/\s+/);
    const durationIndex = words.findIndex((word, index) => /^\d{1,2}$/.test(word) && /^(?:ngày|ngay|đêm|dem)$/i.test(words[index + 1] || ''));
    if (durationIndex >= 0) words = words.slice(0, durationIndex);
    while (words.length && /^(?:nào|nao|không|khong|cơ|co)$/i.test(words.at(-1))) words.pop();
    parsedDestination = words.join(' ');
  }
  // Destination extraction from catalog questions can include the final
  // Vietnamese negative particle (for example, "Có tour Đà Nẵng không?").
  // Strip only a terminal question particle; preserve the canonical place text.
  const destinationWords = String(parsedDestination || '').trim().split(/\s+/);
  if (destinationWords.length > 1 && /^(?:khong|ko|khum)$/.test(normalizeText(destinationWords.at(-1)))) {
    parsedDestination = destinationWords.slice(0, -1).join(' ');
  }
  const destination = /^(?:roi|toi|minh|va|cac|giup|nha|nhe)\b/i.test(normalizeText(parsedDestination)) ? '' : parsedDestination;
  return normalizeCatalogQuery({
    destination,
    maxBudget: parseMoney(message),
    ...(/(?:\/|\b)\s*(?:nguoi|ng|person|pax)\b/i.test(normalized) ? { budgetScope: 'per_person' } : {}),
    durationDays: duration ? Number(duration[1]) : null,
    serviceType: parseServiceType(message, input.serviceType),
    page: input.catalogPage,
    pageSize: input.catalogPageSize
  });
}

function getModels(models) {
  return models || require('../models');
}

function pageInfo(rows, pageSize) {
  return { hasMore: rows.length > pageSize, rows: rows.slice(0, pageSize) };
}

async function searchTours(models, query, signal) {
  signal?.throwIfAborted();
  const { Schedule, ScheduleSample, ScheduleActivity } = models;
  if (!Schedule?.collection || !ScheduleSample?.collection || !ScheduleActivity) throw new Error('Tour catalog unavailable');
  const match = {};
  if (query.destination) match['schedule.destination'] = { $regex: destinationRegex(query.destination), $options: 'i' };
  if (query.durationDays) match['schedule.days'] = query.durationDays;
  if (query.maxBudget !== null) match.cost = { $lte: query.maxBudget };
  const offset = (query.page - 1) * query.pageSize;
  const joined = await ScheduleSample.collection.aggregate([
    { $lookup: { from: Schedule.collection.collectionName, localField: 'id', foreignField: 'id', as: 'schedule' } },
    { $unwind: '$schedule' },
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $sort: { rating: -1, votes_count: -1, cost: 1, id: 1 } },
    { $skip: offset },
    { $limit: query.pageSize + 1 },
    { $project: {
      id: 1, cost: 1, rating: 1, votes_count: 1,
      'schedule.id': 1, 'schedule.tour_name': 1, 'schedule.destination': 1, 'schedule.days': 1,
      'schedule.carbon': 1, 'schedule.image_url': 1, 'schedule.tour_description': 1,
      'schedule.highlights': 1, 'schedule.tags': 1
    } }
  ], { maxTimeMS: 2500 }).toArray();
  const page = pageInfo(joined, query.pageSize);
  const ids = page.rows.map(row => row.id).filter(Boolean);
  const activityRows = ids.length ? await ScheduleActivity.findAll({
    where: { schedule_id: { [Op.in]: ids } },
    order: [['day_number', 'ASC'], ['time', 'ASC']]
  }) : [];
  const activitiesBySchedule = new Map();
  for (const activity of activityRows) {
    const key = activity.schedule_id;
    const days = activitiesBySchedule.get(key) || [];
    const index = Math.max(0, Number(activity.day_number || 1) - 1);
    days[index] ||= [];
    days[index].push({ name: activity.activity_name, title: activity.activity_name });
    activitiesBySchedule.set(key, days);
  }
  return {
    rows: page.rows.map(row => {
      const schedule = row.schedule || {};
      return {
        id: short(row.id, 80), title: short(schedule.tour_name), destination: short(schedule.destination, 100),
        days: safeNumber(schedule.days), cost: safeNumber(row.cost), carbon: safeNumber(schedule.carbon),
        rating: safeNumber(row.rating), votes_count: safeNumber(row.votes_count),
        description: short(schedule.tour_description, 240), image: short(schedule.image_url, 500),
        highlights: Array.isArray(schedule.highlights) ? schedule.highlights.slice(0, 5).map(item => short(item, 80)) : [],
        data: activitiesBySchedule.get(row.id) || []
      };
    }).filter(row => row.id && row.title),
    hasMore: page.hasMore
  };
}

async function searchServices(models, query, signal) {
  signal?.throwIfAborted();
  const { GreenService } = models;
  if (!GreenService?.findAll) throw new Error('Service catalog unavailable');
  const where = { status: 'active', 'current_data.catalogHidden': { [Op.ne]: true } };
  if (query.destination) where.destination = { [Op.regex]: destinationRegex(query.destination) };
  if (query.serviceType) where.type = query.serviceType;
  if (query.maxBudget !== null) where.cost = { [Op.lte]: query.maxBudget };
  const rows = await GreenService.findAll({
    where, order: [['rating', 'DESC'], ['cost', 'ASC'], ['id', 'ASC']],
    offset: (query.page - 1) * query.pageSize, limit: query.pageSize + 1,
    attributes: ['id', 'name_service', 'type', 'destination', 'cost', 'carbon', 'rating', 'image_url', 'status', 'current_data']
  });
  const page = pageInfo(rows, query.pageSize);
  return {
    rows: page.rows.map(row => ({
      id: short(row.id, 80), name: short(row.name_service), type: short(row.type, 40),
      destination: short(row.destination, 100), cost: safeNumber(row.cost), carbon: safeNumber(row.carbon),
      rating: safeNumber(row.rating), image_url: short(row.image_url || row.current_data?.img, 500),
      status: 'active',
      ...(typeof row.current_data?.lat === 'number' ? { lat: row.current_data.lat } : {}),
      ...(typeof row.current_data?.lng === 'number' ? { lng: row.current_data.lng } : {})
    })).filter(row => row.id && row.name),
    hasMore: page.hasMore
  };
}

async function searchItineraryServiceCandidates(models, query, firstPage, signal) {
  const rows = [];
  let hasMore = false;
  let pagesSearched = 0;
  for (let page = 1; page <= SERVICE_CANDIDATE_MAX_PAGES; page++) {
    pagesSearched = page;
    const result = page === 1 && query.page === 1 && query.pageSize === SERVICE_CANDIDATE_PAGE_SIZE && firstPage
      ? firstPage
      : await searchServices(models, { ...query, page, pageSize: SERVICE_CANDIDATE_PAGE_SIZE }, signal);
    rows.push(...result.rows);
    hasMore = result.hasMore;
    if (!hasMore) break;
  }
  return {
    rows: rows.slice(0, MAX_SERVICE_CANDIDATES),
    complete: !hasMore,
    pagesSearched,
    nextPage: hasMore ? pagesSearched + 1 : null
  };
}

async function loadAgentCatalog({ query: rawQuery = {}, models: injectedModels, signal, includeServiceCandidates = false } = {}) {
  const query = normalizeCatalogQuery(rawQuery);
  try {
    signal?.throwIfAborted();
    const models = getModels(injectedModels);
    const [tours, services] = await Promise.all([
      searchTours(models, query, signal),
      searchServices(models, query, signal)
    ]);
    const serviceCandidates = includeServiceCandidates
      ? await searchItineraryServiceCandidates(models, query, services, signal)
      : null;
    signal?.throwIfAborted();
    return {
      available: true, fetchedAt: new Date().toISOString(), page: query.page, pageSize: query.pageSize,
      truncated: tours.hasMore || services.hasMore, truncatedTours: tours.hasMore, truncatedServices: services.hasMore,
      nextPage: tours.hasMore || services.hasMore ? query.page + 1 : null,
      query: { destination: query.destination || null, durationDays: query.durationDays, maxBudget: query.maxBudget, budgetScope: query.budgetScope || null, serviceType: query.serviceType },
      tours: tours.rows, services: services.rows,
      ...(serviceCandidates ? {
        serviceCandidates: serviceCandidates.rows,
        serviceCandidatesComplete: serviceCandidates.complete,
        serviceCandidatesPage: serviceCandidates.pagesSearched,
        serviceCandidatesNextPage: serviceCandidates.nextPage
      } : {})
    };
  } catch {
    return { available: false, fetchedAt: new Date().toISOString(), page: query.page, pageSize: query.pageSize, truncated: false, tours: [], services: [], reason: 'catalog_unavailable' };
  }
}

function createCatalogLoader(options = {}) {
  const cache = new Map();
  const inFlight = new Map();
  return async ({ query = {}, signal, includeServiceCandidates = false } = {}) => {
    signal?.throwIfAborted();
    const normalized = normalizeCatalogQuery(query);
    const includeCandidates = includeServiceCandidates === true;
    const key = JSON.stringify({ query: normalized, includeServiceCandidates: includeCandidates });
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expires > now) return cached.value;
    if (inFlight.has(key)) return inFlight.get(key);
    const pending = loadAgentCatalog({ ...options, query: normalized, signal, includeServiceCandidates: includeCandidates }).then(catalog => {
      if (catalog.available && !signal?.aborted) {
        const configured = Number((options.env || process.env).N8N_CATALOG_CACHE_MS ?? 5000);
        const ttl = Number.isFinite(configured) ? Math.max(0, Math.min(15000, configured)) : 5000;
        if (ttl) cache.set(key, { value: catalog, expires: Date.now() + ttl });
      }
      return catalog;
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  };
}

module.exports = { loadAgentCatalog, createCatalogLoader, normalizeCatalogQuery, queryFromRequest, parseDestination, parseServiceType, parseMoney, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
