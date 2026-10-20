import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const RESET_TTL_MS = 60 * 60_000;

// Chỉ lưu băm của token: lộ cơ sở dữ liệu cũng không dùng được liên kết đang chờ.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Tạo token mới cho người dùng (xóa các token cũ) và trả về token gốc để đưa vào email. */
export async function createResetToken(userId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + RESET_TTL_MS) } }),
  ]);
  return token;
}

export async function isResetTokenValid(token: string, now = new Date()) {
  if (!token || token.length > 100) return false;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  return !!row && !row.usedAt && row.expiresAt > now;
}

/** Đặt mật khẩu mới bằng token. Mỗi token chỉ dùng được một lần. Trả về false nếu token sai, đã dùng hoặc hết hạn. */
export async function consumeResetToken(token: string, newPassword: string, now = new Date()) {
  if (!token || token.length > 100) return false;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return prisma.$transaction(async (tx) => {
    // updateMany có điều kiện để hai yêu cầu cùng lúc chỉ một yêu cầu thắng.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count === 0) return false;
    const row = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) }, select: { userId: true } });
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId, NOT: { tokenHash: hashToken(token) } } });
    return true;
  });
}
