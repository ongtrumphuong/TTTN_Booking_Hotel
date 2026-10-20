import type { Prisma } from "@prisma/client";

type SettleInput = { status: string; paymentStatus: string; totalPrice: number; refundAmount: number | null };

/**
 * Số tiền đơn mang lại cho đối tác (trước hoa hồng):
 *  - đơn đã hoàn tất: toàn bộ số tiền khách trả;
 *  - đơn bị hủy muộn đã thu tiền: chỉ phần phí hủy khách sạn giữ lại (tổng tiền trừ tiền hoàn);
 *  - các đơn còn lại: 0 (chưa hoàn tất, hủy hoàn đủ, chưa trả tiền).
 */
export function settlementGross(b: SettleInput): number {
  if (b.status === "COMPLETED") return b.totalPrice;
  if (b.status === "CANCELLED" && b.paymentStatus !== "UNPAID" && b.refundAmount !== null && b.refundAmount < b.totalPrice) {
    return b.totalPrice - b.refundAmount;
  }
  return 0;
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

export type SettleRow = { id: string; code: string; hotelName: string; gross: number; commission: number; payout: number; commissionPercent: number };

type Db = Pick<Prisma.TransactionClient, "booking">;

/** Các đơn chưa đối soát của một đối tác (chỉ những đơn có doanh thu > 0), kèm hoa hồng đã chốt tại thời điểm đặt. */
export async function listUnsettled(db: Db, ownerId: string): Promise<SettleRow[]> {
  const rows = await db.booking.findMany({
    where: unsettledWhere(ownerId),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      status: true,
      paymentStatus: true,
      totalPrice: true,
      refundAmount: true,
      commissionPercent: true,
      room: { select: { hotel: { select: { name: true } } } },
    },
  });
  return rows
    .map((b) => {
      const gross = settlementGross(b);
      const { commission, payout } = splitGross(gross, b.commissionPercent);
      return { id: b.id, code: b.code, hotelName: b.room.hotel.name, gross, commission, payout, commissionPercent: b.commissionPercent };
    })
    .filter((r) => r.gross > 0);
}

export const sumRows = (rows: SettleRow[]) => ({
  gross: rows.reduce((s, r) => s + r.gross, 0),
  commission: rows.reduce((s, r) => s + r.commission, 0),
  payout: rows.reduce((s, r) => s + r.payout, 0),
});
