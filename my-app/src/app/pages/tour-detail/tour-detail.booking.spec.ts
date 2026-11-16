import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourDetailComponent } from './tour-detail';
import { bookingDate } from '../../utils/booking-date';

describe('tour booking dates and prices', () => {
  afterEach(() => vi.useRealTimers());

  function create() {
    return new TourDetailComponent({} as any, { navigate: vi.fn() } as any, {} as any, {} as any, {} as any, {} as any, { clear: vi.fn(), update: vi.fn() } as any);
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

  it('uses the same Flash Sale unit price for guests and room nights', () => {
    const component = create();
    const flashSale = { id: 'flash', discount_type: 'percent', discount_value: 30, remaining: 10, min_order: 0,
      start_at: new Date(Date.now() - 10000).toISOString(), end_at: new Date(Date.now() + 86400000).toISOString() };
    component.activeTour = { id: 'bike', isService: true, type: 'Phương tiện', cost: 50000, flashSale } as any;
    expect(component.totalPrice).toBe(70000);
    expect(component.displayOldCost).toBe(50000);
    component.bookingAdults = 3;
    expect(component.totalPrice).toBe(105000);
    const stay = lodging();
    stay.activeTour!.flashSale = { ...flashSale, discount_type: 'fixed', discount_value: 100000 } as any;
    expect(stay.totalPrice).toBe(0);
    expect(stay.displayedPrice).toBe(400000);
    expect(stay.displayedOriginalPrice).toBe(500000);
    expect(stay.hasDisplayedSale).toBe(true);
    stay.selectRoom(stay.rooms[0]);
    expect(stay.roomSalePrice(stay.rooms[0])).toBe(400000);
    expect(stay.totalPrice).toBe(1200000);
    stay.activeTour!.flashSale!.end_at = new Date(Date.now() - 1).toISOString();
    expect(stay.totalPrice).toBe(1500000);
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

  it('opens the internal checkout for a bike rental without a lodging room', async () => {
    const component = create();
    component.activeTour = { id: 'srv_demo_detail_hoian_cycle', isService: true,
      type: 'Phương tiện', cost: 50000, days: 1, bookingEnabled: true } as any;
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    try {
      await component.submitBooking({ preventDefault() {} } as Event);
      const context = JSON.parse(setItem.mock.calls[0][1]);
      expect(context.serviceId).toBe('srv_demo_detail_hoian_cycle');
      expect(context.roomId).toBe('');
      expect((component as any).router.navigate).toHaveBeenCalledWith(['/booking'], { queryParams: expect.objectContaining({
        serviceId: 'srv_demo_detail_hoian_cycle', roomId: '', guestCount: 2,
      }) });
    } finally { vi.unstubAllGlobals(); }
  });
});
