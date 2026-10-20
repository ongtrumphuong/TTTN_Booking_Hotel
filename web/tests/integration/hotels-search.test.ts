import { beforeEach, describe, expect, it } from "vitest";
import {
  getCities,
  getFeaturedReviews,
  getFilterOptions,
  getHotelDetail,
  getHotelsByIds,
  getSitemapData,
  searchHotels,
} from "@/lib/hotels";
import { d, minutesAgo, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

type H = Awaited<ReturnType<typeof mkHotel>>;
let guestId: string;
let h1: H; // Hà Nội, 5 sao, Hồ bơi + Spa; phòng chuẩn 1tr (2 người, 2 phòng) + gia đình 2tr (4 người, 1 phòng)
let h2: H; // Hà Nội, 3 sao, Hồ bơi; phòng 500k (2 người, 3 phòng)
let h3: H; // Đà Nẵng, 4 sao, Spa + Phòng gym; phòng 1,5tr (3 người, 1 phòng)

beforeEach(async () => {
  await resetDb();
  guestId = (await mkUser()).id;
  h1 = await mkHotel({ slug: "h1", name: "H1", city: "Hà Nội", stars: 5, amenities: ["Hồ bơi", "Spa"], rooms: [{ name: "Chuẩn", price: 1_000_000, capacity: 2, quantity: 2 }, { name: "Gia đình", price: 2_000_000, capacity: 4, quantity: 1 }] });
  h2 = await mkHotel({ slug: "h2", name: "H2", city: "Hà Nội", stars: 3, amenities: ["Hồ bơi"], rooms: [{ price: 500_000, capacity: 2, quantity: 3 }] });
  h3 = await mkHotel({ slug: "h3", name: "H3", city: "Đà Nẵng", stars: 4, amenities: ["Spa", "Phòng gym"], rooms: [{ price: 1_500_000, capacity: 3, quantity: 1 }] });
  await mkHotel({ slug: "an", name: "Đã ẩn", city: "Hà Nội", active: false, rooms: [{ price: 100_000 }] });
  await mkHotel({ slug: "khong-phong", name: "Không phòng", city: "Hà Nội", rooms: [{ active: false }] });
});

const names = async (q: Parameters<typeof searchHotels>[0]) => (await searchHotels(q)).map((h) => h.name);
const review = (hotelId: string, rating: number, over: { isHidden?: boolean; createdAt?: Date; userId?: string; comment?: string } = {}) =>
  mkUser().then((u) =>
    prisma.review.create({ data: { hotelId, userId: over.userId ?? u.id, rating, comment: over.comment ?? "Nhận xét thử nghiệm", isHidden: over.isHidden ?? false, createdAt: over.createdAt } }),
  );

describe("searchHotels: lọc cơ bản", () => {
  it("chỉ trả khách sạn đang hoạt động và còn phòng đang bán", async () => {
    expect((await names({ guests: 1 })).sort()).toEqual(["H1", "H2", "H3"]);
  });
  it("lọc theo thành phố", async () => {
    expect((await names({ city: "Hà Nội", guests: 1 })).sort()).toEqual(["H1", "H2"]);
    expect(await names({ city: "Đà Nẵng", guests: 1 })).toEqual(["H3"]);
    expect(await names({ city: "Không có", guests: 1 })).toEqual([]);
  });
  it("lọc theo hạng sao tối thiểu", async () => {
    expect((await names({ minStars: 4, guests: 1 })).sort()).toEqual(["H1", "H3"]);
    expect(await names({ minStars: 5, guests: 1 })).toEqual(["H1"]);
  });
  it("lọc theo tiện nghi: phải có đủ tất cả tiện nghi đã chọn", async () => {
    expect((await names({ amenities: ["Spa"], guests: 1 })).sort()).toEqual(["H1", "H3"]);
    expect(await names({ amenities: ["Spa", "Hồ bơi"], guests: 1 })).toEqual(["H1"]);
    expect(await names({ amenities: ["Spa", "Phòng gym"], guests: 1 })).toEqual(["H3"]);
    expect(await names({ amenities: ["Không có tiện nghi này"], guests: 1 })).toEqual([]);
  });
  it("lọc theo sức chứa: chỉ khách sạn có phòng đủ chỗ", async () => {
    expect((await names({ guests: 3 })).sort()).toEqual(["H1", "H3"]);
    expect(await names({ guests: 4 })).toEqual(["H1"]);
    expect(await names({ guests: 5 })).toEqual([]);
  });
  it("kết hợp nhiều điều kiện", async () => {
    expect(await names({ city: "Hà Nội", minStars: 4, amenities: ["Hồ bơi"], guests: 4 })).toEqual(["H1"]);
  });
});

describe("searchHotels: khoảng giá theo phòng", () => {
  it("giữ khách sạn có ít nhất một phòng trong khoảng giá", async () => {
    expect((await names({ minPrice: 900_000, maxPrice: 1_200_000, guests: 1 })).sort()).toEqual(["H1"]);
    expect((await names({ maxPrice: 600_000, guests: 1 }))).toEqual(["H2"]);
    expect((await names({ minPrice: 1_800_000, guests: 1 }))).toEqual(["H1"]);
  });
  it("giá hiển thị là giá thấp nhất trong các phòng thỏa điều kiện, không phải giá thấp nhất của khách sạn", async () => {
    const r = await searchHotels({ minPrice: 1_500_000, guests: 1 });
    const h1r = r.find((h) => h.name === "H1")!;
    expect(h1r.minPrice).toBe(2_000_000); // phòng 1tr bị loại bởi bộ lọc
    expect(r.find((h) => h.name === "H3")!.minPrice).toBe(1_500_000);
  });
  it("cận giá là bao gồm cả hai đầu", async () => {
    expect(await names({ minPrice: 500_000, maxPrice: 500_000, guests: 1 })).toEqual(["H2"]);
  });
  it("khoảng giá không có phòng nào -> rỗng", async () => expect(await names({ minPrice: 5_000_000, guests: 1 })).toEqual([]));
});

describe("searchHotels: phòng trống theo ngày", () => {
  const stay = { checkIn: "2027-05-10", checkOut: "2027-05-12", guests: 2 };
  const take = (roomId: string, o: Partial<Parameters<typeof mkBooking>[0]> = {}) =>
    mkBooking({ userId: guestId, roomId, checkIn: d("2027-05-10"), checkOut: d("2027-05-12"), ...o });

  it("không chọn ngày thì không xét tồn phòng", async () => {
    await take(h3.rooms[0].id, { status: "CONFIRMED" });
    expect(await names({ city: "Đà Nẵng", guests: 2 })).toEqual(["H3"]);
  });
  it("phòng cuối cùng đã xác nhận trong ngày chồng -> khách sạn bị loại", async () => {
    await take(h3.rooms[0].id, { status: "CONFIRMED" });
    expect(await names({ city: "Đà Nẵng", ...stay })).toEqual([]);
  });
  it("ngày không chồng thì vẫn còn", async () => {
    await take(h3.rooms[0].id, { status: "CONFIRMED" });
    expect(await names({ city: "Đà Nẵng", checkIn: "2027-05-12", checkOut: "2027-05-14", guests: 2 })).toEqual(["H3"]);
  });
  it("đơn chờ thanh toán còn hạn giữ phòng thì loại, quá hạn thì không", async () => {
    const b = await take(h3.rooms[0].id, { status: "PENDING", createdAt: minutesAgo(5) });
    expect(await names({ city: "Đà Nẵng", ...stay })).toEqual([]);
    await prisma.booking.update({ where: { id: b.id }, data: { createdAt: minutesAgo(45) } });
    expect(await names({ city: "Đà Nẵng", ...stay })).toEqual(["H3"]);
  });
  it("đơn đã hủy không chiếm phòng", async () => {
    await take(h3.rooms[0].id, { status: "CANCELLED" });
    expect(await names({ city: "Đà Nẵng", ...stay })).toEqual(["H3"]);
  });
  it("còn phòng cùng loại: trừ đúng số phòng đã đặt", async () => {
    const chuan = h1.rooms.find((r) => r.name === "Chuẩn")!;
    await take(chuan.id, { status: "CONFIRMED", rooms: 1 });
    expect((await searchHotels({ city: "Hà Nội", ...stay })).map((h) => h.name)).toContain("H1"); // còn 1 phòng chuẩn
    await take(chuan.id, { status: "CONFIRMED", rooms: 1 });
    const r = await searchHotels({ city: "Hà Nội", ...stay });
    // hết phòng chuẩn nhưng còn phòng gia đình: vẫn hiện và giá là giá phòng gia đình
    expect(r.find((h) => h.name === "H1")!.minPrice).toBe(2_000_000);
  });
  it("ngày không hợp lệ thì bỏ qua điều kiện ngày", async () => {
    await take(h3.rooms[0].id, { status: "CONFIRMED" });
    expect(await names({ city: "Đà Nẵng", checkIn: "2027-05-12", checkOut: "2027-05-10", guests: 2 })).toEqual(["H3"]);
  });
});

describe("searchHotels: sắp xếp và đánh giá", () => {
  it("giá tăng dần và giảm dần theo giá thấp nhất", async () => {
    expect(await names({ sort: "price-asc", guests: 1 })).toEqual(["H2", "H1", "H3"]);
    expect(await names({ sort: "price-desc", guests: 1 })).toEqual(["H3", "H1", "H2"]);
  });
  it("mặc định: nhiều sao trước, cùng sao thì rẻ trước", async () => {
    expect(await names({ guests: 1 })).toEqual(["H1", "H3", "H2"]);
  });
  it("đánh giá cao nhất; đánh giá bị ẩn không được tính", async () => {
    await review(h1.id, 4);
    await review(h2.id, 5);
    await review(h2.id, 1, { isHidden: true }); // bị ẩn: không kéo điểm xuống
    await review(h3.id, 3);
    expect(await names({ sort: "rating", guests: 1 })).toEqual(["H2", "H1", "H3"]);
    const h2r = (await searchHotels({ guests: 1 })).find((h) => h.name === "H2")!;
    expect(h2r).toMatchObject({ avgRating: 5, reviewCount: 1 });
  });
  it("khách sạn chưa có đánh giá: avgRating null", async () => {
    expect((await searchHotels({ guests: 1 })).every((h) => h.avgRating === null && h.reviewCount === 0)).toBe(true);
  });
});

describe("getHotelDetail", () => {
  it("không thấy khách sạn đã ẩn hoặc không tồn tại", async () => {
    expect(await getHotelDetail("an")).toBeNull();
    expect(await getHotelDetail("khong-co")).toBeNull();
  });
  it("chỉ trả phòng đang bán, sắp theo giá tăng dần", async () => {
    await prisma.room.updateMany({ where: { hotelId: h1.id, name: "Gia đình" }, data: { isActive: false } });
    const d1 = await getHotelDetail("h1");
    expect(d1!.rooms.map((r) => r.name)).toEqual(["Chuẩn"]);
  });
  it("đánh giá: bỏ đánh giá ẩn, điểm trung bình tính trên đánh giá đang hiển thị", async () => {
    await review(h1.id, 5, { comment: "tốt" });
    await review(h1.id, 3, { comment: "tạm" });
    await review(h1.id, 1, { comment: "xấu", isHidden: true });
    const detail = await getHotelDetail("h1");
    expect(detail!.reviews.map((r) => r.comment).sort()).toEqual(["tạm", "tốt"]);
    expect(detail!.avgRating).toBe(4);
  });
  it("đánh giá mới nhất xếp trước và có tên tác giả, ngày dạng chuỗi", async () => {
    const old = await mkUser({ name: "Người Cũ" });
    const recent = await mkUser({ name: "Người Mới" });
    await review(h1.id, 4, { userId: old.id, createdAt: new Date("2026-01-01T00:00:00Z") });
    await review(h1.id, 5, { userId: recent.id, createdAt: new Date("2026-06-01T00:00:00Z") });
    const rs = (await getHotelDetail("h1"))!.reviews;
    expect(rs.map((r) => r.author)).toEqual(["Người Mới", "Người Cũ"]);
    expect(typeof rs[0].createdAt).toBe("string");
  });
  it("không có đánh giá: avgRating null", async () => expect((await getHotelDetail("h2"))!.avgRating).toBeNull());
});

describe("getFeaturedReviews", () => {
  it("chỉ lấy đánh giá từ 4 sao, không ẩn, một đánh giá cho mỗi khách sạn, mới nhất trước", async () => {
    await review(h1.id, 5, { comment: "h1 cũ", createdAt: new Date("2026-01-01T00:00:00Z") });
    await review(h1.id, 5, { comment: "h1 mới", createdAt: new Date("2026-05-01T00:00:00Z") });
    await review(h2.id, 3, { comment: "h2 thấp" });
    await review(h2.id, 5, { comment: "h2 ẩn", isHidden: true });
    await review(h3.id, 4, { comment: "h3", createdAt: new Date("2026-03-01T00:00:00Z") });
    const out = await getFeaturedReviews(5);
    expect(out.map((r) => r.comment)).toEqual(["h1 mới", "h3"]);
    expect(out[0].hotel).toMatchObject({ slug: "h1", name: "H1" });
  });
  it("tôn trọng giới hạn số lượng", async () => {
    for (const h of [h1, h2, h3]) await review(h.id, 5);
    expect(await getFeaturedReviews(2)).toHaveLength(2);
  });
  it("bỏ đánh giá của khách sạn đã ẩn", async () => {
    const hidden = await prisma.hotel.findUniqueOrThrow({ where: { slug: "an" } });
    await review(hidden.id, 5, { comment: "của khách sạn ẩn" });
    expect((await getFeaturedReviews(5)).map((r) => r.comment)).not.toContain("của khách sạn ẩn");
  });
});

describe("getFilterOptions", () => {
  it("tiện nghi sắp theo số khách sạn có, rồi theo tên; giá thấp/cao nhất của phòng đang bán", async () => {
    const o = await getFilterOptions();
    expect(o.amenities).toEqual(["Hồ bơi", "Spa", "Phòng gym"]); // Hồ bơi 2, Spa 2 (Hồ trước theo tên), Phòng gym 1
    expect(o.minPrice).toBe(500_000);
    expect(o.maxPrice).toBe(2_000_000);
  });
  it("bỏ qua phòng ẩn và khách sạn ẩn khi tính giá (khách sạn 'Đã ẩn' có phòng 100k)", async () => {
    expect((await getFilterOptions()).minPrice).toBe(500_000);
  });
  it("không có dữ liệu: số 0 và danh sách rỗng", async () => {
    await resetDb();
    expect(await getFilterOptions()).toEqual({ amenities: [], minPrice: 0, maxPrice: 0 });
  });
});

describe("getHotelsByIds, getCities, getSitemapData", () => {
  it("getHotelsByIds giữ đúng thứ tự, bỏ qua mã lạ và khách sạn ẩn", async () => {
    const hidden = await prisma.hotel.findUniqueOrThrow({ where: { slug: "an" } });
    const out = await getHotelsByIds([h3.id, "khong-co", hidden.id, h1.id]);
    expect(out.map((h) => h.name)).toEqual(["H3", "H1"]);
    expect(await getHotelsByIds([])).toEqual([]);
  });
  it("getCities đếm khách sạn đang hoạt động, nhiều nhất trước", async () => {
    const c = await getCities();
    expect(c.map((x) => [x.city, x.count])).toEqual([["Hà Nội", 3], ["Đà Nẵng", 1]]); // gồm cả khách sạn không có phòng, loại khách sạn ẩn
  });
  it("getSitemapData chỉ gồm khách sạn đang hoạt động có phòng đang bán; thành phố không trùng, đã sắp", async () => {
    const s = await getSitemapData();
    expect(s.hotels.map((h) => h.slug).sort()).toEqual(["h1", "h2", "h3"]);
    expect(s.cities).toEqual(["Hà Nội", "Đà Nẵng"].sort());
  });
});
