import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type VnpayConfig = { tmnCode: string; secret: string; payUrl: string; appUrl: string };

/** Trả về null khi chưa có khóa trong .env: hệ thống tự dùng cổng thanh toán giả lập. */
export function vnpayConfig(): VnpayConfig | null {
  const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
  const secret = process.env.VNPAY_HASH_SECRET?.trim();
  if (!tmnCode || !secret) return null;
  return {
    tmnCode,
    secret,
    payUrl: process.env.VNPAY_URL?.trim() || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    appUrl: (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, ""),
  };
}

export const isVnpayConfigured = () => vnpayConfig() !== null;

/** Mã hóa như mẫu chính thức của VNPay: encodeURIComponent, khoảng trắng thành dấu "+". */
const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, "+");

/** Chuỗi cần ký: các tham số sắp theo tên, dạng tên=giá trị đã mã hóa, nối bằng "&". */
function signString(params: Record<string, string>, skipEmpty: boolean) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && (!skipEmpty || params[k] !== ""))
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
}

const hmac = (secret: string, data: string) => createHmac("sha512", secret).update(Buffer.from(data, "utf-8")).digest("hex");

/** Ngày giờ dạng yyyyMMddHHmmss theo múi giờ GMT+7 như VNPay yêu cầu. */
export function vnpDate(d: Date) {
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

export type VnpayPaymentInput = {
  txnRef: string;
  amountVnd: number;
  orderInfo: string; // tiếng Việt không dấu, không ký tự đặc biệt
  ipAddr: string;
  returnUrl: string;
  now?: Date;
  expireAt?: Date;
  bankCode?: "VNPAYQR" | "VNBANK" | "INTCARD";
};

export function buildPaymentUrl(cfg: VnpayConfig, input: VnpayPaymentInput) {
  const now = input.now ?? new Date();
  const params: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: cfg.tmnCode,
    vnp_Amount: String(Math.round(input.amountVnd) * 100),
    vnp_CreateDate: vnpDate(now),
    vnp_CurrCode: "VND",
    vnp_IpAddr: input.ipAddr,
    vnp_Locale: "vn",
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: "other",
    vnp_ReturnUrl: input.returnUrl,
    vnp_TxnRef: input.txnRef,
  };
  if (input.expireAt) params.vnp_ExpireDate = vnpDate(input.expireAt);
  if (input.bankCode) params.vnp_BankCode = input.bankCode;

  const data = signString(params, true);
  return `${cfg.payUrl}?${data}&vnp_SecureHash=${hmac(cfg.secret, data)}`;
}

/**
 * Kiểm tra chữ ký của tham số VNPay gửi về (trang quay về hoặc IPN).
 * Các mẫu chính thức xử lý tham số rỗng khác nhau (Java bỏ qua, Node giữ lại) nên chấp nhận cả hai cách ký;
 * cả hai đều cần khóa bí mật nên không làm yếu an toàn.
 */
export function verifySignature(cfg: VnpayConfig, query: Record<string, string>) {
  const received = (query.vnp_SecureHash ?? "").toLowerCase();
  if (!/^[0-9a-f]{128}$/.test(received)) return false;

  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType") params[k] = v;
  }
  const a = Buffer.from(received, "hex");
  return [true, false].some((skipEmpty) => {
    const expected = Buffer.from(hmac(cfg.secret, signString(params, skipEmpty)), "hex");
    return expected.length === a.length && timingSafeEqual(expected, a);
  });
}
