import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourDetailComponent } from './tour-detail';
import { bookingDate } from '../../utils/booking-date';

describe('tour booking dates and prices', () => {
  afterEach(() => vi.useRealTimers());

  function create() {
    return new TourDetailComponent({} as any, { navigate: vi.fn() } as any, {} as any, {} as any, {} as any, {} as any);
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

  function lodging() {
    const component = create();
    component.activeTour = {
      id: 'stay-test', isService: true, type: 'Lưu trú', cost: 999999, days: 1,
      rooms: [{ id: 'studio', name: 'Studio', price_per_night: 500000, available_rooms: 3, capacity: 2 }]
    } as any;
    component.bookingDate = '2026-12-30';
    component.checkOutDate = '2027-01-02';
    return component;
  }

  it('uses the catalog room rate, quantity and calendar nights instead of guest pricing', () => {
    const component = lodging();
    expect(component.totalPrice).toBe(0);
    component.selectRoom(component.rooms[0]);
    component.roomQuantities['studio'] = 2;
    expect(component.stayNights).toBe(3);
    expect(component.totalPrice).toBe(3000000);
    component.bookingAdults = 4;
    expect(component.totalPrice).toBe(3000000);
  });

  it('does not allow booking a room with unknown price or inventory', () => {
    const component = lodging();
    expect(component.canBookRoom({ id: 'unknown', name: 'Unknown' })).toBe(false);
    expect(component.canBookRoom({ ...component.rooms[0], available_rooms: 0 })).toBe(false);
    expect(component.canBookRoom({ ...component.rooms[0], price_per_night: undefined })).toBe(false);
    expect(component.canBookRoom(component.rooms[0])).toBe(true);
  });

  it('requires a room and enough capacity before navigating to checkout', async () => {
    const component = lodging();
    await component.submitBooking({ preventDefault() {} } as Event);
    expect(component.activeInfoTab).toBe('rooms');
    expect(component.bookingError).toContain('chọn phòng');
    component.selectRoom(component.rooms[0]);
    component.bookingAdults = 3;
    await component.submitBooking({ preventDefault() {} } as Event);
    expect(component.bookingError).toContain('Số phòng hoặc sức chứa');
  });

  it('clamps checkout to the day after check-in across year boundaries', () => {
    const component = lodging();
    component.bookingDate = '2026-12-31';
    component.checkOutDate = '2026-12-31';
    component.validateStayDates();
    expect(component.checkOutDate).toBe('2027-01-01');
  });
});
