// Đo hiệu năng ở quy mô lớn (chạy bằng: PERF=1 npm run test:perf). Mặc định bị bỏ qua để bộ kiểm thử thường chạy nhanh.
// Dữ liệu được nạp vào cơ sở dữ liệu KIỂM THỬ (_test), không đụng dữ liệu thật.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookedQuantity } from "@/lib/booking";
import { getFilterOptions, getHotelDetail, getSitemapData, searchHotels } from "@/lib/hotels";
import { hit } from "@/lib/rate-limit";
import { getDashboardStats } from "@/lib/stats";
import { DAY, prisma, resetDb } from "../helpers/db";

const HOTELS = 300;
const ROOMS_PER_HOTEL = 3;
const BOOKINGS = 40_000;
const REVIEWERS = 80;

const CITIES = ["Hà Nội", "Đà Nẵng", "Hồ Chí Minh", "Đà Lạt", "Nha Trang", "Phú Quốc"];
const AMENITIES = ["Wi-Fi miễn phí", "Hồ bơi", "Bữa sáng", "Spa", "Phòng gym", "Nhà hàng", "Bãi đỗ xe"];
const timings: Record<string, number> = {};

async function time<T>(name: string, fn: () => Promise<T>, runs = 5): Promise<T> {
  let last!: T;
  const ts: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    last = await fn();
    ts.push(performance.now() - t);
  }
  ts.sort((a, b) => a - b);
  timings[name] = ts[Math.floor(ts.length / 2)];
  return last;
}

describe.skipIf(!process.env.PERF)("hiệu năng ở quy mô lớn", () => {
  beforeAll(async () => {
    await resetDb();
    const t0 = performance.now();

    const users = Array.from({ length: REVIEWERS + 1 }, (_, i) => ({ id: `u${i}`, email: `u${i}@perf.local`, name: `Người dùng ${i}`, passwordHash: "x" }));
    await prisma.user.createMany({ data: users });

    await prisma.hotel.createMany({
      data: Array.from({ length: HOTELS }, (_, i) => ({
        id: `h${i}`,
        slug: `khach-san-${i}`,
        name: `Khách sạn ${i}`,
        description: "Mô tả khách sạn dùng cho kiểm thử hiệu năng.",
        address: `${i} Đường Thử`,
        city: CITIES[i % CITIES.length],
        starRating: 2 + (i % 4),
        images: ["https://picsum.photos/seed/a/100/100", "https://picsum.photos/seed/b/100/100"],
        amenities: AMENITIES.filter((_, k) => (i + k) % 3 !== 0),
      })),
    });
    const rooms = Array.from({ length: HOTELS * ROOMS_PER_HOTEL }, (_, i) => ({
      id: `r${i}`,
      hotelId: `h${Math.floor(i / ROOMS_PER_HOTEL)}`,
      name: `Phòng ${i % ROOMS_PER_HOTEL}`,
      description: "Phòng kiểm thử",
      pricePerNight: 500_000 + (i % 7) * 300_000,
      capacity: 2 + (i % 3),
      bedType: "1 giường",
      images: ["https://picsum.photos/seed/c/100/100"],
      quantity: 5 + (i % 6),
    }));
    await prisma.room.createMany({ data: rooms });

    const now = Date.now();
    const statuses = ["CONFIRMED", "CONFIRMED", "CONFIRMED", "COMPLETED", "CANCELLED", "PENDING"] as const;
    const bookings = Array.from({ length: BOOKINGS }, (_, i) => {
      const status = statuses[i % statuses.length];
      const start = Math.floor(((i * 7919) % 180) - 60); // từ 60 ngày trước đến 120 ngày tới
      const checkIn = new Date(Math.floor(now / DAY) * DAY + start * DAY);
      return {
        code: `KGS-PERF${i}`,
        userId: `u${i % (REVIEWERS + 1)}`,
        roomId: `r${(i * 31) % rooms.length}`,
        checkIn,
        checkOut: new Date(checkIn.getTime() + (1 + (i % 4)) * DAY),
        guests: 2,
        rooms: 1 + (i % 2),
        totalPrice: 1_000_000 + (i % 9) * 250_000,
        status,
        paymentStatus: status === "CONFIRMED" || status === "COMPLETED" ? ("PAID" as const) : status === "CANCELLED" ? ("REFUNDED" as const) : ("UNPAID" as const),
        createdAt: new Date(now - ((i * 104729) % (120 * DAY))),
      };
    });
    for (let i = 0; i < bookings.length; i += 5000) await prisma.booking.createMany({ data: bookings.slice(i, i + 5000) });

    const reviews = Array.from({ length: HOTELS * REVIEWERS }, (_, i) => ({
      hotelId: `h${Math.floor(i / REVIEWERS)}`,
      userId: `u${i % REVIEWERS}`,
      rating: 3 + (i % 3),
      comment: "Đánh giá kiểm thử hiệu năng, nội dung đủ dài để giống thật.",
      isHidden: i % 50 === 0,
    }));
    for (let i = 0; i < reviews.length; i += 5000) await prisma.review.createMany({ data: reviews.slice(i, i + 5000) });

    await prisma.$executeRawUnsafe("ANALYZE");
    console.log(`\nNạp dữ liệu: ${HOTELS} khách sạn, ${rooms.length} phòng, ${BOOKINGS} đơn, ${reviews.length} đánh giá trong ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }, 300_000);

  afterAll(async () => {
    console.log("\nKết quả (trung vị của 5 lần chạy, ms):");
    for (const [k, v] of Object.entries(timings)) console.log(`  ${k.padEnd(52)} ${v.toFixed(0).padStart(6)}`);
    await resetDb();
  }, 120_000);

  it("tìm khách sạn: toàn bộ 300 khách sạn", async () => {
    const r = await time("searchHotels (không lọc, 300 khách sạn)", () => searchHotels({ guests: 2 }));
    expect(r.length).toBeGreaterThan(100);
  });
  it("tìm khách sạn: lọc thành phố", async () => {
    const r = await time("searchHotels (một thành phố, 50 khách sạn)", () => searchHotels({ city: "Hà Nội", guests: 2 }));
    expect(r.length).toBeGreaterThan(10);
  });
  it("tìm khách sạn: có ngày (tính phòng trống trên 40.000 đơn)", async () => {
    const day = new Date(Date.now() + 20 * DAY).toISOString().slice(0, 10);
    const out = new Date(Date.now() + 22 * DAY).toISOString().slice(0, 10);
    await time("searchHotels (có ngày, mọi thành phố)", () => searchHotels({ guests: 2, checkIn: day, checkOut: out }));
  });
  it("tổng quan quản trị: 7, 30 và 90 ngày", async () => {
    for (const r of [7, 30, 90] as const) {
      const s = await time(`getDashboardStats(${r} ngày)`, () => getDashboardStats(r));
      expect(s.revenue).toHaveLength(r);
    }
  });
  it("các truy vấn đơn lẻ", async () => {
    await time("getHotelDetail", () => getHotelDetail("khach-san-7"));
    await time("getFilterOptions", () => getFilterOptions());
    await time("getSitemapData (300 khách sạn)", () => getSitemapData());
    await time("bookedQuantity (một loại phòng)", () => bookedQuantity(prisma, "r10", new Date(Date.now() + 5 * DAY), new Date(Date.now() + 7 * DAY)), 20);
    await time("rate-limit hit", () => hit("perf:k", 60_000), 20);
  });

  it("EXPLAIN: các truy vấn của báo cáo dùng chỉ mục", async () => {
    const plan = async (sql: string) => (await prisma.$queryRawUnsafe<Record<string, string>[]>(`EXPLAIN ${sql}`)).map((r) => r["QUERY PLAN"]).join("\n");
    const cut = new Date(Date.now() - 7 * DAY).toISOString();
    const rev = await plan(`SELECT "totalPrice" FROM "Booking" WHERE "createdAt" >= '${cut}' AND "paymentStatus" = 'PAID' AND "status" <> 'CANCELLED'`);
    const refund = await plan(`SELECT count(*) FROM "Booking" WHERE "status" = 'CANCELLED' AND "paymentStatus" = 'PAID'`);
    const overlap = await plan(`SELECT sum("rooms") FROM "Booking" WHERE "roomId" = 'r10' AND "checkIn" < now() + interval '7 day' AND "checkOut" > now()`);
    const hidden = await plan(`SELECT "rating" FROM "Review" WHERE "hotelId" = 'h7' AND "isHidden" = false`);
    console.log("\nKế hoạch truy vấn (rút gọn):");
    for (const [name, p] of Object.entries({ "doanh thu 7 ngày": rev, "đơn chờ hoàn tiền": refund, "phòng bị giữ theo phòng và ngày": overlap, "đánh giá hiển thị của một khách sạn": hidden })) {
      console.log(`  - ${name}: ${/Index (Only )?Scan|Bitmap Index Scan/.test(p) ? "dùng chỉ mục" : "quét tuần tự"}  [${p.split("\n")[0].trim()}]`);
    }
    expect(overlap).toMatch(/Index|Bitmap/);
  });
});
