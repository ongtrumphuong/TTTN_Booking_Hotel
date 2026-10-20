import "server-only";
import type { Prisma } from "@prisma/client";
import { holdingWhere, isoDate, maxBlockedRooms, parseStay, todayUTC } from "@/lib/booking";
import { policyText } from "@/lib/cancellation";
import { stayPrice } from "@/lib/pricing";
import { loadPricing } from "@/lib/pricing-db";
import { prisma } from "@/lib/prisma";
import { signProposal } from "./proposal";

export type SearchInput = {
  city?: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
  maxPricePerNight?: number;
  minPricePerNight?: number;
  keywords?: string[];
};

export type RoomOption = {
  roomId: string;
  hotelName: string;
  hotelSlug: string;
  city: string;
  address: string;
  stars: number;
  rating: number | null;
  reviewCount: number;
  roomName: string;
  bedType: string;
  capacity: number;
  pricePerNight: number;
  nights: number;
  total: number;
  roomsLeft: number;
  highlights: string[];
  matched: string[];
  missing: string[];
  /** Với phương án gần đúng: lý do chưa khớp hẳn yêu cầu (ví dụ vượt ngân sách). */
  note?: string;
  cancelPolicy: string;
  imageUrl: string | null;
  hotelUrl: string;
  proposalToken: string;
};

export type SearchResult =
  | { ok: false; error: string }
  | { ok: true; stay: { checkIn: string; checkOut: string; nights: number }; exact: RoomOption[]; alternatives: RoomOption[]; cities: string[] };

/** Bỏ dấu và viết thường để so khớp không phân biệt dấu ("Hồ Xuân Hương" khớp "ho xuan huong"). */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Các từ đệm trong câu nói ("view hồ Xuân Hương", "gần biển") không phải là phần cần khớp.
const STOP = new Set(["view", "gan", "nhin", "ra", "co", "cho", "o", "tai", "voi", "the", "va", "la"]);

const tokens = (kw: string) => fold(kw).split(" ").filter((t) => t.length > 1 && !STOP.has(t));

/** Một từ khóa khớp khi cả cụm xuất hiện nguyên vẹn, hoặc mọi từ có nghĩa của cụm đều xuất hiện. */
function keywordHit(haystack: string, kw: string) {
  const phrase = fold(kw);
  if (!phrase) return false;
  if (haystack.includes(phrase)) return true;
  const t = tokens(kw);
  return t.length > 0 && t.every((x) => haystack.includes(x));
}

/** "view hồ Xuân Hương", "nhìn ra biển": khách nói về cảnh nhìn thấy từ phòng, khác với "gần hồ Xuân Hương" (vị trí khách sạn). */
const isViewKeyword = (kw: string) => /^(view|nhin)\s/.test(fold(kw));

const MAX_EXACT = 5;
const MAX_ALT = 3;
const OVER_BUDGET_TOLERANCE = 0.4;

/** Số phòng không bán được của nhiều loại phòng cùng lúc (đơn đang giữ + phòng bị chặn), tính bằng vài truy vấn thay vì từng phòng. */
async function unavailableByRoom(db: Pick<Prisma.TransactionClient, "booking" | "roomBlock">, roomIds: string[], checkIn: Date, checkOut: Date) {
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { roomId: { in: roomIds }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn }, ...holdingWhere() },
      select: { roomId: true, rooms: true },
    }),
    db.roomBlock.findMany({ where: { roomId: { in: roomIds }, startDate: { lt: checkOut }, endDate: { gt: checkIn } }, select: { roomId: true, startDate: true, endDate: true, rooms: true } }),
  ]);
  const used = new Map<string, number>();
  for (const b of bookings) used.set(b.roomId, (used.get(b.roomId) ?? 0) + b.rooms);
  const byRoom = new Map<string, typeof blocks>();
  for (const b of blocks) byRoom.set(b.roomId, [...(byRoom.get(b.roomId) ?? []), b]);
  for (const [roomId, list] of byRoom) used.set(roomId, (used.get(roomId) ?? 0) + maxBlockedRooms(list, checkIn, checkOut));
  return used;
}

/**
 * Tìm phòng theo yêu cầu của khách: điểm đến, ngày, số khách, khoảng giá, từ khóa (cảnh quan, địa danh, tiện nghi).
 * Chỉ trả về phòng đang bán, còn trống đúng khoảng ngày và đủ sức chứa. Giá luôn tính ở máy chủ.
 * `exact` là phòng khớp mọi điều kiện; `alternatives` là phòng gần đúng (vượt ngân sách một chút, hoặc thiếu một vài từ khóa) để trợ lý gợi ý.
 */
export async function searchRooms(input: SearchInput, db: Pick<Prisma.TransactionClient, "hotel" | "booking" | "roomBlock" | "review" | "priceRule"> = prisma): Promise<SearchResult> {
  const stay = parseStay(input.checkIn, input.checkOut);
  if (!stay) return { ok: false, error: "Ngày nhận/trả phòng không hợp lệ (cần dạng yyyy-mm-dd, ở lại từ 1 đến 30 đêm, ngày trả sau ngày nhận)." };
  if (stay.checkIn < todayUTC()) return { ok: false, error: `Ngày nhận phòng ${input.checkIn} đã qua. Hãy hỏi lại khách ngày nhận phòng.` };

  const guests = clampInt(input.guests, 1, 20, 2);
  const rooms = clampInt(input.rooms, 1, 10, 1);
  const max = input.maxPricePerNight && input.maxPricePerNight > 0 ? Math.round(input.maxPricePerNight) : undefined;
  const min = input.minPricePerNight && input.minPricePerNight > 0 ? Math.round(input.minPricePerNight) : undefined;
  const keywords = (input.keywords ?? []).map((k) => String(k).trim()).filter(Boolean).slice(0, 6);

  const hotels = await db.hotel.findMany({
    where: { isActive: true },
    include: { rooms: { where: { isActive: true } } },
  });
  const cities = [...new Set(hotels.map((h) => h.city))].sort((a, b) => a.localeCompare(b, "vi"));

  const wantCity = input.city ? fold(input.city) : "";
  const inCity = wantCity ? hotels.filter((h) => fold(h.city).includes(wantCity) || wantCity.includes(fold(h.city))) : hotels;
  if (wantCity && inCity.length === 0) return { ok: false, error: `Hệ thống chưa có khách sạn ở "${input.city}". Các điểm đến hiện có: ${cities.join(", ")}.` };

  const roomIds = inCity.flatMap((h) => h.rooms.map((r) => r.id));
  const [used, ratings, pricing] = await Promise.all([
    unavailableByRoom(db, roomIds, stay.checkIn, stay.checkOut),
    db.review.groupBy({ by: ["hotelId"], where: { hotelId: { in: inCity.map((h) => h.id) }, isHidden: false }, _avg: { rating: true }, _count: true }),
    loadPricing(db, inCity.flatMap((h) => h.rooms), stay.checkIn, stay.checkOut),
  ]);
  const rate = new Map(ratings.map((r) => [r.hotelId, { avg: r._avg.rating, count: r._count }]));

  type Scored = RoomOption & { fits: boolean; priceOk: boolean; overBy: number; score: number };
  const scored: Scored[] = [];
  for (const h of inCity) {
    for (const r of h.rooms) {
      const left = r.quantity - (used.get(r.id) ?? 0);
      if (left < rooms || guests > r.capacity * rooms) continue; // không đặt được: bỏ hẳn

      const hay = fold([h.name, h.city, h.address, h.description, ...h.highlights, ...h.amenities, r.name, r.description, r.bedType, ...r.highlights, ...r.amenities].join(" "));
      // Từ khóa kiểu "view ..." chỉ khớp với thông tin của chính phòng (hoặc điểm nổi bật "View ..." của khách sạn), không khớp "gần ..." hay tên khách sạn.
      const viewHay = fold([r.name, r.description, r.bedType, ...r.highlights, ...r.amenities, ...h.highlights.filter((x) => fold(x).startsWith("view"))].join(" "));
      const matched = keywords.filter((k) => keywordHit(isViewKeyword(k) ? viewHay : hay, k));
      const missing = keywords.filter((k) => !matched.includes(k));
      // Giá thực tế của kỳ lưu trú (có thể có phụ thu cuối tuần/mùa cao điểm); so ngân sách theo giá trung bình mỗi đêm.
      const stayTotal = stayPrice(pricing.get(r.id)!, stay.checkIn, stay.checkOut);
      const avgNight = Math.round(stayTotal / stay.nights);
      const priceOk = (max === undefined || avgNight <= max) && (min === undefined || avgNight >= min);
      const overBy = max !== undefined && avgNight > max ? avgNight - max : 0;
      const rt = rate.get(h.id);
      const token = signProposal({ roomId: r.id, checkIn: input.checkIn, checkOut: input.checkOut, guests, rooms });
      scored.push({
        roomId: r.id,
        hotelName: h.name,
        hotelSlug: h.slug,
        city: h.city,
        address: h.address,
        stars: h.starRating,
        rating: rt?.avg ?? null,
        reviewCount: rt?.count ?? 0,
        roomName: r.name,
        bedType: r.bedType,
        capacity: r.capacity,
        pricePerNight: avgNight,
        nights: stay.nights,
        total: stayTotal * rooms,
        roomsLeft: left,
        highlights: [...new Set([...r.highlights, ...h.highlights])],
        matched,
        missing,
        cancelPolicy: policyText(h.freeCancelDays, h.lateCancelFeePercent),
        imageUrl: r.images[0] ?? h.images[0] ?? null,
        hotelUrl: `/hotels/${h.slug}?checkIn=${isoDate(stay.checkIn)}&checkOut=${isoDate(stay.checkOut)}&guests=${guests}`,
        proposalToken: token,
        fits: matched.length === keywords.length,
        priceOk,
        overBy,
        score: matched.length * 10 + (rt?.avg ?? 0) - (max !== undefined ? Math.abs(max - avgNight) / 1_000_000 : 0),
      });
    }
  }

  const strip = ({ fits: _f, priceOk: _p, overBy: _o, score: _s, ...opt }: Scored): RoomOption => opt; // eslint-disable-line @typescript-eslint/no-unused-vars
  const exact = scored.filter((s) => s.fits && s.priceOk).sort((a, b) => b.score - a.score).slice(0, MAX_EXACT);
  const exactIds = new Set(exact.map((e) => e.roomId));

  const alt = scored
    .filter((s) => !exactIds.has(s.roomId))
    .filter((s) => (s.fits && !s.priceOk && max !== undefined && s.overBy <= max * OVER_BUDGET_TOLERANCE) || (s.priceOk && !s.fits && (s.matched.length > 0 || exact.length === 0)))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ALT)
    .map((s) => ({
      ...strip(s),
      note: s.fits && !s.priceOk
        ? `đúng yêu cầu nhưng vượt ngân sách ${s.overBy.toLocaleString("vi-VN")} ₫/đêm`
        : `đúng ngân sách nhưng chưa thấy: ${s.missing.join(", ")}`,
    }));

  return { ok: true, stay: { checkIn: input.checkIn, checkOut: input.checkOut, nights: stay.nights }, exact: exact.map(strip), alternatives: alt, cities };
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}
