const DAY_MS = 86_400_000;

export type CancelQuote = {
  /** Số ngày từ hôm nay đến ngày nhận phòng. */
  daysLeft: number;
  /** Còn trong hạn hủy miễn phí. */
  free: boolean;
  /** Tiền khách đã trả bị giữ lại theo chính sách. */
  fee: number;
  /** Tiền hoàn lại cho khách. */
  refund: number;
};

/**
 * Tính tiền hoàn khi khách tự hủy. Đơn chưa thanh toán (paid = 0) không mất phí.
 * Hủy trước ngày nhận phòng ít nhất freeCancelDays ngày thì hoàn đủ; muộn hơn thì giữ lateFeePercent% số tiền đã trả.
 */
export function cancelQuote(i: { checkIn: Date; today: Date; paid: number; freeCancelDays: number; lateFeePercent: number }): CancelQuote {
  const daysLeft = Math.round((i.checkIn.getTime() - i.today.getTime()) / DAY_MS);
  const free = i.paid <= 0 || daysLeft >= i.freeCancelDays;
  const pct = Math.min(Math.max(i.lateFeePercent, 0), 100);
  const fee = free ? 0 : Math.round((i.paid * pct) / 100);
  return { daysLeft, free, fee, refund: Math.max(i.paid, 0) - fee };
}

export function policyText(freeCancelDays: number, lateFeePercent: number) {
  const free = freeCancelDays <= 0 ? "Hủy miễn phí cho tới ngày nhận phòng" : `Hủy miễn phí nếu hủy trước ngày nhận phòng ít nhất ${freeCancelDays} ngày`;
  const late = freeCancelDays <= 0 ? "" : lateFeePercent >= 100 ? "; hủy muộn hơn sẽ không được hoàn tiền" : `; hủy muộn hơn bị giữ ${lateFeePercent}% số tiền đã trả`;
  return `${free}${late}.`;
}
