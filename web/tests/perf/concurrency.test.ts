// Thí nghiệm đặt phòng đồng thời (chạy bằng: npm run test:perf). Đo trên cơ sở dữ liệu KIỂM THỬ (_test) ở máy phát triển.
// Hai kịch bản, mỗi cấu hình chạy nhiều lần rồi lấy trung bình:
//  1) "đủ phòng": N khách cùng đặt, loại phòng có đúng N phòng. Lý tưởng là cả N khách đều đặt được. Khách bị báo "bận" dù còn phòng là đơn bị mất vô ích.
//  2) "phòng cuối": N khách cùng giành 1 phòng. Phải có đúng 1 đơn thành công, không bao giờ bán vượt.
// So sánh số lần thử tối đa khi giao dịch Serializable bị hủy do xung đột: 1 (không thử lại, cách làm trước đây), 4 và 10.
import { writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { BOOKING_MAX_ATTEMPTS, createPendingBooking } from "@/lib/booking-create";
import { isoDate } from "@/lib/booking";
import { DAY, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

const LEVELS = [2, 5, 10, 20];
const ATTEMPTS = [1, 4, 10];
const REPEATS = 5;
const day = (n: number) => isoDate(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) + n * DAY));
const checkIn = day(10);
const checkOut = day(12);

type Cell = { n: number; scenario: "enough" | "last"; attempts: number; ok: number; soldOut: number; busy: number; other: number; oversold: number; wallMs: number };
const rows: Cell[] = [];

async function round(n: number, quantity: number, maxAttempts: number) {
  await resetDb();
  const hotel = await mkHotel({ rooms: [{ price: 1_000_000, quantity }] });
  const roomId = hotel.rooms[0].id;
  const users = await Promise.all(Array.from({ length: n }, () => mkUser()));
  const t = performance.now();
  const results = await Promise.all(
    users.map((u) => createPendingBooking({ userId: u.id, roomId, checkIn, checkOut, guests: 2, rooms: 1 }, { maxAttempts }).catch(() => ({ ok: false as const, error: "OTHER" }))),
  );
  const wallMs = performance.now() - t;
  const held = (await prisma.booking.aggregate({ _sum: { rooms: true }, where: { roomId, status: "PENDING" } }))._sum.rooms ?? 0;
  return {
    ok: results.filter((r) => r.ok).length,
    soldOut: results.filter((r) => !r.ok && /hết/.test(r.error)).length,
    busy: results.filter((r) => !r.ok && /bận/.test(r.error)).length,
    other: results.filter((r) => !r.ok && r.error === "OTHER").length,
    oversold: Math.max(0, held - quantity),
    wallMs,
  };
}

async function measure(n: number, scenario: Cell["scenario"], attempts: number) {
  const quantity = scenario === "enough" ? n : 1;
  const acc = { ok: 0, soldOut: 0, busy: 0, other: 0, oversold: 0, wallMs: 0 };
  for (let i = 0; i < REPEATS; i++) {
    const r = await round(n, quantity, attempts);
    for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += r[k];
  }
  const avg = (v: number) => Math.round((v / REPEATS) * 100) / 100;
  rows.push({ n, scenario, attempts, ok: avg(acc.ok), soldOut: avg(acc.soldOut), busy: avg(acc.busy), other: avg(acc.other), oversold: acc.oversold, wallMs: Math.round(acc.wallMs / REPEATS) });
}

describe.skipIf(!process.env.PERF)("thí nghiệm đặt phòng đồng thời", () => {
  afterAll(async () => {
    console.log("\nKết quả (trung bình mỗi lượt, " + REPEATS + " lượt/cấu hình; mặc định hiện tại = " + BOOKING_MAX_ATTEMPTS + " lần thử):");
    console.log("kịch bản  | N  | lần thử | thành công | hết phòng | bận | khác | bán vượt (tổng) | ms");
    for (const r of rows) {
      console.log(`${r.scenario.padEnd(9)} | ${String(r.n).padStart(2)} | ${String(r.attempts).padStart(7)} | ${String(r.ok).padStart(10)} | ${String(r.soldOut).padStart(9)} | ${String(r.busy).padStart(3)} | ${String(r.other).padStart(4)} | ${String(r.oversold).padStart(15)} | ${r.wallMs}`);
    }
    if (process.env.CONCURRENCY_OUT) writeFileSync(process.env.CONCURRENCY_OUT, JSON.stringify({ repeats: REPEATS, defaultAttempts: BOOKING_MAX_ATTEMPTS, rows }, null, 2));
    await resetDb();
  }, 60_000);

  it("đủ phòng cho mọi khách và giành phòng cuối, với 1, 4 và 10 lần thử", async () => {
    for (const n of LEVELS) {
      for (const attempts of ATTEMPTS) {
        await measure(n, "enough", attempts);
        await measure(n, "last", attempts);
      }
    }
    // bất biến an toàn: dù thử lại bao nhiêu lần cũng không bao giờ bán vượt, và tranh phòng cuối chỉ có tối đa một đơn
    for (const r of rows) expect(r.oversold).toBe(0);
    for (const r of rows.filter((r) => r.scenario === "last")) {
      expect(r.ok).toBeLessThanOrEqual(1);
      if (r.attempts > 1) expect(r.ok).toBe(1); // có thử lại thì phòng cuối luôn bán được cho đúng một khách
    }
  }, 900_000);
});
