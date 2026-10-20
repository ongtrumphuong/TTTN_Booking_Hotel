// Mỗi vai trò chỉ dùng giao diện của vai trò đó: khách (và người chưa đăng nhập) dùng giao diện khách; đối tác dùng /host; quản trị viên dùng /admin.
// Đối tác và quản trị viên không bao giờ thấy giao diện khách. Các hàm ở đây thuần (không phụ thuộc máy chủ) để dùng được cả ở proxy lẫn trong kiểm thử.

export type Role = "USER" | "ADMIN" | "HOST";

const HOME: Record<Role, string> = { USER: "/", ADMIN: "/admin", HOST: "/host" };

export const homeFor = (role: Role) => HOME[role];

const within = (path: string, base: string) => path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`);

/** Trang đích sau khi đăng nhập: giữ đường dẫn người dùng định vào nếu nó thuộc khu vực của vai trò, ngược lại về trang chủ của vai trò đó. */
export function afterLoginPath(role: Role, callback: string): string {
  if (role === "USER") return within(callback, "/admin") || within(callback, "/host") ? "/" : callback;
  return within(callback, HOME[role]) ? callback : HOME[role];
}

/**
 * Với tài khoản đối tác/quản trị viên: nếu đường dẫn nằm ngoài khu vực của họ thì trả về nơi phải chuyển tới, ngược lại null.
 * Khách và người chưa đăng nhập: luôn null (việc chặn /admin, /host cho họ do các hàm requireAdmin/requireHost đảm nhiệm).
 * `/account` được ánh xạ sang trang tài khoản riêng của từng khu vực để họ vẫn tự sửa hồ sơ và đổi mật khẩu được.
 */
export function staffRedirect(role: Role | null | undefined, pathname: string): string | null {
  if (role !== "ADMIN" && role !== "HOST") return null;
  const home = HOME[role];
  if (within(pathname, home)) return null;
  if (pathname === "/account") return `${home}/account`;
  return home;
}

/**
 * Quy tắc đầy đủ cho mọi yêu cầu trang, trả về nơi cần chuyển tới hoặc null nếu được đi tiếp:
 *  - đối tác/quản trị viên ngoài khu vực của mình: về khu vực của mình (xem staffRedirect);
 *  - vào /admin hoặc /host mà không đúng vai trò: chưa đăng nhập thì sang trang đăng nhập (kèm đường dẫn để quay lại), khách thì về trang chủ.
 * Việc kiểm tra quyền chi tiết vẫn nằm ở các hàm requireAdmin/requireHost và từng hành động ở máy chủ; đây chỉ là lớp chuyển hướng sớm.
 */
export function areaRedirect(role: Role | null | undefined, pathname: string, search = ""): string | null {
  const staff = staffRedirect(role, pathname);
  if (staff) return staff;
  for (const [base, needed] of [["/admin", "ADMIN"], ["/host", "HOST"]] as const) {
    if (within(pathname, base) && role !== needed) {
      return role ? "/" : `/login?callbackUrl=${encodeURIComponent(pathname + search)}`;
    }
  }
  return null;
}
