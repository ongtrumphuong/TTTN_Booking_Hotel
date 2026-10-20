import { execSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./helpers/env";

/** Tạo cơ sở dữ liệu kiểm thử nếu chưa có (kết nối vào cơ sở dữ liệu quản trị "postgres" của cùng máy chủ). */
async function ensureDatabase(url: string) {
  const u = new URL(url);
  const name = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(name) || !name.endsWith("_test")) throw new Error(`Tên cơ sở dữ liệu kiểm thử không hợp lệ: ${name}`);

  u.pathname = "/postgres";
  const admin = new PrismaClient({ datasourceUrl: u.toString() });
  try {
    const found = await admin.$queryRaw<{ x: number }[]>`SELECT 1 AS x FROM pg_database WHERE datname = ${name}`;
    if (found.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`); // tên đã kiểm tra ở trên
  } finally {
    await admin.$disconnect();
  }
}

/**
 * Chạy một lần trước toàn bộ kiểm thử: bảo đảm cơ sở dữ liệu kiểm thử tồn tại rồi áp dụng các migration còn thiếu.
 * Dùng `migrate deploy` (chỉ thêm, không xóa) thay vì `migrate reset`; việc dọn dữ liệu giữa các bài do resetDb() đảm nhiệm.
 */
export default async function setup() {
  const url = testDatabaseUrl();
  await ensureDatabase(url);
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  process.env.DATABASE_URL = url;
}
