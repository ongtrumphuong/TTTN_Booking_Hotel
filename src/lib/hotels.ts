import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";
import { holdingWhere, parseStay } from "./booking";

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
};

type HotelRow = Awaited<ReturnType<typeof queryHotels>>[number];

function queryHotels(where: object) {
  return prisma.hotel.findMany({
    where: { isActive: true, ...where },
    include: {
      rooms: { where: { isActive: true } },
      reviews: { select: { rating: true } },
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
  const { city, guests = 1, checkIn, checkOut, sort = "recommended" } = params;

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
  }

  const result = hotels
    .map((h) => {
      const rooms = h.rooms.filter((r) => r.capacity >= guests && r.quantity - (busy.get(r.id) ?? 0) > 0);
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
      reviews: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
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
