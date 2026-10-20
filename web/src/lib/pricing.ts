// Giá phòng theo đêm: giá gốc, cộng phụ thu cuối tuần (thứ Sáu và thứ Bảy) và các quy tắc theo mùa/ngày lễ.
// Toàn bộ là hàm thuần để dùng chung cho đặt phòng, trợ lý ảo, trang khách sạn và kiểm thử. Giá thật luôn tính lại ở máy chủ.

const DAY_MS = 86_400_000;
const MIN_PRICE = 10_000;

export type PriceRuleSpan = { name: string; startDate: Date; endDate: Date; percent: number };
export type RoomPricing = { base: number; weekendPercent: number; rules: PriceRuleSpan[] };

export type Night = {
  date: Date;
  price: number;
  /** Phần trăm điều chỉnh tổng cộng so với giá gốc (0 = giá gốc). */
  percent: number;
  /** Lý do điều chỉnh để hiển thị, ví dụ "Cuối tuần", "Tết Dương lịch". */
  reasons: string[];
};

/** Đêm thứ Sáu hoặc thứ Bảy (đêm bắt đầu từ ngày đó). `date` là ngày UTC 00:00. */
export const isWeekendNight = (date: Date) => date.getUTCDay() === 5 || date.getUTCDay() === 6;

/** Giá của từng đêm trong [checkIn, checkOut). Các điều chỉnh cộng dồn theo phần trăm của giá gốc; giá không thấp hơn mức tối thiểu. */
export function nightlyPrices(p: RoomPricing, checkIn: Date, checkOut: Date): Night[] {
  const nights: Night[] = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += DAY_MS) {
    const date = new Date(t);
    let percent = 0;
    const reasons: string[] = [];
    if (p.weekendPercent !== 0 && isWeekendNight(date)) {
      percent += p.weekendPercent;
      reasons.push("Cuối tuần");
    }
    for (const r of p.rules) {
      if (r.startDate.getTime() <= t && t < r.endDate.getTime()) {
        percent += r.percent;
        reasons.push(r.name);
      }
    }
    const price = Math.max(MIN_PRICE, Math.round((p.base * (100 + percent)) / 100));
    nights.push({ date, price, percent, reasons });
  }
  return nights;
}

/** Tổng tiền một phòng cho cả kỳ lưu trú. */
export const stayPrice = (p: RoomPricing, checkIn: Date, checkOut: Date) => nightlyPrices(p, checkIn, checkOut).reduce((sum, n) => sum + n.price, 0);
