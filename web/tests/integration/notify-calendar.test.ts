import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

const sendStaffNotice = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("@/lib/email", () => ({ sendStaffNotice }));

import { notifyBookingEvent, notifyHotelDecision, notifyHotelPending } from "@/lib/notify";
import { occupancy } from "@/lib/occupancy";

beforeEach(async () => {
  await resetDb();
  sendStaffNotice.mockClear();
});

describe("thông báo cho đối tác và quản trị viên", () => {
  it("đơn đã thanh toán của khách sạn đối tác: báo đúng đối tác (thông báo + email), không báo người khác", async () => {
    const owner = await mkUser({ role: "HOST" as never });
    const other = await mkUser({ role: "HOST" as never });
    await mkUser({ role: "ADMIN" });
    const guest = await mkUser({ name: "Trần Thị Khách" });
    const hotel = await mkHotel();
    await prisma.hotel.update({ where: { id: hotel.id }, data: { ownerId: owner.id } });
    const b = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(3), checkOut: daysFromToday(5), status: "CONFIRMED", paymentStatus: "PAID" });

    await notifyBookingEvent(b.id, "PAID");

    const mine = await prisma.notification.findMany({ where: { userId: owner.id } });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: "BOOKING_PAID", href: "/host/bookings", readAt: null });
    expect(mine[0].body).toContain("Trần Thị Khách");
    expect(await prisma.notification.count({ where: { userId: other.id } })).toBe(0);
    expect(await prisma.notification.count()).toBe(1); // quản trị viên không bị báo đơn của đối tác
    expect(sendStaffNotice).toHaveBeenCalledTimes(1);
  });

  it("khách sạn do sàn vận hành: báo mọi quản trị viên, không gửi email đối tác", async () => {
    const a1 = await mkUser({ role: "ADMIN" });
    const a2 = await mkUser({ role: "ADMIN" });
    const guest = await mkUser();
    const hotel = await mkHotel();
    const b = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(3), checkOut: daysFromToday(4), status: "CONFIRMED", paymentStatus: "PAID" });
    await notifyBookingEvent(b.id, "PAID");
    expect((await prisma.notification.findMany({ select: { userId: true, href: true } })).map((n) => n.userId).sort()).toEqual([a1.id, a2.id].sort());
    expect(sendStaffNotice).not.toHaveBeenCalled();
  });

  it("sự kiện không khớp trạng thái đơn thì bỏ qua (đơn chưa xác nhận không báo đơn mới; đơn chưa hủy không báo hủy)", async () => {
    const owner = await mkUser({ role: "HOST" as never });
    const guest = await mkUser();
    const hotel = await mkHotel();
    await prisma.hotel.update({ where: { id: hotel.id }, data: { ownerId: owner.id } });
    const pending = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(3), checkOut: daysFromToday(4), status: "PENDING" });
    const confirmed = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(6), checkOut: daysFromToday(7), status: "CONFIRMED", paymentStatus: "PAID" });
    await notifyBookingEvent(pending.id, "PAID");
    await notifyBookingEvent(confirmed.id, "CANCELLED");
    await notifyBookingEvent("khong-ton-tai", "PAID");
    expect(await prisma.notification.count()).toBe(0);
  });

  it("khách sạn chờ duyệt báo quản trị viên; kết quả duyệt báo đúng chủ khách sạn", async () => {
    const admin = await mkUser({ role: "ADMIN" });
    const owner = await mkUser({ role: "HOST" as never });
    const hotel = await mkHotel();
    await prisma.hotel.update({ where: { id: hotel.id }, data: { ownerId: owner.id } });

    await notifyHotelPending(hotel.id);
    expect(await prisma.notification.findFirstOrThrow({ where: { userId: admin.id } })).toMatchObject({ kind: "HOTEL_PENDING", href: "/admin/partners" });

    await notifyHotelDecision(hotel.id, false, "Thiếu ảnh");
    const rejected = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
    expect(rejected).toMatchObject({ kind: "HOTEL_REJECTED" });
    expect(rejected.body).toContain("Thiếu ảnh");
  });
});

describe("lịch phòng", () => {
  const d = (n: number) => daysFromToday(n);
  it("đếm phòng đã đặt, đã chặn và còn trống từng đêm (nửa mở [nhận, trả))", () => {
    const days = occupancy(5, [{ checkIn: d(1), checkOut: d(3), rooms: 2 }, { checkIn: d(2), checkOut: d(4), rooms: 1 }], [{ startDate: d(2), endDate: d(3), rooms: 1 }], d(0), 5);
    expect(days.map((x) => x.booked)).toEqual([0, 2, 3, 1, 0]);
    expect(days.map((x) => x.blocked)).toEqual([0, 0, 1, 0, 0]);
    expect(days.map((x) => x.free)).toEqual([5, 3, 1, 4, 5]);
  });

  it("số còn trống không âm khi dữ liệu đặt vượt số phòng", () => {
    expect(occupancy(1, [{ checkIn: d(0), checkOut: d(1), rooms: 3 }], [], d(0), 1)[0].free).toBe(0);
  });
});
