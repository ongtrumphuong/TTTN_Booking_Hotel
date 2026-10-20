import { describe, expect, it } from "vitest";
import { maxBlockedRooms, needsRefund, paymentLabel } from "@/lib/booking";
import { cancelQuote, policyText } from "@/lib/cancellation";
import { buildNoticeEmail } from "@/lib/email";
import { boundsOf, compactPrice, mapboxToken } from "@/lib/map";
import { settlementGross, splitGross } from "@/lib/settlement";
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

describe("đối soát với đối tác", () => {
  const base = { status: "COMPLETED", paymentStatus: "PAID", totalPrice: 1_000_000, refundAmount: null as number | null };
  it("đơn hoàn tất tính toàn bộ số tiền khách trả", () => expect(settlementGross(base)).toBe(1_000_000));
  it("đơn hủy muộn: chỉ tính phần phí khách sạn giữ lại", () => {
    expect(settlementGross({ ...base, status: "CANCELLED", refundAmount: 400_000 })).toBe(600_000);
    expect(settlementGross({ ...base, status: "CANCELLED", paymentStatus: "REFUNDED", refundAmount: 0 })).toBe(1_000_000);
  });
  it("hủy hoàn đủ, chưa trả tiền, chưa hoàn tất thì không có doanh thu", () => {
    expect(settlementGross({ ...base, status: "CANCELLED", refundAmount: 1_000_000 })).toBe(0);
    expect(settlementGross({ ...base, status: "CANCELLED", paymentStatus: "UNPAID", refundAmount: null })).toBe(0);
    expect(settlementGross({ ...base, status: "CONFIRMED" })).toBe(0);
    expect(settlementGross({ ...base, status: "PENDING", paymentStatus: "UNPAID" })).toBe(0);
  });
  it("splitGross: hoa hồng làm tròn, tổng luôn bằng số gốc, tỷ lệ bị kẹp 0..100", () => {
    expect(splitGross(1_000_000, 10)).toEqual({ commission: 100_000, payout: 900_000 });
    expect(splitGross(333_333, 10)).toEqual({ commission: 33_333, payout: 300_000 });
    expect(splitGross(1_000, 150)).toEqual({ commission: 1_000, payout: 0 });
    expect(splitGross(1_000, -5)).toEqual({ commission: 0, payout: 1_000 });
  });
});

describe("bản đồ: token, giá gọn, khung bao", () => {
  it("chỉ nhận token công khai pk.…; khóa bí mật sk.… hoặc rỗng thì bỏ qua (không bao giờ đưa khóa bí mật ra trình duyệt)", () => {
    expect(mapboxToken({ NEXT_PUBLIC_MAPBOX_TOKEN: " pk.abc.def " })).toBe("pk.abc.def");
    expect(mapboxToken({ MAPBOX_TOKEN: "pk.xyz" })).toBe("pk.xyz");
    expect(mapboxToken({ NEXT_PUBLIC_MAPBOX_TOKEN: "sk.secret" })).toBeNull();
    expect(mapboxToken({ NEXT_PUBLIC_MAPBOX_TOKEN: "" })).toBeNull();
    expect(mapboxToken({})).toBeNull();
  });
  it("compactPrice", () => {
    expect(compactPrice(1_350_000)).toBe("1,35tr");
    expect(compactPrice(2_000_000)).toBe("2tr");
    expect(compactPrice(12_500_000)).toBe("12,5tr");
    expect(compactPrice(950_000)).toBe("950k");
    expect(compactPrice(780_000)).toBe("780k");
  });
  it("boundsOf: khung bao các điểm hợp lệ, bỏ điểm sai tọa độ, rỗng thì null", () => {
    expect(boundsOf([{ lat: 10, lng: 100 }, { lat: 12, lng: 98 }, { lat: 11, lng: 105 }])).toEqual([[98, 10], [105, 12]]);
    expect(boundsOf([{ lat: 999, lng: 0 }, { lat: Number.NaN, lng: 1 }])).toBeNull();
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ lat: 10, lng: 106 }])).toEqual([[106, 10], [106, 10]]);
  });
});
