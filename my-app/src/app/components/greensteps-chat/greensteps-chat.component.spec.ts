import { describe, expect, it } from 'vitest';
import { GreenStepsChatComponent, isItineraryPrompt } from './greensteps-chat.component';

describe('itinerary prompt context boundary', () => {
  it('recognizes natural “lên lịch đi” requests but not general travel advice', () => {
    expect(isItineraryPrompt('Lên lịch đi Đà Lạt 3 ngày')).toBe(true);
    expect(isItineraryPrompt('Lập lịch đi chơi ở Hội An')).toBe(true);
    expect(isItineraryPrompt('Tư vấn du lịch xanh ở Đà Lạt')).toBe(false);
  });
});

describe('tour discovery actions', () => {
  it('provides a self itinerary action using the recommended tour destination', () => {
    const result = {
      suggestedQuestions: [],
      tours: [{ destination: 'Đà Nẵng' }]
    } as any;
    expect(GreenStepsChatComponent.prototype.itineraryPrompt.call({} as GreenStepsChatComponent, result))
      .toBe('Tự tạo lịch trình tại Đà Nẵng');
  });

  it('keeps the backend itinerary suggestion when tours are unavailable', () => {
    const result = {
      suggestedQuestions: ['Lập lịch trình riêng tại Đà Nẵng'],
      tours: []
    } as any;
    expect(GreenStepsChatComponent.prototype.itineraryPrompt.call({} as GreenStepsChatComponent, result))
      .toBe('Lập lịch trình riêng tại Đà Nẵng');
  });
});
