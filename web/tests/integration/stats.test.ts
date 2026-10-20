import { beforeEach, describe, expect, it } from "vitest";
import { getDashboardStats, vnDay } from "@/lib/stats";
import { DAY, daysFromToday, minutesAgo, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

/** Thời điểm 12:00 giờ Việt Nam của ngày cách hôm nay k ngày (giữa ngày nên không lệch ngày khi đổi múi giờ). */
const midday = (k: number) => new Date(`${vnDay(new Date(Date.now() - k * DAY))}T05:00:00.000Z`);
const ddmm = (iso: string) => iso;

let userId: string;
let hotelA: Awaited<ReturnType<typeof mkHotel>>;
let hotelB: Awaited<ReturnType<typeof mkHotel>>;

beforeEach(async () => {
  await resetDb();
  userId = (await mkUser()).id;
  hotelA = await mkHotel({ name: "Khách sạn A", rooms: [{ quantity: 10 }, { quantity: 5 }] }); // 15 phòng
  hotelB = await mkHotel({ name: "Khách sạn B", rooms: [{ quantity: 5 }] }); // 5 phòng
});

const room = (h: typeof hotelA, i = 0) => h.rooms[i].id;
const sale = (o: Partial<Parameters<typeof mkBooking>[0]> & { room?: string }) =>
  mkBooking({ userId, roomId: o.room ?? room(hotelA), checkIn: daysFromToday(30), checkOut: daysFromToday(32), ...o });

describe("doanh thu và các chỉ số trong kỳ", () => {
  it("không có dữ liệu: mọi số bằng 0, không có NaN", async () => {
    await resetDb();
    const s = await getDashboardStats(30);
    expect(s).toMatchObject({ totalRevenue: 0, newBookings: 0, avgOrderValue: 0, cancelRate: 0, capacity: 0, avgOccupancy: 0, pendingRefunds: 0 });
    expect(s.revenue).toHaveLength(30);
    expect(s.occupancy.every((p) => p.percent === 0 && p.occupied === 0)).toBe(true);
    expect(Number.isNaN(s.avgOccupancy)).toBe(false);
  });

  it("doanh thu theo ngày đặt, chỉ tính đơn đã thanh toán và chưa hủy", async () => {
    await sale({ status: "CONFIRMED", paymentStatus: "PAID", total: 2_900_000, createdAt: midday(1) });
    await sale({ status: "COMPLETED", paymentStatus: "PAID", total: 1_450_000, createdAt: midday(1) });
    await sale({ status: "CONFIRMED", paymentStatus: "PAID", total: 3_920_000, createdAt: midday(3) });
    await sale({ status: "CANCELLED", paymentStatus: "REFUNDED", total: 9_999_999, createdAt: midday(3) }); // đã hủy
    await sale({ status: "CANCELLED", paymentStatus: "PAID", total: 8_888_888, createdAt: midday(2) }); // hủy, chờ hoàn tiền
    await sale({ status: "PENDING", paymentStatus: "UNPAID", total: 7_777_777, createdAt: midday(2) }); // chưa trả

    const s = await getDashboardStats(30);
    const day = (k: number) => s.revenue.find((p) => p.date === vnDay(new Date(Date.now() - k * DAY)))!;
    expect(day(1)).toMatchObject({ revenue: 4_350_000, bookings: 2 });
    expect(day(3)).toMatchObject({ revenue: 3_920_000, bookings: 1 });
    expect(day(2)).toMatchObject({ revenue: 0, bookings: 0 });
    expect(s.totalRevenue).toBe(8_270_000);
    expect(s.avgOrderValue).toBe(Math.round(8_270_000 / 3));
  });

  it("có đúng N điểm liên tiếp, kết thúc ở hôm nay (giờ Việt Nam)", async () => {
    for (const range of [7, 30, 90] as const) {
      const s = await getDashboardStats(range);
      expect(s.revenue).toHaveLength(range);
      expect(s.revenue.at(-1)!.date).toBe(vnDay(new Date()));
      const dates = s.revenue.map((p) => ddmm(p.date));
      expect(new Set(dates).size).toBe(range); // không trùng ngày
      expect([...dates].sort()).toEqual(dates); // tăng dần
    }
  });

  it("đơn nằm ngoài kỳ không được tính", async () => {
    await sale({ status: "CONFIRMED", paymentStatus: "PAID", total: 5_000_000, createdAt: midday(10) });
    expect((await getDashboardStats(7)).totalRevenue).toBe(0);
    expect((await getDashboardStats(30)).totalRevenue).toBe(5_000_000);
    expect((await getDashboardStats(7)).newBookings).toBe(0);
    expect((await getDashboardStats(30)).newBookings).toBe(1);
  });

  it("tỷ lệ hủy = đơn đã hủy / tất cả đơn tạo trong kỳ", async () => {
    await sale({ status: "CONFIRMED", paymentStatus: "PAID", createdAt: midday(1) });
    await sale({ status: "CONFIRMED", paymentStatus: "PAID", createdAt: midday(1) });
    await sale({ status: "CANCELLED", paymentStatus: "REFUNDED", createdAt: midday(2) });
    await sale({ status: "PENDING", createdAt: midday(2) });
    const s = await getDashboardStats(30);
    expect(s.newBookings).toBe(4);
    expect(s.cancelRate).toBeCloseTo(0.25);
  });

  it("đếm đơn chờ hoàn tiền trên toàn bộ thời gian (không giới hạn kỳ)", async () => {
    await sale({ status: "CANCELLED", paymentStatus: "PAID", createdAt: midday(80) });
    await sale({ status: "CANCELLED", paymentStatus: "PAID", createdAt: midday(1) });
    await sale({ status: "CANCELLED", paymentStatus: "REFUNDED", createdAt: midday(1) });
    expect((await getDashboardStats(7)).pendingRefunds).toBe(2);
  });

  it("khách sạn doanh thu cao nhất: sắp giảm dần, tối đa 5, gộp theo khách sạn", async () => {
    await sale({ room: room(hotelA), status: "CONFIRMED", paymentStatus: "PAID", total: 1_000_000, createdAt: midday(1) });
    await sale({ room: room(hotelA, 1), status: "CONFIRMED", paymentStatus: "PAID", total: 2_000_000, createdAt: midday(2) });
    await sale({ room: room(hotelB), status: "CONFIRMED", paymentStatus: "PAID", total: 4_000_000, createdAt: midday(2) });
    const top = (await getDashboardStats(30)).topHotels;
    expect(top).toEqual([
      { name: "Khách sạn B", revenue: 4_000_000, bookings: 1 },
      { name: "Khách sạn A", revenue: 3_000_000, bookings: 2 },
    ]);
  });

  it("chỉ giữ 5 khách sạn đầu", async () => {
    for (let i = 0; i < 7; i++) {
      const h = await mkHotel({ name: `KS ${i}`, rooms: [{ quantity: 1 }] });
      await sale({ room: room(h), status: "CONFIRMED", paymentStatus: "PAID", total: 1_000_000 * (i + 1), createdAt: midday(1) });
    }
    const top = (await getDashboardStats(30)).topHotels;
    expect(top).toHaveLength(5);
    expect(top[0].name).toBe("KS 6");
  });
});

describe("tỷ lệ lấp đầy các ngày tới", () => {
  it("tổng số phòng chỉ tính phòng và khách sạn đang bán", async () => {
    await mkHotel({ name: "Ẩn", active: false, rooms: [{ quantity: 100 }] });
    await mkHotel({ name: "Phòng ẩn", rooms: [{ quantity: 50, active: false }, { quantity: 2 }] });
    expect((await getDashboardStats(7)).capacity).toBe(15 + 5 + 2);
  });

  it("đếm số phòng bị giữ theo từng ngày, nửa mở [nhận, trả)", async () => {
    // 3 phòng từ ngày +1 tới +4 (ở các đêm +1, +2, +3), 2 phòng từ +3 tới +5
    await sale({ status: "CONFIRMED", rooms: 3, checkIn: daysFromToday(1), checkOut: daysFromToday(4) });
    await sale({ status: "CONFIRMED", rooms: 2, checkIn: daysFromToday(3), checkOut: daysFromToday(5) });
    const occ = (await getDashboardStats(7)).occupancy;
    expect(occ.map((p) => p.occupied)).toEqual([0, 3, 3, 5, 2, 0, 0]);
    const cap = 22; // 15 + 5 + ... = A(15) + B(5) = 20
    void cap;
    expect(occ[3].percent).toBeCloseTo((5 / 20) * 100);
  });

  it("đơn chờ thanh toán còn hạn giữ phòng thì tính, quá hạn hoặc đã hủy thì không", async () => {
    await sale({ status: "PENDING", rooms: 2, createdAt: minutesAgo(5), checkIn: daysFromToday(1), checkOut: daysFromToday(2) });
    await sale({ status: "PENDING", rooms: 4, createdAt: minutesAgo(60), checkIn: daysFromToday(1), checkOut: daysFromToday(2) });
    await sale({ status: "CANCELLED", rooms: 4, checkIn: daysFromToday(1), checkOut: daysFromToday(2) });
    expect((await getDashboardStats(7)).occupancy[1].occupied).toBe(2);
  });

  it("không vượt 100% khi đặt quá số phòng (dữ liệu bất thường)", async () => {
    await sale({ status: "CONFIRMED", rooms: 50, checkIn: daysFromToday(1), checkOut: daysFromToday(2) });
    const p = (await getDashboardStats(7)).occupancy[1];
    expect(p.percent).toBe(100);
  });

  it("đơn đang ở (nhận phòng trước hôm nay, trả sau hôm nay) tính vào hôm nay", async () => {
    await sale({ status: "CONFIRMED", rooms: 2, checkIn: daysFromToday(-2), checkOut: daysFromToday(2) });
    const occ = (await getDashboardStats(7)).occupancy;
    expect(occ.slice(0, 3).map((p) => p.occupied)).toEqual([2, 2, 0]);
  });

  it("trung bình lấp đầy là trung bình của các ngày trong kỳ", async () => {
    await sale({ status: "CONFIRMED", rooms: 2, checkIn: daysFromToday(0), checkOut: daysFromToday(7) });
    const s = await getDashboardStats(7);
    expect(s.avgOccupancy).toBeCloseTo((2 / 20) * 100);
  });
});

describe("chỉ số tích hợp với dữ liệu thật trong DB", () => {
  it("kết quả không đổi giữa các lần gọi liên tiếp (không phụ thuộc trạng thái)", async () => {
    await sale({ status: "CONFIRMED", paymentStatus: "PAID", total: 1_234_000, createdAt: midday(1) });
    const a = await getDashboardStats(30);
    const b = await getDashboardStats(30);
    expect(b).toEqual(a);
    expect(await prisma.booking.count()).toBe(1);
  });
});
