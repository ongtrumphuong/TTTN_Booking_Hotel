import { beforeEach, describe, expect, it } from "vitest";
import { expireStaleBookings, unavailableQuantity } from "@/lib/booking";
import { consumeResetToken, createResetToken, isResetTokenValid } from "@/lib/password-reset";
import { checkVoucher } from "@/lib/voucher";
import { d, minutesAgo, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

let userId: string;
let roomId: string;

beforeEach(async () => {
  await resetDb();
  userId = (await mkUser()).id;
  roomId = (await mkHotel({ rooms: [{ quantity: 5 }] })).rooms[0].id;
});

describe("expireStaleBookings", () => {
  const book = (o: Parameters<typeof mkBooking>[0] extends infer T ? Partial<T> : never) =>
    mkBooking({ userId, roomId, checkIn: d("2027-05-10"), checkOut: d("2027-05-12"), ...o });

  it("chỉ hủy đơn chờ thanh toán đã quá hạn giữ phòng", async () => {
    const old = await book({ createdAt: minutesAgo(45) });
    const fresh = await book({ createdAt: minutesAgo(5) });
    const paid = await book({ createdAt: minutesAgo(90), status: "CONFIRMED", paymentStatus: "PAID" });

    expect(await expireStaleBookings(prisma)).toBe(1);
    const status = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(old.id)).toBe("CANCELLED");
    expect(await status(fresh.id)).toBe("PENDING");
    expect(await status(paid.id)).toBe("CONFIRMED");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: old.id } })).cancelledAt).not.toBeNull();
  });

  it("chạy lại không hủy thêm gì", async () => {
    await book({ createdAt: minutesAgo(45) });
    await expireStaleBookings(prisma);
    expect(await expireStaleBookings(prisma)).toBe(0);
  });
});

describe("unavailableQuantity: đơn đặt cộng phòng bị chặn", () => {
  it("phòng bị chặn làm giảm số phòng bán được", async () => {
    await mkBooking({ userId, roomId, checkIn: d("2027-07-10"), checkOut: d("2027-07-12"), status: "CONFIRMED", rooms: 2 });
    await prisma.roomBlock.create({ data: { roomId, startDate: d("2027-07-11"), endDate: d("2027-07-14"), rooms: 2 } });
    expect(await unavailableQuantity(prisma, roomId, d("2027-07-10"), d("2027-07-12"))).toBe(4);
    expect(await unavailableQuantity(prisma, roomId, d("2027-07-08"), d("2027-07-10"))).toBe(0);
    expect(await unavailableQuantity(prisma, roomId, d("2027-07-14"), d("2027-07-16"))).toBe(0);
  });
});

describe("checkVoucher", () => {
  const mk = (o: Partial<{ code: string; percentOff: number; usageLimit: number; perUserLimit: number; minSubtotal: number; isActive: boolean; endsAt: Date; startsAt: Date }> = {}) =>
    prisma.voucher.create({ data: { code: o.code ?? "SALE10", percentOff: o.percentOff ?? 10, ...o } });

  it("mã hợp lệ trả về mức giảm", async () => {
    await mk();
    const r = await checkVoucher(prisma, " sale10 ", userId, 2_000_000);
    expect(r).toMatchObject({ ok: true, discount: 200_000 });
  });

  it("từ chối mã sai, đã tắt, hết hạn, chưa đến hạn, chưa đủ đơn tối thiểu", async () => {
    await mk({ code: "OFF", isActive: false });
    await mk({ code: "OLD", endsAt: new Date(Date.now() - 86_400_000) });
    await mk({ code: "SOON", startsAt: new Date(Date.now() + 86_400_000) });
    await mk({ code: "BIG", minSubtotal: 5_000_000 });
    for (const code of ["NOPE", "OFF", "OLD", "SOON", "BIG"]) expect((await checkVoucher(prisma, code, userId, 1_000_000)).ok).toBe(false);
  });

  it("giới hạn tổng lượt dùng: đơn đang giữ chỗ tính, đơn đã hủy hoặc hết hạn giữ chỗ thì không", async () => {
    await mk({ usageLimit: 1, perUserLimit: 5 });
    const other = (await mkUser()).id;
    const stay = { roomId, checkIn: d("2027-08-01"), checkOut: d("2027-08-03") };

    const cancelled = await mkBooking({ userId: other, ...stay, status: "CANCELLED" });
    await prisma.booking.update({ where: { id: cancelled.id }, data: { voucherCode: "SALE10" } });
    const stale = await mkBooking({ userId: other, ...stay, createdAt: minutesAgo(60) });
    await prisma.booking.update({ where: { id: stale.id }, data: { voucherCode: "SALE10" } });
    expect((await checkVoucher(prisma, "SALE10", userId, 1_000_000)).ok).toBe(true);

    const live = await mkBooking({ userId: other, ...stay, status: "CONFIRMED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: live.id }, data: { voucherCode: "SALE10" } });
    const r = await checkVoucher(prisma, "SALE10", userId, 1_000_000);
    expect(r).toMatchObject({ ok: false });
  });

  it("giới hạn lượt dùng mỗi khách", async () => {
    await mk({ perUserLimit: 1 });
    const b = await mkBooking({ userId, roomId, checkIn: d("2027-08-01"), checkOut: d("2027-08-03"), status: "CONFIRMED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: b.id }, data: { voucherCode: "SALE10" } });
    expect((await checkVoucher(prisma, "SALE10", userId, 1_000_000)).ok).toBe(false);
    expect((await checkVoucher(prisma, "SALE10", (await mkUser()).id, 1_000_000)).ok).toBe(true);
  });
});

describe("đặt lại mật khẩu", () => {
  it("token dùng được một lần và đổi được mật khẩu", async () => {
    const token = await createResetToken(userId);
    expect(await isResetTokenValid(token)).toBe(true);
    expect(await consumeResetToken(token, "MatKhauMoi123")).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordHash).not.toBe("x");
    expect(await isResetTokenValid(token)).toBe(false);
    expect(await consumeResetToken(token, "KhacNua12345")).toBe(false);
  });

  it("token hết hạn hoặc sai thì bị từ chối", async () => {
    const token = await createResetToken(userId, new Date(Date.now() - 2 * 3_600_000));
    expect(await isResetTokenValid(token)).toBe(false);
    expect(await consumeResetToken(token, "MatKhauMoi123")).toBe(false);
    expect(await consumeResetToken("khong-ton-tai", "MatKhauMoi123")).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash).toBe("x");
  });

  it("yêu cầu mới vô hiệu hóa token cũ", async () => {
    const first = await createResetToken(userId);
    const second = await createResetToken(userId);
    expect(await isResetTokenValid(first)).toBe(false);
    expect(await isResetTokenValid(second)).toBe(true);
  });
});
