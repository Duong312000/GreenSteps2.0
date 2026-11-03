/** Format calendar dates locally so UTC conversion cannot shift the departure day. */
export function bookingDate(offsetDays = 0, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
