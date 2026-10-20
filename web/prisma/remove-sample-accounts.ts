// Xóa các tài khoản mẫu do seed tạo ra (và dữ liệu gắn với chúng) trước khi chạy thật.
//
//   npx tsx prisma/remove-sample-accounts.ts            # chỉ liệt kê, KHÔNG xóa
//   npx tsx prisma/remove-sample-accounts.ts --confirm  # xóa thật
//
// Xóa người dùng sẽ xóa theo yêu thích của họ; đơn đặt phòng và đánh giá của họ cũng bị xóa (khóa ngoại), nên chỉ dùng trên hệ thống chưa có dữ liệu thật.
import { PrismaClient } from "@prisma/client";

export const SAMPLE_EMAILS = ["admin@khongiansos.vn", "khach@khongiansos.vn"];
export const SAMPLE_DOMAIN = "@example.com"; // các tài khoản người đánh giá mẫu (linh.tran@example.com...)

export async function findSampleAccounts(db: PrismaClient) {
  return db.user.findMany({
    where: { OR: [{ email: { in: SAMPLE_EMAILS } }, { email: { endsWith: SAMPLE_DOMAIN } }] },
    select: { id: true, email: true, role: true, _count: { select: { bookings: true, reviews: true } } },
    orderBy: { email: "asc" },
  });
}

export async function removeSampleAccounts(db: PrismaClient) {
  const users = await findSampleAccounts(db);
  const ids = users.map((u) => u.id);
  await db.$transaction([
    db.payment.deleteMany({ where: { booking: { userId: { in: ids } } } }),
    db.booking.deleteMany({ where: { userId: { in: ids } } }),
    db.review.deleteMany({ where: { userId: { in: ids } } }),
    db.favorite.deleteMany({ where: { userId: { in: ids } } }),
    db.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return users.length;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await findSampleAccounts(prisma);
    if (users.length === 0) return console.log("Không có tài khoản mẫu nào.");
    for (const u of users) console.log(`- ${u.email} (${u.role}): ${u._count.bookings} đơn, ${u._count.reviews} đánh giá`);
    if (!process.argv.includes("--confirm")) return console.log("\nChưa xóa gì. Thêm --confirm để xóa các tài khoản trên.");
    console.log(`\nĐã xóa ${await removeSampleAccounts(prisma)} tài khoản mẫu.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (typeof require !== "undefined" && require.main === module) void main();
