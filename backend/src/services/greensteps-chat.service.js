const { createCatalogLoader, queryFromRequest } = require('./greensteps-agent-catalog.service');
const { fixedReply, isCatalogDependentRequest, isExplicitCatalogSearchRequest, catalogReply, tourDiscoveryReply, destinationChoiceClarification, routeConflictClarification, destinationCorrectionClarification, compactAiInput } = require('./greensteps-chat-fast-path.service');
const { canonicalTour, normalizeStructuredResponse, suggestedQuestions, isItineraryRequest, isExplicitTourSearchRequest, itineraryClarification, itineraryContextHistory } = require('./greensteps-chat-structured.service');
const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const fail = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code });
const normalizePlace = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();

function validateChatInput(body) {
  if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) {
    throw fail('Vui lòng nhập câu hỏi từ 1 đến 4.000 ký tự.', 400, 'CHAT_INPUT_INVALID');
  }
  if (typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(body.sessionId)) {
    throw fail('Phiên hội thoại không hợp lệ. Vui lòng tải lại trang.', 400, 'CHAT_SESSION_INVALID');
  }
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 40 || history.some(item =>
    !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length > 8000
  ) || JSON.stringify(history).length > 64000) {
    throw fail('Lịch sử hội thoại không hợp lệ hoặc quá dài.', 400, 'CHAT_HISTORY_INVALID');
  }
  const result = { message: body.message.trim(), sessionId: body.sessionId, history: history.map(({ role, content }) => ({ role, content })) };
  if (Number.isInteger(body.catalogPage) && body.catalogPage > 0) result.catalogPage = Math.min(body.catalogPage, 10000);
  if (Array.isArray(body.currentTours)) {
    result.currentTours = body.currentTours.slice(0, 9).map(tour => ({ id: typeof tour?.id === 'string' ? tour.id.slice(0, 80) : '' })).filter(tour => tour.id);
  }
  const planner = body.plannerState;
  if (planner && typeof planner === 'object' && !Array.isArray(planner)) {
    const days = Array.isArray(planner.days) ? planner.days.slice(0, 14).map(day => (Array.isArray(day) ? day : []).slice(0, 12).map(item => ({
      name: typeof item?.name === 'string' ? item.name.slice(0, 140) : '',
      time: typeof item?.time === 'string' ? item.time.slice(0, 8) : '08:00',
      cost: Number.isFinite(Number(item?.cost)) ? Math.max(0, Number(item.cost)) : 0,
      verified: item?.verified === true
    })).filter(item => item.name)) : [];
    if (typeof planner.destination === 'string' && days.length) {
      result.plannerState = { destination: planner.destination.slice(0, 100), name: typeof planner.name === 'string' ? planner.name.slice(0, 120) : '', days };
    }
  }
  return result;
}

function readChatConfig(env = process.env) {
  const { N8N_WEBHOOK_URL: url, N8N_AUTH_HEADER_NAME: headerName, N8N_AUTH_HEADER_VALUE: headerValue } = env;
  if (!url || !headerName || !headerValue) throw fail('Trợ lý AI chưa sẵn sàng. Vui lòng thử lại sau.', 503, 'CHAT_NOT_CONFIGURED');
  let endpoint;
  try { endpoint = new URL(url); } catch { throw fail('Trợ lý AI đang bảo trì. Vui lòng thử lại sau.', 503, 'CHAT_NOT_CONFIGURED'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if ((endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) || endpoint.username || endpoint.password || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(headerName) || /[\r\n]/.test(headerValue) || ['host', 'content-length', 'connection', 'content-type'].includes(headerName.toLowerCase())) {
    throw fail('Trợ lý AI đang bảo trì. Vui lòng thử lại sau.', 503, 'CHAT_NOT_CONFIGURED');
  }
  const configuredTimeout = Number(env.N8N_CHAT_TIMEOUT_MS || 35000);
  return {
    url: endpoint.href, headerName, headerValue,
    timeout: Number.isFinite(configuredTimeout) ? Math.min(45000, Math.max(1000, configuredTimeout)) : 35000,
    responseField: env.N8N_RESPONSE_FIELD || 'output'
  };
}

// The workflow contract is explicit and configurable, rather than guessing which
// arbitrary upstream fields might contain assistant text. n8n may wrap one item.
function normalizeChatResponse(value, responseField = 'output') {
  const item = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (item?.code === 'CHAT_ITERATION_LIMIT') throw fail('Trợ lý đã dùng hết lượt xử lý mà chưa hoàn tất câu trả lời. Bạn hãy chia yêu cầu thành từng phần nhỏ hơn nhé.', 502, 'CHAT_ITERATION_LIMIT');
  if (item?.success === false) throw fail('Trợ lý chưa tạo được câu trả lời. Vui lòng thử lại.', 502, 'CHAT_RESPONSE_INVALID');
  const fields = responseField.split('.');
  if (fields.some(field => !/^[a-zA-Z0-9_-]+$/.test(field) || ['__proto__', 'constructor', 'prototype'].includes(field))) {
    throw fail('Trợ lý AI chưa sẵn sàng. Vui lòng thử lại sau.', 503, 'CHAT_NOT_CONFIGURED');
  }
  let reply = item;
  for (const field of fields) reply = reply && typeof reply === 'object' && Object.hasOwn(reply, field) ? reply[field] : undefined;
  if (typeof reply === 'string' && /^Agent stopped due to max iterations\.?$/i.test(reply.trim())) {
    throw fail('Trợ lý đã dùng hết lượt xử lý mà chưa hoàn tất câu trả lời. Bạn hãy chia yêu cầu thành từng phần nhỏ hơn nhé.', 502, 'CHAT_ITERATION_LIMIT');
  }
  if (typeof reply !== 'string' || !reply.trim() || reply.length > 32000) {
    throw fail('Trợ lý chưa gửi được câu trả lời hợp lệ. Vui lòng thử lại.', 502, 'CHAT_RESPONSE_INVALID');
  }
  return reply.trim();
}

function catalogPageMetadata(catalog) {
  return {
    catalogPage: catalog.page,
    catalogPageSize: catalog.pageSize,
    nextCatalogPage: catalog.nextPage,
    hasMoreTours: Boolean(catalog.truncatedTours),
    hasMoreServices: Boolean(catalog.truncatedServices)
  };
}

async function readResponse(response) {
  // Bound upstream output before parsing it; do not expose raw n8n errors/HTML.
  const reader = response.body?.getReader();
  if (!reader) throw fail('Trợ lý chưa gửi được câu trả lời. Vui lòng thử lại.', 502, 'CHAT_RESPONSE_INVALID');
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 256000) throw fail('Câu trả lời quá dài. Hãy thử một câu hỏi cụ thể hơn.', 502, 'CHAT_RESPONSE_INVALID');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(text); }
  catch { throw fail('Trợ lý chưa gửi được câu trả lời hợp lệ. Vui lòng thử lại.', 502, 'CHAT_RESPONSE_INVALID'); }
}

function createChatAdapter({ env = process.env, fetchImpl = global.fetch, models } = {}) {
  const loadCatalog = createCatalogLoader({ env, models });
  return async function send(input, { signal, metrics = {} } = {}) {
    if (signal?.aborted) throw fail('Yêu cầu đã được dừng.', 499, 'CHAT_CANCELLED');
    metrics.path = 'fast';
    metrics.catalogMs = 0;
    metrics.n8nMs = 0;
    const greeting = fixedReply(input.message);
    if (greeting) {
      metrics.intent = 'fixed';
      return { success: true, reply: greeting, type: 'text', tours: [], itinerary: null, suggestedQuestions: suggestedQuestions('text', [], null), sessionId: input.sessionId };
    }
    const configured = Number(env.N8N_CHAT_TIMEOUT_MS || 35000);
    const deadline = Number.isFinite(configured) ? Math.min(45000, Math.max(1000, configured)) : 35000;
    const abort = AbortSignal.timeout(deadline);
    const requestSignal = signal ? AbortSignal.any([signal, abort]) : abort;
    try {
      const catalogStart = performance.now();
      const itineraryIntent = isItineraryRequest(input);
      const catalogQuery = queryFromRequest(input);
      const catalog = await loadCatalog({
        query: catalogQuery, signal: requestSignal,
        includeServiceCandidates: itineraryIntent
      });
      metrics.catalogMs = Math.round((performance.now() - catalogStart) * 100) / 100;
      requestSignal.throwIfAborted();
      const requestIntent = itineraryIntent ? 'itinerary' : isExplicitTourSearchRequest(input) ? 'tour_search' : 'general';
      const catalogRequired = itineraryIntent || isCatalogDependentRequest(input.message);
      if (catalogRequired && !catalog.available) {
        throw fail('Danh mục du lịch GreenSteps hiện chưa truy cập được. Mình chưa thể xác minh tour, dịch vụ hoặc giá; vui lòng thử lại sau.', 503, 'CHAT_CATALOG_UNAVAILABLE');
      }
      const destinationClarification = destinationChoiceClarification(input.message, catalog);
      if (destinationClarification) {
        metrics.path = 'clarification';
        metrics.intent = destinationClarification.intent;
        return {
          success: true, reply: destinationClarification.reply, type: destinationClarification.type,
          tours: [], itinerary: null, totalTours: 0, hasMoreTours: false, catalogAvailable: true,
          ...catalogPageMetadata(catalog), suggestedQuestions: destinationClarification.suggestedQuestions,
          sessionId: input.sessionId
        };
      }
      let correctionCatalog = catalog;
      const requestedPlace = normalizePlace(catalogQuery.destination);
      const destinationKnownOnFilteredPage = [...(catalog.tours || []), ...(catalog.services || [])]
        .some(row => normalizePlace(row.destination) === requestedPlace);
      if (catalog.available && requestedPlace && !destinationKnownOnFilteredPage) {
        const broadStart = performance.now();
        correctionCatalog = await loadCatalog({ query: { page: 1, pageSize: 20 }, signal: requestSignal });
        metrics.catalogMs = Math.round((metrics.catalogMs + performance.now() - broadStart) * 100) / 100;
      }
      const routeConflict = routeConflictClarification(input.message, correctionCatalog);
      if (routeConflict) {
        metrics.path = 'clarification';
        metrics.intent = routeConflict.intent;
        return { success: true, ...routeConflict, ...catalogPageMetadata(catalog), sessionId: input.sessionId };
      }
      const destinationCorrection = destinationCorrectionClarification(input.message, correctionCatalog);
      if (destinationCorrection) {
        metrics.path = 'clarification';
        metrics.intent = destinationCorrection.intent;
        return {
          success: true, reply: destinationCorrection.reply, type: destinationCorrection.type,
          tours: [], itinerary: null, totalTours: 0, hasMoreTours: false, catalogAvailable: true,
          ...catalogPageMetadata(catalog), suggestedQuestions: destinationCorrection.suggestedQuestions,
          sessionId: input.sessionId
        };
      }
      const clarification = itineraryClarification(input, catalog);
      if (clarification) {
        metrics.path = 'clarification';
        metrics.intent = 'itinerary_missing_information';
        return {
          success: true, reply: clarification.reply, type: 'clarification', tours: [], itinerary: null,
          totalTours: 0, hasMoreTours: false, catalogAvailable: Boolean(catalog?.available),
          ...catalogPageMetadata(catalog),
          suggestedQuestions: clarification.suggestedQuestions.slice(0, 3), sessionId: input.sessionId
        };
      }
      const catalogFastReply = catalogReply(input.message, catalog);
      const discoveryReply = !itineraryIntent ? tourDiscoveryReply(input.message, catalog) : null;
      if (discoveryReply) {
        metrics.intent = discoveryReply.intent;
        return {
          success: true, reply: discoveryReply.reply, type: discoveryReply.type,
          tours: discoveryReply.tours.map(canonicalTour), itinerary: null,
          totalTours: discoveryReply.totalTours, hasMoreTours: discoveryReply.hasMoreTours,
          catalogAvailable: true, ...catalogPageMetadata(catalog),
          suggestedQuestions: discoveryReply.suggestedQuestions, sessionId: input.sessionId
        };
      }
      if (!itineraryIntent && !catalogFastReply && isExplicitCatalogSearchRequest(input.message)) {
        const tourSearch = /\b(?:tour)\b/i.test(input.message.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        const rows = tourSearch ? catalog.tours : catalog.services;
        const shown = rows.slice(0, 6);
        const kind = tourSearch ? 'tour' : 'dịch vụ';
        const reply = shown.length
          ? `${shown.map(row => `- ${row.title || row.name} (mã ${row.id})${row.destination ? ` — ${row.destination}` : ''}${typeof row.cost === 'number' ? `: ${new Intl.NumberFormat('vi-VN').format(row.cost)} đ` : ': chưa có giá'}.`).join('\n')}\nKết quả lấy từ danh mục GreenSteps hiện có.${catalog.truncated ? ' Danh mục bị giới hạn, có thể còn kết quả khác.' : ''}`
          : `Chưa tìm thấy ${kind} phù hợp trong danh mục GreenSteps hiện có.${catalog.truncated ? ' Danh mục bị giới hạn, có thể còn kết quả khác.' : ''}`;
        metrics.intent = tourSearch ? 'tour_search' : 'service_search';
        return {
          success: true, reply, type: tourSearch ? 'tour_recommendations' : 'text',
          tours: tourSearch ? shown.map(canonicalTour) : [], itinerary: null,
          totalTours: tourSearch ? rows.length : 0, hasMoreTours: tourSearch && Boolean(catalog.truncatedTours),
          catalogAvailable: true, ...catalogPageMetadata(catalog),
          suggestedQuestions: suggestedQuestions(tourSearch ? 'tours' : 'services', rows, null),
          sessionId: input.sessionId
        };
      }
      // Recommendations must be selected by the n8n agent so its answer and
      // the cards shown to the user come from the same decision. We still use
      // the local fast path for exact catalog lookups such as prices/services.
      const fast = itineraryIntent || catalogFastReply?.intent === 'tours' ? null : catalogFastReply;
      if (fast) {
        metrics.intent = fast.intent;
        return {
          success: true, reply: fast.reply, type: fast.type || 'text',
          tours: (fast.tours || []).map(canonicalTour), itinerary: null,
          totalTours: fast.totalTours ?? (fast.tours || []).length,
          hasMoreTours: Boolean(fast.hasMoreTours), catalogAvailable: fast.catalogAvailable ?? catalog.available,
          ...catalogPageMetadata(catalog),
          suggestedQuestions: fast.suggestedQuestions || suggestedQuestions(fast.intent, fast.tours || [], null),
          sessionId: input.sessionId
        };
      }
      metrics.path = 'ai';
      const config = readChatConfig(env);
      const intentPrefix = requestIntent === 'itinerary'
        ? '[Backend intent: CUSTOM_ITINERARY. Create a personal day-by-day plan; do not recommend package tours. User request: '
        : requestIntent === 'tour_search'
          ? '[Backend intent: TOUR_SEARCH. Find suitable tours from the supplied catalog. User request: '
          : '';
      // Keep n8n conversation memory isolated from unrelated older requests.
      // Relevant itinerary follow-up history is already included explicitly below.
      const agentSessionId = itineraryIntent
        ? `${input.sessionId.slice(0, 68)}_plan_${randomUUID()}`
        : input.sessionId;
      const aiRequest = {
        ...input, sessionId: agentSessionId, requestIntent,
        message: intentPrefix ? `${intentPrefix}${input.message.slice(0, 3999 - intentPrefix.length)}]` : input.message,
        ...(itineraryIntent ? { history: itineraryContextHistory(input), currentTours: [], plannerState: null } : {})
      };
      const compact = compactAiInput(aiRequest, catalog);
      const { catalog: aiCatalog, ...aiInput } = compact;
      const upstreamStart = performance.now();
      try {
        const response = await fetchImpl(config.url, {
          method: 'POST', redirect: 'error',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', [config.headerName]: config.headerValue },
          body: JSON.stringify({
            ...aiInput, chatInput: input.message,
            context: {
              site: 'GreenSteps', locale: 'vi-VN', catalog: aiCatalog,
              requestIntent,
              currentTourRecommendations: aiInput.currentTours || [],
              currentItinerary: aiInput.plannerState || null,
              uiResponseContract: 'Backend requestIntent=itinerary has strict priority: create a custom itinerary, never switch to catalog tour recommendations because the user mentions budget, dates, or destination. If destination or duration is missing, ask only for the missing detail and do not return tours. When complete, return type="itinerary_proposal" with itinerary {name,destination,durationDays,days:[{activities:[{name,time,serviceId}]}],assumptions}; preserve the requested number of days exactly. Return a verified service with its exact string ID from context.catalog.serviceCandidates as serviceId. For a free-form suggested activity omit serviceId or set it to null. Never represent a service by name alone. Backend verification requires an active candidate ID and matching destination, and replaces service name, cost, carbon, type, and ID with catalog data. Unknown IDs stay unverified suggestions. Tour cards are only for an explicit request to find, suggest, or compare package tours without a custom itinerary request. For tour searches return type="tour_recommendations" and tours as IDs from the supplied catalog; never invent tour IDs, prices, images, labels, or availability. Use only context.catalog entries as verified GreenSteps data. Never invent names, IDs, prices, images, labels, carbon, or availability. Other activities are reference suggestions and must be labeled unverified with no GreenSteps price, service ID, carbon figure, or availability claim. If catalog.available is false, do not answer GreenSteps business facts. For ordinary chat return type="text". Include up to three contextual suggestedQuestions.'
            }
          }),
          signal: requestSignal
        });
        metrics.upstreamStatus = response.status;
        if (!response.ok) {
          await response.body?.cancel();
          const unavailable = [401, 403, 404, 429, 503].includes(response.status);
          throw fail('Trợ lý AI tạm thời chưa kết nối được. Bạn hãy thử lại sau nhé.', unavailable ? 503 : 502, 'CHAT_UPSTREAM_UNAVAILABLE');
        }
        const data = await readResponse(response);
        const item = Array.isArray(data) && data.length === 1 ? data[0] : data;
        if (typeof item?.performance?.agentMs === 'number' && Number.isFinite(item.performance.agentMs) && item.performance.agentMs >= 0 && item.performance.agentMs <= 300000) metrics.agentMs = item.performance.agentMs;
        const structured = normalizeStructuredResponse(data, config.responseField, catalog, input);
        if (!structured) normalizeChatResponse(data, config.responseField);
        return { success: true, ...structured, ...catalogPageMetadata(catalog), sessionId: input.sessionId };
      } finally { metrics.n8nMs = Math.round((performance.now() - upstreamStart) * 100) / 100; }
    } catch (error) {
      if (error.statusCode) throw error;
      if (abort.aborted) throw fail('Trợ lý chưa trả lời kịp. Bạn có thể hỏi ngắn hơn hoặc tìm tour, dịch vụ trực tiếp trong lúc chờ.', 504, 'CHAT_TIMEOUT');
      if (signal?.aborted) throw fail('Yêu cầu đã được dừng.', 499, 'CHAT_CANCELLED');
      throw fail('Chưa kết nối được trợ lý AI. Vui lòng thử lại sau.', 502, 'CHAT_NETWORK_ERROR');
    }
  };
}
module.exports = { validateChatInput, normalizeChatResponse, readChatConfig, createChatAdapter };
