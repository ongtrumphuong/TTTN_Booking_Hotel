// Ảnh 360° mẫu (phép chiếu equirectangular, giấy phép CC0) từ Poly Haven, đặt sẵn ở public/panoramas.
// Chỉ để minh họa cho đồ án: đây là ảnh nội thất thật nhưng không phải phòng của khách sạn trong dữ liệu mẫu.
// Nguồn: https://polyhaven.com/a/cabin, /a/cayley_interior, /a/anniversary_lounge (tác giả Greg Zaal, Dimitrios Savva...).
export const PANORAMAS = {
  bedroom: "/panoramas/cabin.jpg", // phòng ngủ hai giường đơn
  suite: "/panoramas/cayley_interior.jpg", // phòng khách có ban công nhìn hồ
  lounge: "/panoramas/anniversary_lounge.jpg", // phòng khách rộng
} as const;

/** Chọn ảnh theo tên loại phòng: phòng gia đình/suite/villa dùng ảnh rộng hơn, phòng còn lại dùng phòng ngủ. */
export function panoramaFor(roomName: string): string {
  const n = roomName.toLowerCase();
  if (/(gia đình|family|suite|villa|biệt thự|căn hộ)/.test(n)) return PANORAMAS.lounge;
  if (/(deluxe|view|premier|executive|ban công|balcony)/.test(n)) return PANORAMAS.suite;
  return PANORAMAS.bedroom;
}
