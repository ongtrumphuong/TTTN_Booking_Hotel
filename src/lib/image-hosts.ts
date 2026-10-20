// Chỉ cho phép ảnh từ các máy chủ này: trùng với images.remotePatterns trong next.config.ts
// để admin không thể nhập URL làm trình tối ưu ảnh trở thành proxy mở.
export const ALLOWED_IMAGE_HOSTS = ["picsum.photos", "images.unsplash.com"] as const;
