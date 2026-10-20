// Lịch phòng: với mỗi loại phòng và mỗi đêm, đếm số phòng đã đặt, đã chặn và còn trống. Hàm thuần để dễ kiểm thử.
const DAY_MS = 86_400_000;

export type OccBooking = { checkIn: Date; checkOut: Date; rooms: number };
export type OccBlock = { startDate: Date; endDate: Date; rooms: number };
export type OccDay = { date: Date; booked: number; blocked: number; free: number };

/** `days` đêm liên tiếp từ `from`; đêm d được giữ bởi đơn có checkIn <= d < checkOut (nửa mở, giống lúc đặt phòng). */
export function occupancy(quantity: number, bookings: OccBooking[], blocks: OccBlock[], from: Date, days: number): OccDay[] {
  const out: OccDay[] = [];
  for (let i = 0; i < days; i++) {
    const t = from.getTime() + i * DAY_MS;
    const booked = bookings.reduce((sum, b) => (b.checkIn.getTime() <= t && t < b.checkOut.getTime() ? sum + b.rooms : sum), 0);
    const blocked = blocks.reduce((sum, b) => (b.startDate.getTime() <= t && t < b.endDate.getTime() ? sum + b.rooms : sum), 0);
    out.push({ date: new Date(t), booked, blocked, free: Math.max(0, quantity - booked - blocked) });
  }
  return out;
}
