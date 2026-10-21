import { describe, expect, it } from "vitest";
import { DISPUTE_WINDOW_DAYS, canDispute, isFinal, validateResolution } from "@/lib/dispute";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const base = { status: "COMPLETED", paymentStatus: "PAID", checkIn: D("2026-10-10"), checkOut: D("2026-10-12") };

describe("canDispute: khách khiếu nại được khi nào", () => {
  it("được khi đơn đã thanh toán, đã đến ngày nhận phòng và còn trong hạn", () => {
    expect(canDispute(base, D("2026-10-12"), false)).toEqual({ ok: true });
    expect(canDispute({ ...base, status: "CONFIRMED", checkOut: D("2026-10-15") }, D("2026-10-11"), false)).toEqual({ ok: true }); // đang ở
    expect(canDispute(base, D("2026-10-10"), false)).toEqual({ ok: true }); // đúng ngày nhận phòng
  });

  it("không được trước ngày nhận phòng", () => {
    const r = canDispute(base, D("2026-10-09"), false);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.reason).toMatch(/từ ngày nhận phòng/);
  });

  it(`hết hạn sau ${DISPUTE_WINDOW_DAYS} ngày kể từ ngày trả phòng (ngày cuối vẫn được)`, () => {
    expect(canDispute(base, D("2026-10-26"), false)).toEqual({ ok: true });
    expect(canDispute(base, D("2026-10-27"), false)).toMatchObject({ ok: false });
  });

  it("không được khi chưa thanh toán, đã hủy, đang chờ thanh toán", () => {
    expect(canDispute({ ...base, paymentStatus: "UNPAID" }, D("2026-10-12"), false)).toMatchObject({ ok: false });
    expect(canDispute({ ...base, status: "CANCELLED" }, D("2026-10-12"), false)).toMatchObject({ ok: false });
    expect(canDispute({ ...base, status: "PENDING" }, D("2026-10-12"), false)).toMatchObject({ ok: false });
  });

  it("mỗi đơn chỉ một khiếu nại", () => {
    expect(canDispute(base, D("2026-10-12"), true)).toMatchObject({ ok: false, reason: "Đơn này đã có khiếu nại." });
  });
});

describe("validateResolution: quyết định của sàn", () => {
  const ctx = { totalPrice: 2_000_000, hasOwner: true };
  const ok = (over: Partial<Parameters<typeof validateResolution>[0]> = {}) => validateResolution({ decision: "REFUND", refund: 500_000, partnerBears: 300_000, note: "Phòng không đúng mô tả", ...over }, ctx);

  it("hoàn tiền hợp lệ: chia phần đối tác chịu và phần sàn chịu", () => {
    expect(ok()).toEqual({ ok: true, refund: 500_000, partnerBears: 300_000 });
    expect(ok({ partnerBears: 0 })).toEqual({ ok: true, refund: 500_000, partnerBears: 0 }); // sàn chịu hết
    expect(ok({ refund: 2_000_000, partnerBears: 2_000_000 })).toMatchObject({ ok: true }); // hoàn tối đa bằng tổng tiền đơn
  });

  it("từ chối số tiền sai", () => {
    expect(ok({ refund: 0 })).toMatchObject({ ok: false });
    expect(ok({ refund: -5 })).toMatchObject({ ok: false });
    expect(ok({ refund: 2_000_001 })).toMatchObject({ ok: false, error: expect.stringContaining("vượt quá") });
    expect(ok({ refund: 1.5 })).toMatchObject({ ok: false });
    expect(ok({ refund: Number.NaN })).toMatchObject({ ok: false });
  });

  it("phần đối tác chịu không âm và không vượt số tiền hoàn", () => {
    expect(ok({ partnerBears: -1 })).toMatchObject({ ok: false });
    expect(ok({ partnerBears: 500_001 })).toMatchObject({ ok: false });
  });

  it("khách sạn của sàn tự vận hành thì không trừ vào đối tác", () => {
    expect(validateResolution({ decision: "REFUND", refund: 100_000, partnerBears: 1, note: "Lỗi của sàn" }, { totalPrice: 1_000_000, hasOwner: false })).toMatchObject({ ok: false });
    expect(validateResolution({ decision: "REFUND", refund: 100_000, partnerBears: 0, note: "Lỗi của sàn" }, { totalPrice: 1_000_000, hasOwner: false })).toMatchObject({ ok: true });
  });

  it("bác bỏ: không hoàn gì dù có điền số; luôn cần lý do", () => {
    expect(ok({ decision: "REJECT", refund: 999, partnerBears: 999 })).toEqual({ ok: true, refund: 0, partnerBears: 0 });
    expect(ok({ decision: "REJECT", note: "ngắn" })).toMatchObject({ ok: false });
    expect(ok({ note: "    " })).toMatchObject({ ok: false });
    expect(ok({ note: "x".repeat(1001) })).toMatchObject({ ok: false });
  });
});

describe("isFinal", () => {
  it("chỉ RESOLVED và REJECTED là trạng thái cuối", () => {
    expect(isFinal("RESOLVED")).toBe(true);
    expect(isFinal("REJECTED")).toBe(true);
    expect(isFinal("OPEN")).toBe(false);
    expect(isFinal("UNDER_REVIEW")).toBe(false);
  });
});
