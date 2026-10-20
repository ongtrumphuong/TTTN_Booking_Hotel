import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";
import { holdingWhere, maxBlockedRooms, parseStay, type BlockSpan } from "./booking";

export type HotelSummary = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  starRating: number;
  image: string;
  amenities: string[];
  minPrice: number;
  avgRating: number | null;
  reviewCount: number;
};

export type HotelSearch = {
  city?: string;
  guests?: number;
  checkIn?: string; // yyyy-mm-dd
  checkOut?: string;
  sort?: "recommended" | "price-asc" | "price-desc" | "rating";
  minPrice?: number; // giá một đêm, đồng
  maxPrice?: number;
  minStars?: number; // hạng sao tối thiểu
  amenities?: string[]; // khách sạn phải có đủ các tiện nghi này
};

type HotelRow = Awaited<ReturnType<typeof queryHotels>>[number];

function queryHotels(where: object) {
  return prisma.hotel.findMany({
    where: { isActive: true, ...where },
    include: {
      rooms: { where: { isActive: true } },
      reviews: { where: { isHidden: false }, select: { rating: true } },
    },
  });
}

function toSummary(h: HotelRow, rooms = h.rooms): HotelSummary | null {
  if (rooms.length === 0) return null;
  const ratings = h.reviews.map((r) => r.rating);
  return {
    id: h.id,
    slug: h.slug,
    name: h.name,
    city: h.city,
    address: h.address,
    starRating: h.starRating,
    image: h.images[0] ?? "",
    amenities: h.amenities,
    minPrice: Math.min(...rooms.map((r) => r.pricePerNight)),
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    reviewCount: ratings.length,
  };
}

export async function getFeaturedHotels(limit = 6): Promise<HotelSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("hotels");
  const hotels = await queryHotels({});
  return hotels
    .map((h) => toSummary(h))
    .filter((h): h is HotelSummary => h !== null)
    .sort((a, b) => b.starRating - a.starRating || (b.avgRating ?? 0) - (a.avgRating ?? 0))
    .slice(0, limit);
}

export async function getCities(): Promise<{ city: string; count: number; image: string }[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("hotels");
  const hotels = await prisma.hotel.findMany({ where: { isActive: true }, select: { city: true, images: true } });
  const map = new Map<string, { city: string; count: number; image: string }>();
  for (const h of hotels) {
    const cur = map.get(h.city);
    if (cur) cur.count += 1;
    else map.set(h.city, { city: h.city, count: 1, image: h.images[0] ?? "" });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function searchHotels(params: HotelSearch): Promise<HotelSummary[]> {
  "use cache";
  cacheLife("seconds");
  cacheTag("hotels");
  const { city, guests = 1, checkIn, checkOut, sort = "recommended", minPrice, maxPrice, minStars, amenities = [] } = params;

  const hotels = await queryHotels(city ? { city } : {});
  const stay = parseStay(checkIn, checkOut);

  let busy = new Map<string, number>();
  if (stay) {
    const overlapping = await prisma.booking.findMany({
      where: {
        ...holdingWhere(),
        checkIn: { lt: stay.checkOut },
        checkOut: { gt: stay.checkIn },
        room: { hotel: city ? { city } : {} },
      },
      select: { roomId: true, rooms: true },
    });
    busy = overlapping.reduce((m, b) => m.set(b.roomId, (m.get(b.roomId) ?? 0) + b.rooms), new Map<string, number>());

    // Phòng bị quản trị viên chặn cũng không bán được trong các đêm đó.
    const blocks = await prisma.roomBlock.findMany({
      where: { startDate: { lt: stay.checkOut }, endDate: { gt: stay.checkIn }, room: { hotel: city ? { city } : {} } },
      select: { roomId: true, startDate: true, endDate: true, rooms: true },
    });
    const byRoom = new Map<string, BlockSpan[]>();
    for (const b of blocks) byRoom.set(b.roomId, [...(byRoom.get(b.roomId) ?? []), b]);
    for (const [roomId, spans] of byRoom) busy.set(roomId, (busy.get(roomId) ?? 0) + maxBlockedRooms(spans, stay.checkIn, stay.checkOut));
  }

  const result = hotels
    .filter((h) => (minStars ? h.starRating >= minStars : true))
    .filter((h) => amenities.every((a) => h.amenities.includes(a)))
    .map((h) => {
      // Giá hiển thị là giá thấp nhất trong số phòng còn trống, đủ chỗ và nằm trong khoảng giá đã chọn.
      const rooms = h.rooms.filter(
        (r) =>
          r.capacity >= guests &&
          r.quantity - (busy.get(r.id) ?? 0) > 0 &&
          (minPrice === undefined || r.pricePerNight >= minPrice) &&
          (maxPrice === undefined || r.pricePerNight <= maxPrice),
      );
      return toSummary(h, rooms);
    })
    .filter((h): h is HotelSummary => h !== null);

  switch (sort) {
    case "price-asc":
      return result.sort((a, b) => a.minPrice - b.minPrice);
    case "price-desc":
      return result.sort((a, b) => b.minPrice - a.minPrice);
    case "rating":
      return result.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
    default:
      return result.sort((a, b) => b.starRating - a.starRating || a.minPrice - b.minPrice);
  }
}

export async function getHotelDetail(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("hotels");
  const hotel = await prisma.hotel.findFirst({
    where: { slug, isActive: true },
    include: {
      rooms: { where: { isActive: true }, orderBy: { pricePerNight: "asc" } },
      reviews: { where: { isHidden: false }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
    },
  });
  if (!hotel) return null;
  const ratings = hotel.reviews.map((r) => r.rating);
  return {
    ...hotel,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    reviews: hotel.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.user.name,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** Không cache vì phụ thuộc từng người dùng; chỉ trả về khách sạn đang hoạt động theo đúng thứ tự ids. */
export async function getHotelsByIds(ids: string[]): Promise<HotelSummary[]> {
  if (ids.length === 0) return [];
  const hotels = await queryHotels({ id: { in: ids } });
  const byId = new Map(hotels.map((h) => [h.id, h]));
  return ids
    .map((id) => byId.get(id))
    .filter((h): h is HotelRow => !!h)
    .map((h) => toSummary(h))
    .filter((h): h is HotelSummary => h !== null);
}

/** Các lựa chọn cho bộ lọc: tiện nghi đang có ở khách sạn và khoảng giá thực tế. */
export async function getFilterOptions(): Promise<{ amenities: string[]; minPrice: number; maxPrice: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("hotels");
  const [hotels, price] = await Promise.all([
    prisma.hotel.findMany({ where: { isActive: true }, select: { amenities: true } }),
    prisma.room.aggregate({ where: { isActive: true, hotel: { isActive: true } }, _min: { pricePerNight: true }, _max: { pricePerNight: true } }),
  ]);
  const counts = new Map<string, number>();
  for (const h of hotels) for (const a of h.amenities) counts.set(a, (counts.get(a) ?? 0) + 1);
  return {
    amenities: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi")).map(([a]) => a),
    minPrice: price._min.pricePerNight ?? 0,
    maxPrice: price._max.pricePerNight ?? 0,
  };
}

/** Đánh giá tốt gần đây cho trang chủ. */
export async function getFeaturedReviews(limit = 3) {
  "use cache";
  cacheLife("minutes");
  cacheTag("hotels");
  const rows = await prisma.review.findMany({
    where: { rating: { gte: 4 }, isHidden: false, hotel: { isActive: true } },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    include: { user: { select: { name: true } }, hotel: { select: { name: true, slug: true, city: true } } },
  });
  // Mỗi khách sạn chỉ xuất hiện một lần để phần này đa dạng.
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.hotel.slug) ? false : (seen.add(r.hotel.slug), true)))
    .slice(0, limit)
    .map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, author: r.user.name, hotel: r.hotel }));
}

/** Dữ liệu cho sitemap.xml: khách sạn đang hoạt động và các thành phố có khách sạn. */
export async function getSitemapData(): Promise<{ hotels: { slug: string; createdAt: Date }[]; cities: string[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag("hotels");
  const hotels = await prisma.hotel.findMany({
    where: { isActive: true, rooms: { some: { isActive: true } } },
    select: { slug: true, city: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return { hotels: hotels.map((h) => ({ slug: h.slug, createdAt: h.createdAt })), cities: [...new Set(hotels.map((h) => h.city))].sort() };
}

/** Số liệu tổng quan hiển thị ở trang chủ (khách sạn, loại phòng, đánh giá). */
export async function getSiteStats() {
  "use cache";
  cacheLife("minutes");
  cacheTag("hotels");
  const [hotels, rooms, reviews] = await Promise.all([
    prisma.hotel.count({ where: { isActive: true } }),
    prisma.room.count({ where: { isActive: true, hotel: { isActive: true } } }),
    prisma.review.aggregate({ where: { isHidden: false, hotel: { isActive: true } }, _avg: { rating: true }, _count: true }),
  ]);
  return { hotels, rooms, reviews: reviews._count, avgRating: reviews._avg.rating };
}
