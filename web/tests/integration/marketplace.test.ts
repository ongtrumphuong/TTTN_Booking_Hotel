import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

// Phiên giả có kiểm tra vai trò như thật: requireAdmin/requireHost/requireStaff từ chối sai vai trò bằng cách ném lỗi.
type Role = "USER" | "ADMIN" | "HOST";
const session = vi.hoisted(() => ({ user: { id: "", name: "Người dùng", role: "USER" as Role, email: "u@test.local" } }));
class Denied extends Error {}
vi.mock("@/lib/session", () => ({
  requireUser: async () => session.user,
  requireAdmin: async () => {
    if (session.user.role !== "ADMIN") throw new Denied("admin only");
    return session.user;
  },
  requireStaff: async () => {
    if (session.user.role !== "ADMIN" && session.user.role !== "HOST") throw new Denied("staff only");
    return session.user;
  },
  getCurrentUser: async () => session.user,
  safeRedirect: (p: string) => p,
}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBookingCancelled: vi.fn(), sendRefundCompleted: vi.fn(), sendBookingConfirmation: vi.fn(), sendPasswordResetEmail: vi.fn() }));

import { checkInBookingAction, createHotelAction, markRefundedAction, toggleHotelAction, updateBookingStatusAction, updateHotelAction } from "@/app/actions/admin";
import { createBookingAction } from "@/app/actions/booking";
import { approveHotelAction, assignOwnerAction, createPayoutAction, rejectHotelAction, setCommissionAction } from "@/app/actions/partner";
import { canManageBooking, canManageHotel } from "@/lib/access";
import { listUnsettled, sumRows } from "@/lib/settlement";

const as = (user: { id: string; role: Role }) => (session.user = { ...session.user, ...user });
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const hotelForm = (name = "Khách sạn đối tác") =>
  fd({ name, city: "Huế", address: "10 Lê Lợi, Huế", starRating: "4", description: "Khách sạn thử nghiệm của đối tác.", images: "https://picsum.photos/seed/a/800/600", amenities: "Wi-Fi", freeCancelDays: "1", lateCancelFeePercent: "50" });

let admin: { id: string; role: Role };
let hostA: { id: string; role: Role };
let hostB: { id: string; role: Role };
let guest: { id: string; role: Role };

const mkHost = async () => {
  const u = await prisma.user.update({ where: { id: (await mkUser()).id }, data: { role: "HOST" } });
  return { id: u.id, role: "HOST" as Role };
};
const hotelOf = async (ownerId: string | null, commission = 10) => {
  const h = await mkHotel({ rooms: [{ quantity: 5, price: 1_000_000 }] });
  await prisma.hotel.update({ where: { id: h.id }, data: { ownerId, commissionPercent: commission } });
  return { hotelId: h.id, roomId: h.rooms[0].id };
};

beforeEach(async () => {
  await resetDb();
  admin = { id: (await mkUser({ role: "ADMIN" })).id, role: "ADMIN" };
  hostA = await mkHost();
  hostB = await mkHost();
  guest = { id: (await mkUser()).id, role: "USER" };
});

describe("đối tác tạo và sửa khách sạn", () => {
  it("khách sạn do đối tác tạo thuộc về họ, bị ẩn và chờ duyệt; do admin tạo thì của sàn, hiển thị ngay", async () => {
    as(hostA);
    await createHotelAction({}, hotelForm("Của đối tác"));
    const mine = await prisma.hotel.findFirstOrThrow({ where: { name: "Của đối tác" } });
    expect(mine).toMatchObject({ ownerId: hostA.id, isActive: false, approval: "PENDING" });

    as(admin);
    await createHotelAction({}, hotelForm("Của sàn"));
    const platform = await prisma.hotel.findFirstOrThrow({ where: { name: "Của sàn" } });
    expect(platform).toMatchObject({ ownerId: null, isActive: true, approval: "APPROVED" });
  });

  it("đối tác chỉ sửa được khách sạn của mình", async () => {
    const a = await hotelOf(hostA.id);
    const b = await hotelOf(hostB.id);
    as(hostA);
    expect(await updateHotelAction(a.hotelId, {}, hotelForm("Tên mới"))).toMatchObject({ ok: true });
    expect((await prisma.hotel.findUniqueOrThrow({ where: { id: a.hotelId } })).name).toBe("Tên mới");
    expect((await updateHotelAction(b.hotelId, {}, hotelForm("Chiếm quyền"))).error).toMatch(/không có quyền/);
    expect((await prisma.hotel.findUniqueOrThrow({ where: { id: b.hotelId } })).name).not.toBe("Chiếm quyền");
    expect(await canManageHotel(hostA, b.hotelId)).toBe(false);
    expect(await canManageHotel(admin, b.hotelId)).toBe(true);
    expect(await canManageHotel(guest, a.hotelId)).toBe(false);
  });

  it("khách hàng thường không gọi được hành động quản lý", async () => {
    const a = await hotelOf(hostA.id);
    as(guest);
    await expect(updateHotelAction(a.hotelId, {}, hotelForm())).rejects.toBeInstanceOf(Denied);
    await expect(createHotelAction({}, hotelForm())).rejects.toBeInstanceOf(Denied);
  });

  it("đối tác không tự bật hiển thị khách sạn chưa duyệt; sau khi admin duyệt thì khách sạn hiển thị", async () => {
    as(hostA);
    await createHotelAction({}, hotelForm("Chờ duyệt"));
    const h = await prisma.hotel.findFirstOrThrow({ where: { name: "Chờ duyệt" } });
    await toggleHotelAction(h.id);
    expect((await prisma.hotel.findUniqueOrThrow({ where: { id: h.id } })).isActive).toBe(false);

    await expect(approveHotelAction(h.id)).rejects.toBeInstanceOf(Denied); // đối tác không duyệt được
    as(admin);
    expect(await approveHotelAction(h.id)).toEqual({ ok: true });
    expect(await prisma.hotel.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ isActive: true, approval: "APPROVED" });

    as(hostA);
    await toggleHotelAction(h.id); // đã duyệt thì tự ẩn/hiện được
    expect((await prisma.hotel.findUniqueOrThrow({ where: { id: h.id } })).isActive).toBe(false);
  });

  it("từ chối cần lý do; đối tác sửa lại thì gửi duyệt lại", async () => {
    as(hostA);
    await createHotelAction({}, hotelForm("Bị từ chối"));
    const h = await prisma.hotel.findFirstOrThrow({ where: { name: "Bị từ chối" } });
    as(admin);
    expect((await rejectHotelAction(h.id, " ")).error).toMatch(/lý do/);
    expect(await rejectHotelAction(h.id, "Thiếu ảnh phòng")).toEqual({ ok: true });
    expect(await prisma.hotel.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ approval: "REJECTED", approvalNote: "Thiếu ảnh phòng", isActive: false });

    as(hostA);
    await updateHotelAction(h.id, {}, hotelForm("Bị từ chối"));
    expect(await prisma.hotel.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ approval: "PENDING", approvalNote: null });
  });

  it("hoa hồng 0–50%, chỉ admin đặt; gán chủ khách sạn chỉ cho tài khoản đối tác", async () => {
    const h = await hotelOf(null);
    as(admin);
    expect(await setCommissionAction(h.hotelId, "15")).toEqual({ ok: true });
    expect((await prisma.hotel.findUniqueOrThrow({ where: { id: h.hotelId } })).commissionPercent).toBe(15);
    expect((await setCommissionAction(h.hotelId, "60")).error).toMatch(/0% đến 50%/);
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: hostA.id } })).email;
    expect(await assignOwnerAction(h.hotelId, email)).toEqual({ ok: true });
    expect((await prisma.hotel.findUniqueOrThrow({ where: { id: h.hotelId } })).ownerId).toBe(hostA.id);
    expect((await assignOwnerAction(h.hotelId, (await prisma.user.findUniqueOrThrow({ where: { id: guest.id } })).email)).error).toMatch(/đăng ký/);
    expect(await assignOwnerAction(h.hotelId, "")).toEqual({ ok: true });
    expect((await prisma.hotel.findUniqueOrThrow({ where: { id: h.hotelId } })).ownerId).toBeNull();
    as(hostA);
    await expect(setCommissionAction(h.hotelId, "5")).rejects.toBeInstanceOf(Denied);
  });
});

describe("quyền xử lý đơn của đối tác", () => {
  const stay = { checkIn: daysFromToday(0), checkOut: daysFromToday(2) };

  it("đối tác chỉ thấy và xử lý đơn của khách sạn mình; không xác nhận thanh toán, không hoàn tiền", async () => {
    const a = await hotelOf(hostA.id);
    const b = await hotelOf(hostB.id);
    const mine = await mkBooking({ userId: guest.id, roomId: a.roomId, ...stay, status: "CONFIRMED", paymentStatus: "PAID" });
    const theirs = await mkBooking({ userId: guest.id, roomId: b.roomId, ...stay, status: "CONFIRMED", paymentStatus: "PAID" });
    const pending = await mkBooking({ userId: guest.id, roomId: a.roomId, ...stay });

    as(hostA);
    expect(await canManageBooking(hostA, mine.id)).toBe(true);
    expect(await canManageBooking(hostA, theirs.id)).toBe(false);
    expect(await checkInBookingAction(mine.id)).toEqual({ ok: true });
    expect((await checkInBookingAction(theirs.id)).error).toMatch(/không có quyền/);
    expect((await updateBookingStatusAction(theirs.id, "COMPLETED")).error).toMatch(/không có quyền/);
    expect((await updateBookingStatusAction(pending.id, "CONFIRMED")).error).toMatch(/Chỉ quản trị viên/);
    expect(await updateBookingStatusAction(mine.id, "COMPLETED")).toEqual({ ok: true });

    const cancelled = await mkBooking({ userId: guest.id, roomId: a.roomId, ...stay, status: "CANCELLED", paymentStatus: "PAID" });
    await expect(markRefundedAction(cancelled.id, "")).rejects.toBeInstanceOf(Denied);
  });
});

describe("chốt hoa hồng khi đặt phòng", () => {
  const book = (roomId: string) =>
    createBookingAction({}, fd({ roomId, checkIn: daysFromToday(10).toISOString().slice(0, 10), checkOut: daysFromToday(12).toISOString().slice(0, 10), guests: "2", rooms: "1" }));

  it("đơn của khách sạn đối tác lưu tỷ lệ hoa hồng tại thời điểm đặt; khách sạn của sàn là 0", async () => {
    const partner = await hotelOf(hostA.id, 12);
    const platform = await hotelOf(null, 12);
    as(guest);
    await book(partner.roomId);
    await book(platform.roomId);
    const bookings = await prisma.booking.findMany({ orderBy: { createdAt: "asc" } });
    expect(bookings.map((b) => b.commissionPercent)).toEqual([12, 0]);

    // Đổi hoa hồng sau đó không làm đổi đơn cũ.
    await prisma.hotel.update({ where: { id: partner.hotelId }, data: { commissionPercent: 30 } });
    expect((await prisma.booking.findFirstOrThrow({ where: { roomId: partner.roomId } })).commissionPercent).toBe(12);
  });
});

describe("đối soát và chi trả", () => {
  const stay = { checkIn: daysFromToday(-5), checkOut: daysFromToday(-3) };

  async function setup() {
    const a = await hotelOf(hostA.id, 10);
    const platform = await hotelOf(null, 10);
    const mk = (over: Parameters<typeof mkBooking>[0]) => mkBooking(over);
    const done = await mk({ userId: guest.id, roomId: a.roomId, ...stay, status: "COMPLETED", paymentStatus: "PAID", total: 1_000_000 });
    const lateCancel = await mk({ userId: guest.id, roomId: a.roomId, ...stay, status: "CANCELLED", paymentStatus: "REFUNDED", total: 800_000 });
    const fullRefund = await mk({ userId: guest.id, roomId: a.roomId, ...stay, status: "CANCELLED", paymentStatus: "REFUNDED", total: 500_000 });
    const notDone = await mk({ userId: guest.id, roomId: a.roomId, ...stay, status: "CONFIRMED", paymentStatus: "PAID", total: 300_000 });
    const platformDone = await mk({ userId: guest.id, roomId: platform.roomId, ...stay, status: "COMPLETED", paymentStatus: "PAID", total: 700_000 });
    await prisma.booking.updateMany({ where: { id: { in: [done.id, lateCancel.id, fullRefund.id, notDone.id] } }, data: { commissionPercent: 10 } });
    await prisma.booking.update({ where: { id: lateCancel.id }, data: { refundAmount: 300_000 } }); // khách sạn giữ 500.000
    await prisma.booking.update({ where: { id: fullRefund.id }, data: { refundAmount: 500_000 } });
    return { done, lateCancel, fullRefund, notDone, platformDone };
  }

  it("chỉ tính đơn hoàn tất và phí hủy muộn của khách sạn đối tác; hoa hồng theo tỷ lệ đã chốt", async () => {
    const { done, lateCancel } = await setup();
    const rows = await listUnsettled(prisma, hostA.id);
    expect(rows.map((r) => r.id).sort()).toEqual([done.id, lateCancel.id].sort());
    expect(sumRows(rows)).toEqual({ gross: 1_500_000, commission: 150_000, payout: 1_350_000, promo: 0 });
    expect(await listUnsettled(prisma, hostB.id)).toEqual([]);
  });

  it("tạo đợt chi trả gắn đúng các đơn, ghi số liệu; lần hai không còn gì để chi trả", async () => {
    const { done, lateCancel, notDone, platformDone } = await setup();
    as(admin);
    expect(await createPayoutAction(hostA.id, "Chuyển khoản đợt 1")).toEqual({ ok: true });
    const payout = await prisma.payout.findFirstOrThrow({ where: { ownerId: hostA.id } });
    expect(payout).toMatchObject({ gross: 1_500_000, commission: 150_000, amount: 1_350_000, bookingCount: 2, note: "Chuyển khoản đợt 1", createdById: admin.id });
    const linked = await prisma.booking.findMany({ where: { payoutId: payout.id }, select: { id: true } });
    expect(linked.map((b) => b.id).sort()).toEqual([done.id, lateCancel.id].sort());
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: notDone.id } })).payoutId).toBeNull();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: platformDone.id } })).payoutId).toBeNull();

    expect((await createPayoutAction(hostA.id, "")).error).toMatch(/Không có đơn/);
    expect(await prisma.payout.count()).toBe(1);

    // Đơn mới hoàn tất sau đó vào đợt kế tiếp.
    await prisma.booking.update({ where: { id: notDone.id }, data: { status: "COMPLETED" } });
    expect(await createPayoutAction(hostA.id, "Đợt 2")).toEqual({ ok: true });
    expect((await prisma.payout.findFirstOrThrow({ where: { note: "Đợt 2" } })).amount).toBe(270_000);
  });

  it("chỉ admin tạo đợt chi trả; không chi trả cho tài khoản không phải đối tác", async () => {
    await setup();
    as(hostA);
    await expect(createPayoutAction(hostA.id, "")).rejects.toBeInstanceOf(Denied);
    as(admin);
    expect((await createPayoutAction(guest.id, "")).error).toMatch(/Không có đơn/);
  });

  it("hai yêu cầu chi trả cùng lúc không chi trả trùng một đơn", async () => {
    await setup();
    as(admin);
    const results = await Promise.all([createPayoutAction(hostA.id, "a"), createPayoutAction(hostA.id, "b")]);
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(1);
    const payouts = await prisma.payout.findMany();
    expect(payouts.reduce((s, p) => s + p.bookingCount, 0)).toBe(2);
    expect(await prisma.booking.count({ where: { payoutId: { not: null } } })).toBe(2);
  });
});
