import { beforeEach, describe, expect, it } from "vitest";
import { applyGatewayResult, type GatewayResult } from "@/lib/payments/apply";
import { REFUND_WHERE } from "@/lib/booking";
import { d, minutesAgo, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

const AMOUNT = 2_900_000;
let userId: string;
let roomId: string;
let tinyRoomId: string; // chỉ có 1 phòng, dùng cho tình huống hết phòng

beforeEach(async () => {
  await resetDb();
  userId = (await mkUser()).id;
  const hotel = await mkHotel({ rooms: [{ quantity: 6 }, { quantity: 1 }] });
  roomId = hotel.rooms[0].id;
  tinyRoomId = hotel.rooms[1].id;
});

async function pending(over: Partial<Parameters<typeof mkBooking>[0]> = {}) {
  const b = await mkBooking({ userId, roomId, checkIn: d("2027-03-10"), checkOut: d("2027-03-12"), total: AMOUNT, ...over });
  return b;
}
let n = 0;
async function payment(bookingId: string, amount = AMOUNT) {
  return prisma.payment.create({ data: { bookingId, provider: "VNPAY", txnRef: `REF${++n}${Date.now().toString(36)}`, amount } });
}
const ok = (txnRef: string, over: Partial<GatewayResult> = {}): GatewayResult => ({
  txnRef,
  amountMinor: String(AMOUNT * 100),
  responseCode: "00",
  transactionStatus: "00",
  transactionNo: "14000001",
  bankCode: "NCB",
  ...over,
});
const booking = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id } });
const pay = (txnRef: string) => prisma.payment.findUniqueOrThrow({ where: { txnRef } });

describe("kiểm tra đầu vào", () => {
  it("mã giao dịch không tồn tại -> 01", async () => expect((await applyGatewayResult(ok("KHONGCO"))).rsp).toBe("01"));

  it("sai số tiền -> 04, giao dịch và đơn không đổi", async () => {
    const b = await pending();
    const p = await payment(b.id);
    const r = await applyGatewayResult(ok(p.txnRef, { amountMinor: "100" }));
    expect(r.rsp).toBe("04");
    expect((await pay(p.txnRef)).status).toBe("PENDING");
    expect((await booking(b.id)).status).toBe("PENDING");
  });

  it("số tiền gửi về không phải số nguyên đúng dạng -> 04", async () => {
    const b = await pending();
    const p = await payment(b.id);
    for (const bad of ["", "abc", `${AMOUNT * 100}.0`, ` ${AMOUNT * 100}`, "-290000000"]) {
      expect((await applyGatewayResult(ok(p.txnRef, { amountMinor: bad }))).rsp, bad).toBe("04");
    }
  });
});

describe("thanh toán thất bại", () => {
  it("mã lỗi 51: giao dịch FAILED, đơn vẫn chờ thanh toán", async () => {
    const b = await pending();
    const p = await payment(b.id);
    const r = await applyGatewayResult(ok(p.txnRef, { responseCode: "51", transactionStatus: "02" }));
    expect(r).toMatchObject({ rsp: "00", outcome: "failed" });
    const row = await pay(p.txnRef);
    expect(row.status).toBe("FAILED");
    expect(row.responseCode).toBe("51");
    const after = await booking(b.id);
    expect([after.status, after.paymentStatus]).toEqual(["PENDING", "UNPAID"]);
  });

  it("khách bấm hủy trên VNPay (24) -> outcome cancelled, gọi lại vẫn là cancelled", async () => {
    const b = await pending();
    const p = await payment(b.id);
    expect((await applyGatewayResult(ok(p.txnRef, { responseCode: "24", transactionStatus: "02" }))).outcome).toBe("cancelled");
    const again = await applyGatewayResult(ok(p.txnRef, { responseCode: "24", transactionStatus: "02" }));
    expect(again).toMatchObject({ rsp: "02", outcome: "cancelled" });
  });

  it("responseCode 00 nhưng transactionStatus khác 00 -> coi là thất bại", async () => {
    const b = await pending();
    const p = await payment(b.id);
    expect((await applyGatewayResult(ok(p.txnRef, { transactionStatus: "02" }))).outcome).toBe("failed");
    expect((await booking(b.id)).status).toBe("PENDING");
  });

  it("thất bại rồi thử lại bằng giao dịch mới vẫn thanh toán được", async () => {
    const b = await pending();
    const first = await payment(b.id);
    await applyGatewayResult(ok(first.txnRef, { responseCode: "51", transactionStatus: "02" }));
    const second = await payment(b.id);
    expect((await applyGatewayResult(ok(second.txnRef))).outcome).toBe("paid");
    expect((await booking(b.id)).status).toBe("CONFIRMED");
  });
});

describe("thanh toán thành công", () => {
  it("xác nhận đơn và ghi đầy đủ thông tin giao dịch", async () => {
    const b = await pending();
    const p = await payment(b.id);
    const r = await applyGatewayResult(ok(p.txnRef));
    expect(r).toMatchObject({ rsp: "00", outcome: "paid", confirmedNow: true, bookingId: b.id });
    const after = await booking(b.id);
    expect([after.status, after.paymentStatus]).toEqual(["CONFIRMED", "PAID"]);
    const row = await pay(p.txnRef);
    expect(row).toMatchObject({ status: "SUCCESS", providerTxnNo: "14000001", method: "NCB", responseCode: "00" });
    expect(row.paidAt).toBeInstanceOf(Date);
  });

  it("gọi lặp (IPN + trang quay về) -> 02 và không xác nhận lần hai", async () => {
    const b = await pending();
    const p = await payment(b.id);
    await applyGatewayResult(ok(p.txnRef));
    const replay = await applyGatewayResult(ok(p.txnRef));
    expect(replay).toMatchObject({ rsp: "02", outcome: "paid" });
    expect(replay.confirmedNow).toBeUndefined();
  });

  it("hai yêu cầu đồng thời cho cùng giao dịch: đúng một lần xác nhận", async () => {
    const b = await pending();
    const p = await payment(b.id);
    const results = await Promise.all([applyGatewayResult(ok(p.txnRef)), applyGatewayResult(ok(p.txnRef)), applyGatewayResult(ok(p.txnRef))]);
    expect(results.filter((r) => r.confirmedNow).length).toBe(1);
    expect(await prisma.payment.count({ where: { bookingId: b.id, status: "SUCCESS" } })).toBe(1);
    expect((await booking(b.id)).status).toBe("CONFIRMED");
  });

  it("đơn đã được xác nhận trước đó (ví dụ quản trị viên) không bị xác nhận lại; tiền về sau là khoản trùng", async () => {
    const b = await pending({ status: "CONFIRMED", paymentStatus: "PAID" });
    const p = await payment(b.id);
    const r = await applyGatewayResult(ok(p.txnRef));
    expect(r).toMatchObject({ rsp: "00", outcome: "duplicate", paymentId: p.id });
    expect(r.confirmedNow).toBeUndefined();
    expect((await pay(p.txnRef)).duplicate).toBe(true);
  });
});

describe("khách trả tiền hai lần cho một đơn -> khoản sau là thanh toán trùng cần hoàn", () => {
  it("hai giao dịch cùng thành công: đơn xác nhận một lần, giao dịch sau được đánh dấu trùng", async () => {
    const b = await pending();
    const p1 = await payment(b.id);
    const p2 = await payment(b.id);
    expect(await applyGatewayResult(ok(p1.txnRef))).toMatchObject({ outcome: "paid", confirmedNow: true });
    const r = await applyGatewayResult(ok(p2.txnRef));
    expect(r).toMatchObject({ rsp: "00", outcome: "duplicate", paymentId: p2.id });
    expect(r.confirmedNow).toBeUndefined();

    expect(await pay(p1.txnRef)).toMatchObject({ status: "SUCCESS", duplicate: false });
    expect(await pay(p2.txnRef)).toMatchObject({ status: "SUCCESS", duplicate: true });
    expect((await pay(p2.txnRef)).note).toContain("trùng");
    // đơn giữ nguyên: không bị hủy, không đổi số tiền hoàn
    expect(await booking(b.id)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID", refundAmount: null });
    // IPN hoặc trang quay về báo lặp: 02 và vẫn là khoản trùng
    expect(await applyGatewayResult(ok(p2.txnRef))).toMatchObject({ rsp: "02", outcome: "duplicate" });
    // điều kiện "cần hoàn tiền" của quản trị viên thấy đơn này
    expect(await prisma.booking.count({ where: { id: b.id, ...REFUND_WHERE } })).toBe(1);
  });

  it("hai giao dịch thành công đồng thời: đúng một xác nhận đơn, đúng một khoản trùng", async () => {
    const b = await pending();
    const p1 = await payment(b.id);
    const p2 = await payment(b.id);
    const refs = [p1.txnRef, p2.txnRef];
    const rs = await Promise.all(refs.map((t) => applyGatewayResult(ok(t))));
    // xung đột Serializable thì bên thua nhận 99 và VNPay sẽ gọi lại; ở đây gọi lại cho tới khi xong
    for (let i = 0; i < rs.length; i++) while (rs[i].rsp === "99") rs[i] = await applyGatewayResult(ok(refs[i]));
    expect(rs.map((r) => r.outcome).sort()).toEqual(["duplicate", "paid"]);
    expect(await prisma.payment.count({ where: { bookingId: b.id, duplicate: true } })).toBe(1);
    expect((await booking(b.id)).status).toBe("CONFIRMED");
  });

  it("đơn đã hủy và đã hoàn tiền: khoản trả sau đó là khoản trùng, số tiền hoàn của đơn không bị ghi đè", async () => {
    const b = await pending({ status: "CANCELLED", paymentStatus: "REFUNDED" });
    await prisma.booking.update({ where: { id: b.id }, data: { refundAmount: 1_450_000 } });
    const p = await payment(b.id);
    expect((await applyGatewayResult(ok(p.txnRef))).outcome).toBe("duplicate");
    expect(await booking(b.id)).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED", refundAmount: 1_450_000 });
  });

  it("giao dịch thất bại không bao giờ bị coi là trùng", async () => {
    const b = await pending({ status: "CONFIRMED", paymentStatus: "PAID" });
    const p = await payment(b.id);
    expect((await applyGatewayResult(ok(p.txnRef, { responseCode: "51" }))).outcome).toBe("failed");
    expect((await pay(p.txnRef)).duplicate).toBe(false);
    expect(await prisma.booking.count({ where: { id: b.id, ...REFUND_WHERE } })).toBe(0);
  });
});

describe("đã nhận tiền nhưng không giữ được phòng -> cần hoàn tiền thủ công", () => {
  it("đơn đã bị hủy trước khi tiền về", async () => {
    const b = await pending({ status: "CANCELLED" });
    const p = await payment(b.id);
    const r = await applyGatewayResult(ok(p.txnRef));
    expect(r).toMatchObject({ outcome: "needs-refund" });
    expect(r.confirmedNow).toBeUndefined();
    const after = await booking(b.id);
    expect([after.status, after.paymentStatus]).toEqual(["CANCELLED", "PAID"]);
    expect((await pay(p.txnRef)).note).toContain("hoàn tiền");
  });

  it("quá hạn giữ phòng và phòng đã hết", async () => {
    await mkBooking({ userId, roomId: tinyRoomId, checkIn: d("2027-06-01"), checkOut: d("2027-06-03"), status: "CONFIRMED", paymentStatus: "PAID" });
    const b = await pending({ roomId: tinyRoomId, checkIn: d("2027-06-01"), checkOut: d("2027-06-03"), createdAt: minutesAgo(120) });
    const p = await payment(b.id);
    expect((await applyGatewayResult(ok(p.txnRef))).outcome).toBe("needs-refund");
    const after = await booking(b.id);
    expect([after.status, after.paymentStatus]).toEqual(["CANCELLED", "PAID"]);
  });

  it("quá hạn giữ phòng nhưng phòng còn trống -> vẫn xác nhận", async () => {
    const b = await pending({ roomId: tinyRoomId, checkIn: d("2027-07-01"), checkOut: d("2027-07-03"), createdAt: minutesAgo(120) });
    const p = await payment(b.id);
    const r = await applyGatewayResult(ok(p.txnRef));
    expect(r).toMatchObject({ outcome: "paid", confirmedNow: true });
    expect((await booking(b.id)).status).toBe("CONFIRMED");
  });

  it("còn trong hạn giữ phòng thì phòng vẫn của khách dù là phòng cuối cùng", async () => {
    const b = await pending({ roomId: tinyRoomId, checkIn: d("2027-08-01"), checkOut: d("2027-08-03"), createdAt: minutesAgo(5) });
    const p = await payment(b.id);
    expect((await applyGatewayResult(ok(p.txnRef))).outcome).toBe("paid");
  });
});
