import { describe, expect, it } from "vitest";
import { isWeekendNight, nightlyPrices, stayPrice, type RoomPricing } from "@/lib/pricing";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
// 2026-10-23 là thứ Sáu, 2026-10-24 thứ Bảy, 2026-10-25 Chủ nhật
const base: RoomPricing = { base: 1_000_000, weekendPercent: 0, rules: [] };

describe("giá theo đêm", () => {
  it("không có phụ thu thì mọi đêm bằng giá gốc", () => {
    expect(nightlyPrices(base, d("2026-10-22"), d("2026-10-25")).map((n) => n.price)).toEqual([1_000_000, 1_000_000, 1_000_000]);
    expect(stayPrice(base, d("2026-10-22"), d("2026-10-25"))).toBe(3_000_000);
  });

  it("đêm thứ Sáu và thứ Bảy là đêm cuối tuần, Chủ nhật thì không", () => {
    expect(isWeekendNight(d("2026-10-23"))).toBe(true);
    expect(isWeekendNight(d("2026-10-24"))).toBe(true);
    expect(isWeekendNight(d("2026-10-25"))).toBe(false);
  });

  it("phụ thu cuối tuần chỉ áp cho đêm thứ Sáu và thứ Bảy", () => {
    const p = { ...base, weekendPercent: 20 };
    const n = nightlyPrices(p, d("2026-10-22"), d("2026-10-26"));
    expect(n.map((x) => x.price)).toEqual([1_000_000, 1_200_000, 1_200_000, 1_000_000]);
    expect(n[1].reasons).toEqual(["Cuối tuần"]);
  });

  it("quy tắc theo mùa tính theo nửa mở [bắt đầu, kết thúc)", () => {
    const p: RoomPricing = { ...base, rules: [{ name: "Lễ", startDate: d("2026-10-22"), endDate: d("2026-10-24"), percent: 50 }] };
    expect(nightlyPrices(p, d("2026-10-21"), d("2026-10-25")).map((x) => x.price)).toEqual([1_000_000, 1_500_000, 1_500_000, 1_000_000]);
  });

  it("phụ thu cuối tuần và quy tắc cộng dồn; giảm giá được; không thấp hơn mức tối thiểu", () => {
    const p: RoomPricing = { base: 1_000_000, weekendPercent: 20, rules: [{ name: "Lễ", startDate: d("2026-10-23"), endDate: d("2026-10-24"), percent: 30 }] };
    const n = nightlyPrices(p, d("2026-10-23"), d("2026-10-25"));
    expect(n[0].price).toBe(1_500_000); // thứ Sáu: +20% +30%
    expect(n[0].reasons).toEqual(["Cuối tuần", "Lễ"]);
    expect(n[1].price).toBe(1_200_000); // thứ Bảy: chỉ cuối tuần
    expect(nightlyPrices({ base: 12_000, weekendPercent: 0, rules: [{ name: "x", startDate: d("2026-10-21"), endDate: d("2026-10-22"), percent: -50 }] }, d("2026-10-21"), d("2026-10-22"))[0].price).toBe(10_000);
  });
});
