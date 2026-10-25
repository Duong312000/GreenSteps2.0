import { describe, expect, it } from 'vitest';
import { bookingDate, dashboardAnalytics } from './partner-dashboard.analytics';
import type { Booking, Service } from '../../../models/models';

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'test-booking',
  service: 'Tour xanh',
  service_id: 'test-service',
  date: '20/10/2026',
  guests: 2,
  value: 1000000,
  status: 'pending',
  ...overrides,
});
const service = (overrides: Partial<Service> = {}): Service => ({
  id: 'test-service',
  provider_id: 'test-provider',
  name: 'Tour xanh',
  type: 'tour',
  destination: 'Đà Lạt',
  cost: 1000000,
  carbon: 2,
  status: 'active',
  ...overrides,
});

describe('partner analytics from existing API fields', () => {
  it('parses real calendar dates without assuming October or inventing a missing date', () => {
    expect(bookingDate(booking())).toBe('2026-10-20');
    expect(bookingDate(booking({ date: '2026-09-30T23:30:00.000Z' }))).toBe('2026-09-30');
    expect(bookingDate(booking({ date: '', booking_date: '2026-08-03' }))).toBe('2026-08-03');
    for (const date of ['31/02/2026', '2026-13-01', '', 'not a date'])
      expect(bookingDate(booking({ date }))).toBeNull();
  });
  it('preserves the existing KPI status rule and separate revenue chart aggregation', () => {
    const rows = [
      booking(),
      booking({ status: 'deposit', value: 2000000 }),
      booking({ status: 'completed', value: 3000000 }),
      booking({ status: 'cancelled', value: 4000000 }),
    ];
    const data = dashboardAnalytics(rows, []);
    expect(data.totalRevenue).toBe(6000000);
    expect(data.monthly[0].tour).toBe(10000000);
    expect(data.pendingBookings).toBe(1);
    expect(data.monthly[0].bookings).toBe(4);
  });
  it('never supplies random traffic, default five-star ratings or amplified conversion', () => {
    const empty = dashboardAnalytics([], []);
    expect(empty.rating).toBeNull();
    expect(empty.views).toBeNull();
    expect(empty.conversionRate).toBeNull();
    expect(empty.monthly).toEqual([]);
    expect(empty.recent).toEqual([]);
    const data = dashboardAnalytics(
      [booking()],
      [service({ views_count: 100, rating: 4 }), service({ rating: 0 }), service()],
    );
    expect(data.rating).toBe(4);
    expect(data.views).toBe(100);
    expect(data.conversionRate).toBe(1);
    expect(data).toEqual(
      dashboardAnalytics(
        [booking()],
        [service({ views_count: 100, rating: 4 }), service({ rating: 0 }), service()],
      ),
    );
  });
  it('uses returned records for pending services, allocation and customer counts', () => {
    const data = dashboardAnalytics(
      [
        booking({ customer_id: 'one' }),
        booking({ service: 'Homestay xanh', customer_id: 'one' }),
        booking({ service: 'Thuê xe', customer_id: 'two' }),
      ],
      [service(), service({ status: 'pending' })],
    );
    expect(data.activeServices).toBe(1);
    expect(data.pendingServices).toBe(1);
    expect(data.allocation).toEqual({ tour: 1, stay: 1, other: 1 });
    expect(data.customers).toBe(2);
  });
  it('sorts booking dates across years and leaves input arrays intact', () => {
    const rows = [
      booking({ id: 'old', date: '31/12/2025' }),
      booking({ id: 'new', date: '01/01/2026' }),
      booking({ id: 'unknown', date: '' }),
    ];
    const data = dashboardAnalytics(rows, []);
    expect(data.recent.map((row) => row.id)).toEqual(['new', 'old', 'unknown']);
    expect(rows.map((row) => row.id)).toEqual(['old', 'new', 'unknown']);
    expect(data.monthly.map((row) => row.key)).toEqual(['2025-12', '2026-01']);
    expect(Number.isFinite(data.monthly[0].tourHeight)).toBe(true);
  });
});
