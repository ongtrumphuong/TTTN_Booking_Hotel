"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PENDING_HOLD_MINUTES } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { buildPaymentUrl, vnpayConfig } from "@/lib/payments/vnpay";
import { requireUser } from "@/lib/session";

export type PaymentState = { error?: string };

const BANKS = ["", "VNPAYQR", "VNBANK", "INTCARD"] as const;

/** Lấy IP khách cho tham số vnp_IpAddr; chỉ nhận chuỗi đúng dạng IPv4/IPv6, ngược lại dùng 127.0.0.1. */
async function clientIp() {
  const h = await headers();
  const raw = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : "127.0.0.1";
}

/** Tạo giao dịch VNPay cho đơn đang chờ thanh toán rồi chuyển khách sang trang thanh toán của VNPay. */
export async function startVnpayPaymentAction(bookingId: string, _: PaymentState, formData: FormData): Promise<PaymentState> {
  const cfg = vnpayConfig();
  if (!cfg) return { error: "Cổng thanh toán VNPay chưa được cấu hình." };

  const user = await requireUser(`/bookings/${bookingId}/pay`);
  const bank = z.enum(BANKS).safeParse(formData.get("bank") ?? "");
  if (!bank.success) return { error: "Phương thức thanh toán không hợp lệ." };

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: user.id } });
  if (!booking) return { error: "Không tìm thấy đơn đặt phòng." };
  if (booking.status !== "PENDING" || booking.paymentStatus !== "UNPAID") redirect(`/bookings/${bookingId}`);

  const holdEnds = new Date(booking.createdAt.getTime() + PENDING_HOLD_MINUTES * 60_000);
  if (holdEnds.getTime() <= Date.now()) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    return { error: `Đơn đã quá thời gian giữ phòng (${PENDING_HOLD_MINUTES} phút). Vui lòng đặt lại.` };
  }

  // Mỗi lần bấm thanh toán là một giao dịch mới (VNPay yêu cầu mã tham chiếu không trùng).
  const txnRef = `${booking.code.replace(/[^A-Za-z0-9]/g, "")}${Date.now().toString(36).toUpperCase()}`;
  await prisma.payment.create({
    data: { bookingId: booking.id, provider: "VNPAY", txnRef, amount: booking.totalPrice, method: bank.data || null },
  });

  const url = buildPaymentUrl(cfg, {
    txnRef,
    amountVnd: booking.totalPrice,
    orderInfo: `Thanh toan dat phong ${booking.code.replace(/[^A-Za-z0-9]/g, " ").trim()}`,
    ipAddr: await clientIp(),
    returnUrl: `${cfg.appUrl}/api/payments/vnpay/return`,
    expireAt: holdEnds,
    bankCode: bank.data || undefined,
  });

  redirect(url);
}
