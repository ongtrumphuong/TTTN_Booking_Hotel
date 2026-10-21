import { ALLOWED_IMAGE_HOSTS } from "@/lib/image-hosts";

/** Ảnh mẫu đóng gói sẵn trong thư mục public/panoramas (ảnh CC0 từ Poly Haven). */
const LOCAL_SAMPLE = /^\/panoramas\/[a-z0-9_-]{1,60}\.jpg$/;
const UPLOADED = /^\/api\/uploads\/[a-f0-9]{32}\.webp$/;

/** Ảnh 360° hợp lệ: ảnh mẫu đóng gói sẵn, ảnh đã tải lên qua hệ thống, hoặc URL https từ máy chủ ảnh được phép. */
export function isAllowedPanorama(u: string): boolean {
  if (LOCAL_SAMPLE.test(u) || UPLOADED.test(u)) return true;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

/** Ảnh toàn cảnh phép chiếu equirectangular có chiều rộng gấp đôi chiều cao (cho phép lệch 5%). */
export const isEquirectangular = (width: number, height: number) => height > 0 && Math.abs(width / height - 2) <= 0.1;
