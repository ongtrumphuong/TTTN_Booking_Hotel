import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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
export async function saveImage(input: Buffer): Promise<string> {
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
    output = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
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
