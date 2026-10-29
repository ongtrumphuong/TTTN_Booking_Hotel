import { describe, expect, it } from "vitest";
import { NO_SHOW_REPORT_DAYS, autoCompleteUnattendedBefore, canMarkNoShow, checkReschedule, noShowQuote } from "@/lib/lifecycle";

const DAY = 86_400_000;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("khách không đến", () => {
  const b = { status: "CONFIRMED", checkIn: d("2026-11-10"), checkedInAt: null as Date | null };

  it("chỉ báo được từ ngày sau ngày nhận phòng, khi chưa nhận phòng", () => {
    expect(canMarkNoShow(b, d("2026-11-10"))).toBe(false); // đúng ngày nhận phòng: khách còn có thể đến muộn trong ngày
    expect(canMarkNoShow(b, d("2026-11-11"))).toBe(true);
    expect(canMarkNoShow({ ...b, checkedInAt: d("2026-11-10") }, d("2026-11-11"))).toBe(false);
    expect(canMarkNoShow({ ...b, status: "COMPLETED" }, d("2026-11-11"))).toBe(false);
    expect(canMarkNoShow({ ...b, status: "PENDING" }, d("2026-11-11"))).toBe(false);
  });

  it("giữ phí như hủy muộn, kể cả khi khách sạn cho hủy miễn phí tới sát ngày nhận phòng", () => {
    expect(noShowQuote({ checkIn: d("2026-11-10"), paid: 2_000_000, freeCancelDays: 1, lateFeePercent: 50 })).toMatchObject({ free: false, fee: 1_000_000, refund: 1_000_000 });
    expect(noShowQuote({ checkIn: d("2026-11-10"), paid: 2_000_000, freeCancelDays: 0, lateFeePercent: 100 })).toMatchObject({ fee: 2_000_000, refund: 0 });
  });

  it("đơn chưa trả tiền thì không phát sinh phí", () => {
    expect(noShowQuote({ checkIn: d("2026-11-10"), paid: 0, freeCancelDays: 1, lateFeePercent: 50 })).toMatchObject({ fee: 0, refund: 0 });
  });

  it("mốc tự hoàn tất đơn không có ghi nhận nhận phòng lùi lại đúng số ngày báo không đến", () => {
    expect(autoCompleteUnattendedBefore(d("2026-11-20")).getTime()).toBe(d("2026-11-20").getTime() - NO_SHOW_REPORT_DAYS * DAY);
  });
});

describe("đổi ngày ở", () => {
  const base = {
    status: "CONFIRMED",
    paymentStatus: "PAID",
    checkIn: d("2026-11-10"),
    oldCheckOut: d("2026-11-12"),
    checkedInAt: null as Date | null,
    dateChanges: 0,
    voucherCode: null as string | null,
    oldSubtotal: 2_000_000,
    newCheckIn: d("2026-11-14"),
    newCheckOut: d("2026-11-16"),
    newSubtotal: 2_000_000,
    today: d("2026-11-01"),
    freeCancelDays: 1,
  };

  it("đơn đã trả tiền đổi được sang ngày cùng giá, giữ nguyên giá", () => {
    expect(checkReschedule(base)).toEqual({ ok: true, keepsPrice: true });
  });

  it("đơn đã trả tiền không đổi sang ngày khác giá (không thu thêm, không hoàn chênh lệch)", () => {
    const r = checkReschedule({ ...base, newSubtotal: 2_600_000 });
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(/cùng giá/);
  });

  it("đơn có mã giảm giá cũng phải cùng giá", () => {
    expect(checkReschedule({ ...base, paymentStatus: "UNPAID", status: "PENDING", voucherCode: "SALE", newSubtotal: 1_000_000 })).toMatchObject({ ok: false });
  });

  it("đơn chưa trả tiền và không có mã thì tính lại theo giá mới", () => {
    expect(checkReschedule({ ...base, paymentStatus: "UNPAID", status: "PENDING", newSubtotal: 2_600_000 })).toEqual({ ok: true, keepsPrice: false });
  });

  it("chỉ đổi 1 lần", () => {
    expect(checkReschedule({ ...base, dateChanges: 1 })).toMatchObject({ ok: false, error: expect.stringContaining("1 lần") });
  });

  it("đã nhận phòng, đã hủy, hoàn tất hoặc đã đến ngày nhận phòng thì không đổi được", () => {
    expect(checkReschedule({ ...base, checkedInAt: d("2026-11-10") })).toMatchObject({ ok: false });
    expect(checkReschedule({ ...base, status: "CANCELLED" })).toMatchObject({ ok: false });
    expect(checkReschedule({ ...base, status: "COMPLETED" })).toMatchObject({ ok: false });
    expect(checkReschedule({ ...base, today: d("2026-11-10") })).toMatchObject({ ok: false });
  });

  it("đơn đã trả tiền chỉ đổi trong hạn hủy miễn phí (không né phí hủy muộn bằng cách đổi ngày)", () => {
    expect(checkReschedule({ ...base, today: d("2026-11-09"), freeCancelDays: 3 })).toMatchObject({ ok: false, error: expect.stringContaining("hạn đổi ngày") });
    // đơn chưa trả tiền thì không có phí để né
    expect(checkReschedule({ ...base, today: d("2026-11-09"), freeCancelDays: 3, paymentStatus: "UNPAID", status: "PENDING" })).toMatchObject({ ok: true });
  });

  it("ngày mới không ở quá khứ và không trùng ngày cũ", () => {
    expect(checkReschedule({ ...base, newCheckIn: d("2026-10-30"), newCheckOut: d("2026-11-01") })).toMatchObject({ ok: false });
    expect(checkReschedule({ ...base, newCheckIn: base.checkIn, newCheckOut: base.oldCheckOut })).toMatchObject({ ok: false, error: expect.stringContaining("trùng") });
  });
});
