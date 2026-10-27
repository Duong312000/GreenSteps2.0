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
  return http.expectOne(candidate => candidate.url.endsWith('/api/support/chat'));
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

  it('aborts the active request without adding a fabricated assistant reply', async () => {
    expect(typeof chat.cancelMessage).toBe('function');

    const pending = chat.sendMessage('Tìm tour Đà Lạt');
    const request = await expectChatRequest(http);
    chat.cancelMessage();
    await pending;

    expect(request.cancelled).toBe(true);
    expect(chat.transcript().map(message => message.role)).toEqual(['user']);
    expect(chat.transcript()[0].content).toBe('Tìm tour Đà Lạt');
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

  it('keeps earlier conversations and restores their transcript and recommendation context', async () => {
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
});
