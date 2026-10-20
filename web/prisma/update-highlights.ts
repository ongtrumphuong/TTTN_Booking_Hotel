// Điền "điểm nổi bật" cho khách sạn/phòng mẫu trên cơ sở dữ liệu ĐÃ CÓ. Chỉ điền khi đang trống nên không ghi đè nội dung đối tác/quản trị đã nhập.
//
//   npx tsx prisma/update-highlights.ts          # chỉ liệt kê
//   npx tsx prisma/update-highlights.ts --apply  # cập nhật
import { PrismaClient } from "@prisma/client";
import { HOTEL_HIGHLIGHTS, ROOM_HIGHLIGHTS } from "./highlights";

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const hotels = await prisma.hotel.findMany({ where: { slug: { in: Object.keys(HOTEL_HIGHLIGHTS) } }, include: { rooms: true } });
    let n = 0;
    for (const h of hotels) {
      if (h.highlights.length === 0) {
        console.log(`${apply ? "Cập nhật" : "Sẽ cập nhật"} khách sạn: ${h.slug}`);
        if (apply) await prisma.hotel.update({ where: { id: h.id }, data: { highlights: HOTEL_HIGHLIGHTS[h.slug] } });
        n++;
      }
      for (const r of h.rooms) {
        const wanted = ROOM_HIGHLIGHTS[h.slug]?.[r.name];
        if (!wanted || r.highlights.length > 0) continue;
        console.log(`${apply ? "Cập nhật" : "Sẽ cập nhật"} phòng: ${h.slug} / ${r.name}`);
        if (apply) await prisma.room.update({ where: { id: r.id }, data: { highlights: wanted } });
        n++;
      }
    }
    console.log(n === 0 ? "Không có gì cần cập nhật." : apply ? `Xong (${n} mục).` : `Có ${n} mục. Thêm --apply để cập nhật.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
