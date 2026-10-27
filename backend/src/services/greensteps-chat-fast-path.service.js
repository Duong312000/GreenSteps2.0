// Deliberately small grammar: unknown qualifiers and contextual follow-ups go to AI.
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
  const compact = row => ({ ...row, description: row.description?.slice(0, 120), tags: undefined });
  const tours = catalog.tours.filter(relevant), services = catalog.services.filter(relevant);
  const selectedIds = new Set((input.currentTours || []).map(tour => tour.id));
  const currentTours = catalog.tours.filter(tour => selectedIds.has(tour.id)).slice(0, 9).map(tour => ({
    id: tour.id, title: tour.title, destination: tour.destination, days: tour.days, cost: tour.cost
  }));
  return {
    ...input, currentTours, history: input.history.slice(-6).map(item => ({ role: item.role, content: item.content.slice(0, 1000) })),
    catalog: { ...catalog, tours: tours.slice(0, 12).map(compact), services: services.slice(0, 16).map(compact), truncated: Boolean(catalog.truncated || places.length || tours.length > 12 || services.length > 16) }
  };
}

module.exports = { fixedReply, catalogReply, compactAiInput };
