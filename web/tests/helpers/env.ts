import { existsSync } from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const file = path.resolve(__dirname, "../../.env");
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file); // không ghi đè biến môi trường đã có
    } catch {
      /* bỏ qua: sẽ báo thiếu DATABASE_URL ở bước sau */
    }
  }
}

/**
 * Địa chỉ cơ sở dữ liệu dành riêng cho kiểm thử.
 * Chốt chặn an toàn: tên cơ sở dữ liệu BẮT BUỘC kết thúc bằng "_test"; nếu không thì dừng ngay,
 * để bộ kiểm thử (vốn xóa sạch dữ liệu) không bao giờ chạm được vào dữ liệu thật.
 * Mặc định lấy tên từ DATABASE_URL rồi thêm "_test"; có thể đặt TEST_DATABASE_URL để chỉ định riêng.
 */
export function testDatabaseUrl(): string {
  if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) loadDotEnv();
  const explicit = process.env.TEST_DATABASE_URL;
  const base = explicit ?? process.env.DATABASE_URL;
  if (!base) throw new Error("Thiếu DATABASE_URL (hoặc TEST_DATABASE_URL) để chạy kiểm thử.");

  const url = new URL(base);
  let name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!explicit && !name.endsWith("_test")) {
    name += "_test";
    url.pathname = `/${name}`;
  }
  if (!name.endsWith("_test")) {
    throw new Error(`Từ chối chạy kiểm thử: cơ sở dữ liệu "${name}" không kết thúc bằng "_test".`);
  }
  return url.toString();
}
