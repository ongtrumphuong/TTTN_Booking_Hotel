import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * "Đề xuất giữ phòng" mà trợ lý ảo đưa cho khách. Chỉ là một lời mời có chữ ký: nó KHÔNG tạo đơn.
 * Đơn chỉ được tạo khi khách tự mở trang xác nhận, xem lại thông tin và bấm nút (xem /assistant/confirm).
 * Chữ ký đảm bảo khách (hoặc ai đó) không tự sửa phòng/ngày/giá trong đường dẫn; giá vẫn luôn được tính lại ở máy chủ.
 */
export type Proposal = { roomId: string; checkIn: string; checkOut: string; guests: number; rooms: number };

export const PROPOSAL_TTL_MS = 60 * 60_000;

const key = () => {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("Thiếu AUTH_SECRET");
  return createHash("sha256").update(`assistant-proposal:${secret}`).digest();
};

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const mac = (payload: string) => createHmac("sha256", key()).update(payload).digest();

export function signProposal(p: Proposal, now = Date.now()): string {
  const payload = b64(JSON.stringify({ r: p.roomId, i: p.checkIn, o: p.checkOut, g: p.guests, n: p.rooms, e: now + PROPOSAL_TTL_MS }));
  return `${payload}.${b64(mac(payload))}`;
}

/** Trả về nội dung đề xuất nếu chữ ký đúng và chưa hết hạn, ngược lại trả null. */
export function verifyProposal(token: string, now = Date.now()): Proposal | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const given = Buffer.from(sig, "base64url");
  const want = mac(payload);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as Record<string, unknown>;
    if (typeof d.e !== "number" || d.e < now) return null;
    if (typeof d.r !== "string" || typeof d.i !== "string" || typeof d.o !== "string" || typeof d.g !== "number" || typeof d.n !== "number") return null;
    return { roomId: d.r, checkIn: d.i, checkOut: d.o, guests: d.g, rooms: d.n };
  } catch {
    return null;
  }
}
