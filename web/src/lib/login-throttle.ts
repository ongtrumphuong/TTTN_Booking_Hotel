import "server-only";
import { clear, hit, peek } from "./rate-limit";

export const LOGIN_WINDOW_MS = 15 * 60_000;

// Ba lớp để cân bằng giữa chống dò mật khẩu và việc kẻ xấu cố tình khóa tài khoản người khác:
//  - cặp (email, IP): 5 lần sai  -> chặn riêng IP đó với tài khoản đó, người dùng thật ở IP khác không bị ảnh hưởng
//  - email: 15 lần sai (nhiều IP)  -> chặn dò mật khẩu phân tán
//  - IP: 30 lần sai (nhiều email)  -> chặn một nguồn thử nhiều tài khoản
export const LOGIN_LIMITS = { pair: 5, email: 15, ip: 30 } as const;

const norm = (s: string) => s.trim().toLowerCase().slice(0, 254);
const keys = (email: string, ip: string) => ({
  pair: `login:pair:${norm(email)}|${ip}`,
  email: `login:email:${norm(email)}`,
  ip: `login:ip:${ip}`,
});

/** Lấy IP khách từ tiêu đề yêu cầu. Chỉ đáng tin khi website chạy sau proxy ghi đè X-Forwarded-For (xem README, mục triển khai). */
export function clientIpFrom(headers: Headers | undefined | null): string {
  const raw = (headers?.get("x-forwarded-for")?.split(",")[0] ?? headers?.get("x-real-ip") ?? "").trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : "unknown";
}

export async function checkLoginAllowed(email: string, ip: string, now = new Date()): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const k = keys(email, ip);
  const states = await Promise.all([
    peek(k.pair, LOGIN_LIMITS.pair, LOGIN_WINDOW_MS, now),
    peek(k.email, LOGIN_LIMITS.email, LOGIN_WINDOW_MS, now),
    peek(k.ip, LOGIN_LIMITS.ip, LOGIN_WINDOW_MS, now),
  ]);
  const blocked = states.filter((s) => s.blocked);
  return { allowed: blocked.length === 0, retryAfterSec: Math.max(0, ...blocked.map((s) => s.retryAfterSec)) };
}

export async function recordLoginFailure(email: string, ip: string, now = new Date()) {
  const k = keys(email, ip);
  await Promise.all([hit(k.pair, LOGIN_WINDOW_MS, now), hit(k.email, LOGIN_WINDOW_MS, now), hit(k.ip, LOGIN_WINDOW_MS, now)]);
}

/** Đăng nhập đúng thì xóa bộ đếm của riêng tài khoản này (không xóa bộ đếm theo IP). */
export async function clearLoginFailures(email: string, ip: string) {
  const k = keys(email, ip);
  await clear(k.pair, k.email);
}
