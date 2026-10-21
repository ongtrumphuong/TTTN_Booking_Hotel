// Khiếu nại của khách: quy tắc thuần (ai được khiếu nại khi nào, quyết định xử lý hợp lệ ra sao) để dùng ở máy chủ, giao diện và kiểm thử.

/** Khách được gửi khiếu nại từ ngày nhận phòng đến hết số ngày này sau ngày trả phòng. */
export const DISPUTE_WINDOW_DAYS = 14;

export const CATEGORY_LABEL = {
  ROOM_MISMATCH: "Phòng không đúng mô tả",
  CLEANLINESS: "Vệ sinh, chất lượng phòng",
  SERVICE: "Thái độ, dịch vụ",
  OVERCHARGE: "Bị thu thêm tiền",
  OTHER: "Vấn đề khác",
} as const;
export type DisputeCategoryKey = keyof typeof CATEGORY_LABEL;
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as DisputeCategoryKey[];

export const DISPUTE_STATUS = {
  OPEN: { text: "Chờ đối tác phản hồi", cls: "bg-amber-100 text-amber-800" },
  UNDER_REVIEW: { text: "Sàn đang xem xét", cls: "bg-sky-100 text-sky-800" },
  RESOLVED: { text: "Đã giải quyết", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { text: "Đã bác bỏ", cls: "bg-slate-200 text-slate-700" },
} as const;
export type DisputeStatusKey = keyof typeof DISPUTE_STATUS;

export const isFinal = (status: string) => status === "RESOLVED" || status === "REJECTED";

type Eligibility = { status: string; paymentStatus: string; checkIn: Date; checkOut: Date };

/** Khách khiếu nại được khi đơn đã thanh toán, đã đến ngày nhận phòng và chưa quá hạn; mỗi đơn chỉ một khiếu nại. */
export function canDispute(b: Eligibility, today: Date, hasDispute: boolean): { ok: true } | { ok: false; reason: string } {
  if (hasDispute) return { ok: false, reason: "Đơn này đã có khiếu nại." };
  if (b.paymentStatus !== "PAID" || (b.status !== "CONFIRMED" && b.status !== "COMPLETED")) return { ok: false, reason: "Chỉ đơn đã thanh toán và đã diễn ra mới khiếu nại được." };
  if (b.checkIn.getTime() > today.getTime()) return { ok: false, reason: "Bạn chỉ khiếu nại được từ ngày nhận phòng." };
  const deadline = b.checkOut.getTime() + DISPUTE_WINDOW_DAYS * 86_400_000;
  if (today.getTime() > deadline) return { ok: false, reason: `Đã quá ${DISPUTE_WINDOW_DAYS} ngày kể từ ngày trả phòng nên không nhận khiếu nại nữa.` };
  return { ok: true };
}

export type Resolution = { decision: "REFUND" | "REJECT"; refund: number; partnerBears: number; note: string };

/**
 * Kiểm tra quyết định của sàn. Hoàn tiền: 1 đến tổng tiền đơn; đối tác chịu từ 0 đến số tiền hoàn (phần còn lại sàn chịu)
 * và chỉ khi khách sạn có đối tác. Bác bỏ: không hoàn gì. Luôn phải có lý do để hai bên hiểu.
 */
export function validateResolution(r: Resolution, ctx: { totalPrice: number; hasOwner: boolean }): { ok: true; refund: number; partnerBears: number } | { ok: false; error: string } {
  if (r.note.trim().length < 5) return { ok: false, error: "Vui lòng nhập lý do quyết định (ít nhất 5 ký tự)." };
  if (r.note.length > 1000) return { ok: false, error: "Lý do tối đa 1000 ký tự." };
  if (r.decision === "REJECT") return { ok: true, refund: 0, partnerBears: 0 };
  if (!Number.isInteger(r.refund) || r.refund < 1) return { ok: false, error: "Số tiền hoàn phải lớn hơn 0." };
  if (r.refund > ctx.totalPrice) return { ok: false, error: "Số tiền hoàn không được vượt quá tổng tiền của đơn." };
  if (!Number.isInteger(r.partnerBears) || r.partnerBears < 0) return { ok: false, error: "Phần đối tác chịu không hợp lệ." };
  if (r.partnerBears > r.refund) return { ok: false, error: "Phần đối tác chịu không được lớn hơn số tiền hoàn." };
  if (r.partnerBears > 0 && !ctx.hasOwner) return { ok: false, error: "Khách sạn do sàn tự vận hành nên sàn chịu toàn bộ, không trừ vào đối tác." };
  return { ok: true, refund: r.refund, partnerBears: r.partnerBears };
}
