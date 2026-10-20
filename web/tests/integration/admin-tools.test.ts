import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { createOrPromoteAdmin, validateAdminInput } from "../../prisma/create-admin";
import { findSampleAccounts, removeSampleAccounts } from "../../prisma/remove-sample-accounts";
import { d, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

beforeEach(resetDb);

describe("validateAdminInput", () => {
  const ok = { email: "admin@congty.vn", name: "Quản Trị", password: "MatKhauManh123" };
  it("chấp nhận đầu vào hợp lệ", () => expect(validateAdminInput(ok)).toBeNull());
  it.each([
    ["email sai", { email: "khong-phai-email" }],
    ["tên quá ngắn", { name: "A" }],
    ["mật khẩu ngắn", { password: "Ab1" }],
    ["mật khẩu không có chữ số", { password: "KhongCoChuSoNao" }],
    ["mật khẩu không có chữ cái", { password: "1234567890123" }],
    ["mật khẩu dễ đoán", { password: "password12345" }],
  ])("từ chối: %s", (_n, over) => expect(validateAdminInput({ ...ok, ...over })).not.toBeNull());
});

describe("createOrPromoteAdmin", () => {
  it("tạo quản trị viên mới với mật khẩu được băm", async () => {
    expect(await createOrPromoteAdmin(prisma, { email: "Admin@CongTy.vn", name: "Quản Trị", password: "MatKhauManh123" })).toBe("created");
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "admin@congty.vn" } }); // email được chuẩn hóa chữ thường
    expect(u.role).toBe("ADMIN");
    expect(u.passwordHash).not.toContain("MatKhauManh123");
    expect(await bcrypt.compare("MatKhauManh123", u.passwordHash)).toBe(true);
  });

  it("tài khoản đã có thì nâng quyền và đặt lại mật khẩu, giữ nguyên dữ liệu khác", async () => {
    const user = await mkUser({ email: "khach@congty.vn", name: "Khách Cũ" });
    const hotel = await mkHotel();
    const booking = await mkBooking({ userId: user.id, roomId: hotel.rooms[0].id, checkIn: d("2027-01-01"), checkOut: d("2027-01-02") });
    expect(await createOrPromoteAdmin(prisma, { email: "khach@congty.vn", name: "Khách Thành Admin", password: "MatKhauMoi12345" })).toBe("updated");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.role).toBe("ADMIN");
    expect(await bcrypt.compare("MatKhauMoi12345", after.passwordHash)).toBe(true);
    expect(await prisma.booking.count({ where: { id: booking.id } })).toBe(1); // đơn đặt phòng còn nguyên
    expect(await prisma.user.count()).toBe(1); // không tạo bản sao
  });

  it("đầu vào sai thì ném lỗi và không tạo gì", async () => {
    await expect(createOrPromoteAdmin(prisma, { email: "x@y.vn", name: "Tên", password: "ngan" })).rejects.toThrow("10 ký tự");
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("remove-sample-accounts", () => {
  it("chỉ chọn đúng các tài khoản mẫu, không động vào người dùng thật", async () => {
    await mkUser({ email: "admin@khongiansos.vn", role: "ADMIN" });
    await mkUser({ email: "khach@khongiansos.vn" });
    await mkUser({ email: "linh.tran@example.com" });
    const real = await mkUser({ email: "nguoi.that@congty.vn" });
    const found = (await findSampleAccounts(prisma)).map((u) => u.email);
    expect(found).toEqual(["admin@khongiansos.vn", "khach@khongiansos.vn", "linh.tran@example.com"]);
    expect(found).not.toContain(real.email);
  });

  it("xóa tài khoản mẫu cùng dữ liệu gắn với chúng, giữ nguyên dữ liệu của người dùng thật", async () => {
    const sample = await mkUser({ email: "khach@khongiansos.vn" });
    const real = await mkUser({ email: "nguoi.that@congty.vn" });
    const hotel = await mkHotel();
    const roomId = hotel.rooms[0].id;
    const sampleBooking = await mkBooking({ userId: sample.id, roomId, checkIn: d("2027-01-01"), checkOut: d("2027-01-02") });
    await prisma.payment.create({ data: { bookingId: sampleBooking.id, provider: "SIMULATED", txnRef: "S1", amount: 1000, status: "SUCCESS" } });
    await prisma.review.create({ data: { hotelId: hotel.id, userId: sample.id, rating: 5, comment: "đánh giá mẫu" } });
    await prisma.favorite.create({ data: { userId: sample.id, hotelId: hotel.id } });
    const realBooking = await mkBooking({ userId: real.id, roomId, checkIn: d("2027-02-01"), checkOut: d("2027-02-02") });

    expect(await removeSampleAccounts(prisma)).toBe(1);
    expect(await prisma.user.findMany({ select: { email: true } })).toEqual([{ email: "nguoi.that@congty.vn" }]);
    expect(await prisma.booking.findMany({ select: { id: true } })).toEqual([{ id: realBooking.id }]);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.review.count()).toBe(0);
    expect(await prisma.favorite.count()).toBe(0);
    expect(await prisma.hotel.count()).toBe(1); // khách sạn không bị xóa
  });

  it("không có tài khoản mẫu thì không làm gì", async () => {
    await mkUser({ email: "nguoi.that@congty.vn" });
    expect(await removeSampleAccounts(prisma)).toBe(0);
    expect(await prisma.user.count()).toBe(1);
  });
});
