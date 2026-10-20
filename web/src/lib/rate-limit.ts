import "server-only";
import { prisma } from "./prisma";

export type LimitState = { blocked: boolean; retryAfterSec: number };

/**
 * Cộng một lần vào bộ đếm của khóa trong cửa sổ cố định (windowMs) và trả về số lần hiện tại.
 * Một câu lệnh duy nhất (INSERT ... ON CONFLICT) nên đúng cả khi nhiều yêu cầu đến cùng lúc.
 * Thời gian truyền từ ứng dụng ở dạng chuỗi UTC rồi ép về `timestamp` để không phụ thuộc múi giờ của máy chủ cơ sở dữ liệu.
 */
export async function hit(key: string, windowMs: number, now = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - windowMs).toISOString();
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${nowIso}::timestamp(3))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${cutoffIso}::timestamp(3) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoffIso}::timestamp(3) THEN ${nowIso}::timestamp(3) ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;

  // Thỉnh thoảng dọn các bộ đếm đã hết hạn từ lâu để bảng không phình ra.
  if (Math.random() < 0.02) {
    await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 3_600_000) } } });
  }
  return Number(rows[0]?.count ?? 1);
}

/** Xem khóa đã chạm ngưỡng chưa mà không cộng thêm. */
export async function peek(key: string, max: number, windowMs: number, now = new Date()): Promise<LimitState> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row) return { blocked: false, retryAfterSec: 0 };
  const endsAt = row.windowStart.getTime() + windowMs;
  if (endsAt <= now.getTime() || row.count < max) return { blocked: false, retryAfterSec: 0 };
  return { blocked: true, retryAfterSec: Math.ceil((endsAt - now.getTime()) / 1000) };
}

export async function clear(...keys: string[]) {
  if (keys.length) await prisma.rateLimit.deleteMany({ where: { key: { in: keys } } });
}
