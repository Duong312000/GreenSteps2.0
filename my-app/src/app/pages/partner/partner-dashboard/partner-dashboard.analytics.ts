import type { Booking, Service } from '../../../models/models';

export function bookingDate(booking: Booking): string | null {
  const raw = booking.date || booking.booking_date || '';
  let year: number, month: number, day: number;
  const local = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/);
  if (local) [, day, month, year] = local.map(Number);
  else if (iso) [, year, month, day] = iso.map(Number);
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;
}
export function periodLabel(key: string): string {
  return `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}`;
}
export function bookingCategory(booking: Booking): 'tour' | 'stay' | 'other' {
  // Retain the existing dashboard's name-based grouping; the API has no type field.
  const name = (booking.service || booking.service_name || '').toLowerCase();
  if (name.includes('homestay') || name.includes('khách sạn') || name.includes('nhà'))
    return 'stay';
  if (name.includes('tour') || name.includes('chuyến đi') || name.includes('hành trình'))
    return 'tour';
  return 'other';
}
const value = (number: unknown): number => (Number.isFinite(Number(number)) ? Number(number) : 0);

export function dashboardAnalytics(bookings: Booking[], services: Service[]) {
  const totalRevenue = bookings
    .filter((b) => ['completed', 'deposit', 'pending'].includes(b.status))
    .reduce((sum, b) => sum + value(b.value), 0);
  const months = [
    ...new Set(
      bookings
        .map(bookingDate)
        .filter((date): date is string => !!date)
        .map((date) => date.slice(0, 7)),
    ),
  ]
    .sort()
    .slice(-6);
  const monthly = months.map((key) => {
    const rows = bookings.filter((b) => bookingDate(b)?.startsWith(key));
    // Keep original revenue chart aggregation: all returned booking values,
    // classified as lodging vs remaining products, distinct from KPI revenue.
    return {
      key,
      label: `Thg ${Number(key.slice(5))}`,
      year: key.slice(0, 4),
      bookings: rows.length,
      tour: rows
        .filter((b) => bookingCategory(b) !== 'stay')
        .reduce((sum, b) => sum + value(b.value), 0),
      stay: rows
        .filter((b) => bookingCategory(b) === 'stay')
        .reduce((sum, b) => sum + value(b.value), 0),
    };
  });
  const maxBookings = Math.max(1, ...monthly.map((row) => row.bookings));
  const maxRevenue = Math.max(1, ...monthly.flatMap((row) => [row.tour, row.stay]));
  const points = monthly.map((row, index) => ({
    ...row,
    x: monthly.length === 1 ? 300 : 76 + index * (464 / (monthly.length - 1)),
    y: 175 - (row.bookings / maxBookings) * 135,
    tourHeight: (row.tour / maxRevenue) * 140,
    stayHeight: (row.stay / maxRevenue) * 140,
  }));
  const allocation = { tour: 0, stay: 0, other: 0 };
  for (const booking of bookings) allocation[bookingCategory(booking)]++;
  const ratings = services
    .map((s) => s.rating)
    .filter(
      (rating): rating is number =>
        typeof rating === 'number' && Number.isFinite(rating) && rating > 0 && rating <= 5,
    );
  const hasViews = services.some(
    (s) => typeof s.views_count === 'number' && Number.isFinite(s.views_count),
  );
  const views = hasViews ? services.reduce((sum, s) => sum + value(s.views_count), 0) : null;
  const customerKeys = bookings
    .map((b) => b.customer_id || b.customer || b.customer_name)
    .filter((name): name is string => !!name);
  return {
    totalRevenue,
    monthly: points,
    maxBookings,
    maxRevenue,
    allocation,
    bookingPath: points
      .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
      .join(' '),
    activeServices: services.filter((s) => s.status === 'active').length,
    pendingServices: services.filter((s) => s.status === 'pending').length,
    pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    rating: ratings.length
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
      : null,
    ratedServices: ratings.length,
    views,
    conversionRate: views && views > 0 ? Math.round((bookings.length / views) * 10000) / 100 : null,
    customers: new Set(customerKeys).size,
    recent: [...bookings]
      .sort((a, b) => (bookingDate(b) || '').localeCompare(bookingDate(a) || ''))
      .slice(0, 5),
    bestServices: Object.values(
      bookings.reduce<Record<string, { name: string; bookings: number; revenue: number }>>(
        (groups, b) => {
          const name = b.service || b.service_name || 'Chưa có tên dịch vụ';
          groups[name] ??= { name, bookings: 0, revenue: 0 };
          groups[name].bookings++;
          groups[name].revenue += value(b.value);
          return groups;
        },
        {},
      ),
    )
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 4),
  };
}
