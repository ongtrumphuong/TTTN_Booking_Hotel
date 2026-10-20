import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decode } from "next-auth/jwt";

/** Chỉ cho phép đường dẫn nội bộ, tránh open-redirect qua callbackUrl. */
export function safeRedirect(path: string | null | undefined, fallback = "/") {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
}

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

export type SessionUser = { id: string; role: "USER" | "ADMIN"; name: string; email: string };

/**
 * Đọc người dùng từ cookie phiên bằng cách chỉ giải mã JWT (có kiểm tra chữ ký và hạn).
 * Không dùng auth() vì nó mã hóa lại token bằng giá trị ngẫu nhiên, bị Next.js cảnh báo khi prefetch.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  for (const name of SESSION_COOKIES) {
    const token = store.get(name)?.value;
    if (!token) continue;
    try {
      const jwt = await decode({ token, secret: process.env.AUTH_SECRET!, salt: name });
      if (jwt?.id && (jwt.role === "USER" || jwt.role === "ADMIN")) {
        return { id: jwt.id, role: jwt.role, name: String(jwt.name ?? ""), email: String(jwt.email ?? "") };
      }
    } catch {
      // token hỏng hoặc hết hạn: coi như chưa đăng nhập
    }
  }
  return null;
}

export async function requireUser(returnTo = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdmin(returnTo = "/admin") {
  const user = await requireUser(returnTo);
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
