import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { formatVND } from "@/lib/format";
import type { HotelSummary } from "@/lib/hotels";
import { FavoriteButton } from "./favorite-button";

export function HotelCard({ hotel, href }: { hotel: HotelSummary; href?: string }) {
  return (
    // Nút tim nằm ngoài <Link> (không lồng phần tử tương tác), đặt đè lên ảnh bằng định vị tuyệt đối.
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-white transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-ink/10">
      <FavoriteButton hotelId={hotel.id} />
      <Link href={href ?? `/hotels/${hotel.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-border">
          <Image
            src={hotel.image}
            alt={hotel.name}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/70 to-transparent" />
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold">
            <Star size={12} className="fill-accent text-accent" aria-hidden /> {hotel.starRating} sao
          </span>
          <p className="absolute bottom-3 left-4 right-4 text-white">
            <span className="block text-[11px] font-medium text-white/80">Giá từ</span>
            <span className="text-xl font-extrabold">{formatVND(hotel.minPrice)}</span>
            <span className="text-xs text-white/80"> /đêm</span>
          </p>
        </div>
        <div className="space-y-2.5 p-5">
          <h3 className="font-display line-clamp-1 text-xl font-semibold">{hotel.name}</h3>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin size={14} aria-hidden /> {hotel.city}
            </p>
            {hotel.avgRating ? (
              <span className="flex items-center gap-1.5 text-sm">
                <span className="rounded-lg bg-brand px-2 py-0.5 text-xs font-bold text-white">{hotel.avgRating.toFixed(1)}</span>
                <span className="text-xs text-muted">{hotel.reviewCount} đánh giá</span>
              </span>
            ) : (
              <span className="text-xs text-muted">Chưa có đánh giá</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
