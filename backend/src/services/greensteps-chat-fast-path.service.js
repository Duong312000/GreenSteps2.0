// Deliberately small grammar: unknown qualifiers and contextual follow-ups go to AI.
const { queryFromRequest } = require('./greensteps-agent-catalog.service');
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
const money = value => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const label = value => String(value).replace(/[\\`*_{}\[\]<>#!|]/g, '').replace(/[\r\n]+/g, ' ').slice(0, 160);
const finitePrice = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const fixed = new Map([
  ['xin chao', 'Xin chào! Mình có thể tìm tour, dịch vụ, giá tham khảo hoặc giúp bạn lập lịch trình du lịch xanh. Bạn muốn đi đâu?'],
  ['chao', 'Chào bạn! Bạn muốn tìm tour, dịch vụ hay lập lịch trình du lịch xanh?'],
  ['hello', 'Xin chào! Bạn muốn tìm tour hay dịch vụ ở điểm đến nào?'],
  ['hi', 'Xin chào! Bạn muốn tìm tour hay dịch vụ ở điểm đến nào?'],
  ['ban giup duoc gi', 'Mình hỗ trợ tìm tour, dịch vụ, xem giá tham khảo và tư vấn lịch trình. Bạn có thể hỏi: “Tìm tour Đà Lạt 3 ngày dưới 3 triệu”.'],
  ['huong dan dat tour', 'Bạn mở mục Tour, chọn tour và xem chi tiết, rồi làm theo các bước đặt tour trên website. Hãy kiểm tra giá và điều kiện trước khi thanh toán. Chatbot không thực hiện đặt tour.']
]);
const destinationQuestions = new Set(['greensteps co nhung diem den nao', 'greensteps co diem den nao', 'liet ke diem den', 'cac diem den cua greensteps']);
const types = {
  homestay: s => /\bhomestay\b/.test(normalize(s.name)) || normalize(s.type) === 'homestay',
  'luu tru': s => ['stay', 'lodging', 'homestay'].includes(normalize(s.type)),
  'khach san': s => /\bkhach san\b/.test(normalize(s.name)) || normalize(s.type) === 'hotel',
  'an uong': s => ['food', 'dining'].includes(normalize(s.type)),
  'nha hang': s => /\bnha hang\b/.test(normalize(s.name)) || normalize(s.type) === 'restaurant',
  'tham quan': s => ['attraction', 'activity'].includes(normalize(s.type)),
  'di chuyen': s => ['transport', 'transportation'].includes(normalize(s.type))
};

function fixedReply(message) { return fixed.get(normalize(message).replace(/[.!?]+$/, '')); }
function isCatalogDependentRequest(message) {
  const value = normalize(message);
  if (/(?:tra cuu|kiem tra|tim don|ma don|ma ve)|\bBKT-[A-Z0-9_-]+\b|\bSCH[A-Z0-9_-]+\b/.test(value)) return false;
  if (/\b(?:hoan tien|hoan huy|chinh sach|thanh toan|vietqr|phuong thuc thanh toan|toi uu lich trinh|sua gio|trung gio|tu dong sua|auto adjust)\b/.test(value)) return false;
  return /\b(?:tour|dich vu|homestay|khach san|luu tru|quan cafe|ca phe|cafe|nha hang|an uong|tham quan|diem den|lich trinh|hanh trinh|chuyen di|itinerary|travel plan)\b/.test(value);
}
function isExplicitCatalogSearchRequest(message) {
  const value = normalize(message);
  return /\b(?:tim|goi y|de xuat|liet ke|xem)\b/.test(value)
    && /\b(?:tour|dich vu|homestay|khach san|luu tru|quan cafe|ca phe|cafe|nha hang|an uong|tham quan|diem den)\b/.test(value);
}
function destinations(catalog) {
  return [...new Map([...catalog.tours, ...catalog.services].map(row => [normalize(row.destination), row.destination]).filter(([key]) => key)).values()];
}
function destinationParts(value) {
  return String(value ?? '').split(/[,–—|/\-]+/).map(part => normalize(part)).filter(Boolean);
}
function matchesDestination(requested, actual) {
  const needle = normalize(requested), value = normalize(actual);
  return Boolean(needle && value && (value === needle || value.startsWith(`${needle} `) || destinationParts(actual).includes(needle)));
}
function destinationOptions(catalog) {
  return [...new Set(destinations(catalog).flatMap(value => [value, ...destinationParts(value)]))];
}

function requestedDiscoveryDestination(message, catalog) {
  const normalized = normalize(message);
  const options = destinationOptions(catalog).sort((a, b) => normalize(b).length - normalize(a).length);
  if (/(?:\b(?:hay|hoac)\b|\/)/.test(normalized)) return '';
  const parsed = queryFromRequest({ message }).destination;
  if (parsed) return options.find(place => normalize(place) === normalize(parsed)) || parsed;
  const found = options.filter(place => {
    const key = normalize(place);
    const at = normalized.indexOf(key);
    if (at < 0) return false;
    const prefix = normalized.slice(Math.max(0, at - 24), at).trim();
    return !/(?:khong muon di|khong chon|khong phai)\s*$/.test(prefix);
  });
  const explicit = found[0];
  if (!explicit) return '';
  const also = found.slice(1).filter(place => normalize(place) !== normalize(explicit));
  if (also.length && /\b(?:hay|hoac)\b|\//.test(normalized)) return '';
  return explicit;
}

function destinationChoiceClarification(message, catalog) {
  if (!catalog?.available || !/(?:\b(?:hay|hoac)\b|\/)/.test(normalize(message))) return null;
  const value = normalize(message);
  const options = destinationOptions(catalog).sort((a, b) => normalize(b).length - normalize(a).length);
  const mentioned = [];
  for (const place of options) {
    const key = normalize(place);
    const index = value.indexOf(key);
    if (index < 0) continue;
    const prefix = value.slice(Math.max(0, index - 24), index).trim();
    if (/(?:khong muon di|khong chon|khong phai)\s*$/.test(prefix)) continue;
    if (!mentioned.some(existing => normalize(existing) === key)) mentioned.push(place);
  }
  if (mentioned.length < 2) return null;
  const choices = mentioned.slice(0, 3);
  return {
    intent: 'destination_clarification',
    reply: `Bạn muốn chọn điểm đến nào: ${choices.map(label).join(', ')}?`,
    type: 'clarification', tours: [], itinerary: null, totalTours: 0, hasMoreTours: false,
    catalogAvailable: true,
    suggestedQuestions: choices
  };
}

function routeConflictClarification(message, catalog) {
  if (!catalog?.available) return null;
  const value = normalize(message);
  const places = destinationOptions(catalog).sort((a, b) => normalize(b).length - normalize(a).length)
    .filter(place => value.includes(normalize(place)));
  const unique = [...new Map(places.map(place => [normalize(place), place])).values()];
  const hasBaNa = /\bba na hills?\b/.test(value);
  if (unique.length < 2 && !(hasBaNa && unique.length === 1 && !matchesDestination(unique[0], 'Đà Nẵng'))) return null;
  const choices = unique.slice(0, 3);
  if (hasBaNa && !choices.some(place => matchesDestination(place, 'Đà Nẵng'))) choices.push('Đà Nẵng');
  return {
    intent: 'route_clarification', type: 'clarification', tours: [], itinerary: null,
    totalTours: 0, hasMoreTours: false, catalogAvailable: true,
    reply: hasBaNa && unique.length === 1
      ? `Bà Nà Hills thuộc khu vực Đà Nẵng, khác với ${label(unique[0])}. Bạn muốn giữ ${label(unique[0])} hay đổi sang Đà Nẵng?`
      : `Mình thấy yêu cầu nhắc đến nhiều điểm đến (${choices.map(label).join(', ')}). Bạn muốn chọn điểm nào?`,
    suggestedQuestions: choices.slice(0, 3)
  };
}

function editDistanceAtMostOne(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length > right.length) i++;
    else if (right.length > left.length) j++;
    else { i++; j++; }
  }
  if (i < left.length || j < right.length) edits++;
  return edits <= 1;
}

function destinationCorrectionClarification(message, catalog) {
  if (!catalog?.available) return null;
  const requested = queryFromRequest({ message }).destination;
  const key = normalize(requested);
  if (!key || destinationOptions(catalog).some(place => normalize(place) === key)) return null;
  const uniquePlaces = destinationOptions(catalog).reduce((places, place) => {
    const placeKey = normalize(place);
    if (!places.has(placeKey)) places.set(placeKey, place);
    return places;
  }, new Map());
  const ranked = [...uniquePlaces.entries()].map(([placeKey, place]) => ({ key: placeKey, place }));
  const suggestions = ranked.filter(item => item.key.split(' ')[0] === key.split(' ')[0] && editDistanceAtMostOne(item.key, key));
  if (suggestions.length !== 1) return null;
  const place = suggestions[0].place;
  return {
    intent: 'destination_correction',
    reply: `Bạn muốn nói ${label(place)} phải không?`,
    type: 'clarification', tours: [], itinerary: null, totalTours: 0, hasMoreTours: false,
    catalogAvailable: true, suggestedQuestions: [place, 'Nhập lại điểm đến']
  };
}

function tourDiscoveryReply(message, catalog) {
  const value = normalize(message);
  const casualDiscovery = /(?:\bmuon di\b|\bmuon den\b|\bmuon toi\b|\btoi muon di\b)/.test(value);
  const questionDiscovery = /\b(?:co|con) tour\b/.test(value) && /\b(?:khong|ko|khum)\b/.test(value);
  if (!catalog?.available || (!casualDiscovery && !questionDiscovery)) return null;
  const place = requestedDiscoveryDestination(message, catalog);
  if (!place) return null;
  const rows = (catalog.tours || []).filter(row => matchesDestination(place, row.destination));
  const selected = rows.slice(0, 6);
  const suffix = catalog.truncatedTours
    ? '\nDanh mục đang hiển thị một phần kết quả; có thể còn tour phù hợp khác.'
    : '';
  const reply = rows.length
    ? `Mình tìm thấy ${rows.length}${catalog.truncatedTours ? '+' : ''} tour trong danh mục GreenSteps tại ${label(place)}:\n${selected.map(row => `- ${label(row.title || row.name)} (mã ${label(row.id)})${row.days ? ` — ${row.days} ngày` : ''}: ${finitePrice(row.cost) ? money(row.cost) : 'chưa có giá'}.`).join('\n')}${suffix}`
    : catalog.truncatedTours
      ? `Trang danh mục hiện tại chưa có tour phù hợp tại ${label(place)}; danh sách chưa được truy vấn hết.`
      : `Mình chưa tìm thấy tour tại ${label(place)} trong danh mục GreenSteps hiện có.`;
  return {
    intent: rows.length ? 'tours' : catalog.truncatedTours ? 'partial_no_match' : 'tours',
    type: 'tour_recommendations', reply, tours: selected, itinerary: null,
    totalTours: rows.length, hasMoreTours: Boolean(catalog.truncatedTours),
    catalogAvailable: true,
    suggestedQuestions: [`Tự tạo lịch trình tại ${place}`, 'Tìm tour ở điểm đến khác', 'Xem dịch vụ tại điểm đến này']
  };
}
function listReply(rows, kind, catalog) {
  const suffix = catalog.truncated ? '\nDanh mục được giới hạn; kết quả chưa bao gồm toàn bộ sản phẩm.' : '';
  if (!rows.length) return `Chưa tìm thấy ${kind} phù hợp trong danh mục hiện có.${suffix}`;
  const lines = rows.slice(0, 6).map(row => `- ${label(row.title || row.name)} (mã ${label(row.id)})${row.days ? ` — ${row.days} ngày` : ''}: ${finitePrice(row.cost) ? money(row.cost) : 'chưa có giá'}.`);
  return `${lines.join('\n')}\nGiá tham khảo từ danh mục; đơn vị tính và điều kiện cần xác nhận trên trang chi tiết trước thanh toán.${rows.length > 6 ? `\nĐang hiển thị 6/${rows.length} kết quả.` : ''}${suffix}`;
}

function matchExact(catalog, kind, text) {
  const rows = kind === 'tour' ? catalog.tours : catalog.services;
  const matches = rows.filter(row => [row.id, row.title || row.name].some(value => normalize(value) === text));
  return matches.length === 1 ? matches[0] : null;
}

function catalogReply(message, catalog) {
  if (!catalog?.available) return null;
  const text = normalize(message).replace(/[.!?]+$/, '');
  if (destinationQuestions.has(text)) {
    const names = destinations(catalog);
    return { intent: 'destinations', reply: names.length ? `Điểm đến trong danh mục GreenSteps hiện có: ${names.map(label).join('; ')}.${catalog.truncated ? ' Danh mục có giới hạn, chưa phải toàn bộ điểm đến.' : ''}` : 'Danh mục hiện chưa có điểm đến.' };
  }
  const price = text.match(/^(?:xem )?gia (tour|dich vu) (.+)$/);
  if (price) {
    const row = matchExact(catalog, price[1], price[2]);
    return row ? { intent: 'price', reply: listReply([row], price[1], catalog) } : null;
  }
  // Only explicit catalog identifiers/names + quantity. Never use a price from chat history.
  const sum = text.match(/^tinh tong (.+)$/);
  if (sum) {
    const parts = sum[1].split(/\s*\+\s*/);
    if (!parts.length || parts.length > 10) return null;
    const items = [];
    for (const part of parts) {
      const match = part.match(/^(tour|dich vu) (.+) x ([1-9]\d?)$/);
      if (!match) return null;
      const row = matchExact(catalog, match[1], match[2]);
      if (!row || !finitePrice(row.cost)) return null;
      items.push({ row, quantity: Number(match[3]), kind: match[1] });
    }
    // Tour inclusions are unknown: do not sum a package and individual services together.
    if (new Set(items.map(i => i.kind)).size > 1) return null;
    const total = items.reduce((value, item) => value + item.row.cost * item.quantity, 0);
    return { intent: 'sum', reply: `${items.map(i => `- ${label(i.row.title || i.row.name)}: ${money(i.row.cost)} × ${i.quantity}`).join('\n')}\nTổng các khoản: **${money(total)}**. Chỉ cộng số lượng theo giá danh mục, chưa xác nhận đơn vị tính, phụ phí hoặc tình trạng còn chỗ.` };
  }
  // Consume the complete search grammar. Any leftover phrase requires AI interpretation.
  const search = text.match(/^(?:goi y|de xuat|tim|liet ke|xem) (?:cho toi )?(tour|dich vu|homestay|luu tru|khach san|an uong|nha hang|tham quan|di chuyen) (.+)$/);
  if (!search) return null;
  const kind = search[1];
  let rest = search[2].replace(/^(?:tai|o) /, '');
  const place = destinationOptions(catalog).sort((a, b) => b.length - a.length)
    .find(name => rest === normalize(name) || rest.startsWith(normalize(name) + ' '));
  if (!place) return null;
  rest = rest.slice(normalize(place).length).trim();
  let days, budget, exclusive = false;
  if (kind === 'tour') {
    const dayMatch = rest.match(/^(\d{1,2}) ngay(?: (\d{1,2}) dem)?(?: |$)/);
    if (dayMatch) {
      days = Number(dayMatch[1]);
      if (!days || (dayMatch[2] && Number(dayMatch[2]) !== days - 1)) return null;
      rest = rest.slice(dayMatch[0].length).trim();
    }
  }
  if (rest) {
    const budgetMatch = rest.match(/^(duoi|toi da|khong qua) (\d+(?:[.,]\d{1,2})?)\s*(trieu|tr|nghin|ngan|k|vnd|dong|d)$/);
    if (!budgetMatch) return null;
    const multiplier = { trieu: 1e6, tr: 1e6, nghin: 1000, ngan: 1000, k: 1000, vnd: 1, dong: 1, d: 1 }[budgetMatch[3]];
    budget = Number(budgetMatch[2].replace(',', '.')) * multiplier;
    if (!(budget > 0 && budget <= 1e9)) return null;
    exclusive = budgetMatch[1] === 'duoi';
  }
  let rows = (kind === 'tour' ? catalog.tours : catalog.services).filter(row => matchesDestination(place, row.destination)
    && (kind === 'tour' || kind === 'dich vu' || types[kind](row))
    && (days === undefined || row.days === days)
    && (budget === undefined || (finitePrice(row.cost) && (exclusive ? row.cost < budget : row.cost <= budget))));
  if (kind === 'tour') {
    rows = rows.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)
      || (Number(b.votesCount) || 0) - (Number(a.votesCount) || 0)
      || ((finitePrice(a.cost) ? a.cost : Number.POSITIVE_INFINITY) - (finitePrice(b.cost) ? b.cost : Number.POSITIVE_INFINITY)));
    const selected = rows.slice(0, 80);
    return {
      intent: 'tours', type: 'tour_recommendations',
      reply: listReply(rows, 'tour', catalog),
      tours: selected, totalTours: rows.length, hasMoreTours: Boolean(catalog.truncatedTours),
      catalogAvailable: true,
      suggestedQuestions: rows.length === 0
        ? ['Tìm tour ở địa điểm khác', `Lập lịch trình riêng tại ${place}`, 'Thử điều chỉnh số ngày hoặc ngân sách']
        : rows.length > 1
        ? ['So sánh các tour này', `Tạo lịch trình riêng tại ${place}`, 'Tour nào phù hợp ngân sách của tôi?']
        : [`Xem chi tiết ${rows[0]?.title || 'tour'}`, 'Tạo lịch trình riêng', `Tìm dịch vụ xanh tại ${place}`]
    };
  }
  return { intent: 'services', reply: listReply(rows, 'dịch vụ', catalog) };
}

function compactAiInput(input, catalog) {
  // Explicit place in current question takes precedence. Contextual questions retain the catalog.
  const message = normalize(input.message);
  const places = destinationOptions(catalog).filter(place => message.includes(normalize(place)));
  const relevant = row => !places.length || places.some(place => matchesDestination(place, row.destination));

  // Ultra-lean projection: strip heavy images, descriptions, tags, and internal structures
  const compactTour = row => ({
    id: row.id,
    title: row.title || row.name,
    destination: row.destination,
    days: row.days || row.durationDays || 1,
    cost: row.cost,
    carbon: row.carbon
  });

  const compactService = row => ({
    id: row.id,
    name: row.name || row.name_service,
    type: row.type || row.serviceType,
    destination: row.destination,
    cost: row.cost
  });

  const rawTours = (catalog.tours || []).filter(relevant);
  const rawServices = (catalog.services || []).filter(relevant);

  // Keep strictly up to 3 relevant tours and 5 relevant services
  const tours = rawTours.slice(0, 3).map(compactTour);
  const services = rawServices.slice(0, 5).map(compactService);

  const rawCandidates = Array.isArray(catalog.serviceCandidates) ? catalog.serviceCandidates.filter(relevant) : [];
  const serviceCandidates = rawCandidates.slice(0, 6).map(compactService);

  const selectedIds = new Set((input.currentTours || []).map(tour => tour.id));
  const currentTours = rawTours.filter(tour => selectedIds.has(tour.id)).slice(0, 3).map(compactTour);

  const history = (input.history || []).slice(-3).map(item => ({
    role: item.role,
    content: (item.content || '').slice(0, 250)
  }));

  return {
    ...input,
    currentTours,
    history,
    catalog: {
      tours,
      services,
      serviceCandidates,
      available: Boolean(catalog?.available),
      truncated: true
    }
  };
}

module.exports = { fixedReply, isCatalogDependentRequest, isExplicitCatalogSearchRequest, catalogReply, tourDiscoveryReply, destinationChoiceClarification, routeConflictClarification, destinationCorrectionClarification, compactAiInput };
