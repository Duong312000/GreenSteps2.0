import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, fromEvent, takeUntil, timeout, TimeoutError } from 'rxjs';
import type { AIProvider, ChatMessage, Conversation, IConversationManager } from 'aura-ai-chat';
import type { ChatItineraryDraft, ChatProviderRequest, ChatTranscriptMessage, ChatTour, GreenStepsChatRequest, GreenStepsChatResponse, GreenStepsChatResult } from './greensteps-chat.types';

function normalizeChatIntent(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, character => character === 'đ' ? 'd' : 'D').toLowerCase();
}

function isExplicitItineraryRequest(message: string): boolean {
  const value = normalizeChatIntent(message);
  const hasPlanAction = /\b(?:lap|tao|len|xay dung|thiet ke|lam|sap xep|soan)\b/.test(value);
  const mentionsPlan = /\b(?:lich trinh|lap lich(?: trinh| di(?: choi)?)?|len lich(?: trinh| di(?: choi)?)?|lich di(?: choi)?|hanh trinh|ke hoach(?: du lich| chuyen di)?)\b/.test(value)
    || (hasPlanAction && /\b(?:tour|chuyen di)\b/.test(value));
  if (!mentionsPlan) return false;
  if (hasPlanAction) return true;
  const asksForPlan = /\b(?:goi y|de xuat|tu van|muon)\b/.test(value);
  const explicitlySearchesTours = /\btour\b/.test(value) && /\b(?:tim|goi y|de xuat|so sanh|chon|tu van|muon)\b/.test(value);
  return asksForPlan && !explicitlySearchesTours;
}

function explicitChatMessageIntent(message: string): 'itinerary' | 'tour_search' | '' {
  if (isExplicitItineraryRequest(message)) return 'itinerary';
  const value = normalizeChatIntent(message);
  return /\btour\b/.test(value) && /\b(?:tim|goi y|de xuat|so sanh|chon|tu van|muon)\b/.test(value)
    ? 'tour_search'
    : '';
}

function parseTextItinerary(reply: string, request: string): ChatItineraryDraft | null {
  const place = request.match(/(?:lịch trình|hành trình|tại|ở|đến)\s+([\p{L}][\p{L}\s'-]{1,55}?)(?=\s+\d{1,2}\s*(?:ngày|day|đêm|night)|[,!?;.]|$)/iu)?.[1]?.trim();
  if (!place || !/(?:lịch trình|hành trình|\bngày\s+\d)/iu.test(reply)) return null;

  const days: ChatItineraryDraft['days'] = [];
  let currentDay = -1;
  for (const line of reply.split(/\r?\n/).slice(0, 160)) {
    const heading = line.match(/^\s*(?:#{1,4}\s*)?(?:ngày|day)\s*(\d{1,2})\s*[:.\-–—]?/iu);
    if (heading) {
      currentDay = Number(heading[1]) - 1;
      if (currentDay >= 0 && currentDay < 14) days[currentDay] ??= [];
      else currentDay = -1;
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/u);
    if (!bullet) continue;
    if (currentDay < 0) { currentDay = 0; days[currentDay] ??= []; }
    const name = bullet[1].replace(/\*\*/g, '').trim().slice(0, 140);
    if (!name || days[currentDay].length >= 12) continue;
    days[currentDay].push({ name, time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null });
  }

  const populatedDays = days.filter(day => day?.length);
  if (!populatedDays.length || populatedDays.every(day => !day.length)) return null;
  const requestedDays = Number(normalizeChatIntent(request).match(/\b(\d{1,2})\s*(?:ngay|day)\b/)?.[1]) || 0;
  if (requestedDays && populatedDays.length < requestedDays) return null;
  return {
    name: `Lịch trình khám phá ${place}`,
    destination: place,
    startDate: null,
    endDate: null,
    days: populatedDays,
    estimatedCost: 0,
    assumptions: ['Các hoạt động trích từ câu trả lời AI; chưa xác minh với dịch vụ trong hệ thống.']
  };
}

@Injectable({ providedIn: 'root' })
export class GreenStepsChatService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:5055/api/support/chat'
    : 'https://greensteps-6swn.onrender.com/api/support/chat';
  // Memory only: opening/closing and routing never erase messages; reload starts
  // fresh. These interfaces can later be backed by authenticated MongoDB storage.
  private readonly conversations = new Map<string, Conversation>();
  private activeId: string = globalThis.crypto?.randomUUID?.() ?? `gs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  private readonly currentToursContext = signal<ChatTour[]>([]);
  private activeRequest: AbortController | null = null;
  private submitting = false;
  readonly isSending = signal(false);
  readonly connectionError = signal<string | null>(null);
  readonly latestResult = signal<GreenStepsChatResult | null>(null);
  readonly currentItinerary = signal<ChatItineraryDraft | null>(null);
  readonly lastMessage = signal('');
  readonly transcript = signal<ChatTranscriptMessage[]>([]);
  private previousItinerary: ChatItineraryDraft | null = null;

  readonly conversationManager: IConversationManager = {
    createConversation: async conversation => {
      this.activeId = conversation.id;
      this.conversations.set(conversation.id, structuredClone(conversation));
      return structuredClone(conversation);
    },
    loadConversation: async id => {
      this.activeId = id;
      return structuredClone(this.conversations.get(id) ?? null);
    },
    listConversations: async () => structuredClone([...this.conversations.values()]),
    saveMessage: async (id, message) => {
      this.activeId = id;
      const conversation = this.conversations.get(id) ?? { id, title: 'Hội thoại GreenSteps', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
      const index = conversation.messages.findIndex(item => item.id === message.id);
      if (index < 0) conversation.messages.push(structuredClone(message));
      else conversation.messages[index] = structuredClone(message);
      if (message.role === 'user' && conversation.title === 'Hội thoại GreenSteps') {
        conversation.title = message.content.trim().slice(0, 48) || 'Hội thoại GreenSteps';
      }
      conversation.updatedAt = Date.now();
      this.conversations.set(id, conversation);
    },
    deleteConversation: async id => { this.conversations.delete(id); },
    clearHistory: async () => { this.conversations.clear(); }
  };

  // Provider/manager methods close over the Angular service. No HttpClient or DI
  // objects are exposed on config: Aura serializes agent configuration internally.
  readonly provider: AIProvider = {
    id: 'greensteps-n8n', label: 'GreenSteps AI', icon: 'eco', type: 'greensteps',
    configure: () => {}, getConfig: () => ({}),
    listModels: async () => [{ id: 'greensteps-agent', name: 'GreenSteps AI' }],
    sendMessages: request => this.send(request)
  };

  async sendMessage(rawMessage: string): Promise<void> {
    const message = rawMessage.trim();
    if (!message || message.length > 4000) {
      const error = new Error('Vui lòng nhập câu hỏi từ 1 đến 4.000 ký tự.');
      this.connectionError.set(error.message);
      throw error;
    }
    if (this.submitting || this.isSending()) return;

    this.submitting = true;
    this.isSending.set(true);
    const last = this.transcript().at(-1);
    const retryingLastMessage = Boolean(this.connectionError() && last?.role === 'user' && last.content === message);
    const controller = new AbortController();
    this.activeRequest = controller;

    try {
      if (!retryingLastMessage) {
        const userMessage: ChatTranscriptMessage = {
          id: this.messageId(), role: 'user', content: message, createdAt: Date.now()
        };
        this.transcript.update(items => [...items, userMessage]);
        await this.conversationManager.saveMessage(this.activeId, this.toChatMessage(userMessage));
      }

      const response = await this.send({
        messages: [{ role: 'user', content: message }],
        options: { signal: controller.signal }
      }, false);
      const result = this.latestResult();
      const assistantMessage: ChatTranscriptMessage = {
        id: this.messageId(), role: 'assistant',
        content: response.content || result?.reply || 'Mình chưa nhận được câu trả lời. Bạn hãy thử lại nhé.',
        ...(result ? { result: structuredClone(result) } : {}),
        createdAt: Date.now()
      };
      this.transcript.update(items => [...items, assistantMessage]);
      await this.conversationManager.saveMessage(this.activeId, this.toChatMessage(assistantMessage));
    } catch (error: unknown) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      throw error;
    } finally {
      if (this.activeRequest === controller) this.activeRequest = null;
      this.isSending.set(false);
      this.submitting = false;
    }
  }

  cancelMessage(): void {
    this.activeRequest?.abort();
  }

  async startNewConversation(): Promise<void> {
    if (this.isSending()) return;
    this.activeId = globalThis.crypto?.randomUUID?.() ?? `gs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.transcript.set([]);
    this.latestResult.set(null);
    this.currentToursContext.set([]);
    this.currentItinerary.set(null);
    this.connectionError.set(null);
    this.lastMessage.set('');
    this.previousItinerary = null;
  }

  async loadConversation(id: string): Promise<void> {
    if (this.isSending()) return;
    this.activeId = id;
    const conversation = this.conversations.get(id) ?? null;
    const messages = (conversation?.messages ?? [])
      .filter(message => this.visibleMessage(message))
      .map(message => this.toTranscriptMessage(message));
    this.transcript.set(messages);
    this.latestResult.set([...messages].reverse().find(message => message.result)?.result ?? null);
    this.currentToursContext.set(
      [...messages].reverse().find(message => message.result?.type === 'tour_recommendations')?.result?.tours.slice(0, 9) ?? []
    );
    this.currentItinerary.set(
      [...messages].reverse().find(message => message.result?.itinerary)?.result?.itinerary ?? null
    );
    this.connectionError.set(null);
    this.lastMessage.set([...messages].reverse().find(message => message.role === 'user')?.content ?? '');
    this.previousItinerary = null;
  }

  async listConversations(): Promise<Conversation[]> {
    return [...this.conversations.values()]
      .map(conversation => structuredClone(conversation))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private messageId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private toChatMessage(message: ChatTranscriptMessage): ChatMessage {
    return {
      id: message.id, role: message.role, content: message.content, timestamp: message.createdAt,
      ...(message.result ? { metadata: { greenStepsResult: structuredClone(message.result) } } : {})
    };
  }

  private toTranscriptMessage(message: ChatMessage): ChatTranscriptMessage {
    const result = message.metadata?.['greenStepsResult'];
    return {
      id: message.id, role: message.role as 'user' | 'assistant', content: message.content,
      createdAt: message.timestamp,
      ...(result && typeof result === 'object' ? { result: structuredClone(result as GreenStepsChatResult) } : {})
    };
  }

  private visibleMessage(message: ChatMessage): boolean {
    return ['user', 'assistant'].includes(message.role) && !message.metadata?.['isIteration'] && message.metadata?.['type'] !== 'error';
  }

  private async send(request: ChatProviderRequest, manageSendingState = true): ReturnType<AIProvider['sendMessages']> {
    const message = request.messages.filter(item => item.role === 'user').at(-1)?.content.trim();
    if (!message || message.length > 4000) throw new Error('Vui lòng nhập câu hỏi từ 1 đến 4.000 ký tự.');
    const abort = request.options?.signal;
    if (abort?.aborted) throw new DOMException('Yêu cầu đã dừng.', 'AbortError');
    const saved = this.conversations.get(this.activeId)?.messages ?? [];
    const history = saved.filter(item => this.visibleMessage(item));
    if (history.at(-1)?.role === 'user' && history.at(-1)?.content === message) history.pop();
    const body: GreenStepsChatRequest = {
      message, sessionId: this.activeId,
      history: history.slice(-6).map(item => ({ role: item.role as 'user' | 'assistant', content: item.content.slice(0, 1000) })),
      plannerState: this.currentItinerary(),
      currentTours: this.currentToursContext().slice(0, 9)
    };
    while (JSON.stringify(body.history).length > 60000) body.history.shift();
    if (manageSendingState) this.isSending.set(true);
    this.lastMessage.set(message);
    this.connectionError.set(null);
    const started = performance.now();
    let status = 0;
    try {
      const pending = this.http.post<GreenStepsChatResponse>(this.endpoint, body, { observe: 'response' }).pipe(timeout(50000));
      const result = await firstValueFrom(abort ? pending.pipe(takeUntil(fromEvent(abort, 'abort'))) : pending);
      status = result.status;
      const response = result.body;
      if (!response) throw new Error('Trợ lý chưa gửi được câu trả lời.');
      if (!response.success || typeof response.reply !== 'string' || !response.reply.trim()) throw new Error('Trợ lý chưa gửi được câu trả lời. Vui lòng thử lại.');
      const tours = Array.isArray(response.tours) ? response.tours : [];
      const normalizedMessage = normalizeChatIntent(message);
      const currentItineraryRequest = isExplicitItineraryRequest(message);
      const previousAssistantText = [...body.history].reverse().find(item => item.role === 'assistant')?.content || '';
      const previousIntent = [...body.history].reverse()
        .filter(item => item.role === 'user')
        .map(item => explicitChatMessageIntent(item.content))
        .find(intent => intent !== '') || '';
      const previousItineraryRequest = previousIntent === 'itinerary';
      const isItineraryClarification = /ban muon lap lich trinh o dau|ban muon den diem den nao|chon mot diem den|chon thoi luong/.test(normalizeChatIntent(previousAssistantText));
      const answersDuration = /\b\d{1,2}\s*(?:ngay|day|dem|night)\b/.test(normalizedMessage);
      const explicitlyRequestsItinerary = currentItineraryRequest || (previousItineraryRequest && (isItineraryClarification || answersDuration));
      const explicitlyRequestsTour = /\btour\b/.test(normalizedMessage) && !explicitlyRequestsItinerary;
      const isTourResponse = tours.length > 0 || response.type === 'tour_recommendation' || response.type === 'tour_recommendations';
      const showClarification = response.type === 'clarification';
      const isItineraryResponse = response.type === 'itinerary_proposal' || Boolean(response.itinerary);
      const showTourResult = !showClarification && !explicitlyRequestsItinerary && !isItineraryResponse && (explicitlyRequestsTour || isTourResponse);
      const itinerary = showTourResult || showClarification ? null : response.itinerary || parseTextItinerary(response.reply, message);
      const totalTours = Math.max(tours.length, Number(response.totalTours) || tours.length);
      const type: GreenStepsChatResult['type'] = showTourResult
        ? 'tour_recommendations'
        : showClarification ? 'clarification'
          : itinerary || isItineraryResponse ? 'itinerary_proposal' : 'text';
      const displayReply = showTourResult
        ? tours.length
          ? `M\u00ecnh t\u00ecm th\u1ea5y ${totalTours} tour ph\u00f9 h\u1ee3p v\u1edbi b\u1ea1n:`
          : 'M\u00ecnh ch\u01b0a t\u00ecm th\u1ea5y tour ph\u00f9 h\u1ee3p trong danh m\u1ee5c hi\u1ec7n c\u00f3.'
        : showClarification ? response.reply
        : itinerary
        ? `Mình đã chuẩn bị phương án ${itinerary.destination} · ${itinerary.days.length} ngày. Bạn có thể xem tóm tắt, điều chỉnh hoặc yêu cầu GreenSteps lưu vào lịch trình của mình.`
        : response.reply;
      if (itinerary) {
        this.previousItinerary = this.currentItinerary();
        this.currentItinerary.set(itinerary);
      }
      if (type === 'tour_recommendations') this.currentToursContext.set(tours.slice(0, 9));
      else if (explicitlyRequestsItinerary || type === 'clarification' || type === 'itinerary_proposal') this.currentToursContext.set([]);
      this.latestResult.set({
        reply: displayReply,
        type,
        tours,
        totalTours,
        hasMoreTours: response.hasMoreTours ?? totalTours > tours.length,
        catalogAvailable: response.catalogAvailable ?? tours.length > 0,
        itinerary,
        suggestedQuestions: (showTourResult ? [] : response.suggestedQuestions || (itinerary
          ? ['Giảm ngân sách lịch trình', 'Thêm địa điểm thiên nhiên', 'Điều chỉnh thời gian di chuyển']
          : [])).slice(0, 3)
      });
      return { content: displayReply, toolCalls: [] };
    } catch (error: unknown) {
      status = error instanceof HttpErrorResponse ? error.status : status;
      if (abort?.aborted) throw new DOMException('Yêu cầu đã dừng.', 'AbortError');
      const fallback = error instanceof TimeoutError
        ? 'Trợ lý chưa trả lời kịp. Bạn có thể hỏi ngắn hơn hoặc tìm tour, dịch vụ trực tiếp.'
        : 'Chưa kết nối được GreenSteps AI. Bạn hãy thử lại sau nhé.';
      const detail: unknown = error instanceof HttpErrorResponse ? error.error : null;
      const text = detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string'
        ? detail.message : fallback;
      this.connectionError.set(text);
      throw new Error(text);
    } finally {
      console.info('[GreenSteps chat performance]', { frontendExpressMs: Math.round(performance.now() - started), status });
      if (manageSendingState) this.isSending.set(false);
    }
  }

  undoItineraryEdit(): boolean {
    if (!this.previousItinerary) return false;
    const current = this.currentItinerary();
    this.currentItinerary.set(this.previousItinerary);
    this.previousItinerary = current;
    return true;
  }
}
