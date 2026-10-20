import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vé điện tử: mã QR chứa "mã đặt phòng.chữ ký". Chữ ký (HMAC) cho biết vé do hệ thống cấp, nên không ai làm giả vé từ một mã đoán được.
 * Quét vé chỉ để TÌM đơn nhanh; quyền xử lý đơn vẫn do canManageBooking quyết định ở máy chủ, nên vé của khách sạn khác không dùng được.
 */
const key = () => {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("Thiếu AUTH_SECRET");
  return createHash("sha256").update(`booking-ticket:${secret}`).digest();
};

const sig = (code: string) => createHmac("sha256", key()).update(code).digest("base64url").slice(0, 12);

export function ticketFor(code: string): string {
  return `${code}.${sig(code)}`;
}

const CODE_RE = /^KGS-[A-Z2-9]{8}$/;

/**
 * Đọc nội dung quét được hoặc gõ tay. Trả về mã đặt phòng, hoặc null nếu không hợp lệ.
 * Vé có chữ ký phải đúng chữ ký; lễ tân cũng có thể gõ tay mã đặt phòng (không có chữ ký) khi khách quên vé.
 */
export function readTicket(raw: string): string | null {
  const text = String(raw ?? "").trim().toUpperCase();
  if (text.length > 60) return null;
  const [code, given] = text.split(".");
  if (!CODE_RE.test(code)) return null;
  if (given === undefined) return code;
  // Chữ ký phân biệt hoa thường nên so với bản gốc chưa đổi chữ hoa.
  const original = String(raw).trim().split(".")[1] ?? "";
  const want = Buffer.from(sig(code));
  const have = Buffer.from(original);
  return have.length === want.length && timingSafeEqual(have, want) ? code : null;
}
