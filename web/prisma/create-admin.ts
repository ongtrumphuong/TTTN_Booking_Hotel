// Tạo (hoặc nâng quyền và đặt lại mật khẩu cho) một tài khoản quản trị viên, không cần chạy seed.
//
//   ADMIN_PASSWORD='MatKhauManh123' npx tsx prisma/create-admin.ts admin@congty.vn "Tên Quản Trị"
//
// Mật khẩu đưa qua biến môi trường ADMIN_PASSWORD (không đưa vào tham số dòng lệnh để khỏi lọt vào lịch sử lệnh/danh sách tiến trình).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export type AdminInput = { email: string; name: string; password: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEAK_WORDS = new Set(["password", "matkhau", "admin", "administrator", "qwerty", "letmein", "welcome", "khongiansos", "khongiansostay"]);

/** Kiểm tra đầu vào; trả về thông báo lỗi hoặc null nếu hợp lệ. */
export function validateAdminInput({ email, name, password }: AdminInput): string | null {
  if (!EMAIL.test(email) || email.length > 254) return "Email không hợp lệ.";
  if (name.trim().length < 2 || name.length > 80) return "Tên phải từ 2 đến 80 ký tự.";
  if (password.length < 10) return "Mật khẩu tối thiểu 10 ký tự.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mật khẩu cần có cả chữ cái và chữ số.";
  // Chặn khi phần chữ cái chính là một từ yếu phổ biến (kể cả khi chỉ thêm số), ví dụ "password12345", "admin123456".
  if (WEAK_WORDS.has(password.toLowerCase().replace(/[^a-z]/g, ""))) return "Mật khẩu quá dễ đoán.";
  return null;
}

/** Tạo mới hoặc nâng quyền; trả về "created" hoặc "updated". */
export async function createOrPromoteAdmin(db: PrismaClient, input: AdminInput): Promise<"created" | "updated"> {
  const error = validateAdminInput(input);
  if (error) throw new Error(error);

  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", passwordHash, name: input.name.trim() } });
    return "updated";
  }
  await db.user.create({ data: { email, name: input.name.trim(), role: "ADMIN", passwordHash } });
  return "created";
}

async function main() {
  const [email, name] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !name) {
    console.error('Cách dùng: ADMIN_PASSWORD=... npx tsx prisma/create-admin.ts <email> "<Tên hiển thị>"');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const result = await createOrPromoteAdmin(prisma, { email, name, password });
    console.log(result === "created" ? `Đã tạo quản trị viên ${email}.` : `Đã nâng quyền và đặt lại mật khẩu cho ${email}.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Chỉ chạy khi gọi trực tiếp bằng dòng lệnh, không chạy khi được nhập vào làm thư viện (ví dụ trong kiểm thử).
if (typeof require !== "undefined" && require.main === module) void main();
