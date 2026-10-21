import type { Prisma } from "@prisma/client";

type SettleInput = { status: string; paymentStatus: string; totalPrice: number; refundAmount: number | null; discount?: number };

/**
 * Số tiền đơn mang lại cho đối tác (trước hoa hồng):
 *  - đơn đã hoàn tất: giá phòng TRƯỚC giảm giá = số khách trả + mã giảm giá. Mã giảm giá do sàn tạo nên **sàn chịu**,
 *    đối tác vẫn nhận đủ như khi khách không dùng mã, và hoa hồng cũng tính trên giá trước giảm;
 *  - đơn bị hủy muộn đã thu tiền: chỉ phần phí hủy khách sạn giữ lại (tổng tiền trừ tiền hoàn);
 *  - các đơn còn lại: 0 (chưa hoàn tất, hủy hoàn đủ, chưa trả tiền).
 * Đơn hủy muộn: phí giữ lại tính trên số tiền khách đã thực trả (sàn không bù phần giảm giá cho phí hủy).
 */
export function settlementGross(b: SettleInput): number {
  if (b.status === "COMPLETED") return b.totalPrice + (b.discount ?? 0);
  if (b.status === "CANCELLED" && b.paymentStatus !== "UNPAID" && b.refundAmount !== null && b.refundAmount < b.totalPrice) {
    return b.totalPrice - b.refundAmount;
  }
  return 0;
}

/** Tiền mã giảm giá sàn phải chịu cho đơn này: chỉ đơn hoàn tất mới phát sinh (đơn hủy không có doanh thu để bù). */
export function promoCost(b: SettleInput): number {
  return b.status === "COMPLETED" ? (b.discount ?? 0) : 0;
}

/** Tách tổng thu thành hoa hồng của sàn và tiền chi cho đối tác (làm tròn hoa hồng từng đơn). */
export function splitGross(gross: number, commissionPercent: number) {
  const pct = Math.min(Math.max(commissionPercent, 0), 100);
  const commission = Math.round((gross * pct) / 100);
  return { commission, payout: gross - commission };
}

/** Đơn của khách sạn có đối tác, chưa nằm trong đợt chi trả nào, ở trạng thái có thể phát sinh doanh thu. */
export const unsettledWhere = (ownerId?: string): Prisma.BookingWhereInput => ({
  payoutId: null,
  room: { hotel: { ownerId: ownerId ?? { not: null } } },
  OR: [{ status: "COMPLETED" }, { status: "CANCELLED", paymentStatus: { in: ["PAID", "REFUNDED"] }, refundAmount: { not: null } }],
});

/** Loại doanh thu của một dòng đối soát: đơn hoàn tất (thu đủ) hoặc phí hủy muộn khách sạn được giữ. */
export type SettleKind = "COMPLETED" | "LATE_CANCEL";

export type SettleRow = {
  id: string;
  code: string;
  hotelName: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  kind: SettleKind;
  /** Doanh thu trước hoa hồng (đơn hoàn tất: giá trước giảm giá). */
  gross: number;
  /** Tiền mã giảm giá của sàn trong đơn này (sàn chịu), 0 nếu không có. */
  promo: number;
  commission: number;
  payout: number;
  commissionPercent: number;
};

type Db = Pick<Prisma.TransactionClient, "booking">;

const settleSelect = {
  id: true,
  code: true,
  status: true,
  paymentStatus: true,
  totalPrice: true,
  refundAmount: true,
  discount: true,
  commissionPercent: true,
  checkIn: true,
  checkOut: true,
  user: { select: { name: true } },
  room: { select: { hotel: { select: { name: true } } } },
} satisfies Prisma.BookingSelect;

type SettleBooking = Prisma.BookingGetPayload<{ select: typeof settleSelect }>;

/** Biến một đơn thành dòng đối soát; chỉ giữ những đơn có doanh thu > 0. */
function toRows(bookings: SettleBooking[]): SettleRow[] {
  return bookings
    .map((b) => {
      const gross = settlementGross(b);
      const { commission, payout } = splitGross(gross, b.commissionPercent);
      return {
        id: b.id,
        code: b.code,
        hotelName: b.room.hotel.name,
        guestName: b.user.name,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        kind: (b.status === "COMPLETED" ? "COMPLETED" : "LATE_CANCEL") as SettleKind,
        gross,
        promo: promoCost(b),
        commission,
        payout,
        commissionPercent: b.commissionPercent,
      };
    })
    .filter((r) => r.gross > 0);
}

/** Các đơn chưa đối soát của một đối tác (chỉ những đơn có doanh thu > 0), kèm hoa hồng đã chốt tại thời điểm đặt. */
export async function listUnsettled(db: Db, ownerId: string): Promise<SettleRow[]> {
  return toRows(await db.booking.findMany({ where: unsettledWhere(ownerId), orderBy: { createdAt: "asc" }, select: settleSelect }));
}

/** Các đơn đã nằm trong một đợt chi trả, tính lại theo đúng quy tắc (dùng cho trang chi tiết và xuất CSV). */
export async function listPayoutLines(db: Db, payoutId: string): Promise<SettleRow[]> {
  return toRows(await db.booking.findMany({ where: { payoutId }, orderBy: { createdAt: "asc" }, select: settleSelect }));
}

export const sumRows = (rows: SettleRow[]) => ({
  gross: rows.reduce((s, r) => s + r.gross, 0),
  commission: rows.reduce((s, r) => s + r.commission, 0),
  payout: rows.reduce((s, r) => s + r.payout, 0),
  promo: rows.reduce((s, r) => s + r.promo, 0),
});

export type DeductionRow = { id: string; bookingCode: string; hotelName: string; amount: number; resolvedAt: Date | null };

/** Khoản trừ do khiếu nại đã giải quyết mà đối tác phải chịu và chưa nằm trong đợt chi trả nào. */
export function deductionsWhere(ownerId: string): Prisma.DisputeWhereInput {
  return { status: "RESOLVED", partnerBearsAmount: { gt: 0 }, payoutId: null, hotel: { ownerId } };
}

export async function listDeductions(db: Pick<Prisma.TransactionClient, "dispute">, ownerId: string): Promise<DeductionRow[]> {
  const rows = await db.dispute.findMany({
    where: deductionsWhere(ownerId),
    orderBy: { resolvedAt: "asc" },
    select: { id: true, partnerBearsAmount: true, resolvedAt: true, booking: { select: { code: true } }, hotel: { select: { name: true } } },
  });
  return rows.map((d) => ({ id: d.id, bookingCode: d.booking.code, hotelName: d.hotel.name, amount: d.partnerBearsAmount, resolvedAt: d.resolvedAt }));
}

export const sumDeductions = (rows: DeductionRow[]) => rows.reduce((s, r) => s + r.amount, 0);

/** Số tiền đối tác thực nhận = tiền chi trả từ đơn trừ các khoản khiếu nại do đối tác chịu. */
export const netPayout = (rows: SettleRow[], deductions: DeductionRow[]) => sumRows(rows).payout - sumDeductions(deductions);
