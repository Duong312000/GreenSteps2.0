import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';
import { ApiService } from '../../services/api.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([Home])).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps home primary content available when optional catalog requests fail', async () => {
    const api = TestBed.inject(ApiService);
    (api as any).getNationalDestinations = vi.fn().mockRejectedValue(new Error('catalog unavailable'));
    (api as any).getToursPage = vi.fn().mockRejectedValue(new Error('tours unavailable'));

    await component.ngOnInit();

    expect(fixture.nativeElement.querySelector('.gs-hero')).toBeTruthy();
    expect(component.destinationCards.length).toBeGreaterThan(0);
    expect(component.realTours).toEqual([]);
  });

  it('applies destination cards while optional tour previews are still pending', async () => {
    let resolveDestinations!: (value: any) => void;
    const pendingTours = new Promise<any>(() => {});
    const api = TestBed.inject(ApiService) as any;
    api.getNationalDestinations = vi.fn(() => new Promise(resolve => { resolveDestinations = resolve; }));
    api.getToursPage = vi.fn(() => pendingTours);
    const initialCards = component.destinationCards.length;

    const initialization = component.ngOnInit();
    resolveDestinations({ items: [{ name: component.destinationCards[0].dest }] });
    await Promise.resolve();

    expect(component.destinationCards.length).toBe(1);
    expect(component.destinationCards.length).toBeLessThan(initialCards);
    void initialization;
  });

  it('sends the selected database destination as an explicit catalog itinerary request', async () => {
    const api = TestBed.inject(ApiService);
    const send = vi.fn().mockResolvedValue({ success: true, reply: 'Plan from catalog' });
    api.sendAiMessage = send;
    component.realTours = [{
      id: 'tour-hue', title: 'Huế xanh', destination: 'Huế', days: 3, cost: 2000000,
      data: [[{ name: 'Đại Nội', time: '08:00' }]]
    } as any];
    component.aiPlannerDest = 'Huế';

    await component.generateAiItinerary();

    expect(send).toHaveBeenCalled();
    expect(send.mock.calls[0][0]).toContain('Lập lịch trình');
    expect(send.mock.calls[0][1]).toBe('Huế');
  });
});
