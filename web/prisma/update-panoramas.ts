// Gán ảnh 360° mẫu cho các loại phòng CHƯA có ảnh 360° (không đụng ảnh do đối tác/quản trị viên đã đặt).
// Chạy: npx tsx prisma/update-panoramas.ts --apply   (không có --apply chỉ in ra những gì sẽ làm)
import { PrismaClient } from "@prisma/client";
import { panoramaFor } from "./panoramas";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const rooms = await prisma.room.findMany({ where: { panoramaUrl: null }, select: { id: true, name: true, hotel: { select: { name: true } } } });
  for (const r of rooms) {
    const url = panoramaFor(r.name);
    console.log(`${apply ? "Gán" : "Sẽ gán"} ${url} cho "${r.name}" (${r.hotel.name})`);
    if (apply) await prisma.room.update({ where: { id: r.id }, data: { panoramaUrl: url } });
  }
  console.log(`${rooms.length} loại phòng${apply ? " đã cập nhật" : " (thêm --apply để ghi)"}.`);
}

main().finally(() => prisma.$disconnect());
