import "server-only";
import { holdingWhere } from "./booking";
import { prisma } from "./prisma";

export type Range = 7 | 30 | 90;
export const RANGES: Range[] = [7, 30, 90];

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

/** Ngày theo giờ Việt Nam (yyyy-mm-dd) của một thời điểm. */
export const vnDay = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);

export type RevenuePoint = { date: string; revenue: number; bookings: number };
export type OccupancyPoint = { date: string; occupied: number; percent: number };

export type DashboardStats = {
  range: Range;
  revenue: RevenuePoint[];
  totalRevenue: number;
  newBookings: number;
  avgOrderValue: number;
  cancelRate: number; // 0..1, trên các đơn tạo trong kỳ
  occupancy: OccupancyPoint[];
  avgOccupancy: number; // 0..100
  capacity: number; // tổng số phòng đang bán
  topHotels: { name: string; revenue: number; bookings: number }[];
  pendingRefunds: number;
};

/**
 * Doanh thu = tổng tiền các đơn đã thanh toán và chưa hủy, tính theo ngày đặt (giờ Việt Nam).
 * Tỷ lệ lấp đầy = số phòng đang bị giữ (đã xác nhận hoặc đang chờ thanh toán trong hạn) / tổng số phòng đang bán, cho N ngày tới.
 */
export async function getDashboardStats(range: Range): Promise<DashboardStats> {
  const now = new Date();
  const pastDays = Array.from({ length: range }, (_, i) => vnDay(new Date(now.getTime() - (range - 1 - i) * DAY_MS)));
  const windowStart = new Date(Date.parse(`${pastDays[0]}T00:00:00.000Z`) - VN_OFFSET_MS);

  const todayUtc = new Date(`${vnDay(now)}T00:00:00.000Z`);
  const futureDays = Array.from({ length: range }, (_, i) => new Date(todayUtc.getTime() + i * DAY_MS));
  const futureEnd = new Date(todayUtc.getTime() + range * DAY_MS);

  const [paid, created, cancelled, rooms, holds, pendingRefunds] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gte: windowStart }, paymentStatus: "PAID", status: { not: "CANCELLED" } },
      select: { createdAt: true, totalPrice: true, room: { select: { hotel: { select: { id: true, name: true } } } } },
    }),
    prisma.booking.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.booking.count({ where: { createdAt: { gte: windowStart }, status: "CANCELLED" } }),
    prisma.room.aggregate({ where: { isActive: true, hotel: { isActive: true } }, _sum: { quantity: true } }),
    prisma.booking.findMany({
      where: { ...holdingWhere(), checkIn: { lt: futureEnd }, checkOut: { gt: todayUtc } },
      select: { checkIn: true, checkOut: true, rooms: true },
    }),
    prisma.booking.count({ where: { status: "CANCELLED", paymentStatus: "PAID" } }),
  ]);

  const byDay = new Map<string, RevenuePoint>(pastDays.map((date) => [date, { date, revenue: 0, bookings: 0 }]));
  const byHotel = new Map<string, { name: string; revenue: number; bookings: number }>();
  for (const b of paid) {
    const point = byDay.get(vnDay(b.createdAt));
    if (point) {
      point.revenue += b.totalPrice;
      point.bookings += 1;
    }
    const h = byHotel.get(b.room.hotel.id) ?? { name: b.room.hotel.name, revenue: 0, bookings: 0 };
    h.revenue += b.totalPrice;
    h.bookings += 1;
    byHotel.set(b.room.hotel.id, h);
  }
  const revenue = [...byDay.values()];
  const totalRevenue = revenue.reduce((a, p) => a + p.revenue, 0);

  const capacity = rooms._sum.quantity ?? 0;
  const occupancy = futureDays.map((day) => {
    const occupied = holds.filter((h) => h.checkIn <= day && h.checkOut > day).reduce((a, h) => a + h.rooms, 0);
    return { date: day.toISOString().slice(0, 10), occupied, percent: capacity ? Math.min(100, (occupied / capacity) * 100) : 0 };
  });

  return {
    range,
    revenue,
    totalRevenue,
    newBookings: created,
    avgOrderValue: paid.length ? Math.round(totalRevenue / paid.length) : 0,
    cancelRate: created ? cancelled / created : 0,
    occupancy,
    avgOccupancy: occupancy.length ? occupancy.reduce((a, p) => a + p.percent, 0) / occupancy.length : 0,
    capacity,
    topHotels: [...byHotel.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    pendingRefunds,
  };
}
