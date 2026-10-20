import { randomInt } from "node:crypto";
import type { BookingStatus, Prisma } from "@prisma/client";

const DAY_MS = 86_400_000;
export const PENDING_HOLD_MINUTES = 30;

export type Stay = { checkIn: Date; checkOut: Date; nights: number };

/** Đọc "yyyy-mm-dd" thành khoảng lưu trú hợp lệ (1–30 đêm) hoặc null. */
export function parseStay(checkIn?: string, checkOut?: string): Stay | null {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!checkIn || !checkOut || !re.test(checkIn) || !re.test(checkOut)) return null;
  const a = new Date(`${checkIn}T00:00:00.000Z`);
  const b = new Date(`${checkOut}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const nights = Math.round((b.getTime() - a.getTime()) / DAY_MS);
  if (nights < 1 || nights > 30) return null;
  return { checkIn: a, checkOut: b, nights };
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function todayUTC() {
  return new Date(`${isoDate(new Date())}T00:00:00.000Z`);
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function bookingCode() {
  return "KGS-" + Array.from({ length: 8 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
}

/** Đơn đang giữ phòng: đã xác nhận, hoặc chờ thanh toán chưa quá hạn giữ chỗ. */
export function holdingWhere(): Prisma.BookingWhereInput {
  const cutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60_000);
  return { OR: [{ status: "CONFIRMED" }, { status: "PENDING", createdAt: { gt: cutoff } }] };
}

/** Số phòng của một loại phòng đã bị giữ trong khoảng ngày. */
export async function bookedQuantity(
  db: Pick<Prisma.TransactionClient, "booking">,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
) {
  const agg = await db.booking.aggregate({
    _sum: { rooms: true },
    where: { roomId, checkIn: { lt: checkOut }, checkOut: { gt: checkIn }, ...holdingWhere() },
  });
  return agg._sum.rooms ?? 0;
}

// Trạng thái kế tiếp admin được phép chuyển; CANCELLED và COMPLETED là trạng thái cuối.
export const NEXT_STATUS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
};

export const PAYMENT_LABEL: Record<string, string> = { UNPAID: "Chưa thanh toán", PAID: "Đã thanh toán", REFUNDED: "Đã hoàn tiền" };

/** Đơn đã hủy mà tiền vẫn ở trạng thái đã thanh toán nghĩa là đang chờ hoàn tiền. */
/** Đơn đã quá thời gian giữ phòng chưa (tính từ lúc tạo đơn). */
export const holdExpired = (createdAt: Date) => createdAt.getTime() < Date.now() - PENDING_HOLD_MINUTES * 60_000;

export const needsRefund = (status: string, paymentStatus: string) => status === "CANCELLED" && paymentStatus === "PAID";

export function paymentLabel(status: string, paymentStatus: string) {
  return needsRefund(status, paymentStatus) ? "Chờ hoàn tiền" : PAYMENT_LABEL[paymentStatus];
}

/**
 * Trạng thái thanh toán sau khi hủy đơn. Đơn trả tiền thật qua VNPay phải giữ "Đã thanh toán" cho tới khi quản trị viên
 * hoàn tiền xong và xác nhận; đơn giả lập hoặc chưa trả tiền thì không có tiền thật để hoàn nên được chuyển ngay.
 */
export async function paymentStatusAfterCancel(
  db: Pick<Prisma.TransactionClient, "payment">,
  bookingId: string,
  current: "UNPAID" | "PAID" | "REFUNDED",
): Promise<"UNPAID" | "PAID" | "REFUNDED"> {
  if (current !== "PAID") return current;
  const real = await db.payment.count({ where: { bookingId, provider: "VNPAY", status: "SUCCESS" } });
  return real > 0 ? "PAID" : "REFUNDED";
}

export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "Chờ thanh toán", cls: "bg-amber-100 text-amber-800" },
  CONFIRMED: { text: "Đã xác nhận", cls: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { text: "Đã hủy", cls: "bg-red-100 text-red-700" },
  COMPLETED: { text: "Hoàn tất", cls: "bg-slate-200 text-slate-700" },
};
