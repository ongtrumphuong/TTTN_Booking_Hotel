// Thay ảnh mẫu ngẫu nhiên (picsum.photos) bằng ảnh thật theo khách sạn/loại phòng cho dữ liệu đã có sẵn trong cơ sở dữ liệu.
// Chỉ đụng tới khách sạn có slug trong prisma/photos.ts và chỉ khi ảnh hiện tại vẫn là ảnh mẫu picsum, nên không ghi đè ảnh
// quản trị viên đã tự tải lên.
//
//   npx tsx prisma/update-images.ts          # chỉ liệt kê
//   npx tsx prisma/update-images.ts --apply  # cập nhật
import { PrismaClient } from "@prisma/client";
import { HOTEL_PHOTOS, hotelImages, roomImages } from "./photos";

const isSample = (images: string[]) => images.length > 0 && images.every((u) => u.startsWith("https://picsum.photos/"));

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const hotels = await prisma.hotel.findMany({ where: { slug: { in: Object.keys(HOTEL_PHOTOS) } }, include: { rooms: true }, orderBy: { createdAt: "asc" } });
    let changed = 0;
    for (const [index, h] of hotels.entries()) {
      if (isSample(h.images)) {
        console.log(`${apply ? "Cập nhật" : "Sẽ cập nhật"} ảnh khách sạn: ${h.slug}`);
        if (apply) await prisma.hotel.update({ where: { id: h.id }, data: { images: hotelImages(h.slug) } });
        changed++;
      }
      for (const r of h.rooms) {
        if (!isSample(r.images)) continue;
        console.log(`${apply ? "Cập nhật" : "Sẽ cập nhật"} ảnh phòng: ${h.slug} / ${r.name}`);
        if (apply) await prisma.room.update({ where: { id: r.id }, data: { images: roomImages(r.name, index) } });
        changed++;
      }
    }
    console.log(changed === 0 ? "Không có ảnh mẫu nào cần thay." : apply ? `Xong (${changed} mục).` : `Có ${changed} mục. Thêm --apply để cập nhật.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
