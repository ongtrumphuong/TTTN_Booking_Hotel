import { vi } from "vitest";
import { testDatabaseUrl } from "./helpers/env";

// Phải đặt trước khi bất kỳ mô-đun nào tạo PrismaClient.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.APP_URL = "http://localhost:3000";
process.env.AUTH_SECRET = "test-secret-not-used-in-production";
for (const k of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_URL", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "UPLOAD_DIR"]) delete process.env[k];

// Các hàm bộ nhớ đệm của Next.js chỉ dùng được bên trong luồng dựng trang của Next; ở đây thay bằng hàm rỗng.
vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  updateTag: () => {},
  revalidatePath: () => {},
  revalidateTag: () => {},
}));
