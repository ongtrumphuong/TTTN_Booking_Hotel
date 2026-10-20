import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgePercent, Headset, Quote, ShieldCheck, Star } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { HotelCard } from "@/components/hotel-card";
import { getCities, getFeaturedHotels, getFeaturedReviews } from "@/lib/hotels";

async function HeroSearch() {
  const cities = await getCities();
  return <SearchForm cities={cities.map((c) => c.city)} />;
}

async function Destinations() {
  const cities = await getCities();
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cities.map((c) => (
        <Link
          key={c.city}
          href={`/hotels?city=${encodeURIComponent(c.city)}`}
          className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-border"
        >
          <Image src={c.image} alt={c.city} fill sizes="200px" className="object-cover transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
          <div className="absolute bottom-3 left-3 text-white">
            <p className="font-bold">{c.city}</p>
            <p className="text-xs text-white/80">{c.count} khách sạn</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function Featured() {
  const hotels = await getFeaturedHotels(6);
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {hotels.map((h) => (
        <HotelCard key={h.id} hotel={h} />
      ))}
    </div>
  );
}

function GridSkeleton({ n }: { n: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl bg-border" />
      ))}
    </div>
  );
}

async function Testimonials() {
  const reviews = await getFeaturedReviews(3);
  if (reviews.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14">
      <h2 className="text-2xl font-extrabold">Khách hàng nói gì</h2>
      <p className="mb-6 mt-1 text-sm text-muted">Đánh giá thật từ những khách đã lưu trú</p>
      <div className="grid gap-4 md:grid-cols-3">
        {reviews.map((r) => (
          <figure key={r.id} className="flex flex-col rounded-2xl border border-border bg-white p-6">
            <Quote size={22} className="text-brand/40" aria-hidden />
            <p className="mt-3 flex gap-0.5" aria-label={`${r.rating} trên 5 sao`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={14} className={i < r.rating ? "fill-accent text-accent" : "text-border"} aria-hidden />
              ))}
            </p>
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed">{r.comment}</blockquote>
            <figcaption className="mt-4 border-t border-border pt-3 text-sm">
              <span className="font-semibold">{r.author}</span>
              <span className="text-muted"> · </span>
              <Link href={`/hotels/${r.hotel.slug}`} className="text-brand hover:underline">{r.hotel.name}</Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const perks = [
  { icon: BadgePercent, title: "Giá tốt mỗi ngày", text: "Giá minh bạch, không phí ẩn, nhiều ưu đãi theo mùa." },
  { icon: ShieldCheck, title: "Đặt phòng an toàn", text: "Xác nhận nhanh, thông tin được bảo mật tuyệt đối." },
  { icon: Headset, title: "Hỗ trợ 24/7", text: "Đội ngũ Không Gian Số luôn sẵn sàng giúp bạn mọi lúc." },
];

export default function Home() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#0a3fa8] via-brand to-[#3d8bff] pb-24 pt-16 text-white">
        <div className="absolute -right-24 -top-24 -z-10 size-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 left-10 -z-10 size-96 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            Không Gian Số Stay
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Tìm nơi nghỉ lý tưởng cho chuyến đi tiếp theo của bạn
          </h1>
          <p className="mt-4 max-w-xl text-white/80">
            Hàng trăm khách sạn, resort trên khắp Việt Nam với giá tốt và xác nhận đặt phòng ngay lập tức.
          </p>
          <div className="mt-10">
            <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-white/20" />}>
              <HeroSearch />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <h2 className="text-2xl font-extrabold">Điểm đến phổ biến</h2>
        <p className="mb-6 mt-1 text-sm text-muted">Khám phá những thành phố được yêu thích nhất</p>
        <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-border" />}>
          <Destinations />
        </Suspense>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Khách sạn nổi bật</h2>
            <p className="mt-1 text-sm text-muted">Được đánh giá cao và đặt nhiều nhất</p>
          </div>
          <Link href="/hotels" className="text-sm font-semibold text-brand hover:underline">Xem tất cả →</Link>
        </div>
        <Suspense fallback={<GridSkeleton n={6} />}>
          <Featured />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <Testimonials />
      </Suspense>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="grid gap-4 md:grid-cols-3">
          {perks.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-white p-6">
              <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon size={22} aria-hidden />
              </span>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
