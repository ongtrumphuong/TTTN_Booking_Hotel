import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { formatVND } from "@/lib/format";
import type { HotelSummary } from "@/lib/hotels";
import { FavoriteButton } from "./favorite-button";

export function HotelCard({ hotel, href }: { hotel: HotelSummary; href?: string }) {
  return (
    // Nút tim nằm ngoài <Link> (không lồng phần tử tương tác), đặt đè lên ảnh bằng định vị tuyệt đối.
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
      <FavoriteButton hotelId={hotel.id} />
      <Link href={href ?? `/hotels/${hotel.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-border">
          <Image
            src={hotel.image}
            alt={hotel.name}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold">
            <Star size={12} className="fill-accent text-accent" aria-hidden /> {hotel.starRating} sao
          </span>
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-1 text-base font-bold">{hotel.name}</h3>
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin size={14} aria-hidden /> {hotel.city}
          </p>
          <div className="flex items-end justify-between pt-1">
            {hotel.avgRating ? (
              <span className="rounded-lg bg-brand px-2 py-1 text-xs font-bold text-white">
                {hotel.avgRating.toFixed(1)} <span className="font-medium text-white/80">· {hotel.reviewCount} đánh giá</span>
              </span>
            ) : (
              <span className="text-xs text-muted">Chưa có đánh giá</span>
            )}
            <p className="text-right">
              <span className="block text-[11px] text-muted">Từ</span>
              <span className="text-lg font-extrabold text-brand">{formatVND(hotel.minPrice)}</span>
              <span className="text-xs text-muted"> /đêm</span>
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
