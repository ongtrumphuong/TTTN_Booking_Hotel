import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Trả mã 404 thật cho khách sạn không tồn tại hoặc đã bị ẩn.
 * Trang chi tiết được truyền dòng (streaming) nên khi nội dung bắt đầu gửi đi, mã trạng thái 200 đã được gửi và không đổi được;
 * nếu chỉ gọi notFound() trong trang thì công cụ tìm kiếm nhận "404 mềm" (200 kèm giao diện báo lỗi).
 * Kiểm tra ở đây chạy trước khi dựng trang nên mã trạng thái luôn đúng.
 */
export async function proxy(req: NextRequest) {
  const match = req.nextUrl.pathname.match(/^\/hotels\/([^/]+)\/?$/);
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

export const config = { matcher: "/hotels/:slug" };
