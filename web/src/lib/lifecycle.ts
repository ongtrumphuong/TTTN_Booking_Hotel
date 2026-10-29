import { cancelQuote, type CancelQuote } from "@/lib/cancellation";

const DAY_MS = 86_400_000;

/** Sau ngày trả phòng, khách sạn còn bao nhiêu ngày để báo "khách không đến"; hết hạn thì đơn tự chuyển Hoàn tất. */
export const NO_SHOW_REPORT_DAYS = 2;

type StayState = { status: string; checkIn: Date; checkedInAt: Date | null };

/** Chỉ báo "không đến" được cho đơn đã xác nhận, chưa nhận phòng, và từ ngày sau ngày nhận phòng trở đi. */
export function canMarkNoShow(b: StayState, today: Date) {
  return b.status === "CONFIRMED" && !b.checkedInAt && today.getTime() > b.checkIn.getTime();
}

/** Khách không đến bị giữ phí như hủy muộn (theo % khách sạn đã đặt cho hủy muộn); đơn chưa trả tiền thì không có gì để giữ. */
export function noShowQuote(i: { checkIn: Date; paid: number; freeCancelDays: number; lateFeePercent: number }): CancelQuote {
  // Lấy "hôm nay" là sau ngày nhận phòng một ngày để luôn rơi vào nhánh hủy muộn, bất kể hạn hủy miễn phí của khách sạn.
  return cancelQuote({ ...i, today: new Date(i.checkIn.getTime() + DAY_MS) });
}

/** Mốc ngày trả phòng mà đơn đã nhận phòng được tự chuyển Hoàn tất. */
export const autoCompleteBefore = (today: Date) => today;
/** Đơn không có ghi nhận nhận phòng: chờ thêm NO_SHOW_REPORT_DAYS ngày (để khách sạn báo không đến) rồi mới tự hoàn tất. */
export const autoCompleteUnattendedBefore = (today: Date) => new Date(today.getTime() - NO_SHOW_REPORT_DAYS * DAY_MS);

export type RescheduleInput = {
  status: string;
  paymentStatus: string;
  checkIn: Date;
  oldCheckOut: Date;
  checkedInAt: Date | null;
  dateChanges: number;
  voucherCode: string | null;
  /** Giá phòng trước giảm giá của đơn hiện tại (totalPrice + discount). */
  oldSubtotal: number;
  newCheckIn: Date;
  newCheckOut: Date;
  /** Giá phòng trước giảm giá của khoảng ngày mới, tính lại ở máy chủ. */
  newSubtotal: number;
  today: Date;
  freeCancelDays: number;
};

export type RescheduleResult = { ok: true; keepsPrice: boolean } | { ok: false; error: string };

/**
 * Luật đổi ngày ở: đơn chưa nhận phòng, đổi tối đa 1 lần, đơn đã trả tiền phải còn trong hạn hủy miễn phí (đổi ngày không phải cách né phí hủy muộn),
 * và đơn đã thanh toán hoặc có mã giảm giá chỉ đổi được sang khoảng ngày có cùng giá (không thu thêm, không hoàn chênh lệch).
 * Đơn chưa trả tiền và không có mã thì tính lại theo giá mới.
 */
export function checkReschedule(i: RescheduleInput): RescheduleResult {
  if (i.status !== "PENDING" && i.status !== "CONFIRMED") return { ok: false, error: "Đơn này không còn đổi ngày được." };
  if (i.checkedInAt) return { ok: false, error: "Khách đã nhận phòng, không thể đổi ngày." };
  if (i.dateChanges >= 1) return { ok: false, error: "Mỗi đơn chỉ được đổi ngày 1 lần. Nếu cần, hãy hủy và đặt lại." };
  if (i.checkIn.getTime() <= i.today.getTime()) return { ok: false, error: "Đã đến ngày nhận phòng, không thể đổi ngày." };
  if (i.newCheckIn.getTime() < i.today.getTime()) return { ok: false, error: "Ngày nhận phòng mới không được ở trong quá khứ." };
  if (i.newCheckIn.getTime() === i.checkIn.getTime() && i.newCheckOut.getTime() === i.oldCheckOut.getTime()) {
    return { ok: false, error: "Ngày mới trùng với ngày đang đặt." };
  }
  const paid = i.paymentStatus === "PAID";
  const daysLeft = Math.round((i.checkIn.getTime() - i.today.getTime()) / DAY_MS);
  if (paid && daysLeft < i.freeCancelDays) {
    return { ok: false, error: `Đã quá hạn đổi ngày: chỉ đổi được trước ngày nhận phòng ít nhất ${i.freeCancelDays} ngày.` };
  }
  const keepsPrice = paid || !!i.voucherCode;
  if (keepsPrice && i.newSubtotal !== i.oldSubtotal) {
    const fmt = (n: number) => `${n.toLocaleString("vi-VN")} ₫`;
    return {
      ok: false,
      error: `Khoảng ngày mới có giá ${fmt(i.newSubtotal)}, khác giá đơn hiện tại ${fmt(i.oldSubtotal)}. Đơn đã thanh toán hoặc có mã giảm giá chỉ đổi được sang ngày cùng giá; nếu khác giá, vui lòng hủy và đặt lại.`,
    };
  }
  return { ok: true, keepsPrice };
}
