import { NextResponse, after, connection, type NextRequest } from "next/server";
import { sendBookingConfirmation } from "@/lib/email";
import { notifyBookingEvent } from "@/lib/notify";
import { applyGatewayResult, type Rsp } from "@/lib/payments/apply";
import { verifySignature, vnpayConfig } from "@/lib/payments/vnpay";

// Nội dung phản hồi IPN đúng như tài liệu VNPay.
const MESSAGES: Record<Rsp | "97", string> = {
  "00": "Confirm Success",
  "01": "Order not found",
  "02": "Order already confirmed",
  "04": "invalid amount",
  "97": "Invalid signature",
  "99": "Unknow error",
};

const reply = (code: Rsp | "97") => NextResponse.json({ RspCode: code, Message: MESSAGES[code] });

/** VNPay gọi trực tiếp từ máy chủ của họ (cần địa chỉ công khai HTTPS khi triển khai thật). */
export async function GET(req: NextRequest) {
  // Bắt buộc xử lý theo từng yêu cầu: nếu không, Next.js có thể dựng sẵn phản hồi lúc build (khi chưa có khóa) rồi phục vụ mãi.
  await connection();
  const cfg = vnpayConfig();
  if (!cfg) return reply("99");

  const q = Object.fromEntries(req.nextUrl.searchParams);
  if (!verifySignature(cfg, q)) return reply("97");

  try {
    const res = await applyGatewayResult({
      txnRef: q.vnp_TxnRef ?? "",
      amountMinor: q.vnp_Amount ?? "",
      responseCode: q.vnp_ResponseCode ?? "",
      transactionStatus: q.vnp_TransactionStatus ?? "",
      transactionNo: q.vnp_TransactionNo,
      bankCode: q.vnp_BankCode,
    });
    const bookingId = res.bookingId;
    if (res.confirmedNow && bookingId) {
    after(() => sendBookingConfirmation(bookingId));
    after(() => notifyBookingEvent(bookingId, "PAID"));
  }
    return reply(res.rsp);
  } catch (e) {
    console.error("[vnpay ipn]", e instanceof Error ? e.message : e);
    return reply("99");
  }
}
