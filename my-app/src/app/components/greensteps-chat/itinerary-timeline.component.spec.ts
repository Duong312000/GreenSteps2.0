import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { ItineraryTimelineComponent } from './itinerary-timeline.component';
import type { ChatItineraryDraft } from './greensteps-chat.types';

describe('ItineraryTimelineComponent service verification labels', () => {
  it('VER-020 / UI-017: labels catalog-backed services separately from reference suggestions', async () => {
    registerLocaleData(localeVi);
    await TestBed.configureTestingModule({ imports: [ItineraryTimelineComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ItineraryTimelineComponent);
    const itinerary: ChatItineraryDraft = {
      name: 'Đà Nẵng', destination: 'Đà Nẵng', startDate: null, endDate: null,
      days: [[
        { name: 'Lưu trú GreenSteps', time: '08:00', cost: 600000, carbon: 1.2, type: 'lodging', verified: true, serviceId: 'S-DN-1' },
        { name: 'Đi dạo biển', time: '10:00', cost: 0, carbon: 0, type: 'attraction', verified: false, serviceId: null }
      ]], estimatedCost: 600000, assumptions: []
    };
    fixture.componentInstance.itinerary = itinerary;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('dịch vụ GreenSteps đã xác minh');
    expect(fixture.nativeElement.textContent).toContain('hoạt động gợi ý tham khảo');
    expect(fixture.componentInstance.verifiedActivityCountForDay(itinerary.days[0])).toBe(1);
    expect(fixture.componentInstance.suggestedActivityCountForDay(itinerary.days[0])).toBe(1);
  });
});
