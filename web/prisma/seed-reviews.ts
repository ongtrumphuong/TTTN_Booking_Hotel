// Thêm đánh giá mẫu đa dạng mà KHÔNG xóa dữ liệu hiện có.
// Chạy: npx tsx prisma/seed-reviews.ts
// Chỉ thay các đánh giá còn mang lời nhận xét lặp lại của bản seed cũ; đánh giá thật của người dùng được giữ nguyên.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { LEGACY_SEED_COMMENT, REVIEWERS, reviewsForHotel } from "./sample-reviews";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(randomUUID(), 10);
  const users = [];
  for (const r of REVIEWERS) {
    users.push(await prisma.user.upsert({ where: { email: r.email }, update: {}, create: { ...r, passwordHash } }));
  }

  const legacy = await prisma.review.deleteMany({ where: { comment: LEGACY_SEED_COMMENT } });

  const hotels = await prisma.hotel.findMany({ orderBy: { createdAt: "asc" }, select: { id: true } });
  let created = 0;
  for (const [i, h] of hotels.entries()) {
    for (const r of reviewsForHotel(i)) {
      const userId = users[r.reviewerIndex].id;
      const exists = await prisma.review.findUnique({ where: { hotelId_userId: { hotelId: h.id, userId } } });
      if (exists) continue;
      await prisma.review.create({ data: { hotelId: h.id, userId, rating: r.rating, comment: r.text } });
      created++;
    }
  }
  console.log(`Đã thay ${legacy.count} đánh giá lặp, thêm ${created} đánh giá mới cho ${hotels.length} khách sạn.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
