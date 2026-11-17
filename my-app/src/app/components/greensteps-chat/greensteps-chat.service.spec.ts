import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ChatTour, GreenStepsChatResponse } from './greensteps-chat.types';
import { GreenStepsChatService } from './greensteps-chat.service';

const tour: ChatTour = {
  id: 'tour-live-1', name: 'Đà Lạt xanh', destination: 'Đà Lạt', durationDays: 3, durationNights: 2,
  price: 3200000, currency: 'VND', imageUrl: '/images/dalat.jpg', highlights: [], ecoLabels: [],
  bookingAvailable: false
};

function tourReply(sessionId: string): GreenStepsChatResponse {
  return {
    success: true, reply: 'Mình tìm thấy tour thật trong danh mục.', sessionId,
    type: 'tour_recommendations', tours: [tour], totalTours: 1, hasMoreTours: false,
    catalogAvailable: true, suggestedQuestions: ['So sánh các tour này']
  };
}

async function expectChatRequest(http: HttpTestingController) {
  await Promise.resolve();
  const access = http.expectOne(candidate => candidate.url.endsWith('/api/support/chat-access'));
  expect(access.request.method).toBe('POST');
  access.flush({ success: true, webhookUrl: 'https://n8n.example.test/webhook/greensteps', token: 'short-lived-test-token', expiresIn: 120 });
  await Promise.resolve();
  await Promise.resolve();
  return http.expectOne('https://n8n.example.test/webhook/greensteps');
}

describe('GreenStepsChatService transcript operations', () => {
  let chat: GreenStepsChatService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    chat = TestBed.inject(GreenStepsChatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends a three-day Đà Lạt tour search directly to n8n with the short-lived Bearer token', async () => {
    const pending = chat.sendMessage('Tìm tour 3 ngày 2 đêm Đà Lạt');
    await Promise.resolve();
    const access = http.expectOne(candidate => candidate.url.endsWith('/api/support/chat-access'));
    expect(access.request.body).toEqual({});
    access.flush({ success: true, webhookUrl: 'https://n8n.example.test/webhook/greensteps', token: 'short-lived-test-token', expiresIn: 120 });
    await Promise.resolve();
    await Promise.resolve();

    const request = http.expectOne('https://n8n.example.test/webhook/greensteps');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer short-lived-test-token');
    expect(request.request.body.message).toBe('Tìm tour 3 ngày 2 đêm Đà Lạt');
    expect(request.request.body.requestIntent).toBe('tour_search');
    expect(request.request.body.catalogDestination).toBe('Đà Lạt');
    request.flush([tourReply(request.request.body.sessionId)]);
    await pending;

    expect(chat.latestResult()?.tours[0].id).toBe('tour-live-1');
  });

  it('stores the structured recommendation on the assistant turn', async () => {
    expect(typeof chat.sendMessage).toBe('function');
    expect(typeof chat.transcript).toBe('function');

    const pending = chat.sendMessage('Gợi ý tour Đà Lạt 3 ngày 2 đêm');
    const request = await expectChatRequest(http);
    request.flush(tourReply(request.request.body.sessionId));
    await pending;

    expect(chat.transcript().map(message => [message.role, message.content])).toEqual([
      ['user', 'Gợi ý tour Đà Lạt 3 ngày 2 đêm'],
      ['assistant', 'Mình tìm thấy 1 tour phù hợp với bạn:']
    ]);
    expect(chat.transcript()[1].result?.tours[0].id).toBe('tour-live-1');
    expect(request.request.body.sessionId).toMatch(/^[a-zA-Z0-9_-]{8,128}$/);
  });

  it('keeps prior turns and sends only current catalog tour IDs as follow-up context', async () => {
    expect(typeof chat.sendMessage).toBe('function');

    const first = chat.sendMessage('Tìm tour Đà Lạt');
    const firstRequest = await expectChatRequest(http);
    const sessionId = firstRequest.request.body.sessionId;
    firstRequest.flush(tourReply(sessionId));
    await first;

    const second = chat.sendMessage('So sánh các tour này');
    const secondRequest = await expectChatRequest(http);
    expect(secondRequest.request.body.sessionId).toBe(sessionId);
    expect(secondRequest.request.body.history).toEqual([
      { role: 'user', content: 'Tìm tour Đà Lạt' },
      { role: 'assistant', content: 'Mình tìm thấy 1 tour phù hợp với bạn:' }
    ]);
    expect(secondRequest.request.body.currentTours.map((item: ChatTour) => item.id)).toEqual(['tour-live-1']);
    secondRequest.flush(tourReply(sessionId));
    await second;
  });

  it('keeps trip-creation intent when a user answers a duration clarification', async () => {
    const first = chat.sendMessage('Tạo cho tui chuyến đi Phú Yên');
    const firstRequest = await expectChatRequest(http);
    const sessionId = firstRequest.request.body.sessionId;
    firstRequest.flush({ success: true, reply: 'Bạn muốn đi Phú Yên trong bao lâu?', type: 'clarification', sessionId });
    await first;

    const second = chat.sendMessage('2 ngày 1 đêm');
    const secondRequest = await expectChatRequest(http);
    secondRequest.flush(tourReply(sessionId));
    await second;

    expect(chat.latestResult()?.type).toBe('text');
  });

  it('UI-010: aborts the active request without adding a fabricated assistant reply', async () => {
    expect(typeof chat.cancelMessage).toBe('function');

    const pending = chat.sendMessage('Tìm tour Đà Lạt');
    const request = await expectChatRequest(http);
    chat.cancelMessage();
    await pending;

    expect(request.cancelled).toBe(true);
    expect(chat.transcript().map(message => message.role)).toEqual(['user']);
    expect(chat.transcript()[0].content).toBe('Tìm tour Đà Lạt');
  });

  it('does not post to n8n when the user cancels while the access token is being issued', async () => {
    const pending = chat.sendMessage('Tìm tour Đà Lạt');
    await Promise.resolve();
    const access = http.expectOne(candidate => candidate.url.endsWith('/api/support/chat-access'));

    chat.cancelMessage();
    await pending;

    expect(access.cancelled).toBe(true);
    http.expectNone('https://n8n.example.test/webhook/greensteps');
    expect(chat.transcript().map(message => message.role)).toEqual(['user']);
  });

  it('retains the last tour context after a text-only assistant turn', async () => {
    const first = chat.sendMessage('Tìm tour Đà Lạt');
    const firstRequest = await expectChatRequest(http);
    const sessionId = firstRequest.request.body.sessionId;
    firstRequest.flush(tourReply(sessionId));
    await first;

    const second = chat.sendMessage('Cảm ơn bạn');
    const secondRequest = await expectChatRequest(http);
    expect(secondRequest.request.body.currentTours.map((item: ChatTour) => item.id)).toEqual(['tour-live-1']);
    secondRequest.flush({ success: true, reply: 'Mình sẵn lòng giúp bạn.', sessionId, type: 'text' });
    await second;

    const third = chat.sendMessage('So sánh các tour vừa gợi ý');
    const thirdRequest = await expectChatRequest(http);
    expect(thirdRequest.request.body.currentTours.map((item: ChatTour) => item.id)).toEqual(['tour-live-1']);
    thirdRequest.flush(tourReply(sessionId));
    await third;
  });

  it('UI-012: restores the selected conversation transcript and recommendation context', async () => {
    expect(typeof chat.startNewConversation).toBe('function');
    expect(typeof chat.loadConversation).toBe('function');
    expect(typeof chat.listConversations).toBe('function');

    const pending = chat.sendMessage('Tìm tour Đà Lạt');
    const request = await expectChatRequest(http);
    request.flush(tourReply(request.request.body.sessionId));
    await pending;
    const [previous] = await chat.listConversations();

    await chat.startNewConversation();
    expect(chat.transcript()).toEqual([]);
    expect(chat.latestResult()).toBeNull();
    const conversations = await chat.listConversations();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].id).toBe(previous.id);

    await chat.loadConversation(previous.id);
    expect(chat.transcript()).toHaveLength(2);
    expect(chat.transcript()[1].result?.tours[0].id).toBe('tour-live-1');
    expect(chat.latestResult()?.tours[0].id).toBe('tour-live-1');
  });

  it('UI-011 / UI-025 / CTX-020: locks the view during a pending response and never accepts a superseding stale turn', async () => {
    const pending = chat.sendMessage('TÃ¬m tour ÄÃ  Láº¡t');
    const request = await expectChatRequest(http);
    await chat.sendMessage('TÃ¬m tour ÄÃ  Náºµng');
    http.expectNone(candidate => candidate.url === 'https://n8n.example.test/webhook/greensteps' && candidate.body.message === 'TÃ¬m tour ÄÃ  Náºµng');
    expect(chat.transcript().map(message => message.content)).toEqual(['TÃ¬m tour ÄÃ  Láº¡t']);

    request.flush(tourReply(request.request.body.sessionId));
    await pending;
    expect(chat.latestResult()?.tours.map(item => item.id)).toEqual(['tour-live-1']);
    expect(chat.transcript().map(message => message.content)).not.toContain('TÃ¬m tour ÄÃ  Náºµng');
  });

  it('UI-014: rejects and does not render an itinerary whose destination conflicts with the request', async () => {
    const pending = chat.sendMessage('Tao lich trinh Da Nang 1 ngay');
    const request = await expectChatRequest(http);
    request.flush({ success: true, reply: 'Phu Yen plan', type: 'itinerary_proposal', sessionId: request.request.body.sessionId,
      itinerary: { name: 'Phu Yen', destination: 'Phu Yen', days: [[{ name: 'Tuy Hoa beach', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }]], estimatedCost: 0, assumptions: [] } });
    await pending;
    expect(chat.latestResult()?.type).toBe('text');
    expect(chat.latestResult()?.itinerary).toBeNull();
    expect(chat.latestResult()?.reply).toMatch(/không khớp điểm đến|chưa hiển thị/i);
    expect(chat.currentItinerary()).toBeNull();
  });

  it('UI-025: a successful later plan becomes the active result and clears stale tour context', async () => {
    const first = chat.sendMessage('TÃ¬m tour ÄÃ  Láº¡t');
    const firstRequest = await expectChatRequest(http);
    firstRequest.flush(tourReply(firstRequest.request.body.sessionId));
    await first;

    const second = chat.sendMessage('Táº¡o lá»‹ch trÃ¬nh ÄÃ  Náºµng 1 ngÃ y');
    const secondRequest = await expectChatRequest(http);
    secondRequest.flush({ success: true, reply: 'Lá»‹ch trÃ¬nh ÄÃ  Náºµng', type: 'itinerary_proposal', sessionId: secondRequest.request.body.sessionId,
      itinerary: { name: 'ÄÃ  Náºµng', destination: 'ÄÃ  Náºµng', days: [[{ name: 'SÆ¡n TrÃ ', time: '08:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }]], estimatedCost: 0, assumptions: [] } });
    await second;
    expect(chat.latestResult()?.type).toBe('itinerary_proposal');
    expect(chat.latestResult()?.tours).toEqual([]);
  });
});
