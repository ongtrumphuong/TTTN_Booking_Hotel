export type MapPoint = {
  id: string;
  slug: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  /** Giá thấp nhất mỗi đêm (đồng); chỉ dùng cho bản đồ kết quả tìm kiếm. */
  price?: number;
  image?: string;
  rating?: number | null;
  stars?: number;
};

/**
 * Token công khai của Mapbox (dạng pk.…). Được phép lộ ở trình duyệt nên khác với khóa bí mật (sk.…), thứ tuyệt đối không được đưa vào
 * mã giao diện: nếu ai đó lỡ điền khóa bí mật thì bỏ qua và dùng bản đồ dự phòng thay vì để lộ nó ra trình duyệt.
 */
export function mapboxToken(env: Record<string, string | undefined> = process.env): string | null {
  const t = (env.NEXT_PUBLIC_MAPBOX_TOKEN ?? env.MAPBOX_TOKEN)?.trim();
  return t && t.startsWith("pk.") ? t : null;
}

/** Giá gọn để ghi trên ghim: 1.350.000 -> "1,35tr", 950.000 -> "950k", 2.000.000 -> "2tr". */
export function compactPrice(vnd: number): string {
  if (vnd >= 1_000_000) {
    const m = Math.round((vnd / 1_000_000) * 100) / 100;
    return `${String(m).replace(".", ",")}tr`;
  }
  return `${Math.round(vnd / 1000)}k`;
}

/** Khung bao các điểm có tọa độ hợp lệ: [[tây, nam], [đông, bắc]]; null nếu không có điểm nào. */
export function boundsOf(points: Pick<MapPoint, "lat" | "lng">[]): [[number, number], [number, number]] | null {
  const ok = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  if (ok.length === 0) return null;
  return [
    [Math.min(...ok.map((p) => p.lng)), Math.min(...ok.map((p) => p.lat))],
    [Math.max(...ok.map((p) => p.lng)), Math.max(...ok.map((p) => p.lat))],
  ];
}
