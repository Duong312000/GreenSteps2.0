import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourDetailComponent } from './tour-detail';
import { bookingDate } from '../../utils/booking-date';

describe('tour booking dates and prices', () => {
  afterEach(() => vi.useRealTimers());

  function create() {
    return new TourDetailComponent({} as any, { navigate: vi.fn() } as any, {} as any, {} as any, {} as any);
  }

  it('defaults to today and advances the earliest departure when the day changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59));
    const component = create();
    expect(component.bookingDate).toBe('2026-10-31');
    vi.setSystemTime(new Date(2026, 10, 1, 0, 1));
    expect(component.minBookingDate).toBe('2026-11-01');
    component.validateBookingDate();
    expect(component.bookingDate).toBe('2026-11-01');
    component.bookingDate = '2026-12-15';
    component.validateBookingDate();
    expect(component.bookingDate).toBe('2026-12-15');
  });

  it('recalculates the total when adults or children change', () => {
    const component = create();
    component.activeTour = { cost: 500000 } as any;
    expect(component.totalPrice).toBe(1000000);
    component.bookingAdults = 3;
    expect(component.totalPrice).toBe(1500000);
    component.bookingChildren = 2;
    expect(component.totalGuests).toBe(5);
    expect(component.totalPrice).toBe(2500000);
    component.bookingAdults = 1;
    expect(component.totalPrice).toBe(1500000);
  });

  it('calculates the next local calendar date across month and year boundaries', () => {
    expect(bookingDate(1, new Date(2026, 9, 31, 0, 30))).toBe('2026-11-01');
    expect(bookingDate(3, new Date(2026, 11, 30, 0, 30))).toBe('2027-01-02');
  });
});
