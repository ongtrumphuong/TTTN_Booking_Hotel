import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { hotelImages, roomImages } from "./photos";
import { REVIEWERS, reviewsForHotel } from "./sample-reviews";

const prisma = new PrismaClient();

// Tài khoản mẫu cho môi trường phát triển (đổi trước khi triển khai thật).
const ADMIN = { email: "admin@khongiansos.vn", name: "Quản trị viên", password: "Admin@123456" };
const USER = { email: "khach@khongiansos.vn", name: "Nguyễn Văn Khách", password: "Khach@123456" };
const HOST = { email: "doitac@khongiansos.vn", name: "Công ty Khách sạn Sông Hàn", password: "Doitac@123456" };
// Các khách sạn mẫu thuộc về đối tác (còn lại do sàn tự vận hành).
const PARTNER_HOTELS = new Set(["han-river-central", "dalat-pine-hill", "nha-trang-ocean-pearl"]);

const HOTEL_AMENITIES = ["Wi-Fi miễn phí", "Hồ bơi", "Bữa sáng", "Đưa đón sân bay", "Spa", "Phòng gym", "Nhà hàng", "Bãi đỗ xe"];
const ROOM_AMENITIES = ["Điều hòa", "TV màn hình phẳng", "Minibar", "Máy sấy tóc", "Két an toàn", "Ban công"];

type Seed = {
  slug: string;
  name: string;
  city: string;
  address: string;
  star: number;
  description: string;
  lat: number;
  lng: number;
  base: number;
};

const hotels: Seed[] = [
  { slug: "khong-gian-so-hanoi-old-quarter", name: "Không Gian Số Old Quarter", city: "Hà Nội", address: "36 Hàng Bạc, Hoàn Kiếm", star: 4, base: 1250000, lat: 21.0341, lng: 105.8532, description: "Khách sạn boutique giữa phố cổ Hà Nội, cách Hồ Gươm 5 phút đi bộ, kết hợp nét kiến trúc Đông Dương với tiện nghi hiện đại." },
  { slug: "tay-ho-lake-view", name: "Tây Hồ Lake View Hotel", city: "Hà Nội", address: "12 Quảng An, Tây Hồ", star: 5, base: 2400000, lat: 21.0685, lng: 105.8266, description: "Khách sạn 5 sao nhìn ra Hồ Tây với nhà hàng trên cao và spa thư giãn." },
  { slug: "my-khe-beach-resort", name: "Mỹ Khê Beach Resort", city: "Đà Nẵng", address: "Võ Nguyên Giáp, Sơn Trà", star: 5, base: 3200000, lat: 16.0544, lng: 108.2478, description: "Resort sát biển Mỹ Khê với hồ bơi vô cực, phòng hướng biển và câu lạc bộ trẻ em." },
  { slug: "han-river-central", name: "Hàn River Central Hotel", city: "Đà Nẵng", address: "88 Bạch Đằng, Hải Châu", star: 4, base: 1450000, lat: 16.0678, lng: 108.2243, description: "Vị trí trung tâm ngay bên sông Hàn, gần cầu Rồng và các quán ăn đường phố nổi tiếng." },
  { slug: "saigon-skyline", name: "Saigon Skyline Hotel", city: "Hồ Chí Minh", address: "25 Nguyễn Huệ, Quận 1", star: 5, base: 2900000, lat: 10.7745, lng: 106.7035, description: "Khách sạn cao tầng trên phố đi bộ Nguyễn Huệ với quầy bar sân thượng ngắm toàn cảnh thành phố." },
  { slug: "district-3-garden-inn", name: "District 3 Garden Inn", city: "Hồ Chí Minh", address: "14 Võ Văn Tần, Quận 3", star: 3, base: 780000, lat: 10.7769, lng: 106.6903, description: "Khách sạn nhỏ yên tĩnh trong khu nhiều cây xanh, phù hợp công tác và nghỉ dưỡng ngắn ngày." },
  { slug: "dalat-pine-hill", name: "Đà Lạt Pine Hill Retreat", city: "Đà Lạt", address: "7 Trần Hưng Đạo", star: 4, base: 1350000, lat: 11.9404, lng: 108.4583, description: "Khu nghỉ dưỡng giữa đồi thông với lò sưởi trong phòng và tầm nhìn ra thung lũng." },
  { slug: "nha-trang-ocean-pearl", name: "Nha Trang Ocean Pearl", city: "Nha Trang", address: "60 Trần Phú", star: 4, base: 1650000, lat: 12.2388, lng: 109.1967, description: "Nằm ngay đường Trần Phú, phòng nhìn ra vịnh Nha Trang, có hồ bơi trên tầng thượng." },
  { slug: "phu-quoc-sunset-bay", name: "Phú Quốc Sunset Bay Resort", city: "Phú Quốc", address: "Bãi Trường, Dương Đông", star: 5, base: 3600000, lat: 10.2273, lng: 103.9663, description: "Resort bãi biển riêng, biệt thự hồ bơi và quầy bar ngắm hoàng hôn nổi tiếng." },
];

async function main() {
  await prisma.favorite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: ADMIN.email, name: ADMIN.name, role: "ADMIN", passwordHash: await bcrypt.hash(ADMIN.password, 10) },
  });
  const user = await prisma.user.create({
    data: { email: USER.email, name: USER.name, phone: "0900000000", passwordHash: await bcrypt.hash(USER.password, 10) },
  });

  const host = await prisma.user.create({
    data: { email: HOST.email, name: HOST.name, role: "HOST", phone: "0911111111", passwordHash: await bcrypt.hash(HOST.password, 10) },
  });

  // Người đánh giá mẫu: mật khẩu ngẫu nhiên nên không đăng nhập được, chỉ để đánh giá hiển thị đa dạng.
  const reviewerHash = await bcrypt.hash(randomUUID(), 10);
  const reviewers = [];
  for (const r of REVIEWERS) reviewers.push(await prisma.user.create({ data: { ...r, passwordHash: reviewerHash } }));

  for (const [index, h] of hotels.entries()) {
    const hotel = await prisma.hotel.create({
      data: {
        slug: h.slug,
        name: h.name,
        description: h.description,
        address: h.address,
        city: h.city,
        starRating: h.star,
        latitude: h.lat,
        longitude: h.lng,
        images: hotelImages(h.slug),
        ownerId: PARTNER_HOTELS.has(h.slug) ? host.id : null,
        amenities: HOTEL_AMENITIES.slice(0, 4 + (h.star % 5)),
      },
    });

    const rooms = [
      { name: "Phòng Tiêu chuẩn", bed: "1 giường đôi", cap: 2, size: 24, mult: 1, qty: 6 },
      { name: "Phòng Deluxe", bed: "1 giường King", cap: 2, size: 32, mult: 1.35, qty: 4 },
      { name: "Phòng Gia đình", bed: "2 giường đôi", cap: 4, size: 44, mult: 1.8, qty: 3 },
    ];
    for (const r of rooms) {
      await prisma.room.create({
        data: {
          hotelId: hotel.id,
          name: r.name,
          description: `${r.name} tại ${h.name}, diện tích ${r.size}m² với đầy đủ tiện nghi.`,
          pricePerNight: Math.round((h.base * r.mult) / 10000) * 10000,
          capacity: r.cap,
          bedType: r.bed,
          sizeM2: r.size,
          images: roomImages(r.name, index),
          amenities: ROOM_AMENITIES,
          quantity: r.qty,
        },
      });
    }

    for (const r of reviewsForHotel(index)) {
      await prisma.review.create({
        data: { hotelId: hotel.id, userId: reviewers[r.reviewerIndex].id, rating: r.rating, comment: r.text },
      });
    }
  }

  console.log(`Đã tạo ${hotels.length} khách sạn, tài khoản admin (${admin.email}) và user (${user.email}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
