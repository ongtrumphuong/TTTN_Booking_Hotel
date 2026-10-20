import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PENDING_HOLD_MINUTES, unavailableQuantity } from "@/lib/booking";

export type GatewayResult = {
  txnRef: string;
  amountMinor: string; // vnp_Amount: số tiền × 100
  responseCode: string;
  transactionStatus: string;
  transactionNo?: string;
  bankCode?: string;
};

/** Mã RspCode theo quy định của VNPay cho IPN. */
export type Rsp = "00" | "01" | "02" | "04" | "99";
export type Outcome = "paid" | "failed" | "cancelled" | "needs-refund";

export type ApplyResult = { rsp: Rsp; bookingId?: string; outcome?: Outcome; confirmedNow?: boolean };

/**
 * Áp dụng kết quả thanh toán từ cổng, an toàn khi gọi nhiều lần (IPN và trang quay về đều gọi):
 * mỗi giao dịch chỉ được xử lý đúng một lần nhờ chuyển trạng thái PENDING -> SUCCESS/FAILED có điều kiện.
 * Người gọi phải kiểm tra chữ ký trước khi gọi hàm này.
 */
export async function applyGatewayResult(r: GatewayResult): Promise<ApplyResult> {
  const payment = await prisma.payment.findUnique({ where: { txnRef: r.txnRef }, select: { id: true, bookingId: true, amount: true, status: true, responseCode: true } });
  if (!payment) return { rsp: "01" };
  if (r.amountMinor !== String(payment.amount * 100)) return { rsp: "04", bookingId: payment.bookingId };
  if (payment.status !== "PENDING") {
    const outcome: Outcome = payment.status === "SUCCESS" ? "paid" : payment.responseCode === "24" ? "cancelled" : "failed";
    return { rsp: "02", bookingId: payment.bookingId, outcome };
  }

  const success = r.responseCode === "00" && r.transactionStatus === "00";
  if (!success) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED", responseCode: r.responseCode, providerTxnNo: r.transactionNo || null, method: r.bankCode || null },
    });
    return { rsp: "00", bookingId: payment.bookingId, outcome: r.responseCode === "24" ? "cancelled" : "failed" };
  }

  try {
    return await prisma.$transaction(
      async (tx): Promise<ApplyResult> => {
        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { status: "SUCCESS", paidAt: new Date(), responseCode: r.responseCode, providerTxnNo: r.transactionNo || null, method: r.bankCode || null },
        });
        if (claimed.count === 0) return { rsp: "02", bookingId: payment.bookingId, outcome: "paid" };

        const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId }, include: { room: true } });
        const base = { rsp: "00" as const, bookingId: booking.id };

        if (booking.status === "CONFIRMED") return { ...base, outcome: "paid" };

        if (booking.status === "PENDING") {
          // Đơn còn trong thời gian giữ phòng thì phòng vẫn của khách; quá hạn thì phải kiểm tra lại còn phòng không.
          const holding = booking.createdAt.getTime() > Date.now() - PENDING_HOLD_MINUTES * 60_000;
          const left = booking.room.quantity - (await unavailableQuantity(tx, booking.roomId, booking.checkIn, booking.checkOut));
          if (holding || left >= booking.rooms) {
            await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", paymentStatus: "PAID" } });
            return { ...base, outcome: "paid", confirmedNow: true };
          }
        }

        // Đã nhận tiền nhưng không giữ được phòng (đơn đã hủy hoặc phòng đã hết): đánh dấu để quản trị viên hoàn tiền thủ công.
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", paymentStatus: "PAID", cancelledAt: new Date(), refundAmount: booking.totalPrice } });
        await tx.payment.update({ where: { id: payment.id }, data: { note: "Đã nhận tiền nhưng không giữ được phòng: cần hoàn tiền thủ công." } });
        return { ...base, outcome: "needs-refund" };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    // Xung đột giao dịch: trả 99 để VNPay gọi lại IPN sau vài phút.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return { rsp: "99", bookingId: payment.bookingId };
    throw e;
  }
}
