import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { decode } from "next-auth/jwt";

/** Chỉ cho phép đường dẫn nội bộ, tránh open-redirect qua callbackUrl. */
export function safeRedirect(path: string | null | undefined, fallback = "/") {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
}

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

export type SessionUser = { id: string; role: "USER" | "ADMIN" | "HOST"; name: string; email: string };

/**
 * Đọc người dùng từ cookie phiên bằng cách chỉ giải mã JWT (có kiểm tra chữ ký và hạn).
 * Không dùng auth() vì nó mã hóa lại token bằng giá trị ngẫu nhiên, bị Next.js cảnh báo khi prefetch.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  await connection(); // kiểm tra hạn token dùng thời gian hiện tại nên luôn chạy lúc có yêu cầu, không dựng sẵn
  const store = await cookies();
  for (const name of SESSION_COOKIES) {
    const token = store.get(name)?.value;
    if (!token) continue;
    try {
      const jwt = await decode({ token, secret: process.env.AUTH_SECRET!, salt: name });
      if (jwt?.id && (jwt.role === "USER" || jwt.role === "ADMIN" || jwt.role === "HOST")) {
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

/** Khu vực đối tác: chỉ vai trò HOST (quản trị viên có khu vực riêng ở /admin). */
export async function requireHost(returnTo = "/host") {
  const user = await requireUser(returnTo);
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role !== "HOST") redirect("/partner");
  return user;
}

/** Người được phép quản lý khách sạn/đơn: quản trị viên hoặc đối tác. Quyền theo từng khách sạn kiểm tra thêm bằng `canManageHotel`. */
export async function requireStaff(returnTo = "/admin") {
  const user = await requireUser(returnTo);
  if (user.role !== "ADMIN" && user.role !== "HOST") redirect("/");
  return user as SessionUser & { role: "ADMIN" | "HOST" };
}
