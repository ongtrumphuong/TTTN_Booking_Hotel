// Thêm tài khoản đối tác mẫu và gán vài khách sạn cho đối tác trên cơ sở dữ liệu ĐÃ CÓ (không xóa dữ liệu, chạy lại an toàn).
// Chỉ dùng khi phát triển/demo; tài khoản mẫu phải xóa hoặc đổi mật khẩu trước khi triển khai thật.
//
//   npx tsx prisma/seed-partner.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const HOST = { email: "doitac@khongiansos.vn", name: "Công ty Khách sạn Sông Hàn", password: "Doitac@123456" };
const SLUGS = ["han-river-central", "dalat-pine-hill", "nha-trang-ocean-pearl"];

async function main() {
  const prisma = new PrismaClient();
  try {
    const host = await prisma.user.upsert({
      where: { email: HOST.email },
      update: { role: "HOST" },
      create: { email: HOST.email, name: HOST.name, role: "HOST", phone: "0911111111", passwordHash: await bcrypt.hash(HOST.password, 10) },
    });
    const res = await prisma.hotel.updateMany({ where: { slug: { in: SLUGS }, ownerId: null }, data: { ownerId: host.id } });
    console.log(`Đối tác ${host.email} sẵn sàng; đã gán ${res.count} khách sạn.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
