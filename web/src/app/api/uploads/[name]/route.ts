import { connection, type NextRequest } from "next/server";
import { readUpload } from "@/lib/uploads";

/** Phục vụ ảnh đã tải lên. Tên tệp được kiểm tra chặt nên không thể đọc tệp ngoài thư mục lưu ảnh. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/uploads/[name]">) {
  await connection();
  const { name } = await ctx.params;
  const file = await readUpload(name);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.length),
      "Cache-Control": "public, max-age=31536000, immutable", // tên tệp là mã ngẫu nhiên, nội dung không bao giờ đổi
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}
