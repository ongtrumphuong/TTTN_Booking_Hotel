import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

type Role = "USER" | "ADMIN" | "HOST";
const session = vi.hoisted(() => ({ user: { id: "", name: "Lễ tân", role: "ADMIN" as Role, email: "a@test.local" } }));
vi.mock("@/lib/session", () => ({
  requireUser: async () => session.user,
  requireAdmin: async () => session.user,
  requireStaff: async () => session.user,
  getCurrentUser: async () => session.user,
  safeRedirect: (p: string) => p,
}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBookingCancelled: vi.fn(), sendRefundCompleted: vi.fn(), sendBookingConfirmation: vi.fn(), sendPasswordResetEmail: vi.fn() }));

import { checkInBookingAction, lookupTicketAction } from "@/app/actions/admin";
import { bookingCode } from "@/lib/booking";
import { readTicket, ticketFor } from "@/lib/ticket";

beforeEach(resetDb);

describe("vé điện tử", () => {
  it("vé có chữ ký đúng thì đọc được mã; sửa mã hoặc chữ ký thì bị từ chối", () => {
    const t = ticketFor("KGS-ABCD2345");
    expect(readTicket(t)).toBe("KGS-ABCD2345");
    expect(readTicket(`  ${t}  `)).toBe("KGS-ABCD2345");
    expect(readTicket(t.replace("KGS-ABCD2345", "KGS-ABCD2346"))).toBeNull();
    expect(readTicket(t.slice(0, -1) + (t.endsWith("a") ? "b" : "a"))).toBeNull();
    expect(readTicket("KGS-ABCD2345.")).toBeNull();
  });

  it("gõ tay mã đặt phòng (không chữ ký) vẫn tra được, không phân biệt hoa thường; mã sai dạng thì từ chối", () => {
    expect(readTicket("kgs-abcd2345")).toBe("KGS-ABCD2345");
    expect(readTicket("")).toBeNull();
    expect(readTicket("ABC")).toBeNull();
    expect(readTicket("KGS-ABCD234")).toBeNull();
    expect(readTicket("x".repeat(200))).toBeNull();
  });
});

describe("quầy lễ tân: tra cứu vé và nhận phòng", () => {
  it("đối tác chỉ tra được đơn của khách sạn mình; đơn khách sạn khác báo như không tồn tại", async () => {
    const owner = await mkUser({ role: "HOST" as never });
    const other = await mkUser({ role: "HOST" as never });
    const guest = await mkUser();
    const mine = await mkHotel();
    const theirs = await mkHotel();
    await prisma.hotel.update({ where: { id: mine.id }, data: { ownerId: owner.id } });
    await prisma.hotel.update({ where: { id: theirs.id }, data: { ownerId: other.id } });
    const b1 = await mkBooking({ userId: guest.id, code: bookingCode(), roomId: mine.rooms[0].id, checkIn: daysFromToday(0), checkOut: daysFromToday(2), status: "CONFIRMED", paymentStatus: "PAID" });
    const b2 = await mkBooking({ userId: guest.id, code: bookingCode(), roomId: theirs.rooms[0].id, checkIn: daysFromToday(0), checkOut: daysFromToday(2), status: "CONFIRMED", paymentStatus: "PAID" });

    session.user = { id: owner.id, name: "Chủ", role: "HOST", email: "h@test.local" };
    const ok = await lookupTicketAction(ticketFor(b1.code));
    expect(ok).toMatchObject({ booking: { code: b1.code, canCheckIn: true, hotelName: mine.name } });
    expect(await lookupTicketAction(ticketFor(b2.code))).toEqual({ error: "Không tìm thấy đơn này trong khách sạn bạn quản lý." });
    expect(await lookupTicketAction("KGS-ZZZZZZZZ")).toEqual({ error: "Không tìm thấy đơn này trong khách sạn bạn quản lý." });
  });

  it("nói rõ vì sao chưa nhận phòng được; nhận phòng xong thì tra lại thấy đã nhận", async () => {
    const admin = await mkUser({ role: "ADMIN" });
    session.user = { id: admin.id, name: "Admin", role: "ADMIN", email: "a@test.local" };
    const guest = await mkUser();
    const h = await mkHotel();
    const room = h.rooms[0].id;
    const pending = await mkBooking({ userId: guest.id, code: bookingCode(), roomId: room, checkIn: daysFromToday(0), checkOut: daysFromToday(2), status: "PENDING" });
    const future = await mkBooking({ userId: guest.id, code: bookingCode(), roomId: room, checkIn: daysFromToday(5), checkOut: daysFromToday(6), status: "CONFIRMED", paymentStatus: "PAID" });
    const ready = await mkBooking({ userId: guest.id, code: bookingCode(), roomId: room, checkIn: daysFromToday(0), checkOut: daysFromToday(1), status: "CONFIRMED", paymentStatus: "PAID" });

    expect(await lookupTicketAction(pending.code)).toMatchObject({ booking: { canCheckIn: false, reason: "Đơn chưa thanh toán." } });
    expect(await lookupTicketAction(future.code)).toMatchObject({ booking: { canCheckIn: false, reason: "Chưa đến ngày nhận phòng." } });

    expect(await checkInBookingAction(ready.id)).toMatchObject({ ok: true });
    expect(await lookupTicketAction(ready.code)).toMatchObject({ booking: { canCheckIn: false, reason: "Khách đã nhận phòng rồi." } });
  });
});
