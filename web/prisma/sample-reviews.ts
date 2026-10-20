// Dữ liệu đánh giá mẫu dùng chung cho seed.ts và seed-reviews.ts.
// Các tài khoản người đánh giá chỉ để hiển thị: mật khẩu ngẫu nhiên, không ai đăng nhập được.

export const REVIEWERS = [
  { email: "linh.tran@example.com", name: "Trần Thùy Linh" },
  { email: "minh.nguyen@example.com", name: "Nguyễn Quang Minh" },
  { email: "huong.le@example.com", name: "Lê Thu Hương" },
  { email: "khoa.pham@example.com", name: "Phạm Đăng Khoa" },
  { email: "an.vo@example.com", name: "Võ Hoài An" },
];

export const COMMENTS = [
  { rating: 5, text: "Phòng rộng, sạch và rất yên tĩnh. Nhân viên lễ tân hỗ trợ nhiệt tình, nhận phòng nhanh. Gia đình mình rất hài lòng." },
  { rating: 5, text: "Vị trí tuyệt vời, đi bộ vài phút là tới khu ăn uống. Bữa sáng đa dạng, hồ bơi sạch sẽ. Chắc chắn sẽ quay lại." },
  { rating: 4, text: "Khách sạn đẹp, đúng như hình. Phòng hơi nhỏ so với mong đợi nhưng tiện nghi đầy đủ và giá hợp lý." },
  { rating: 5, text: "Dịch vụ chu đáo, nhân viên nhớ tên khách và gợi ý nhiều quán ngon quanh đây. Giường rất êm." },
  { rating: 4, text: "Mình đi công tác, wifi mạnh, bàn làm việc tiện. Chỉ tiếc giờ cao điểm thang máy hơi chờ lâu." },
  { rating: 5, text: "Kỳ nghỉ cuối tuần tuyệt vời. View đẹp, không gian thư giãn, trẻ nhỏ rất thích hồ bơi." },
  { rating: 4, text: "Sạch sẽ, thoải mái, đưa đón sân bay đúng giờ. Bữa sáng ổn, sẽ giới thiệu cho bạn bè." },
  { rating: 5, text: "Mọi thứ đều vượt mong đợi từ phòng ốc đến dịch vụ. Đáng đồng tiền, lần sau sẽ đặt hạng phòng cao hơn." },
];

/** Mỗi khách sạn nhận 3 đánh giá từ 3 người khác nhau, nội dung luân phiên theo vị trí khách sạn. */
export function reviewsForHotel(hotelIndex: number) {
  return [0, 1, 2].map((k) => ({
    reviewerIndex: (hotelIndex + k) % REVIEWERS.length,
    ...COMMENTS[(hotelIndex * 3 + k) % COMMENTS.length],
  }));
}

/** Lời nhận xét lặp lại của bản seed cũ, dùng để nhận diện và thay thế. */
export const LEGACY_SEED_COMMENT = "Nhân viên thân thiện, phòng sạch sẽ, vị trí thuận tiện. Sẽ quay lại.";
