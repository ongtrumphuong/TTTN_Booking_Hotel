import { NextResponse, after, connection, type NextRequest } from "next/server";
import { sendBookingConfirmation } from "@/lib/email";
import { applyGatewayResult } from "@/lib/payments/apply";
import { verifySignature, vnpayConfig } from "@/lib/payments/vnpay";

/**
 * Trang VNPay đưa khách quay về sau khi thanh toán. Chữ ký được kiểm tra (chỉ VNPay và hệ thống này biết khóa)
 * rồi kết quả được áp dụng một lần duy nhất, dùng chung hàm với IPN. Nhờ vậy chạy trên máy cá nhân (IPN không gọi
 * được vào localhost) vẫn xác nhận được đơn; khi triển khai thật, IPN là kênh chính thức và việc xử lý trùng được bỏ qua.
 */
export async function GET(req: NextRequest) {
  // Bắt buộc xử lý theo từng yêu cầu: nếu không, Next.js có thể dựng sẵn phản hồi lúc build (khi chưa có khóa) rồi phục vụ mãi.
  await connection();
  const cfg = vnpayConfig();
  if (!cfg) return NextResponse.redirect(new URL("/", req.nextUrl.origin));

  const to = (path: string) => NextResponse.redirect(`${cfg.appUrl}${path}`);
  const q = Object.fromEntries(req.nextUrl.searchParams);

  if (!verifySignature(cfg, q)) return to("/bookings?payment=invalid");

  const res = await applyGatewayResult({
    txnRef: q.vnp_TxnRef ?? "",
    amountMinor: q.vnp_Amount ?? "",
    responseCode: q.vnp_ResponseCode ?? "",
    transactionStatus: q.vnp_TransactionStatus ?? "",
    transactionNo: q.vnp_TransactionNo,
    bankCode: q.vnp_BankCode,
  });

  const bookingId = res.bookingId;
  if (res.confirmedNow && bookingId) after(() => sendBookingConfirmation(bookingId));

  if (!bookingId || res.rsp === "01" || res.rsp === "04") return to("/bookings?payment=invalid");
  switch (res.outcome) {
    case "paid":
      return to(`/bookings/${bookingId}?paid=1`);
    case "needs-refund":
      return to(`/bookings/${bookingId}?payment=refund`);
    case "cancelled":
      return to(`/bookings/${bookingId}/pay?error=cancelled`);
    default:
      return to(`/bookings/${bookingId}/pay?error=failed`);
  }
}
