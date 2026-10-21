import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { isEquirectangular } from "@/lib/panorama";

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB mỗi ảnh
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_REQUEST_BYTES = 30 * 1024 * 1024;
export const MAX_PIXELS = 50_000_000; // chặn "bom giải nén": ảnh nhỏ về dung lượng nhưng rất lớn về kích thước
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Thư mục lưu ảnh tải lên, nằm NGOÀI public để phục vụ qua route có kiểm tra và không bị thực thi như mã. */
// Đường dẫn lấy lúc chạy (không thuộc phần build) nên báo cho Turbopack bỏ qua, tránh gom cả dự án vào bản triển khai.
export const uploadDir = () =>
  path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR?.trim() || path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads"));

/** Tên tệp hợp lệ: 32 ký tự hex + .webp (không có dấu chấm đôi hay dấu gạch nên không thể thoát khỏi thư mục). */
export const UPLOAD_NAME = /^[a-f0-9]{32}\.webp$/;
export const UPLOAD_URL = /^\/api\/uploads\/[a-f0-9]{32}\.webp$/;

export class UploadError extends Error {}

/**
 * Nhận dữ liệu thô của một ảnh, xác minh đó đúng là JPEG/PNG/WebP bằng cách giải mã thật (không tin tên tệp hay Content-Type),
 * xoay theo hướng chụp, thu nhỏ tối đa 2000px, bỏ toàn bộ siêu dữ liệu (EXIF, vị trí) và lưu lại dưới dạng WebP.
 */
export async function saveImage(input: Buffer, opts: { panorama?: boolean } = {}): Promise<string> {
  if (input.length === 0) throw new UploadError("Tệp rỗng.");
  if (input.length > MAX_FILE_BYTES) throw new UploadError("Ảnh vượt quá 5 MB.");

  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata()).format;
  } catch {
    throw new UploadError("Tệp không phải ảnh hợp lệ.");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new UploadError("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");

  let output: Buffer;
  try {
    const img = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).rotate();
    if (opts.panorama) {
      // Ảnh 360° cần giữ độ phân giải cao hơn ảnh thường (tối đa 6000px chiều rộng) và phải đúng tỷ lệ 2:1.
      const m = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
      if (!isEquirectangular(m.width ?? 0, m.height ?? 0)) throw new UploadError("Ảnh 360° phải có chiều rộng gấp đôi chiều cao (ví dụ 4096×2048).");
      img.resize({ width: 6000, withoutEnlargement: true });
    } else {
      img.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
    }
    output = await img
      .webp({ quality: 82 })
      .toBuffer();
  } catch (e) {
    if (e instanceof UploadError) throw e;
    throw new UploadError("Không xử lý được ảnh (tệp có thể bị hỏng).");
  }

  const name = `${randomBytes(16).toString("hex")}.webp`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), output, { flag: "wx" });
  return `/api/uploads/${name}`;
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (!UPLOAD_NAME.test(name)) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ uploadDir(), name));
  } catch {
    return null;
  }
}
