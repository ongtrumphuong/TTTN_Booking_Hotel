import type { Prisma, Voucher } from "@prisma/client";
import { holdingWhere } from "@/lib/booking";

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");

/** Số tiền giảm của một mã trên tổng tiền phòng; không bao giờ vượt quá tổng tiền. */
export function computeDiscount(v: Pick<Voucher, "percentOff" | "amountOff" | "maxDiscount">, subtotal: number) {
  let off = 0;
  if (v.percentOff) off = Math.floor((subtotal * v.percentOff) / 100);
  else if (v.amountOff) off = v.amountOff;
  if (v.maxDiscount && off > v.maxDiscount) off = v.maxDiscount;
  return Math.max(0, Math.min(off, subtotal));
}

export type VoucherCheck = { ok: true; voucher: Voucher; discount: number } | { ok: false; error: string };

/** Kiểm tra mã có dùng được cho người này với tổng tiền này không. Nên gọi trong cùng giao dịch với việc tạo đơn. */
export async function checkVoucher(
  db: Pick<Prisma.TransactionClient, "voucher" | "booking">,
  rawCode: string,
  userId: string,
  subtotal: number,
  now = new Date(),
): Promise<VoucherCheck> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "Vui lòng nhập mã giảm giá." };
  const v = await db.voucher.findUnique({ where: { code } });
  if (!v || !v.isActive) return { ok: false, error: "Mã giảm giá không tồn tại hoặc đã ngừng áp dụng." };
  if (v.startsAt && v.startsAt > now) return { ok: false, error: "Mã giảm giá chưa đến thời gian áp dụng." };
  if (v.endsAt && v.endsAt < now) return { ok: false, error: "Mã giảm giá đã hết hạn." };
  if (subtotal < v.minSubtotal) return { ok: false, error: `Đơn tối thiểu ${v.minSubtotal.toLocaleString("vi-VN")} ₫ mới dùng được mã này.` };

  // Lượt dùng tính theo các đơn còn hiệu lực (đang giữ phòng hoặc đã hoàn tất), nên đơn bị hủy/hết hạn tự trả lại lượt.
  const used = { voucherCode: code, OR: [holdingWhere(), { status: "COMPLETED" as const }] };
  if (v.usageLimit !== null && (await db.booking.count({ where: used })) >= v.usageLimit) {
    return { ok: false, error: "Mã giảm giá đã hết lượt sử dụng." };
  }
  if ((await db.booking.count({ where: { ...used, userId } })) >= v.perUserLimit) {
    return { ok: false, error: "Bạn đã dùng hết lượt cho mã giảm giá này." };
  }
  const discount = computeDiscount(v, subtotal);
  if (discount <= 0) return { ok: false, error: "Mã giảm giá không áp dụng được cho đơn này." };
  return { ok: true, voucher: v, discount };
}
