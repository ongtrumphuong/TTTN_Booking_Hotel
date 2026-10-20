// Điểm nổi bật (vị trí, cảnh quan) cho dữ liệu mẫu. Khách và trợ lý ảo dùng các cụm này để tìm đúng nơi, ví dụ "view Hồ Xuân Hương".

export const HOTEL_HIGHLIGHTS: Record<string, string[]> = {
  "khong-gian-so-hanoi-old-quarter": ["Phố cổ Hà Nội", "Gần Hồ Gươm", "Gần chợ đêm"],
  "tay-ho-lake-view": ["View Hồ Tây", "Gần Hồ Tây", "Nhà hàng trên cao"],
  "my-khe-beach-resort": ["Sát biển Mỹ Khê", "Hồ bơi vô cực", "Gần bán đảo Sơn Trà"],
  "han-river-central": ["Bên sông Hàn", "Gần cầu Rồng", "Trung tâm Đà Nẵng"],
  "saigon-skyline": ["Phố đi bộ Nguyễn Huệ", "Quận 1", "Quầy bar sân thượng"],
  "district-3-garden-inn": ["Khu yên tĩnh nhiều cây xanh", "Quận 3", "Gần trung tâm"],
  "dalat-pine-hill": ["Gần Hồ Xuân Hương", "Trung tâm Đà Lạt", "Đồi thông", "Lò sưởi trong phòng"],
  "nha-trang-ocean-pearl": ["Mặt tiền đường Trần Phú", "View vịnh Nha Trang", "Hồ bơi tầng thượng"],
  "phu-quoc-sunset-bay": ["Bãi biển riêng", "Ngắm hoàng hôn", "Biệt thự hồ bơi"],
};

/** slug khách sạn -> tên loại phòng -> điểm nổi bật của phòng. */
export const ROOM_HIGHLIGHTS: Record<string, Record<string, string[]>> = {
  "khong-gian-so-hanoi-old-quarter": { "Phòng Deluxe": ["View phố cổ", "Ban công"] },
  "tay-ho-lake-view": { "Phòng Deluxe": ["View Hồ Tây", "Ban công"], "Phòng Gia đình": ["View Hồ Tây"] },
  "my-khe-beach-resort": { "Phòng Deluxe": ["View biển", "Ban công"], "Phòng Gia đình": ["View biển"] },
  "han-river-central": { "Phòng Deluxe": ["View sông Hàn", "Ban công"] },
  "saigon-skyline": { "Phòng Deluxe": ["View thành phố", "Tầng cao"] },
  "dalat-pine-hill": {
    "Phòng Tiêu chuẩn": ["View hồ Xuân Hương"],
    "Phòng Deluxe": ["View hồ Xuân Hương", "Ban công", "Lò sưởi"],
    "Phòng Gia đình": ["Ban công ngắm đồi thông", "Phòng khách riêng"],
  },
  "nha-trang-ocean-pearl": { "Phòng Deluxe": ["View vịnh Nha Trang", "Ban công"], "Phòng Gia đình": ["View biển"] },
  "phu-quoc-sunset-bay": { "Phòng Deluxe": ["View biển", "Ban công"], "Phòng Gia đình": ["View biển", "Gần hồ bơi"] },
};
