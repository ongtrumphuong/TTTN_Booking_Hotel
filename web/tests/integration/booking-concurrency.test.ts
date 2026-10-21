import { beforeEach, describe, expect, it } from "vitest";
import { mkHotel, mkUser, prisma, resetDb } from "../helpers/db";
import { createPendingBooking } from "@/lib/booking-create";
import { isoDate } from "@/lib/booking";

beforeEach(resetDb);

const DAY = 86_400_000;
const day = (n: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) + n * DAY);

describe("đặt phòng đồng thời", () => {
  it("nhiều khách cùng đặt một loại phòng chỉ có 2 phòng: không bao giờ bán vượt số phòng", async () => {
    const hotel = await mkHotel({ rooms: [{ price: 1_000_000, quantity: 2 }] });
    const roomId = hotel.rooms[0].id;
    const users = await Promise.all(Array.from({ length: 8 }, () => mkUser()));

    const results = await Promise.all(
      users.map((u) => createPendingBooking({ userId: u.id, roomId, checkIn: isoDate(day(5)), checkOut: isoDate(day(7)), guests: 2, rooms: 1 })),
    );

    const ok = results.filter((r) => r.ok).length;
    const held = await prisma.booking.aggregate({ _sum: { rooms: true }, where: { roomId, status: "PENDING" } });
    expect(ok).toBeGreaterThanOrEqual(1); // ít nhất một khách đặt được
    expect(ok).toBeLessThanOrEqual(2); // tối đa bằng số phòng
    expect(held._sum.rooms ?? 0).toBe(ok); // số phòng đang giữ khớp số đơn thành công
    // Khách không đặt được nhận thông báo rõ ràng (hết phòng hoặc hệ thống bận), không bị lỗi bất ngờ.
    for (const r of results) if (!r.ok) expect(r.error).toMatch(/hết|bận/);
  });

  it("các khoảng ngày không giao nhau thì không cản nhau (ngày trả phòng của đơn này là ngày nhận phòng của đơn kia)", async () => {
    const hotel = await mkHotel({ rooms: [{ price: 1_000_000, quantity: 1 }] });
    const roomId = hotel.rooms[0].id;
    const [a, b] = await Promise.all([mkUser(), mkUser()]);
    const first = await createPendingBooking({ userId: a.id, roomId, checkIn: isoDate(day(5)), checkOut: isoDate(day(7)), guests: 2, rooms: 1 });
    const second = await createPendingBooking({ userId: b.id, roomId, checkIn: isoDate(day(7)), checkOut: isoDate(day(9)), guests: 2, rooms: 1 });
    const overlap = await createPendingBooking({ userId: b.id, roomId, checkIn: isoDate(day(6)), checkOut: isoDate(day(8)), guests: 2, rooms: 1 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(overlap).toMatchObject({ ok: false, error: expect.stringContaining("hết") });
  });
});
