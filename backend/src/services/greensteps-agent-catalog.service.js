const { Op } = require('../db/mongo-store');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 40;
const MAX_PAGE = 10000;
const SERVICE_CANDIDATE_PAGE_SIZE = DEFAULT_PAGE_SIZE;
const SERVICE_CANDIDATE_MAX_PAGES = 2;
const MAX_SERVICE_CANDIDATES = SERVICE_CANDIDATE_PAGE_SIZE * SERVICE_CANDIDATE_MAX_PAGES;
const MAX_DESTINATION_LENGTH = 80;
const SERVICE_TYPES = new Set(['stay', 'food', 'transport', 'attraction', 'tour']);

const KNOWN_DESTINATION_RULES = [
  { dest: 'TP. Hồ Chí Minh', keywords: ['tp. ho chi minh', 'tp ho chi minh', 'tp.hcm', 'tphcm', 'tp hcm', 'ho chi minh', 'sai gon', 'saigon', 'can gio'] },
  { dest: 'Hà Nội', keywords: ['ha noi', 'hanoi', 'thu do', 'hoan kiem', 'tay ho', 'pho co ha noi'] },
  { dest: 'Hạ Long', keywords: ['ha long', 'halong', 'quang ninh', 'vinh ha long', 'bai chay', 'tuan chau', 'lan ha', 'cat ba'] },
  { dest: 'Sa Pa', keywords: ['sa pa', 'sapa', 'lao cai', 'fansipan'] },
  { dest: 'Ninh Bình', keywords: ['ninh binh', 'ninhbinh', 'trang an', 'tam coc', 'hang mua', 'hoa lu', 'bai dinh'] },
  { dest: 'Hà Giang', keywords: ['ha giang', 'hagiang', 'dong van', 'meo vac', 'ma pi leng', 'tu san', 'lung cu'] },
  { dest: 'Huế', keywords: ['hue', 'thua thien hue', 'song huong', 'thuy bieu', 'dai noi'] },
  { dest: 'Đà Nẵng – Hội An', keywords: ['da nang', 'danang', 'hoi an', 'hoian', 'quang nam', 'ba na', 'son tra', 'ngu hanh son'] },
  { dest: 'Đà Lạt', keywords: ['da lat', 'dalat', 'lam dong', 'cau dat', 'langbiang', 'tuyen lam'] },
  { dest: 'Phú Yên', keywords: ['phu yen', 'phuyen', 'tuy hoa', 'ganh da dia', 'dam o loan', 'mui dien', 'bai xep'] },
  { dest: 'Cần Thơ', keywords: ['can tho', 'cantho', 'cai rang', 'ninh kieu', 'song nuoc'] },
  { dest: 'Phú Quốc', keywords: ['phu quoc', 'phuquoc', 'kien giang', 'dao ngoc', 'an thoi', 'duong dong'] },
  // Regional queries
  { dest: 'Miền Bắc', isRegion: true, targets: ['Hà Nội', 'Hạ Long', 'Sa Pa', 'Ninh Bình', 'Hà Giang'], keywords: ['mien bac', 'bac bo', 'tay bac', 'dong bac'] },
  { dest: 'Miền Trung', isRegion: true, targets: ['Đà Nẵng – Hội An', 'Huế', 'Phú Yên'], keywords: ['mien trung', 'trung bo', 'duyen hai mien trung'] },
  { dest: 'Tây Nguyên', isRegion: true, targets: ['Đà Lạt'], keywords: ['tay nguyen', 'cao nguyen'] },
  { dest: 'Miền Nam', isRegion: true, targets: ['TP. Hồ Chí Minh', 'Cần Thơ', 'Phú Quốc'], keywords: ['mien nam', 'nam bo', 'mien tay', 'dong bang song cuu long'] }
];

const short = (value, max = 150) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeNumber = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1e9 ? number : null;
};
const normalizeText = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, c => c === 'đ' ? 'd' : 'D').toLowerCase();

function detectKnownDestination(text) {
  if (!text) return '';
  const n = normalizeText(text);
  for (const rule of KNOWN_DESTINATION_RULES) {
    if (rule.keywords.some(k => n.includes(k))) return rule.dest;
  }
  return '';
}

function destinationMatches(tourDest, targetDest) {
  if (!targetDest) return true;
  const nTour = normalizeText(tourDest);
  const nTarget = normalizeText(targetDest);
  if (nTour.includes(nTarget) || nTarget.includes(nTour)) return true;

  const regionRule = KNOWN_DESTINATION_RULES.find(r => r.isRegion && (r.dest === targetDest || normalizeText(r.dest) === nTarget));
  if (regionRule && regionRule.targets) {
    return regionRule.targets.some(t => destinationMatches(tourDest, t));
  }

  const destRule = KNOWN_DESTINATION_RULES.find(r => r.dest === targetDest || normalizeText(r.dest) === nTarget);
  if (destRule && destRule.keywords) {
    return destRule.keywords.some(k => nTour.includes(k));
  }
  return false;
}
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
  const duration = normalized.match(/\b(\d{1,2})\s*(?:ngay|day|n|d)\b/);
  const correction = message.match(/(?:kh\u00f4ng|khong)\s*,\s*([\p{L}][\p{L}\s.'-]{1,58}?)(?:\s+(?:c\u01a1|co))?\s*$/iu)?.[1]?.trim();
  const positiveMessage = message.replace(/(?:,\s*|\s+)kh(?:\u00f4ng|ong)\s+(?:\u0111i|di|gh[e\u00e9]|\u0111[e\u00e9]n|den|tham quan)\s+.+$/iu, '')
    .replace(/(?:,\s*|\s+)khong\s+(?:di|ghe|den|tham quan)\s+.+$/iu, '');
  const leadingDestination = positiveMessage.match(/^\s*(?:(?:tui|tôi|toi|mình|minh)\s+)?(?:\u0111i|di)\s+([\p{L}][\p{L}\s.'-]{1,58}?)(?=\s+\d{1,2}\s*(?:ngày|ngay)|\s+(?:budget|ngân sách|ngan sach)|[,;!?]|$)/iu)?.[1]?.trim();
  const explicitDestination = typeof input.destination === 'string' ? input.destination : '';
  const knownDest = detectKnownDestination(explicitDestination) || detectKnownDestination(message);
  let parsedDestination = explicitDestination || knownDest || requestedRevisedDestination(message) || correction || requestedItineraryDestination(positiveMessage) || parseDestination(positiveMessage) || leadingDestination;
  if (typeof parsedDestination === 'string' && !knownDest) {
    let words = parsedDestination.trim().split(/\s+/);
    const durationIndex = words.findIndex((word, index) => /^\d{1,2}$/.test(word) && /^(?:ngày|ngay|đêm|dem)$/i.test(words[index + 1] || ''));
    if (durationIndex >= 0) words = words.slice(0, durationIndex);
    while (words.length && /^(?:nào|nao|không|khong|cơ|co)$/i.test(words.at(-1))) words.pop();
    parsedDestination = words.join(' ');
  }
  const destinationWords = String(parsedDestination || '').trim().split(/\s+/);
  if (!knownDest && destinationWords.length > 1 && /^(?:khong|ko|khum)$/.test(normalizeText(destinationWords.at(-1)))) {
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
  const { Schedule, ScheduleSample } = models;
  if (!Schedule) throw new Error('Tour catalog unavailable');

  // Load sample prices if ScheduleSample exists
  const samples = ScheduleSample?.findAll
    ? await ScheduleSample.findAll({
        readPreference: 'primaryPreferred',
        attributes: ['id', 'schedule_id', 'cost', 'rating', 'votes_count']
      }).catch(() => [])
    : [];
  signal?.throwIfAborted();

  const sampleMap = new Map();
  for (const s of samples) {
    if (s.id) sampleMap.set(s.id, s);
    if (s.schedule_id) sampleMap.set(s.schedule_id, s);
  }

  // Load all official catalog tours from Schedule
  const allSchedules = await Schedule.findAll({
    readPreference: 'primaryPreferred',
    attributes: [
      'id', 'tour_name', 'destination', 'days', 'carbon',
      'tour_description', 'image_url', 'highlights',
      'catalog_status', 'price', 'rating', 'votes_count', 'current_data'
    ]
  });
  signal?.throwIfAborted();

  const officialTours = allSchedules.filter(s => {
    if (!s.id) return false;
    if (sampleMap.has(s.id)) return true;
    if (s.id.startsWith('SCH') || s.id.startsWith('tour_') || s.id.startsWith('demo-')) return true;
    if (['demo', 'editorial', 'published', 'active', 'legacy'].includes(s.catalog_status)) return true;
    return false;
  });

  const matched = officialTours.filter(schedule => {
    if (query.destination && !destinationMatches(schedule.destination, query.destination)) {
      return false;
    }
    if (query.durationDays && Number(schedule.days) !== query.durationDays) {
      return false;
    }
    const sample = sampleMap.get(schedule.id);
    const cost = safeNumber(sample?.cost || schedule.price || schedule.current_data?.price || schedule.current_data?.cost);
    if (query.maxBudget !== null && cost !== null && cost > query.maxBudget) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    const sA = sampleMap.get(a.id);
    const sB = sampleMap.get(b.id);
    const rA = safeNumber(sA?.rating || a.rating || 5);
    const rB = safeNumber(sB?.rating || b.rating || 5);
    const vA = safeNumber(sA?.votes_count || a.votes_count || 1);
    const vB = safeNumber(sB?.votes_count || b.votes_count || 1);
    const cA = safeNumber(sA?.cost || a.price || a.current_data?.price || 0);
    const cB = safeNumber(sB?.cost || b.price || b.current_data?.price || 0);
    return rB - rA || vB - vA || cA - cB || String(a.id).localeCompare(String(b.id));
  });

  const offset = (query.page - 1) * query.pageSize;
  const page = pageInfo(matched.slice(offset, offset + query.pageSize + 1), query.pageSize);

  return {
    rows: page.rows.map(schedule => {
      const sample = sampleMap.get(schedule.id) || {};
      const cost = safeNumber(sample.cost || schedule.price || schedule.current_data?.price || schedule.current_data?.cost);
      const isDemo = ['demo', 'editorial'].includes(schedule.catalog_status);
      const bookingAvailable = !isDemo && Boolean(cost && cost > 0);
      const imageUrl = schedule.image_url || schedule.current_data?.coverImage || schedule.current_data?.imageUrl || '';
      return {
        id: short(schedule.id, 80),
        title: short(schedule.tour_name),
        destination: short(schedule.destination, 100),
        days: safeNumber(schedule.days),
        cost,
        carbon: safeNumber(schedule.carbon),
        rating: safeNumber(sample.rating || schedule.rating || 5),
        votes_count: safeNumber(sample.votes_count || schedule.votes_count || 1),
        description: short(schedule.tour_description, 280),
        image: short(imageUrl, 500),
        imageUrl: short(imageUrl, 500),
        highlights: Array.isArray(schedule.highlights) ? schedule.highlights.slice(0, 5).map(item => short(item, 80)) : [],
        bookingAvailable,
        data: []
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
    attributes: ['id', 'name_service', 'type', 'destination', 'cost', 'carbon', 'rating', 'image_url', 'status']
  });
  const page = pageInfo(rows, query.pageSize);
  return {
    rows: page.rows.map(row => ({
      id: short(row.id, 80), name: short(row.name_service), type: short(row.type, 40),
      destination: short(row.destination, 100), cost: safeNumber(row.cost), carbon: safeNumber(row.carbon),
      rating: safeNumber(row.rating), image_url: short(row.image_url, 500),
      status: 'active'
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

async function loadAgentCatalog({ query: rawQuery = {}, models: injectedModels, signal, includeServiceCandidates = false, includeServices = true } = {}) {
  const query = normalizeCatalogQuery(rawQuery);
  try {
    signal?.throwIfAborted();
    const models = getModels(injectedModels);
    const catalogPromise = Promise.all([
      searchTours(models, query, signal),
      includeServices ? searchServices(models, query, signal) : Promise.resolve({ rows: [], hasMore: false })
    ]);
    const [tours, services] = await Promise.race([
      catalogPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Catalog timeout')), 7000))
    ]).catch(err => {
      console.warn('[Catalog Loader] Tối ưu hóa phản hồi: Catalog query vượt quá 7s, trả về danh mục rỗng để AI phản hồi ngay:', err.message);
      return [{ rows: [], hasMore: false }, { rows: [], hasMore: false }];
    });
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
  return async ({ query = {}, signal, includeServiceCandidates = false, includeServices = true } = {}) => {
    signal?.throwIfAborted();
    const normalized = normalizeCatalogQuery(query);
    const includeCandidates = includeServiceCandidates === true;
    const includeServiceCatalog = includeServices !== false;
    const key = JSON.stringify({ query: normalized, includeServiceCandidates: includeCandidates, includeServices: includeServiceCatalog });
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expires > now) return cached.value;
    if (inFlight.has(key)) return inFlight.get(key);
    const pending = loadAgentCatalog({ ...options, query: normalized, signal, includeServiceCandidates: includeCandidates, includeServices: includeServiceCatalog }).then(catalog => {
      if (catalog.available && !signal?.aborted) {
        const configured = Number((options.env || process.env).N8N_CATALOG_CACHE_MS ?? 300000);
        const ttl = Number.isFinite(configured) ? Math.max(30000, Math.min(600000, configured)) : 300000;
        if (ttl) cache.set(key, { value: catalog, expires: Date.now() + ttl });
      }
      return catalog;
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  };
}

module.exports = { loadAgentCatalog, createCatalogLoader, normalizeCatalogQuery, queryFromRequest, parseDestination, parseServiceType, parseMoney, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
