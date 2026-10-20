import { beforeEach, describe, expect, it } from "vitest";
import { bookedQuantity, holdingWhere, paymentStatusAfterCancel, todayUTC } from "@/lib/booking";
import { d, minutesAgo, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

let userId: string;
let roomId: string;

beforeEach(async () => {
  await resetDb();
  userId = (await mkUser()).id;
  roomId = (await mkHotel({ rooms: [{ quantity: 10 }] })).rooms[0].id;
});

const book = (o: Partial<Parameters<typeof mkBooking>[0]>) =>
  mkBooking({ userId, roomId, checkIn: d("2027-05-10"), checkOut: d("2027-05-12"), ...o });
const booked = (a: string, b: string) => bookedQuantity(prisma, roomId, d(a), d(b));

describe("bookedQuantity: số phòng đang bị giữ trong khoảng ngày", () => {
  it("không có đơn nào -> 0", async () => expect(await booked("2027-05-10", "2027-05-12")).toBe(0));

  it("cộng số phòng của các đơn đã xác nhận chồng lên khoảng ngày", async () => {
    await book({ status: "CONFIRMED", rooms: 2 });
    await book({ status: "CONFIRMED", rooms: 3 });
    expect(await booked("2027-05-10", "2027-05-12")).toBe(5);
  });

  it("khoảng ngày là nửa mở: ngày trả phòng trùng ngày nhận phòng của đơn khác thì không chồng", async () => {
    await book({ status: "CONFIRMED", rooms: 2, checkIn: d("2027-05-10"), checkOut: d("2027-05-12") });
    expect(await booked("2027-05-12", "2027-05-14")).toBe(0); // nhận phòng đúng ngày người trước trả
    expect(await booked("2027-05-08", "2027-05-10")).toBe(0); // trả phòng đúng ngày người sau nhận
    expect(await booked("2027-05-11", "2027-05-13")).toBe(2); // chồng 1 đêm
    expect(await booked("2027-05-01", "2027-05-31")).toBe(2); // bao trùm
    expect(await booked("2027-05-11", "2027-05-12")).toBe(2); // nằm trong
  });

  it("đơn chờ thanh toán còn trong hạn giữ 30 phút thì tính", async () => {
    await book({ status: "PENDING", rooms: 2, createdAt: minutesAgo(29) });
    expect(await booked("2027-05-10", "2027-05-12")).toBe(2);
  });

  it("đơn chờ thanh toán quá hạn giữ thì không tính", async () => {
    await book({ status: "PENDING", rooms: 2, createdAt: minutesAgo(31) });
    expect(await booked("2027-05-10", "2027-05-12")).toBe(0);
  });

  it("đơn đã hủy và đơn hoàn tất không tính", async () => {
    await book({ status: "CANCELLED", rooms: 4 });
    await book({ status: "COMPLETED", rooms: 4 });
    expect(await booked("2027-05-10", "2027-05-12")).toBe(0);
  });

  it("chỉ tính đúng loại phòng được hỏi", async () => {
    const other = (await mkHotel({ rooms: [{ quantity: 3 }] })).rooms[0].id;
    await mkBooking({ userId, roomId: other, checkIn: d("2027-05-10"), checkOut: d("2027-05-12"), status: "CONFIRMED", rooms: 3 });
    expect(await booked("2027-05-10", "2027-05-12")).toBe(0);
  });

  it("tính được cả khi chạy trong giao dịch", async () => {
    await book({ status: "CONFIRMED", rooms: 2 });
    const n = await prisma.$transaction((tx) => bookedQuantity(tx, roomId, d("2027-05-10"), d("2027-05-12")));
    expect(n).toBe(2);
  });
});

describe("holdingWhere", () => {
  it("chọn đơn đã xác nhận và đơn chờ còn hạn", async () => {
    const a = await book({ status: "CONFIRMED" });
    const b = await book({ status: "PENDING", createdAt: minutesAgo(5) });
    await book({ status: "PENDING", createdAt: minutesAgo(45) });
    await book({ status: "CANCELLED" });
    const ids = (await prisma.booking.findMany({ where: holdingWhere(), select: { id: true } })).map((x) => x.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
  });
});

describe("paymentStatusAfterCancel: hoàn tiền thật hay không", () => {
  const withPayment = async (provider: "SIMULATED" | "VNPAY", status: "SUCCESS" | "FAILED" | "PENDING") => {
    const b = await book({ status: "CONFIRMED", paymentStatus: "PAID" });
    await prisma.payment.create({ data: { bookingId: b.id, provider, txnRef: `T${b.id}`, amount: 1000, status } });
    return b.id;
  };

  it("chưa thanh toán thì giữ nguyên", async () => expect(await paymentStatusAfterCancel(prisma, "x", "UNPAID")).toBe("UNPAID"));
  it("đã hoàn tiền thì giữ nguyên", async () => expect(await paymentStatusAfterCancel(prisma, "x", "REFUNDED")).toBe("REFUNDED"));
  it("đã thanh toán nhưng không có giao dịch nào (quản trị viên xác nhận tay) -> coi là hoàn ngay", async () => {
    const b = await book({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect(await paymentStatusAfterCancel(prisma, b.id, "PAID")).toBe("REFUNDED");
  });
  it("trả bằng cổng giả lập -> hoàn ngay vì không có tiền thật", async () => {
    expect(await paymentStatusAfterCancel(prisma, await withPayment("SIMULATED", "SUCCESS"), "PAID")).toBe("REFUNDED");
  });
  it("trả thật qua VNPay -> giữ 'đã thanh toán' để chờ quản trị viên hoàn tiền", async () => {
    expect(await paymentStatusAfterCancel(prisma, await withPayment("VNPAY", "SUCCESS"), "PAID")).toBe("PAID");
  });
  it("giao dịch VNPay chưa thành công không tính là tiền thật", async () => {
    expect(await paymentStatusAfterCancel(prisma, await withPayment("VNPAY", "FAILED"), "PAID")).toBe("REFUNDED");
    expect(await paymentStatusAfterCancel(prisma, await withPayment("VNPAY", "PENDING"), "PAID")).toBe("REFUNDED");
  });
  it("chạy được trong giao dịch", async () => {
    const id = await withPayment("VNPAY", "SUCCESS");
    expect(await prisma.$transaction((tx) => paymentStatusAfterCancel(tx, id, "PAID"))).toBe("PAID");
  });
});

describe("todayUTC", () => {
  it("là nửa đêm UTC của ngày hiện tại", () => {
    const t = todayUTC();
    expect(t.getUTCHours() + t.getUTCMinutes() + t.getUTCSeconds() + t.getUTCMilliseconds()).toBe(0);
    expect(t.toISOString().slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
  });
});
