const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u0111\u0110]/g, character => character === '\u0111' ? 'd' : 'D').toLowerCase().replace(/\s+/g, ' ').trim();
const text = (value, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeNumber = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

function readPath(value, path) {
  let result = value;
  for (const field of path.split('.')) result = result && typeof result === 'object' && Object.hasOwn(result, field) ? result[field] : undefined;
  return result;
}

function canonicalTour(tour) {
  const days = typeof tour.days === 'number' && Number.isInteger(tour.days) && tour.days > 0 ? tour.days : null;
  const price = typeof tour.cost === 'number' && Number.isFinite(tour.cost) && tour.cost >= 0 ? tour.cost : null;
  const rating = typeof tour.rating === 'number' && Number.isFinite(tour.rating) && tour.rating >= 0 && tour.rating <= 5 ? tour.rating : null;
  const tags = Array.isArray(tour.tags) ? tour.tags.map(tag => text(tag, 40)).filter(Boolean).slice(0, 6) : [];
  const badgeLabels = {
    BADGE_STAY_GREEN: 'L\u01b0u tr\u00fa xanh',
    BADGE_GREEN_TRANSPORT: 'Di chuy\u1ec3n xanh',
    BADGE_SLOW_TRAVEL: 'Du l\u1ecbch ch\u1eadm',
    BADGE_LOCAL_CULTURE: 'V\u0103n h\u00f3a \u0111\u1ecba ph\u01b0\u01a1ng',
    BADGE_SEA_CLEAN: 'B\u1ea3o t\u1ed3n bi\u1ec3n'
  };
  const ecoLabels = tags.map(tag => ({ label: badgeLabels[tag] || tag, recognized: Boolean(badgeLabels[tag]) || /xanh|eco|green|carbon|sustaina/i.test(tag) }))
    .filter(item => item.recognized).map(item => item.label);
  const highlights = Array.isArray(tour.highlights) ? tour.highlights.map(item => text(item, 80)).filter(Boolean).slice(0, 5) : [];
  return {
    id: text(tour.id, 80), name: text(tour.title || tour.name, 120), destination: text(tour.destination, 100),
    durationDays: days, durationNights: days === null ? null : Math.max(0, days - 1), price, currency: price === null ? null : 'VND',
    imageUrl: text(tour.imageUrl || tour.image, 500) || null, highlights: highlights.length ? highlights : tags,
    ecoLabels,
    rating,
    bookingAvailable: tour.bookingAvailable === true
  };
}

function resolveTour(reference, catalog) {
  const ref = typeof reference === 'string' ? { id: reference, name: reference } : reference || {};
  const rows = catalog?.tours || [];
  const id = text(ref.id || ref.tourId || ref.tour_id, 80);
  const name = normalize(ref.name || ref.title || ref.tourName || ref.tour_name);
  return rows.find(row => id && row.id === id)
    || rows.find(row => name && normalize(row.title) === name)
    || null;
}

function sameDestination(expected, returned) {
  const expectedValue = normalize(expected);
  const returnedValue = normalize(returned);
  return Boolean(expectedValue && returnedValue
    && (expectedValue === returnedValue || expectedValue.includes(returnedValue) || returnedValue.includes(expectedValue)));
}

function canonicalItinerary(raw, catalog, fallbackDestination = '', requestedDays = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const destination = text(fallbackDestination || raw.destination, 100);
  const declaredDays = [raw.durationDays, raw.duration_days, raw.totalDays, raw.total_days, raw.dayCount, raw.day_count]
    .map(value => Number(value)).find(value => Number.isInteger(value) && value > 0 && value <= 14) || 0;
  const declaredText = normalize(raw.duration || raw.durationText || raw.duration_text);
  const declaredTextDays = Number(declaredText.match(/\b(\d{1,2})\s*(?:ngay|day)\b/)?.[1]) || 0;
  const declaredNights = Number(declaredText.match(/\b(\d{1,2})\s*(?:dem|night)\b/)?.[1]) || 0;
  const expectedDays = Math.min(14, requestedDays || declaredDays || declaredTextDays || (declaredNights ? declaredNights + 1 : 0));
  const rawDays = Array.isArray(raw.days) ? raw.days : Array.isArray(raw.activities) ? raw.activities : [];
  const activityList = value => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    for (const key of ['activities', 'items', 'schedule', 'places', 'stops']) {
      if (Array.isArray(value[key])) return value[key];
    }
    return value.name || value.title || value.activity ? [value] : [];
  };
  const dayMarker = value => value && typeof value === 'object'
    ? value.dayNumber ?? value.day_number ?? value.dayIndex ?? value.day_index ?? value.day
    : undefined;
  const hasNestedDayLists = rawDays.some(day => ['activities', 'items', 'schedule', 'places', 'stops']
    .some(key => Array.isArray(day?.[key])));
  const hasDayMarkers = rawDays.some(day => dayMarker(day) !== undefined && dayMarker(day) !== null);
  let dayGroups;
  if (rawDays.some(Array.isArray) || hasNestedDayLists) {
    dayGroups = rawDays;
  } else if (hasDayMarkers) {
    const grouped = new Map();
    for (const item of rawDays) {
      const marker = dayMarker(item);
      const key = marker === undefined || marker === null ? `item-${grouped.size}` : String(marker);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(...activityList(item));
    }
    dayGroups = [...grouped.values()];
  } else if (expectedDays > 1 && rawDays.length === expectedDays) {
    // Some n8n workflows return one object per day without nesting activities.
    dayGroups = rawDays.map(day => activityList(day));
  } else {
    // A flat activities array describes a single day unless a requested or
    // declared duration lets us split those activities into day-sized groups.
    dayGroups = rawDays.length ? [rawDays] : [];
  }
  let days = dayGroups.slice(0, 14).map(day => {
    const activities = activityList(day);
    return activities.slice(0, 12).map(activity => {
      const name = text(typeof activity === 'string' ? activity : activity?.name || activity?.title || activity?.activity, 140);
      if (!name) return null;
      const candidate = resolveTour({ id: activity.serviceId || activity.service_id, name }, { tours: catalog?.services || [] });
      const service = candidate && sameDestination(destination, candidate.destination) ? candidate : null;
      const verified = Boolean(service);
      return {
        name,
        time: /^([01]\d|2[0-3]):[0-5]\d$/.test(activity.time || '') ? activity.time : '08:00',
        cost: verified ? safeNumber(service.cost) : 0,
        carbon: verified ? safeNumber(service.carbon) : 0,
        type: verified ? (service.type === 'stay' ? 'lodging' : service.type === 'food' ? 'dining' : service.type === 'transport' ? 'transport' : 'attraction') : 'attraction',
        verified,
        serviceId: verified ? service.id : null
      };
    }).filter(Boolean);
  });
  if (expectedDays && days.length === 1 && days[0].length > expectedDays) {
    const activities = days[0];
    const perDay = Math.ceil(activities.length / expectedDays);
    days = Array.from({ length: expectedDays }, (_, index) => activities.slice(index * perDay, (index + 1) * perDay));
  }
  if (expectedDays) {
    days = days.slice(0, expectedDays);
    while (days.length < expectedDays) days.push([]);
    if (days.some(day => !day.length)) return null;
  } else {
    while (days.length && !days.at(-1).length) days.pop();
  }
  if (!destination || !days.length || days.every(day => !day.length)) return null;
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
  return {
    destination, name: text(raw.name || raw.title, 120) || `Hành trình khám phá ${destination}`,
    startDate: date(raw.startDate || raw.start_date), endDate: date(raw.endDate || raw.end_date),
    days, estimatedCost: days.flat().reduce((sum, activity) => sum + activity.cost, 0),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(item => text(item, 140)).filter(Boolean).slice(0, 5) : []
  };
}

function inferDestination(message, history = [], catalog) {
  const context = [message, ...(history || []).filter(item => item?.role === 'user').slice(-6).map(item => item.content)].join(' ');
  const known = [...new Set([...(catalog?.tours || []), ...(catalog?.services || [])]
    .map(row => row.destination).filter(Boolean).flatMap(destination => [destination, ...String(destination).split(/[,–—|/\-]+/).map(part => part.trim()).filter(Boolean)]))]
    .sort((a, b) => normalize(b).length - normalize(a).length);
  return known.find(place => normalize(context).includes(normalize(place))) || '';
}

function isExplicitItineraryRequest(message) {
  const value = normalize(message);
  const hasPlanAction = /\b(?:lap|tao|len|xay dung|thiet ke|lam|sap xep|soan)\b/.test(value);
  const mentionsPlan = /\b(?:lich trinh|lap lich(?: trinh| di(?: choi)?)?|len lich(?: trinh| di(?: choi)?)?|lich di(?: choi)?|hanh trinh|ke hoach(?: du lich| chuyen di)?)\b/.test(value)
    || (hasPlanAction && /\b(?:tour|chuyen di)\b/.test(value));
  if (!mentionsPlan) return false;

  // A direct planning verb is the strongest signal. Phrases such as “tạo lịch
  // đi”, “lên kế hoạch du lịch”, and “xây dựng hành trình” all mean a custom
  // itinerary, even when the user also mentions budget or tours.
  if (hasPlanAction) return true;

  const asksForPlan = /\b(?:goi y|de xuat|tu van|muon)\b/.test(value);
  const explicitlySearchesTours = /\btour\b/.test(value) && /\b(?:tim|goi y|de xuat|so sanh|chon|tu van|muon)\b/.test(value);
  return asksForPlan && !explicitlySearchesTours;
}

function itineraryContextHistory(input) {
  const history = Array.isArray(input?.history) ? input.history : [];
  if (isExplicitItineraryRequest(input?.message)) return [];

  let requestIndex = -1;
  for (let index = history.length - 1; index >= 0; index--) {
    const item = history[index];
    if (item?.role === 'user' && isExplicitItineraryRequest(item.content)) {
      requestIndex = index;
      break;
    }
  }
  return requestIndex < 0 ? [] : history.slice(requestIndex);
}

function itineraryUserMessages(input) {
  return [
    ...itineraryContextHistory(input).filter(item => item?.role === 'user').map(item => item.content || ''),
    input?.message || ''
  ];
}

function pendingItineraryQuestion(input) {
  const lastAssistant = [...(input.history || [])].reverse().find(item => item?.role === 'assistant');
  const value = normalize(lastAssistant?.content);
  if (/ban muon lap lich trinh o dau|ban muon den diem den nao|chon mot diem den/.test(value)) return 'destination';
  if (/ban muon di (?:.{1,50} )?(?:trong bao lau|bao nhieu ngay)|ban muon di bao nhieu ngay|chon thoi luong/.test(value)) return 'duration';
  return '';
}

function explicitMessageIntent(message) {
  if (isExplicitItineraryRequest(message)) return 'itinerary';
  const value = normalize(message);
  return /\btour\b/.test(value) && /\b(?:tim|goi y|de xuat|so sanh|chon|tu van|muon)\b/.test(value)
    ? 'tour_search'
    : '';
}

function latestConversationIntent(input) {
  for (const item of [...(input?.history || [])].reverse()) {
    if (item?.role !== 'user') continue;
    const intent = explicitMessageIntent(item.content);
    if (intent) return intent;
  }
  return '';
}

function isItineraryRequest(input) {
  if (isExplicitItineraryRequest(input.message)) return true;
  const value = normalize(input.message);
  if (explicitMessageIntent(input.message) === 'tour_search') return false;
  const suppliesDuration = /\b\d{1,2}\s*(?:ngay|day|dem|night)\b/.test(value);
  return latestConversationIntent(input) === 'itinerary'
    && Boolean(pendingItineraryQuestion(input) || suppliesDuration);
}

function isExplicitTourSearchRequest(input) {
  return !isItineraryRequest(input) && explicitMessageIntent(input?.message) === 'tour_search';
}

function planDestination(input, catalog) {
  const userTexts = itineraryUserMessages(input);
  for (const source of [...userTexts].reverse()) {
    const knownDestination = inferDestination(source, [], catalog);
    if (knownDestination) return knownDestination;
  }
  for (const source of userTexts.reverse()) {
    const place = String(source).match(/(?:t\u1ea1i|\u1edf|\u0111i \u0111\u1ebfn|\u0111\u1ebfn|tai|o|den)\s+([\p{L}][\p{L}\s'-]{1,40}?)(?=\s+(?:trong|voi|ngan sach|duoi|toi da)|\s+\d|[,!?;.]|$)/iu);
    if (place?.[1]) return place[1].trim();
  }
  if (pendingItineraryQuestion(input) !== 'destination') return '';
  let value = String(input.message || '').trim();
  const normalized = normalize(value);
  const prefix = normalized.match(/^(?:(?:toi|minh) muon (?:di|den|toi|o)|di den|den|tai|o)\s+/);
  if (prefix) value = value.slice(prefix[0].length);
  value = value.replace(/[,;].*$/, '').replace(/\s+\d.*$/, '').trim();
  const candidate = normalize(value);
  if (value.length < 2 || value.length > 80 || !/[\p{L}]/u.test(value)
    || /^(khac|diem den khac|chua biet|khong biet|khong quan trong)$/.test(candidate)) return '';
  return value;
}

function planDurationDays(input) {
  const context = normalize(itineraryUserMessages(input).join(' '));
  const vietnameseShorthand = context.match(/\b(\d{1,2})\s*n\s*\d{1,2}\s*d\b/);
  if (vietnameseShorthand && Number(vietnameseShorthand[1]) >= 1 && Number(vietnameseShorthand[1]) <= 30) return Number(vietnameseShorthand[1]);
  const englishShorthand = context.match(/\b(\d{1,2})\s*d\s*\d{1,2}\s*n\b/);
  if (englishShorthand && Number(englishShorthand[1]) >= 1 && Number(englishShorthand[1]) <= 30) return Number(englishShorthand[1]);
  const dayMatch = context.match(/\b(\d{1,2})\s*(?:ngay|day)\b/);
  if (dayMatch && Number(dayMatch[1]) >= 1 && Number(dayMatch[1]) <= 30) return Number(dayMatch[1]);
  const weekMatch = context.match(/\b(\d)\s*tuan\b/);
  if (weekMatch) return Number(weekMatch[1]) * 7;
  const nightMatch = context.match(/\b(\d{1,2})\s*(?:dem|night)\b/);
  if (nightMatch && Number(nightMatch[1]) <= 29) return Number(nightMatch[1]) + 1;
  return 0;
}

function itineraryClarification(input, catalog) {
  if (!isItineraryRequest(input)) return null;
  const destination = planDestination(input, catalog);
  if (!destination) {
    const counts = new Map();
    for (const tour of catalog?.tours || []) if (tour.destination) counts.set(tour.destination, (counts.get(tour.destination) || 0) + 1);
    const choices = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([place]) => place);
    return {
      reply: 'B\u1ea1n mu\u1ed1n l\u1eadp l\u1ecbch tr\u00ecnh \u1edf \u0111\u00e2u? Ch\u1ecdn m\u1ed9t \u0111i\u1ec3m \u0111\u1ebfn b\u00ean d\u01b0\u1edbi ho\u1eb7c nh\u1eadp t\u00ean \u0111i\u1ec3m \u0111\u1ebfn kh\u00e1c.',
      suggestedQuestions: choices
    };
  }
  if (!planDurationDays(input)) {
    return {
      reply: `B\u1ea1n mu\u1ed1n \u0111i ${destination} trong bao l\u00e2u? Ch\u1ecdn th\u1eddi l\u01b0\u1ee3ng b\u00ean d\u01b0\u1edbi.`,
      suggestedQuestions: ['2 ng\u00e0y 1 \u0111\u00eam', '3 ng\u00e0y 2 \u0111\u00eam', '4 ng\u00e0y 3 \u0111\u00eam']
    };
  }
  return null;
}

function parseTextItinerary(reply, input, catalog) {
  const request = normalize(input.message);
  const looksLikePlan = /lich trinh|hanh trinh|phuong an|ket hop|ngay \d/.test(normalize(reply));
  if (!looksLikePlan) return null;
  const destination = isItineraryRequest(input) ? planDestination(input, catalog) : inferDestination(input.message, input.history, catalog);
  const sections = [];
  let current = null;
  for (const line of reply.split(/\r?\n/).slice(0, 120)) {
    // n8n commonly formats each day as a markdown list item, e.g.
    // "* **Ngày 1: Hồ Xuân Hương**". Normalize only for heading detection;
    // keep the original line for activity bullets below.
    const headingText = line.trim()
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\*{1,2}\s*/, '')
      .replace(/\*{1,2}\s*$/, '')
      .trim();
    const heading = headingText.match(/^(?:ngày|ngay|day)\s*(\d{1,2})\s*[:.\-–—]?\s*(.*)$/iu);
    if (heading) {
      const dayNumber = Number(heading[1]);
      if (dayNumber < 1 || dayNumber > 14) continue;
      while (sections.length < dayNumber) sections.push([]);
      current = sections[dayNumber - 1];
      const rest = heading[2].replace(/\*{1,2}/g, '').replace(/^\s*\([^)]*\)\s*/, '').trim();
      if (rest && !/^(?:sang|chieu|toi|morning|afternoon|evening)\b/i.test(rest)) current.push({ name: rest });
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (!bullet) continue;
    if (!current) { sections.push([]); current = sections[0]; }
    const name = bullet[1].replace(/\*\*/g, '').split(/\s+[—–-]\s+|\s+\(/)[0].trim();
    if (name.length >= 3 && current.length < 12) current.push({ name });
  }
  const requestedDays = Math.min(14, planDurationDays(input));
  const dayCount = Math.max(sections.length, requestedDays);
  const days = Array.from({ length: dayCount }, (_, index) => (sections[index] || [])
    .map(activity => ({ ...activity, time: '08:00' })));
  if (requestedDays && Array.from({ length: requestedDays }, (_, index) => sections[index]).some(day => !day?.length)) return null;
  if (!destination || !days.length || !days.some(day => day.length >= 2)) return null;
  return canonicalItinerary({ destination, days, durationDays: requestedDays }, catalog, destination, requestedDays);
}

function suggestedQuestions(type, tours, itinerary, explicit = [], message = '') {
  if (Array.isArray(explicit)) {
    const questions = [...new Set(explicit.map(item => text(item, 100)).filter(Boolean))].slice(0, 3);
    if (questions.length) return questions;
  }
  if (itinerary) return ['Giảm ngân sách lịch trình', 'Thêm một địa điểm thiên nhiên', 'Tối ưu thứ tự di chuyển'];
  if (type === 'tour_recommendations' && !tours.length) return ['Thử điểm đến khác', 'Điều chỉnh số ngày hoặc ngân sách', 'Lập lịch trình riêng'];
  if (tours.length > 1) return ['So sánh các tour này', `Tạo lịch trình riêng tại ${tours[0].destination}`, 'Tour nào phù hợp ngân sách của tôi?'];
  if (tours.length === 1) return [`Xem chi tiết ${tours[0].name}`, 'Tạo lịch trình riêng', `Tìm dịch vụ xanh tại ${tours[0].destination}`];
  const intent = normalize(`${type} ${message}`);
  const place = String(message).match(/(?:tại|ở|đến)\s+([\p{L}][\p{L}\s-]{1,45}?)(?=\s+\d|[,!?;.]|$)/iu)?.[1]?.trim();
  if (/ngan sach|chi phi|gia|tiet kiem/.test(intent)) return ['Tìm tour trong ngân sách này', 'Tách chi phí theo ngày', 'Có dịch vụ nào giúp tiết kiệm hơn?'];
  if (/homestay|luu tru|khach san/.test(intent)) return [place ? `Tìm tour tại ${place}` : 'Tìm tour gần chỗ lưu trú', 'Gợi ý trải nghiệm xanh gần đây', 'So sánh các lựa chọn lưu trú'];
  if (/lich trinh|hanh trinh|ngay|tour/.test(intent)) return [place ? `Tìm tour tại ${place}` : 'So sánh tour theo số ngày', 'Tối ưu thời gian di chuyển', 'Tạo lịch trình theo sở thích'];
  if (place) return [`Tìm tour tại ${place}`, `Lập lịch trình ở ${place}`, 'Gợi ý hoạt động du lịch xanh'];
  if (/diem den|kham pha/.test(intent)) return ['Tìm tour tại một điểm đến cụ thể', 'So sánh điểm đến theo ngân sách', 'Lập lịch trình du lịch xanh'];
  return ['Tìm tour theo ngân sách của tôi', 'Khám phá một điểm đến xanh', 'Lập lịch trình nhiều ngày'];
}

function normalizeStructuredResponse(value, responseField, catalog, input) {
  const item = Array.isArray(value) && value.length === 1 ? value[0] : value;
  let raw = readPath(item, responseField);
  if (raw === undefined) raw = item;
  let structured = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  let reply = typeof raw === 'string' ? raw.trim() : '';
  if (!structured && reply.startsWith('{')) {
    try {
      const parsed = JSON.parse(reply);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) { structured = parsed; reply = ''; }
    } catch { /* Keep ordinary text responses unchanged. */ }
  }
  if (structured) reply = text(structured.message || structured.reply || structured.text, 32000);
  if (!reply && (Array.isArray(structured?.tours) || structured?.itinerary || structured?.itineraryDraft || structured?.plan)) {
    reply = Array.isArray(structured.tours) ? 'Mình đã tìm các tour phù hợp trong danh mục GreenSteps.' : 'Mình đã chuẩn bị phương án lịch trình để bạn xem lại.';
  }
  if (!reply) return null;

  const itineraryRequest = isItineraryRequest(input);
  const expectedDestination = itineraryRequest ? planDestination(input, catalog) : '';
  const rawPlan = structured?.itinerary || structured?.itineraryDraft || structured?.plan;
  const returnedDestination = text(rawPlan?.destination, 100) || inferDestination(reply, [], catalog);
  if (itineraryRequest && expectedDestination && returnedDestination
    && !sameDestination(expectedDestination, returnedDestination)) {
    return {
      reply: `Mình xin lỗi, phản hồi vừa rồi bị lẫn điểm đến nên mình chưa hiển thị lịch trình sai. Bạn gửi lại yêu cầu cho ${expectedDestination} để mình tạo lại nhé.`,
      type: 'text', tours: [], itinerary: null, totalTours: 0, hasMoreTours: false,
      catalogAvailable: Boolean(catalog?.available), suggestedQuestions: []
    };
  }

  const refs = Array.isArray(structured?.tours) ? structured.tours : [];
  const canonical = [];
  for (const ref of refs.slice(0, 9)) {
    const tour = resolveTour(ref, catalog);
    if (tour && !canonical.some(item => item.id === tour.id)) canonical.push(canonicalTour(tour));
  }
  if (!canonical.length && catalog?.available) {
    for (const tour of catalog.tours || []) {
      if (tour.title && normalize(reply).includes(normalize(tour.title)) && !canonical.some(item => item.id === tour.id)) canonical.push(canonicalTour(tour));
      if (canonical.length >= 6) break;
    }
  }

  const followUp = /so sanh|compare|tiet kiem hon|phu hop hon|tour nao/.test(normalize(input.message));
  if (followUp && Array.isArray(input.currentTours)) {
    for (const reference of input.currentTours.slice(0, 9)) {
      const tour = resolveTour(reference, catalog);
      if (tour && !canonical.some(item => item.id === tour.id)) canonical.push(canonicalTour(tour));
    }
  }

  const normalizedMessage = normalize(input.message);
  const explicitlyRequestsTour = /\btour\b/.test(normalizedMessage) && !itineraryRequest;
  const fallbackDestination = itineraryRequest ? planDestination(input, catalog) : inferDestination(input.message, input.history, catalog);
  const requestedDays = itineraryRequest ? planDurationDays(input) : 0;
  const itinerary = explicitlyRequestsTour ? null : canonicalItinerary(structured?.itinerary || structured?.itineraryDraft || structured?.plan, catalog, fallbackDestination, requestedDays)
    || parseTextItinerary(reply, input, catalog);
  const requestedType = text(structured?.type, 40);
  const requestedTours = ['tour_recommendations', 'tour_recommendation'].includes(requestedType);
  const tourIntent = /\btour\b|goi y|recommend/.test(normalize(input.message));
  const type = explicitlyRequestsTour ? 'tour_recommendations' : itinerary ? 'itinerary_proposal' : itineraryRequest ? 'text' : canonical.length || requestedTours || tourIntent ? 'tour_recommendations' : 'text';
  const responseTours = itineraryRequest ? [] : canonical;
  return {
    reply, type, tours: responseTours, itinerary,
    totalTours: responseTours.length, hasMoreTours: false, catalogAvailable: Boolean(catalog?.available),
    suggestedQuestions: suggestedQuestions(type, responseTours, itinerary, structured?.suggestedQuestions, input.message)
  };
}

module.exports = { canonicalTour, canonicalItinerary, normalizeStructuredResponse, suggestedQuestions, isItineraryRequest, isExplicitTourSearchRequest, itineraryClarification, itineraryContextHistory };
