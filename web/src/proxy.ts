import { NextResponse, type NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/role-routing";
import { areaRedirect } from "@/lib/role-routing";

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/** Vai trò trong phiên đăng nhập (chỉ giải mã JWT, có kiểm tra chữ ký và hạn); không có phiên hợp lệ thì trả null. */
async function roleOf(req: NextRequest): Promise<Role | null> {
  for (const name of SESSION_COOKIES) {
    const token = req.cookies.get(name)?.value;
    if (!token) continue;
    try {
      const jwt = await decode({ token, secret: process.env.AUTH_SECRET!, salt: name });
      if (jwt?.role === "USER" || jwt?.role === "ADMIN" || jwt?.role === "HOST") return jwt.role;
    } catch {
      // token hỏng hoặc hết hạn: coi như chưa đăng nhập
    }
  }
  return null;
}

/**
 * 1) Mỗi vai trò chỉ dùng giao diện của vai trò đó: quản trị viên và đối tác bị đưa về khu vực của mình nếu vào giao diện khách.
 * 2) Trả mã 404 thật cho khách sạn không tồn tại hoặc đã bị ẩn.
 *    Trang chi tiết được truyền dòng (streaming) nên khi nội dung bắt đầu gửi đi, mã trạng thái 200 đã được gửi và không đổi được;
 *    nếu chỉ gọi notFound() trong trang thì công cụ tìm kiếm nhận "404 mềm" (200 kèm giao diện báo lỗi).
 *    Kiểm tra ở đây chạy trước khi dựng trang nên mã trạng thái luôn đúng.
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const target = areaRedirect(req.cookies.size > 0 ? await roleOf(req) : null, pathname, req.nextUrl.search);
  if (target) return NextResponse.redirect(new URL(target, req.url));

  const match = pathname.match(/^\/hotels\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();

  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return NextResponse.rewrite(new URL("/__khong-tim-thay", req.url)); // địa chỉ không giải mã được
  }

  // Slug do hệ thống tạo ra chỉ gồm chữ thường, số và dấu gạch ngang. Sai dạng thì khỏi truy vấn (cũng tránh ký tự NUL làm lỗi cơ sở dữ liệu).
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return NextResponse.rewrite(new URL("/__khong-tim-thay", req.url));

  try {
    const hotel = await prisma.hotel.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!hotel) return NextResponse.rewrite(new URL("/__khong-tim-thay", req.url)); // đường dẫn không tồn tại -> trang 404 với mã 404
  } catch {
    // Không kiểm tra được (ví dụ cơ sở dữ liệu tạm thời lỗi): để trang tự xử lý thay vì chặn nhầm khách sạn thật.
  }
  return NextResponse.next();
}

// Chạy cho mọi trang (không chạy cho API, tệp tĩnh và tài nguyên Next).
export const config = { matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"] };
