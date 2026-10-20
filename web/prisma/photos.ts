// Ảnh thật (Unsplash, dùng miễn phí theo giấy phép Unsplash) cho dữ liệu mẫu: mỗi khách sạn một bộ ảnh đúng địa điểm,
// mỗi loại phòng một bộ ảnh phòng ngủ. Chỉ lưu mã ảnh; URL được dựng bằng `photo()` (host images.unsplash.com đã được cho phép
// trong src/lib/image-hosts.ts).

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

const P = {
  // Hà Nội
  hnBridge: "1611195328596-d8dcf57f5cea",
  hnLake: "1790570614016-bd209213f377",
  hnStreet: "1613131145282-9476375618e1",
  hnFlags: "1616424649579-4d280a3680e2",
  hnDusk: "1790570614352-063cbb37df9a",
  // Đà Nẵng
  dnDragon: "1788927794265-948172782833",
  dnRiver: "1781963577464-aae78aa7be67",
  dnBeach: "1674296067534-0f9769040781",
  dnShore: "1689825199899-c57cc46c2a9a",
  // TP. Hồ Chí Minh
  sgSky: "1521019795854-14e15f600980",
  sgRiver: "1592114631383-89cafc376ba5",
  sgBank: "1592982349625-b89ecccd6a12",
  sgNight: "1705253920175-8df4e2408113",
  // Đà Lạt
  dlHills: "1777383505231-db1218b2d020",
  dlMist: "1774081639594-0c4ab58afabb",
  dlPine: "1775485483383-ae46e65715d9",
  // Nha Trang
  ntBeach: "1533002832-1721d16b4bb9",
  ntCity: "1570366290364-5e76a15ae408",
  // Phú Quốc
  pqSunset: "1698809807960-758cf416e96e",
  pqWhite: "1732243395944-cb3ff9311091",
  pqPalms: "1693282814784-649be45a459b",
  // Tiện ích
  pool1: "1743525922686-badbeac16a34",
  pool2: "1711114378532-bab7d55311f3",
  pool3: "1645447556616-e9d1c52e8037",
  poolSea: "1629129924298-42d89875f115",
  lobby1: "1742844552193-2fd3425cd26d",
  lobby2: "1759038085950-1234ca8f5fed",
  lobby3: "1758448500688-3ababa93fd67",
  balcony: "1772902362618-c45e3e804001",
  // Phòng
  room1: "1631049552057-403cdb8f0658",
  room2: "1512918728675-ed5a9ecdebfd",
  room3: "1731336478850-6bce7235e320",
  room4: "1685592437742-3b56edb46b15",
  roomTwin: "1771775529138-a7a20ba7e032",
  roomTwinSea: "1779870458288-95fd59cd2c5b",
  roomSuite: "1776763018972-588e27bf6511",
  roomSea: "1718942899965-4fc10607d805",
  roomDark: "1766928210443-0be92ed5884a",
  roomCream: "1784653549349-97e2116919b1",
  roomRed: "1777170191230-3f357b815483",
} as const;

/** Ảnh khách sạn theo slug; ảnh đầu tiên là ảnh đại diện (thẻ khách sạn, ảnh điểm đến). */
export const HOTEL_PHOTOS: Record<string, string[]> = {
  "khong-gian-so-hanoi-old-quarter": [P.hnBridge, P.lobby3, P.hnStreet, P.hnFlags],
  "tay-ho-lake-view": [P.hnLake, P.hnDusk, P.lobby1, P.lobby2],
  "my-khe-beach-resort": [P.dnBeach, P.dnShore, P.poolSea, P.balcony],
  "han-river-central": [P.dnDragon, P.dnRiver, P.lobby2, P.lobby3],
  "saigon-skyline": [P.sgSky, P.sgNight, P.sgRiver, P.lobby1],
  "district-3-garden-inn": [P.sgBank, P.pool3, P.lobby3, P.sgRiver],
  "dalat-pine-hill": [P.dlHills, P.dlMist, P.dlPine, P.lobby3],
  "nha-trang-ocean-pearl": [P.ntBeach, P.ntCity, P.pool1, P.balcony],
  "phu-quoc-sunset-bay": [P.pqSunset, P.pqWhite, P.pool2, P.pqPalms, P.pool1],
};

const ROOM_SETS: Record<string, string[][]> = {
  "Phòng Tiêu chuẩn": [
    [P.room1, P.room2, P.room4],
    [P.room2, P.room3, P.room1],
    [P.room4, P.room1, P.room3],
  ],
  "Phòng Deluxe": [
    [P.roomSuite, P.roomCream, P.roomSea],
    [P.roomCream, P.roomDark, P.roomSuite],
    [P.roomSea, P.roomRed, P.roomCream],
  ],
  "Phòng Gia đình": [
    [P.roomTwin, P.roomTwinSea, P.room3],
    [P.roomTwinSea, P.roomTwin, P.room4],
    [P.roomTwin, P.room2, P.roomTwinSea],
  ],
};

const FALLBACK_HOTEL = [P.lobby1, P.lobby2, P.lobby3, P.pool1];

export function hotelImages(slug: string): string[] {
  return (HOTEL_PHOTOS[slug] ?? FALLBACK_HOTEL).map(photo);
}

/** `variant` (số thứ tự khách sạn) xoay vòng bộ ảnh để các khách sạn không dùng chung đúng một dãy ảnh phòng. */
export function roomImages(roomName: string, variant: number): string[] {
  const sets = ROOM_SETS[roomName] ?? ROOM_SETS["Phòng Tiêu chuẩn"];
  return sets[variant % sets.length].map(photo);
}
