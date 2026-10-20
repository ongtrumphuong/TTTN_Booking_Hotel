import { NextResponse, connection } from "next/server";
import { prisma } from "@/lib/prisma";

/** Kiểm tra sức khỏe cho bộ cân bằng tải / Docker: ứng dụng chạy và kết nối được cơ sở dữ liệu. Không trả thông tin nhạy cảm. */
export async function GET() {
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
