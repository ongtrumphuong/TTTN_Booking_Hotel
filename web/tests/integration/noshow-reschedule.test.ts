import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

// Server action gọi vào cookie/phiên của Next nên thay bằng người dùng giả; phần còn lại (Prisma, luật nghiệp vụ) chạy thật.
const session = vi.hoisted(() => ({ user: { id: "", name: "Quản trị", role: "ADMIN" as "ADMIN" | "USER", email: "a@test.local" } }));
vi.mock("@/lib/session", () => ({
  requireUser: async () => session.user,
  requireAdmin: async () => session.user,
  requireStaff: async () => session.user,
  safeRedirect: (p: string) => p,
  getCurrentUser: async () => session.user,
}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendBookingCancelled: vi.fn(),
  sendRefundCompleted: vi.fn(),
  sendBookingConfirmation: vi.fn(),
  sendStaffNotice: vi.fn(),
}));

import { markNoShowAction } from "@/app/actions/admin";
import { rescheduleBookingAction } from "@/app/actions/booking";
import { completeFinishedStays, isoDate } from "@/lib/booking";
import { listUnsettled, sumRows } from "@/lib/settlement";

let userId: string;
let roomId: string;
let hotelId: string;

const as = (role: "ADMIN" | "USER", id: string) => {
  session.user = { id, name: role === "ADMIN" ? "Quản trị" : "Khách", role, email: "x@test.local" };
};
const iso = (n: number) => isoDate(daysFromToday(n));

beforeEach(async () => {
  await resetDb();
  const u = await mkUser();
  userId = u.id;
  const hotel = await mkHotel({ rooms: [{ price: 1_000_000, quantity: 1 }] });
  hotelId = hotel.id;
  roomId = hotel.rooms[0].id;
});

describe("khách không đến", () => {
  beforeEach(async () => {
    const admin = await mkUser({ role: "ADMIN" });
    as("ADMIN", admin.id);
  });

  it("giữ phí như hủy muộn, chuyển CANCELLED có cờ noShow và ghi số tiền hoàn", async () => {
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(-2), checkOut: daysFromToday(0), status: "CONFIRMED", paymentStatus: "PAID", total: 2_000_000 });
    expect(await markNoShowAction(b.id)).toEqual({ ok: true });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after).toMatchObject({ status: "CANCELLED", noShow: true, refundAmount: 1_000_000, paymentStatus: "REFUNDED" }); // thanh toán giả lập không có tiền thật để hoàn nên chuyển ngay, như hủy muộn
    expect(after.cancelledAt).not.toBeNull();
  });

  it("phòng được nhả lại cho khách khác", async () => {
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(-1), checkOut: daysFromToday(2), status: "CONFIRMED", paymentStatus: "PAID" });
    const { bookedQuantity } = await import("@/lib/booking");
    expect(await bookedQuantity(prisma, roomId, daysFromToday(0), daysFromToday(1))).toBe(1);
    await markNoShowAction(b.id);
    expect(await bookedQuantity(prisma, roomId, daysFromToday(0), daysFromToday(1))).toBe(0);
  });

  it("phí giữ lại được tính vào doanh thu đối soát của đối tác", async () => {
    const owner = await mkUser();
    await prisma.user.update({ where: { id: owner.id }, data: { role: "HOST" } });
    await prisma.hotel.update({ where: { id: hotelId }, data: { ownerId: owner.id, commissionPercent: 10 } });
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(-2), checkOut: daysFromToday(0), status: "CONFIRMED", paymentStatus: "PAID", total: 2_000_000 });
    await prisma.booking.update({ where: { id: b.id }, data: { commissionPercent: 10 } });
    await markNoShowAction(b.id);
    const sum = sumRows(await listUnsettled(prisma, owner.id));
    expect(sum).toMatchObject({ gross: 1_000_000, commission: 100_000, payout: 900_000 });
  });

  it("không báo được khi chưa qua ngày nhận phòng, khi đã nhận phòng, hoặc khi đơn không ở trạng thái đã xác nhận", async () => {
    const today = await mkBooking({ userId, roomId, checkIn: daysFromToday(0), checkOut: daysFromToday(2), status: "CONFIRMED", paymentStatus: "PAID" });
    expect((await markNoShowAction(today.id)).error).toMatch(/sau ngày nhận phòng/);

    const came = await mkBooking({ userId, roomId, checkIn: daysFromToday(-3), checkOut: daysFromToday(-1), status: "CONFIRMED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: came.id }, data: { checkedInAt: new Date() } });
    expect((await markNoShowAction(came.id)).error).toMatch(/đã nhận phòng/);

    const pending = await mkBooking({ userId, roomId, checkIn: daysFromToday(-3), checkOut: daysFromToday(-1), status: "PENDING" });
    expect((await markNoShowAction(pending.id)).error).toMatch(/đã xác nhận/);
  });

  it("báo hai lần chỉ có hiệu lực một lần", async () => {
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(-2), checkOut: daysFromToday(0), status: "CONFIRMED", paymentStatus: "PAID" });
    const [a, c] = await Promise.all([markNoShowAction(b.id), markNoShowAction(b.id)]);
    expect([a, c].filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("tự hoàn tất đơn đã ở xong", () => {
  it("đơn đã nhận phòng chuyển Hoàn tất ngay khi qua ngày trả phòng; đơn chưa tới ngày trả thì giữ nguyên", async () => {
    const done = await mkBooking({ userId, roomId, checkIn: daysFromToday(-3), checkOut: daysFromToday(0), status: "CONFIRMED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: done.id }, data: { checkedInAt: daysFromToday(-3) } });
    const still = await mkBooking({ userId, roomId, checkIn: daysFromToday(-1), checkOut: daysFromToday(2), status: "CONFIRMED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: still.id }, data: { checkedInAt: daysFromToday(-1) } });

    expect(await completeFinishedStays(prisma)).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: done.id } })).status).toBe("COMPLETED");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: still.id } })).status).toBe("CONFIRMED");
  });

  it("đơn không có ghi nhận nhận phòng chờ hết hạn báo không đến rồi mới tự hoàn tất", async () => {
    const inWindow = await mkBooking({ userId, roomId, checkIn: daysFromToday(-4), checkOut: daysFromToday(-1), status: "CONFIRMED", paymentStatus: "PAID" });
    const expired = await mkBooking({ userId, roomId, checkIn: daysFromToday(-6), checkOut: daysFromToday(-3), status: "CONFIRMED", paymentStatus: "PAID" });

    expect(await completeFinishedStays(prisma)).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: inWindow.id } })).status).toBe("CONFIRMED"); // còn báo không đến được
    const auto = await prisma.booking.findUniqueOrThrow({ where: { id: expired.id } });
    expect(auto.status).toBe("COMPLETED");
    expect(auto.checkedInAt).not.toBeNull();
  });

  it("đơn hoàn tất tự động đi vào đối soát của đối tác", async () => {
    const owner = await mkUser();
    await prisma.user.update({ where: { id: owner.id }, data: { role: "HOST" } });
    await prisma.hotel.update({ where: { id: hotelId }, data: { ownerId: owner.id } });
    await mkBooking({ userId, roomId, checkIn: daysFromToday(-9), checkOut: daysFromToday(-7), status: "CONFIRMED", paymentStatus: "PAID", total: 3_000_000 });
    expect(await listUnsettled(prisma, owner.id)).toHaveLength(0);
    await completeFinishedStays(prisma);
    expect(sumRows(await listUnsettled(prisma, owner.id)).gross).toBe(3_000_000);
  });
});

describe("đổi ngày ở", () => {
  beforeEach(() => as("USER", userId));

  it("đơn đã trả tiền đổi được sang ngày cùng giá và đếm số lần đổi", async () => {
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", paymentStatus: "PAID", total: 2_000_000 });
    expect(await rescheduleBookingAction(b.id, iso(20), iso(22))).toEqual({ ok: true });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(isoDate(after.checkIn)).toBe(iso(20));
    expect(isoDate(after.checkOut)).toBe(iso(22));
    expect(after).toMatchObject({ dateChanges: 1, totalPrice: 2_000_000, status: "CONFIRMED" });
  });

  it("chỉ đổi 1 lần", async () => {
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", paymentStatus: "PAID", total: 2_000_000 });
    await rescheduleBookingAction(b.id, iso(20), iso(22));
    expect((await rescheduleBookingAction(b.id, iso(30), iso(32))).error).toMatch(/1 lần/);
  });

  it("đơn đã trả tiền không đổi sang ngày khác giá (ngày cuối tuần đắt hơn)", async () => {
    await prisma.room.update({ where: { id: roomId }, data: { weekendPercent: 50 } });
    // Tìm một khoảng 2 đêm không có đêm thứ Sáu/Bảy và một khoảng có.
    const nightsOf = (n: number) => [0, 1].map((k) => daysFromToday(n + k).getUTCDay());
    let plain = 5;
    while (nightsOf(plain).some((w) => w === 5 || w === 6)) plain++;
    let weekend = plain + 1;
    while (!nightsOf(weekend).some((w) => w === 5 || w === 6)) weekend++;
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(plain), checkOut: daysFromToday(plain + 2), status: "CONFIRMED", paymentStatus: "PAID", total: 2_000_000 });
    const res = await rescheduleBookingAction(b.id, iso(weekend), iso(weekend + 2));
    expect(res.error).toMatch(/cùng giá/);
    expect(isoDate((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).checkIn)).toBe(iso(plain));
  });

  it("đơn chờ thanh toán không có mã được tính lại giá theo ngày mới", async () => {
    await prisma.room.update({ where: { id: roomId }, data: { weekendPercent: 50 } });
    const nightsOf = (n: number) => [0, 1].map((k) => daysFromToday(n + k).getUTCDay());
    let plain = 5;
    while (nightsOf(plain).some((w) => w === 5 || w === 6)) plain++;
    let weekend = plain + 1;
    while (!nightsOf(weekend).some((w) => w === 5 || w === 6)) weekend++;
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(plain), checkOut: daysFromToday(plain + 2), status: "PENDING", total: 2_000_000 });
    expect(await rescheduleBookingAction(b.id, iso(weekend), iso(weekend + 2))).toEqual({ ok: true });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.totalPrice).toBeGreaterThan(2_000_000);
  });

  it("không đổi sang ngày đã hết phòng, nhưng đơn không tự chặn chính nó khi hai khoảng ngày chồng nhau", async () => {
    // Loại phòng chỉ có 1 phòng; khách khác giữ ngày 20–22.
    const other = await mkUser();
    await mkBooking({ userId: other.id, roomId, checkIn: daysFromToday(20), checkOut: daysFromToday(22), status: "CONFIRMED", paymentStatus: "PAID" });
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", paymentStatus: "PAID", total: 2_000_000 });
    expect((await rescheduleBookingAction(b.id, iso(21), iso(23))).error).toMatch(/hết/);
    // dời lùi 1 ngày: khoảng mới 11–13 chồng lên 10–12 của chính đơn này, vẫn phải đổi được
    expect(await rescheduleBookingAction(b.id, iso(11), iso(13))).toEqual({ ok: true });
  });

  it("không đổi được đơn của người khác, đơn đã hủy hay đã nhận phòng", async () => {
    const other = await mkUser();
    const theirs = await mkBooking({ userId: other.id, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", paymentStatus: "PAID" });
    expect((await rescheduleBookingAction(theirs.id, iso(20), iso(22))).error).toMatch(/Không tìm thấy/);

    const cancelled = await mkBooking({ userId, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CANCELLED", paymentStatus: "PAID" });
    expect((await rescheduleBookingAction(cancelled.id, iso(20), iso(22))).error).toMatch(/không còn đổi/);

    const came = await mkBooking({ userId, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: came.id }, data: { checkedInAt: new Date() } });
    expect((await rescheduleBookingAction(came.id, iso(20), iso(22))).error).toMatch(/đã nhận phòng/);
  });

  it("đơn đã trả tiền quá hạn hủy miễn phí thì không đổi được", async () => {
    await prisma.hotel.update({ where: { id: hotelId }, data: { freeCancelDays: 3 } });
    const b = await mkBooking({ userId, roomId, checkIn: daysFromToday(2), checkOut: daysFromToday(4), status: "CONFIRMED", paymentStatus: "PAID" });
    expect((await rescheduleBookingAction(b.id, iso(20), iso(22))).error).toMatch(/hạn đổi ngày/);
  });
});
