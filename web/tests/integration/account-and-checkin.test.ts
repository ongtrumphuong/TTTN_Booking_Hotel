import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

// Các server action gọi vào cookie/phiên của Next nên thay bằng người dùng giả; phần còn lại (Prisma, bcrypt, zod) chạy thật.
const session = vi.hoisted(() => ({ user: { id: "", name: "Quản trị", role: "ADMIN" as "ADMIN" | "USER", email: "a@test.local" } }));
vi.mock("@/lib/session", () => ({
  requireUser: async () => session.user,
  requireAdmin: async () => session.user,
  requireStaff: async () => session.user,
  safeRedirect: (p: string) => p,
  getCurrentUser: async () => session.user,
}));
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "10.0.0.1" }) }));
vi.mock("@/lib/email", () => ({
  sendBookingCancelled: vi.fn(),
  sendRefundCompleted: vi.fn(),
  sendBookingConfirmation: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import { checkInBookingAction, updateBookingStatusAction } from "@/app/actions/admin";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

let userId: string;
let roomId: string;

beforeEach(async () => {
  await resetDb();
  const u = await mkUser();
  userId = u.id;
  roomId = (await mkHotel()).rooms[0].id;
});

describe("hồ sơ cá nhân", () => {
  beforeEach(() => {
    session.user = { id: userId, name: "Khách", role: "USER", email: "k@test.local" };
  });

  it("sửa họ tên và số điện thoại", async () => {
    expect(await updateProfileAction({}, fd({ name: "  Nguyễn Văn An ", phone: "0912345678" }))).toMatchObject({ done: true });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ name: "Nguyễn Văn An", phone: "0912345678" });
  });

  it("để trống số điện thoại thì xóa số cũ; tên hoặc số sai thì báo lỗi và không ghi", async () => {
    await updateProfileAction({}, fd({ name: "An An", phone: "0912345678" }));
    await updateProfileAction({}, fd({ name: "An An", phone: "" }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).phone).toBeNull();

    expect((await updateProfileAction({}, fd({ name: "A", phone: "" }))).fieldErrors?.name).toBeTruthy();
    expect((await updateProfileAction({}, fd({ name: "An An", phone: "123" }))).fieldErrors?.phone).toBeTruthy();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe("An An");
  });
});

describe("đổi mật khẩu", () => {
  beforeEach(async () => {
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash("MatKhauCu123", 4) } });
    session.user = { id: userId, name: "Khách", role: "USER", email: "k@test.local" };
  });
  const change = (o: Partial<Record<"current" | "password" | "confirm", string>>) =>
    changePasswordAction({}, fd({ current: "MatKhauCu123", password: "MatKhauMoi456", confirm: "MatKhauMoi456", ...o }));

  it("đổi được khi nhập đúng mật khẩu hiện tại, và xóa các token đặt lại đang chờ", async () => {
    await prisma.passwordResetToken.create({ data: { userId, tokenHash: "h", expiresAt: new Date(Date.now() + 3_600_000) } });
    expect(await change({})).toMatchObject({ done: true });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare("MatKhauMoi456", u.passwordHash)).toBe(true);
    expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(0);
  });

  it("từ chối khi sai mật khẩu hiện tại, mật khẩu yếu, nhập lại không khớp hoặc trùng mật khẩu cũ", async () => {
    expect((await change({ current: "SaiRoi12345" })).fieldErrors?.current).toBeTruthy();
    expect((await change({ password: "abc", confirm: "abc" })).fieldErrors?.password).toBeTruthy();
    expect((await change({ confirm: "KhacNhau123" })).fieldErrors?.confirm).toBeTruthy();
    expect((await change({ password: "MatKhauCu123", confirm: "MatKhauCu123" })).fieldErrors?.password).toBeTruthy();
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare("MatKhauCu123", u.passwordHash)).toBe(true);
  });

  it("giới hạn số lần thử: quá 10 lần trong 15 phút thì bị chặn kể cả khi nhập đúng", async () => {
    for (let i = 0; i < 10; i++) await change({ current: "SaiRoi12345" });
    expect((await change({})).error).toMatch(/quá nhiều lần/);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare("MatKhauCu123", u.passwordHash)).toBe(true);
  });
});

describe("check-in / check-out thực tế", () => {
  beforeEach(() => {
    session.user = { id: "admin", name: "Quản trị", role: "ADMIN", email: "a@test.local" };
  });
  const stay = (inDays: number, outDays: number) => ({ checkIn: daysFromToday(inDays), checkOut: daysFromToday(outDays) });
  const mk = (o: Partial<Parameters<typeof mkBooking>[0]>) => mkBooking({ userId, roomId, status: "CONFIRMED", paymentStatus: "PAID", ...stay(0, 2), ...o });

  it("nhận phòng đúng ngày thì ghi thời điểm; bấm lần hai bị từ chối", async () => {
    const b = await mk({});
    expect(await checkInBookingAction(b.id)).toEqual({ ok: true });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).checkedInAt).not.toBeNull();
    expect((await checkInBookingAction(b.id)).error).toMatch(/đã nhận phòng/);
  });

  it("từ chối khi chưa đến ngày, đã quá ngày trả, đơn chưa xác nhận hoặc đã hủy", async () => {
    expect((await checkInBookingAction((await mk(stay(3, 5))).id)).error).toMatch(/Chưa đến ngày/);
    expect((await checkInBookingAction((await mk(stay(-5, -2))).id)).error).toMatch(/quá ngày trả/);
    expect((await checkInBookingAction((await mk({ status: "PENDING", paymentStatus: "UNPAID" })).id)).error).toMatch(/đã xác nhận/);
    expect((await checkInBookingAction((await mk({ status: "CANCELLED" })).id)).error).toMatch(/đã xác nhận/);
    expect((await checkInBookingAction("khong-co")).error).toMatch(/không có quyền/); // không lộ việc đơn có tồn tại hay không
  });

  it("đã nhận phòng thì admin không hủy được đơn nữa, nhưng hoàn tất (trả phòng) được và ghi giờ trả", async () => {
    const b = await mk({});
    await checkInBookingAction(b.id);
    expect((await updateBookingStatusAction(b.id, "CANCELLED")).error).toMatch(/không thể hủy/);
    expect(await updateBookingStatusAction(b.id, "COMPLETED")).toEqual({ ok: true });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after).toMatchObject({ status: "COMPLETED" });
    expect(after.checkedInAt).not.toBeNull();
    expect(after.checkedOutAt).not.toBeNull();
  });

  it("hoàn tất đơn chưa ghi nhận nhận phòng thì tự coi là nhận phòng đúng ngày đặt", async () => {
    const b = await mk(stay(-2, 0));
    expect(await updateBookingStatusAction(b.id, "COMPLETED")).toEqual({ ok: true });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.checkedInAt?.getTime()).toBe(b.checkIn.getTime());
    expect(after.checkedOutAt).not.toBeNull();
  });

  it("admin hủy đơn đã thanh toán (chưa nhận phòng) thì hoàn đủ và ghi số tiền hoàn", async () => {
    const b = await mk({ ...stay(5, 7), total: 3_000_000 });
    expect(await updateBookingStatusAction(b.id, "CANCELLED")).toEqual({ ok: true });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after).toMatchObject({ status: "CANCELLED", refundAmount: 3_000_000 });
    expect(after.cancelledAt).not.toBeNull();
  });
});

