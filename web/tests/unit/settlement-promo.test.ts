import { describe, expect, it } from "vitest";
import { promoCost, settlementGross, splitGross } from "@/lib/settlement";

// Khách trả 900.000 sau khi dùng mã giảm 100.000: giá phòng trước giảm là 1.000.000.
const withVoucher = { status: "COMPLETED", paymentStatus: "PAID", totalPrice: 900_000, discount: 100_000, refundAmount: null };

describe("mã giảm giá của sàn do sàn chịu", () => {
  it("đơn hoàn tất: đối tác được tính theo giá trước giảm, như khi khách không dùng mã", () => {
    expect(settlementGross(withVoucher)).toBe(1_000_000);
    expect(settlementGross({ ...withVoucher, discount: 0, totalPrice: 1_000_000 })).toBe(1_000_000);
  });

  it("hoa hồng tính trên giá trước giảm; đối tác nhận đủ phần còn lại", () => {
    const gross = settlementGross(withVoucher);
    expect(splitGross(gross, 10)).toEqual({ commission: 100_000, payout: 900_000 });
  });

  it("tiền sàn chịu = mã giảm của đơn hoàn tất; thu nhập ròng của sàn = hoa hồng − khuyến mãi", () => {
    expect(promoCost(withVoucher)).toBe(100_000);
    const { commission } = splitGross(settlementGross(withVoucher), 10);
    expect(commission - promoCost(withVoucher)).toBe(0); // hoa hồng 100k vừa đủ bù mã giảm 100k
    const big = { ...withVoucher, totalPrice: 700_000, discount: 300_000 };
    expect(splitGross(settlementGross(big), 10).commission - promoCost(big)).toBe(-200_000); // sàn lỗ trên đơn này
  });

  it("đơn không hoàn tất không phát sinh khuyến mãi sàn chịu", () => {
    for (const status of ["CONFIRMED", "PENDING", "CANCELLED"]) {
      expect(promoCost({ ...withVoucher, status })).toBe(0);
    }
  });

  it("hủy muộn: phí giữ lại tính trên số tiền khách thực trả, không bù giảm giá", () => {
    const cancelled = { status: "CANCELLED", paymentStatus: "PAID", totalPrice: 900_000, discount: 100_000, refundAmount: 450_000 };
    expect(settlementGross(cancelled)).toBe(450_000);
    expect(promoCost(cancelled)).toBe(0);
  });

  it("đơn không có thông tin giảm giá (dữ liệu cũ) vẫn tính như trước", () => {
    expect(settlementGross({ status: "COMPLETED", paymentStatus: "PAID", totalPrice: 1_000_000, refundAmount: null })).toBe(1_000_000);
  });
});
