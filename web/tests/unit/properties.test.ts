import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cancelQuote } from "@/lib/cancellation";
import { checkReschedule, noShowQuote } from "@/lib/lifecycle";
import { nightlyPrices, stayPrice, type RoomPricing } from "@/lib/pricing";
import { promoCost, settlementGross, splitGross } from "@/lib/settlement";
import { computeDiscount } from "@/lib/voucher";

// Kiểm thử theo thuộc tính: thay vì vài ví dụ cụ thể, fast-check sinh hàng trăm đầu vào ngẫu nhiên
// và kiểm tra những điều luôn phải đúng (bất biến) của các hàm xử lý tiền, giá và vòng đời đơn.

const DAY_MS = 86_400_000;
const BASE = Date.UTC(2027, 0, 1);
const day = (n: number) => new Date(BASE + n * DAY_MS);
const dayOffset = fc.integer({ min: 0, max: 1500 });
const money = fc.integer({ min: 0, max: 200_000_000 });
const percent = fc.integer({ min: 0, max: 100 });

describe("cancelQuote: tiền hoàn và phí giữ lại", () => {
  const input = fc.record({
    checkIn: dayOffset.map(day),
    today: dayOffset.map(day),
    paid: money,
    freeCancelDays: fc.integer({ min: 0, max: 60 }),
    lateFeePercent: fc.integer({ min: -50, max: 150 }), // cố ý vượt miền hợp lệ để thử kẹp giá trị
  });

  it("phí + tiền hoàn luôn bằng đúng số tiền đã trả, không tự sinh hay mất tiền", () => {
    fc.assert(fc.property(input, (i) => {
      const q = cancelQuote(i);
      expect(q.fee + q.refund).toBe(i.paid);
    }));
  });

  it("phí và tiền hoàn đều nằm trong khoảng 0..số đã trả", () => {
    fc.assert(fc.property(input, (i) => {
      const q = cancelQuote(i);
      expect(q.fee).toBeGreaterThanOrEqual(0);
      expect(q.refund).toBeGreaterThanOrEqual(0);
      expect(q.fee).toBeLessThanOrEqual(i.paid);
    }));
  });

  it("hủy trong hạn miễn phí thì hoàn đủ; đơn chưa trả tiền thì không có phí", () => {
    fc.assert(fc.property(input, (i) => {
      const q = cancelQuote(i);
      if (q.free) expect(q.fee).toBe(0);
      if (i.paid === 0) expect(q.fee).toBe(0);
    }));
  });

  it("hủy càng sát ngày nhận phòng thì phí không bao giờ giảm", () => {
    fc.assert(fc.property(dayOffset, fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 200 }), money, fc.integer({ min: 0, max: 60 }), percent,
      (checkIn, a, b, paid, freeCancelDays, lateFeePercent) => {
        const [early, late] = a <= b ? [a, b] : [b, a]; // late là hủy muộn hơn (ít ngày còn lại hơn)
        const mk = (offset: number) => cancelQuote({ checkIn: day(checkIn + 300), today: day(checkIn + 300 - offset), paid, freeCancelDays, lateFeePercent });
        // `late` cách ngày nhận phòng gần hơn ⇒ ít ngày còn lại hơn.
        expect(mk(early).fee).toBeGreaterThanOrEqual(mk(late).fee);
        expect(mk(early).fee).toBeGreaterThanOrEqual(0);
      }));
  });
});

describe("noShowQuote: khách không đến", () => {
  it("luôn bị tính như hủy muộn, kể cả khi khách sạn đặt hạn hủy miễn phí rất ngắn", () => {
    fc.assert(fc.property(dayOffset.map(day), money, fc.integer({ min: 0, max: 60 }), percent, (checkIn, paid, freeCancelDays, lateFeePercent) => {
      const q = noShowQuote({ checkIn, paid, freeCancelDays, lateFeePercent });
      expect(q.fee + q.refund).toBe(paid);
      expect(q.fee).toBe(Math.round((paid * lateFeePercent) / 100));
    }));
  });
});

describe("computeDiscount: giảm giá", () => {
  const voucher = fc.record({
    percentOff: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
    amountOff: fc.option(fc.integer({ min: 1, max: 50_000_000 }), { nil: null }),
    maxDiscount: fc.option(fc.integer({ min: 1, max: 50_000_000 }), { nil: null }),
  });

  it("không bao giờ giảm quá tổng tiền, không âm, không vượt mức giảm tối đa", () => {
    fc.assert(fc.property(voucher, money, (v, subtotal) => {
      const off = computeDiscount(v, subtotal);
      expect(off).toBeGreaterThanOrEqual(0);
      expect(off).toBeLessThanOrEqual(subtotal);
      if (v.maxDiscount) expect(off).toBeLessThanOrEqual(v.maxDiscount);
    }));
  });

  it("tổng tiền càng lớn thì mức giảm không bao giờ giảm đi", () => {
    fc.assert(fc.property(voucher, money, money, (v, a, b) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      expect(computeDiscount(v, hi)).toBeGreaterThanOrEqual(computeDiscount(v, lo));
    }));
  });
});

describe("pricing: giá theo đêm", () => {
  const pricing = fc.record({
    base: fc.integer({ min: 10_000, max: 20_000_000 }),
    weekendPercent: fc.integer({ min: -90, max: 200 }),
    rules: fc.array(
      fc.record({
        name: fc.constant("quy tắc"),
        start: dayOffset,
        length: fc.integer({ min: 1, max: 60 }),
        percent: fc.integer({ min: -90, max: 300 }),
      }).map((r) => ({ name: r.name, startDate: day(r.start), endDate: day(r.start + r.length), percent: r.percent })),
      { maxLength: 4 },
    ),
  }) as fc.Arbitrary<RoomPricing>;

  it("mỗi đêm có đúng một giá và không thấp hơn mức tối thiểu 10.000 ₫", () => {
    fc.assert(fc.property(pricing, dayOffset, fc.integer({ min: 1, max: 30 }), (p, start, nights) => {
      const list = nightlyPrices(p, day(start), day(start + nights));
      expect(list).toHaveLength(nights);
      for (const n of list) expect(n.price).toBeGreaterThanOrEqual(10_000);
    }));
  });

  it("giá cộng được: giá cả kỳ bằng giá hai nửa kỳ cộng lại", () => {
    fc.assert(fc.property(pricing, dayOffset, fc.integer({ min: 1, max: 15 }), fc.integer({ min: 1, max: 15 }), (p, start, a, b) => {
      const whole = stayPrice(p, day(start), day(start + a + b));
      const parts = stayPrice(p, day(start), day(start + a)) + stayPrice(p, day(start + a), day(start + a + b));
      expect(whole).toBe(parts);
    }));
  });

  it("không phụ thu và không quy tắc thì giá = giá gốc × số đêm", () => {
    fc.assert(fc.property(fc.integer({ min: 10_000, max: 20_000_000 }), dayOffset, fc.integer({ min: 1, max: 30 }), (base, start, nights) => {
      expect(stayPrice({ base, weekendPercent: 0, rules: [] }, day(start), day(start + nights))).toBe(base * nights);
    }));
  });

  it("kỳ lưu trú rỗng (nhận = trả) thì giá bằng 0", () => {
    fc.assert(fc.property(pricing, dayOffset, (p, start) => {
      expect(stayPrice(p, day(start), day(start))).toBe(0);
    }));
  });
});

describe("đối soát: bảo toàn tiền", () => {
  const completed = fc.record({ totalPrice: money, discount: fc.integer({ min: 0, max: 50_000_000 }) })
    .map((b) => ({ ...b, status: "COMPLETED", paymentStatus: "PAID", refundAmount: null as number | null }));

  const lateCancelled = fc.integer({ min: 1, max: 200_000_000 }).chain((total) =>
    fc.integer({ min: 0, max: total - 1 }).map((refund) => ({ status: "CANCELLED", paymentStatus: "PAID", totalPrice: total, discount: 0, refundAmount: refund as number | null })),
  );

  it("hoa hồng + tiền chi trả luôn bằng đúng doanh thu, mỗi phần không âm", () => {
    fc.assert(fc.property(money, fc.integer({ min: -20, max: 130 }), (gross, pct) => {
      const { commission, payout } = splitGross(gross, pct);
      expect(commission + payout).toBe(gross);
      expect(commission).toBeGreaterThanOrEqual(0);
      expect(payout).toBeGreaterThanOrEqual(0);
    }));
  });

  it("đơn hoàn tất: tiền khách trả + khuyến mãi sàn chịu = doanh thu tính cho đối tác", () => {
    fc.assert(fc.property(completed, (b) => {
      expect(b.totalPrice + promoCost(b)).toBe(settlementGross(b));
    }));
  });

  it("đơn hủy muộn đã thu tiền: tiền hoàn + phí khách sạn giữ lại = tiền khách đã trả", () => {
    fc.assert(fc.property(lateCancelled, (b) => {
      expect((b.refundAmount ?? 0) + settlementGross(b)).toBe(b.totalPrice);
      expect(promoCost(b)).toBe(0);
    }));
  });

  it("doanh thu đối soát không bao giờ âm, với mọi trạng thái đơn", () => {
    const any = fc.record({
      status: fc.constantFrom("PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"),
      paymentStatus: fc.constantFrom("UNPAID", "PAID", "REFUNDED"),
      totalPrice: money,
      discount: fc.integer({ min: 0, max: 50_000_000 }),
    }).chain((b) => fc.tuple(fc.integer({ min: 0, max: b.totalPrice }), fc.boolean()).map(([r, hasRefund]) => ({ ...b, refundAmount: hasRefund ? r : null })));
    fc.assert(fc.property(any, (b) => {
      expect(settlementGross(b)).toBeGreaterThanOrEqual(0);
    }));
  });
});

describe("checkReschedule: luật đổi ngày", () => {
  const input = fc.record({
    status: fc.constantFrom("PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"),
    paymentStatus: fc.constantFrom("UNPAID", "PAID"),
    checkIn: fc.integer({ min: 0, max: 400 }).map(day),
    oldCheckOut: fc.integer({ min: 401, max: 420 }).map(day),
    checkedInAt: fc.option(fc.constant(day(1)), { nil: null }),
    dateChanges: fc.integer({ min: 0, max: 3 }),
    voucherCode: fc.option(fc.constant("GIAM10"), { nil: null }),
    oldSubtotal: fc.integer({ min: 100_000, max: 5_000_000 }),
    newCheckIn: fc.integer({ min: 0, max: 400 }).map(day),
    newCheckOut: fc.integer({ min: 401, max: 420 }).map(day),
    newSubtotal: fc.integer({ min: 100_000, max: 5_000_000 }),
    today: fc.integer({ min: 0, max: 400 }).map(day),
    freeCancelDays: fc.integer({ min: 0, max: 30 }),
  });

  it("đã đổi một lần, đã nhận phòng, hoặc đơn đã đóng thì luôn bị từ chối", () => {
    fc.assert(fc.property(input, (i) => {
      const r = checkReschedule(i);
      if (i.dateChanges >= 1 || i.checkedInAt || !["PENDING", "CONFIRMED"].includes(i.status)) expect(r.ok).toBe(false);
    }));
  });

  it("đơn được chấp nhận mà đã trả tiền hoặc có mã giảm giá thì giá mới phải đúng bằng giá cũ", () => {
    fc.assert(fc.property(input, (i) => {
      const r = checkReschedule(i);
      if (r.ok && (i.paymentStatus === "PAID" || i.voucherCode)) expect(i.newSubtotal).toBe(i.oldSubtotal);
    }));
  });

  it("đơn đã trả tiền mà quá hạn hủy miễn phí thì không đổi ngày được (không né phí hủy muộn)", () => {
    fc.assert(fc.property(input, (i) => {
      const daysLeft = Math.round((i.checkIn.getTime() - i.today.getTime()) / DAY_MS);
      if (i.paymentStatus === "PAID" && daysLeft < i.freeCancelDays) expect(checkReschedule(i).ok).toBe(false);
    }));
  });
});
