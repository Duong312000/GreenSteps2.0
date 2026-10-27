import { describe, expect, it } from 'vitest';
import { isItineraryPrompt } from './greensteps-chat.component';

describe('itinerary prompt context boundary', () => {
  it('recognizes natural “lên lịch đi” requests but not general travel advice', () => {
    expect(isItineraryPrompt('Lên lịch đi Đà Lạt 3 ngày')).toBe(true);
    expect(isItineraryPrompt('Lập lịch đi chơi ở Hội An')).toBe(true);
    expect(isItineraryPrompt('Tư vấn du lịch xanh ở Đà Lạt')).toBe(false);
  });
});
