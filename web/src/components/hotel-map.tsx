import { MapPin } from "lucide-react";
import { LazyMap } from "@/components/map/lazy-map";
import { mapboxToken } from "@/lib/map";

/** Có token Mapbox thì dùng bản đồ tương tác (ghim, vệ tinh, phóng to); chưa có thì dùng bản đồ OpenStreetMap nhúng bằng iframe (không cần khóa). */
export function HotelMap({ lat, lng, name, address }: { lat: number; lng: number; name: string; address: string }) {
  const token = mapboxToken();
  const dLat = 0.004;
  const dLng = 0.006;
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(6)).join("%2C");
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
  const full = `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=16/${lat.toFixed(6)}/${lng.toFixed(6)}`;

  return (
    <div>
      <p className="mb-3 flex items-start gap-2 text-sm text-muted">
        <MapPin size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden /> {address}
      </p>
      {token ? (
        <LazyMap token={token} mode="single" points={[{ id: "hotel", slug: "", name, city: address, lat, lng }]} className="h-72 md:h-96" />
      ) : (
      <div className="relative h-64 overflow-hidden rounded-2xl border border-border bg-background md:h-80">
        {/* Lớp dự phòng nằm dưới: chỉ lộ ra khi bản đồ chưa tải được (mất mạng, bị chặn tên miền...) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted">
          <MapPin size={28} className="text-brand/60" aria-hidden />
          <span>Đang tải bản đồ... Nếu không hiển thị, hãy bấm &quot;Xem bản đồ lớn&quot; bên dưới.</span>
        </div>
        <iframe
          title={`Bản đồ vị trí ${name}`}
          src={embed}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full"
        />
      </div>
      )}
      <a href={full} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">
        Xem bản đồ lớn →
      </a>
    </div>
  );
}
