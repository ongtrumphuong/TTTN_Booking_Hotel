import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

// Ma trận phân quyền: mỗi hành động nhạy cảm được thử bằng người KHÔNG có quyền (khách khác, đối tác khác, khách thường),
// rồi kiểm dữ liệu không bị thay đổi. Không chỉ kiểm thông báo lỗi, vì ẩn nút trên giao diện không phải là bảo mật.
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

import {
  checkInBookingAction,
  createPriceRuleAction,
  createRoomAction,
  createRoomBlockAction,
  createVoucherAction,
  deletePriceRuleAction,
  deleteRoomBlockAction,
  deleteReviewAction,
  lookupTicketAction,
  markNoShowAction,
  markDuplicateRefundedAction,
  markRefundedAction,
  toggleReviewHiddenAction,
  toggleRoomAction,
  toggleVoucherAction,
  updateBookingStatusAction,
  updateRoomAction,
  updateUserRoleAction,
} from "@/app/actions/admin";
import { cancelBookingAction, payBookingAction } from "@/app/actions/booking";
import { NO_ACCESS } from "@/lib/access";
import { ticketFor } from "@/lib/ticket";

const as = (user: { id: string; role: Role }) => (session.user = { ...session.user, ...user });
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const roomForm = () =>
  fd({ name: "Tên bị đổi", description: "Mô tả phòng thử nghiệm", pricePerNight: "1", capacity: "2", bedType: "1 giường đôi", quantity: "1", images: "https://picsum.photos/seed/a/800/600" });

type Actor = { id: string; role: Role };
let admin: Actor;
let hostA: Actor; // chủ khách sạn A
let hostB: Actor; // đối tác khác, không liên quan khách sạn A
let guest1: Actor; // người đặt phòng
let guest2: Actor; // khách khác

let hotelId: string;
let roomId: string;

const mkHost = async (): Promise<Actor> => {
  const u = await prisma.user.update({ where: { id: (await mkUser()).id }, data: { role: "HOST" } });
  return { id: u.id, role: "HOST" };
};

beforeEach(async () => {
  await resetDb();
  admin = { id: (await mkUser({ role: "ADMIN" })).id, role: "ADMIN" };
  hostA = await mkHost();
  hostB = await mkHost();
  guest1 = { id: (await mkUser()).id, role: "USER" };
  guest2 = { id: (await mkUser()).id, role: "USER" };
  const h = await mkHotel({ rooms: [{ quantity: 5, price: 1_000_000 }] });
  await prisma.hotel.update({ where: { id: h.id }, data: { ownerId: hostA.id } });
  hotelId = h.id;
  roomId = h.rooms[0].id;
});

describe("khách không động được vào đơn của người khác", () => {
  it("không hủy được đơn của người khác: đơn giữ nguyên trạng thái và tiền", async () => {
    const b = await mkBooking({ userId: guest1.id, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CONFIRMED", paymentStatus: "PAID" });
    as(guest2);
    await cancelBookingAction(b.id);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID", refundAmount: null, cancelledAt: null });
  });

  it("không thanh toán hộ được đơn của người khác: không có giao dịch thanh toán nào được tạo", async () => {
    const b = await mkBooking({ userId: guest1.id, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12) });
    as(guest2);
    const res = await payBookingAction(b.id, {}, fd({ method: "card" }));
    expect(res?.error).toBeTruthy();
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "PENDING", paymentStatus: "UNPAID" });
    expect(await prisma.payment.count({ where: { bookingId: b.id } })).toBe(0);
  });
});

describe("đối tác khác không quản lý được khách sạn, phòng, đơn không phải của mình", () => {
  it("không sửa, bật/tắt hay thêm phòng vào khách sạn của người khác", async () => {
    as(hostB);
    expect(await updateRoomAction(roomId, {}, roomForm())).toEqual({ error: NO_ACCESS });
    await toggleRoomAction(roomId);
    expect(await createRoomAction(hotelId, {}, roomForm())).toEqual({ error: NO_ACCESS });

    const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    expect(room).toMatchObject({ pricePerNight: 1_000_000, quantity: 5, isActive: true });
    expect(room.name).not.toBe("Tên bị đổi");
    expect(await prisma.room.count({ where: { hotelId } })).toBe(1);
  });

  it("không chặn phòng hay đặt quy tắc giá của người khác, và không xóa được những thứ đã có", async () => {
    const block = await prisma.roomBlock.create({ data: { roomId, startDate: daysFromToday(20), endDate: daysFromToday(22), rooms: 1 } });
    const rule = await prisma.priceRule.create({ data: { roomId, name: "Lễ", startDate: daysFromToday(20), endDate: daysFromToday(22), percent: 20 } });

    as(hostB);
    const dates = { startDate: "2099-01-01", endDate: "2099-01-03" };
    expect(await createRoomBlockAction(roomId, {}, fd({ ...dates, rooms: "1" }))).toEqual({ error: NO_ACCESS });
    expect(await createPriceRuleAction(roomId, {}, fd({ ...dates, name: "Giảm sốc", percent: "-50" }))).toEqual({ error: NO_ACCESS });
    await deleteRoomBlockAction(block.id);
    await deletePriceRuleAction(rule.id);

    expect(await prisma.roomBlock.count({ where: { roomId } })).toBe(1);
    expect(await prisma.priceRule.count({ where: { roomId } })).toBe(1);
  });

  it("không nhận phòng, báo không đến, đổi trạng thái hay tra vé của đơn thuộc khách sạn khác", async () => {
    const stay = await mkBooking({ userId: guest1.id, roomId, checkIn: daysFromToday(0), checkOut: daysFromToday(2), status: "CONFIRMED", paymentStatus: "PAID" });
    const past = await mkBooking({ userId: guest1.id, roomId, checkIn: daysFromToday(-3), checkOut: daysFromToday(-1), status: "CONFIRMED", paymentStatus: "PAID" });

    as(hostB);
    expect(await checkInBookingAction(stay.id)).toEqual({ error: NO_ACCESS });
    expect(await markNoShowAction(past.id)).toEqual({ error: NO_ACCESS });
    expect(await updateBookingStatusAction(stay.id, "CANCELLED")).toEqual({ error: NO_ACCESS });
    expect(await lookupTicketAction(ticketFor(stay.code))).toMatchObject({ error: expect.any(String) });

    expect(await prisma.booking.findUniqueOrThrow({ where: { id: stay.id } })).toMatchObject({ status: "CONFIRMED", checkedInAt: null });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: past.id } })).toMatchObject({ status: "CONFIRMED", noShow: false });

    // chính chủ thì làm được: phân biệt "bị chặn đúng chỗ" với "hành động hỏng với mọi người"
    as(hostA);
    expect(await checkInBookingAction(stay.id)).toMatchObject({ ok: true });
  });
});

describe("hành động chỉ dành cho quản trị viên sàn", () => {
  it("đối tác và khách thường không ẩn/xóa đánh giá, đổi vai trò, tạo hay tắt mã giảm giá, xác nhận hoàn tiền", async () => {
    const review = await prisma.review.create({ data: { hotelId, userId: guest1.id, rating: 5, comment: "Rất tốt" } });
    const voucher = await prisma.voucher.create({ data: { code: "GIAM10", percentOff: 10 } });
    const cancelled = await mkBooking({ userId: guest1.id, roomId, checkIn: daysFromToday(10), checkOut: daysFromToday(12), status: "CANCELLED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: cancelled.id }, data: { refundAmount: cancelled.totalPrice } });
    const dup = await prisma.payment.create({ data: { bookingId: cancelled.id, provider: "VNPAY", txnRef: "TRUNG1", amount: cancelled.totalPrice, status: "SUCCESS", duplicate: true } });

    for (const who of [hostA, guest2]) {
      as(who);
      await expect(toggleReviewHiddenAction(review.id)).rejects.toThrow(Denied);
      await expect(deleteReviewAction(review.id)).rejects.toThrow(Denied);
      await expect(updateUserRoleAction(guest1.id, "ADMIN")).rejects.toThrow(Denied);
      await expect(updateUserRoleAction(who.id, "ADMIN")).rejects.toThrow(Denied); // không tự nâng quyền
      await expect(createVoucherAction({}, fd({ code: "HACK100", kind: "PERCENT", value: "100" }))).rejects.toThrow(Denied);
      await expect(toggleVoucherAction(voucher.id)).rejects.toThrow(Denied);
      await expect(markRefundedAction(cancelled.id, "đã hoàn")).rejects.toThrow(Denied);
      await expect(markDuplicateRefundedAction(dup.id, "đã hoàn")).rejects.toThrow(Denied);
    }
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: dup.id } })).refundedAt).toBeNull();

    expect(await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).toMatchObject({ isHidden: false });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: guest1.id } })).toMatchObject({ role: "USER" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: hostA.id } })).toMatchObject({ role: "HOST" });
    expect(await prisma.voucher.count()).toBe(1);
    expect(await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } })).toMatchObject({ isActive: true });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: cancelled.id } })).toMatchObject({ paymentStatus: "PAID" });

    // quản trị viên thì làm được
    as(admin);
    await toggleReviewHiddenAction(review.id);
    expect(await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).toMatchObject({ isHidden: true });
  });
});
