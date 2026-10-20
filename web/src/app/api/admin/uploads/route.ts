import { NextResponse, connection, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { MAX_FILES_PER_REQUEST, MAX_REQUEST_BYTES, UploadError, saveImage } from "@/lib/uploads";

const json = (body: object, status = 200) => NextResponse.json(body, { status });

/** Tải ảnh lên (chỉ quản trị viên). Trả về danh sách đường dẫn đã lưu và lỗi riêng của từng tệp. */
export async function POST(req: NextRequest) {
  await connection();

  const user = await getCurrentUser();
  if (!user) return json({ error: "Bạn cần đăng nhập." }, 401);
  if (user.role !== "ADMIN") return json({ error: "Bạn không có quyền tải ảnh lên." }, 403);

  // Chặn gửi chéo trang: yêu cầu phải xuất phát từ chính website này.
  const origin = req.headers.get("origin");
  if (origin) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      /* origin sai định dạng */
    }
    if (host !== req.headers.get("host")) return json({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
  }

  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return json({ error: "Thiếu kích thước dữ liệu." }, 411);
  if (length > MAX_REQUEST_BYTES) return json({ error: "Dữ liệu tải lên quá lớn." }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Dữ liệu tải lên không hợp lệ." }, 400);
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return json({ error: "Chưa chọn ảnh nào." }, 400);
  if (files.length > MAX_FILES_PER_REQUEST) return json({ error: `Mỗi lần tối đa ${MAX_FILES_PER_REQUEST} ảnh.` }, 400);

  const urls: string[] = [];
  const errors: { name: string; error: string }[] = [];
  for (const file of files) {
    try {
      urls.push(await saveImage(Buffer.from(await file.arrayBuffer())));
    } catch (e) {
      errors.push({ name: file.name.slice(0, 80), error: e instanceof UploadError ? e.message : "Lưu ảnh thất bại." });
    }
  }
  return json({ urls, errors }, urls.length === 0 ? 400 : 200);
}
