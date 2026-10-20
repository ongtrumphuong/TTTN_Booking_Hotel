import { describe, expect, it } from "vitest";
import { maxBlockedRooms, needsRefund, paymentLabel } from "@/lib/booking";
import { cancelQuote, policyText } from "@/lib/cancellation";
import { buildNoticeEmail } from "@/lib/email";
import { computeDiscount, normalizeCode } from "@/lib/voucher";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("cancelQuote: chính sách hủy", () => {
  const base = { today: d("2027-05-01"), freeCancelDays: 3, lateFeePercent: 50 };

  it("hủy sớm hơn hạn thì hoàn đủ", () => {
    expect(cancelQuote({ ...base, checkIn: d("2027-05-10"), paid: 2_000_000 })).toMatchObject({ free: true, fee: 0, refund: 2_000_000, daysLeft: 9 });
  });
  it("đúng ngày cuối của hạn miễn phí vẫn hoàn đủ", () => {
    expect(cancelQuote({ ...base, checkIn: d("2027-05-04"), paid: 1_000_000 })).toMatchObject({ free: true, refund: 1_000_000 });
  });
  it("hủy muộn bị giữ phần trăm phí, làm tròn", () => {
    expect(cancelQuote({ ...base, checkIn: d("2027-05-03"), paid: 1_000_001 })).toMatchObject({ free: false, fee: 500_001, refund: 500_000 });
  });
  it("phí 100% thì không hoàn gì", () => {
    expect(cancelQuote({ ...base, lateFeePercent: 100, checkIn: d("2027-05-02"), paid: 800_000 }).refund).toBe(0);
  });
  it("đơn chưa trả tiền không mất phí dù hủy muộn", () => {
    expect(cancelQuote({ ...base, checkIn: d("2027-05-02"), paid: 0 })).toMatchObject({ free: true, fee: 0, refund: 0 });
  });
  it("freeCancelDays = 0: hủy được miễn phí đến tận ngày trước nhận phòng", () => {
    expect(cancelQuote({ ...base, freeCancelDays: 0, checkIn: d("2027-05-02"), paid: 500_000 }).free).toBe(true);
  });
  it("phần trăm phí được kẹp trong 0..100", () => {
    expect(cancelQuote({ ...base, lateFeePercent: 250, checkIn: d("2027-05-02"), paid: 100 }).refund).toBe(0);
    expect(cancelQuote({ ...base, lateFeePercent: -5, checkIn: d("2027-05-02"), paid: 100 }).refund).toBe(100);
  });
  it("policyText mô tả đúng từng trường hợp", () => {
    expect(policyText(3, 50)).toContain("3 ngày");
    expect(policyText(3, 50)).toContain("50%");
    expect(policyText(3, 100)).toContain("không được hoàn tiền");
    expect(policyText(0, 50)).toContain("cho tới ngày nhận phòng");
  });
});

describe("needsRefund với số tiền hoàn", () => {
  it("giữ toàn bộ tiền (hoàn 0) thì không còn gì để hoàn", () => {
    expect(needsRefund("CANCELLED", "PAID", 0)).toBe(false);
    expect(paymentLabel("CANCELLED", "PAID", 0)).toBe("Đã thanh toán");
  });
  it("hoàn một phần hoặc chưa ghi nhận số tiền thì vẫn chờ hoàn", () => {
    expect(needsRefund("CANCELLED", "PAID", 500)).toBe(true);
    expect(needsRefund("CANCELLED", "PAID", null)).toBe(true);
    expect(needsRefund("CANCELLED", "PAID")).toBe(true);
  });
});

describe("computeDiscount", () => {
  it("giảm theo phần trăm, làm tròn xuống", () => {
    expect(computeDiscount({ percentOff: 10, amountOff: null, maxDiscount: null }, 1_999_999)).toBe(199_999);
  });
  it("áp trần giảm tối đa", () => {
    expect(computeDiscount({ percentOff: 50, amountOff: null, maxDiscount: 300_000 }, 2_000_000)).toBe(300_000);
  });
  it("giảm số tiền cố định nhưng không vượt tổng tiền", () => {
    expect(computeDiscount({ percentOff: null, amountOff: 500_000, maxDiscount: null }, 300_000)).toBe(300_000);
    expect(computeDiscount({ percentOff: null, amountOff: 100_000, maxDiscount: null }, 300_000)).toBe(100_000);
  });
  it("chuẩn hóa mã: bỏ khoảng trắng, viết hoa", () => expect(normalizeCode("  he 2027 ")).toBe("HE2027"));
});

describe("maxBlockedRooms: phòng bị chặn theo từng đêm", () => {
  const blocks = [
    { startDate: d("2027-06-10"), endDate: d("2027-06-13"), rooms: 2 }, // đêm 10, 11, 12
    { startDate: d("2027-06-12"), endDate: d("2027-06-15"), rooms: 3 }, // đêm 12, 13, 14
  ];
  it("lấy đêm bị chặn nhiều nhất, không cộng dồn các khối không chồng nhau", () => {
    expect(maxBlockedRooms(blocks, d("2027-06-10"), d("2027-06-12"))).toBe(2);
    expect(maxBlockedRooms(blocks, d("2027-06-13"), d("2027-06-15"))).toBe(3);
  });
  it("đêm 12 bị cả hai khối cùng chặn", () => expect(maxBlockedRooms(blocks, d("2027-06-10"), d("2027-06-14"))).toBe(5));
  it("ngày trả phòng trùng ngày bắt đầu chặn thì không ảnh hưởng", () => {
    expect(maxBlockedRooms(blocks, d("2027-06-08"), d("2027-06-10"))).toBe(0);
    expect(maxBlockedRooms(blocks, d("2027-06-15"), d("2027-06-17"))).toBe(0);
  });
});

describe("buildNoticeEmail", () => {
  const base = { subject: "S", heading: "H", guestName: "An <b>", intro: "đã hủy.", rows: [["Mã", "KGS-1"], ["Hoàn tiền", "1.000 ₫"]] as [string, string][], link: "http://x/y?a=1&b=2" };
  it("thoát ký tự HTML trong dữ liệu động và có đủ các dòng", () => {
    const m = buildNoticeEmail(base);
    expect(m.html).toContain("An &lt;b&gt;");
    expect(m.html).not.toContain("An <b>");
    expect(m.html).toContain("a=1&amp;b=2");
    expect(m.html).toContain("Hoàn tiền");
    expect(m.text).toContain("Hoàn tiền: 1.000 ₫");
    expect(m.text).toContain("Chi tiết: http://x/y?a=1&b=2");
  });
});
