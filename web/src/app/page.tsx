import { Suspense } from "react";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, Quote, ShieldCheck, Sparkles, Star, Wallet } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { HotelCard } from "@/components/hotel-card";
import { getCities, getFeaturedHotels, getFeaturedReviews, getSiteStats } from "@/lib/hotels";

// Ảnh trang trí của trang chủ (Unsplash). Ảnh khách sạn thật lấy từ cơ sở dữ liệu.
const unsplash = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const HERO = {
  main: unsplash("1698809807960-758cf416e96e", 900),
  second: unsplash("1788927794265-948172782833", 700),
  cta: unsplash("1693282814784-649be45a459b", 1800),
  story: unsplash("1743525922686-badbeac16a34", 1400),
};

async function HeroSearch() {
  await connection(); // đọc cơ sở dữ liệu lúc có yêu cầu, không phải lúc build (build không cần cơ sở dữ liệu)
  const cities = await getCities();
  return <SearchForm cities={cities.map((c) => c.city)} />;
}

/** Điểm đánh giá trung bình thật từ các đánh giá đang hiển thị; không có đánh giá thì không hiện. */
async function HeroBadge() {
  await connection();
  const s = await getSiteStats();
  if (!s.avgRating) return null;
  return (
    <div className="animate-fade-up delay-3 absolute bottom-6 right-[26%] flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-foreground shadow-xl">
      <span className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Star size={20} className="fill-accent" />
      </span>
      <span className="text-sm leading-tight">
        <b className="block text-base">{s.avgRating.toFixed(1)} / 5</b>
        <span className="text-muted">từ {s.reviews} đánh giá</span>
      </span>
    </div>
  );
}

async function Destinations() {
  await connection();
  const cities = await getCities();
  return (
    <div className="grid auto-rows-[170px] grid-cols-2 gap-3 md:auto-rows-[190px] md:grid-cols-4 md:gap-4">
      {cities.map((c, i) => (
        <Link
          key={c.city}
          href={`/hotels?city=${encodeURIComponent(c.city)}`}
          className={`group relative overflow-hidden rounded-3xl bg-border ${i === 0 ? "col-span-2 row-span-2" : ""}`}
        >
          <Image
            src={c.image}
            alt={`Khách sạn tại ${c.city}`}
            fill
            sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
            className="object-cover transition duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white md:p-5">
            <div>
              <p className={`font-display font-semibold leading-tight ${i === 0 ? "text-3xl md:text-4xl" : "text-xl"}`}>{c.city}</p>
              <p className="mt-0.5 text-xs text-white/80">{c.count} khách sạn</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-white/20 backdrop-blur transition group-hover:bg-white group-hover:text-brand">
              <ArrowRight size={16} aria-hidden />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function Featured() {
  await connection();
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
        <div key={i} className="h-80 animate-pulse rounded-3xl bg-border" />
      ))}
    </div>
  );
}

async function StoryStats() {
  await connection();
  const s = await getSiteStats();
  const items = [
    { value: String(s.hotels), label: "khách sạn & resort" },
    { value: String(s.rooms), label: "loại phòng" },
    { value: s.avgRating ? s.avgRating.toFixed(1) : "—", label: `điểm đánh giá (${s.reviews} lượt)` },
  ];
  return (
    <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
      {items.map((it) => (
        <div key={it.label}>
          <dd className="font-display text-3xl font-semibold md:text-4xl">{it.value}</dd>
          <dt className="mt-1 text-xs text-white/70">{it.label}</dt>
        </div>
      ))}
    </dl>
  );
}

async function Testimonials() {
  await connection();
  const reviews = await getFeaturedReviews(3);
  if (reviews.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-20">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Lời khách nói</p>
      <h2 className="font-display mt-2 text-3xl font-semibold md:text-4xl">Những chuyến đi đáng nhớ</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {reviews.map((r, i) => (
          <figure
            key={r.id}
            className={`flex flex-col rounded-3xl p-7 ${i === 1 ? "bg-ink text-white md:-translate-y-4" : "border border-border bg-white"}`}
          >
            <Quote size={28} className={i === 1 ? "text-accent" : "text-brand/40"} aria-hidden />
            <p className="mt-4 flex gap-0.5" aria-label={`${r.rating} trên 5 sao`}>
              {Array.from({ length: 5 }, (_, k) => (
                <Star key={k} size={14} className={k < r.rating ? "fill-accent text-accent" : i === 1 ? "text-white/25" : "text-border"} aria-hidden />
              ))}
            </p>
            <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed">{r.comment}</blockquote>
            <figcaption className={`mt-5 border-t pt-4 text-sm ${i === 1 ? "border-white/15" : "border-border"}`}>
              <span className="font-semibold">{r.author}</span>
              <span className={i === 1 ? "text-white/50" : "text-muted"}> · </span>
              <Link href={`/hotels/${r.hotel.slug}`} className={`hover:underline ${i === 1 ? "text-accent" : "text-brand"}`}>{r.hotel.name}</Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const trust = [
  { icon: CalendarCheck, title: "Hủy phòng linh hoạt", text: "Chính sách hủy rõ ràng cho từng khách sạn." },
  { icon: ShieldCheck, title: "Thanh toán an toàn", text: "Qua cổng VNPay, không lưu thông tin thẻ." },
  { icon: BadgeCheck, title: "Xác nhận tức thì", text: "Nhận mã đặt phòng ngay sau khi thanh toán." },
  { icon: Wallet, title: "Giá minh bạch", text: "Không phí ẩn, thêm mã giảm giá khi có ưu đãi." },
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-ink pb-28 pt-12 text-white md:pb-32 md:pt-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(14,116,144,0.55),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(242,107,79,0.18),transparent_55%)]" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide backdrop-blur">
              <Sparkles size={14} className="text-accent" aria-hidden /> Khách sạn &amp; resort khắp Việt Nam
            </p>
            <h1 className="animate-fade-up delay-1 font-display text-balance mt-5 text-4xl font-semibold leading-[1.1] md:text-6xl">
              Chọn nơi nghỉ,<br />
              <em className="text-accent">trọn kỳ nghỉ</em> của bạn
            </h1>
            <p className="animate-fade-up delay-2 mt-5 max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
              Từ phố cổ Hà Nội đến biển Phú Quốc: so sánh giá, xem phòng trống theo ngày và đặt phòng chỉ trong vài phút.
            </p>
            <div className="animate-fade-up delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/hotels" className="inline-flex items-center gap-2 rounded-full bg-sun px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sun/30 transition hover:brightness-110">
                Khám phá khách sạn <ArrowRight size={16} aria-hidden />
              </Link>
              <Link href="/#diem-den" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold transition hover:bg-white/10">
                Xem điểm đến
              </Link>
            </div>
          </div>

          {/* Bộ ảnh hình vòm */}
          <div className="relative mx-auto hidden h-[440px] w-full max-w-md lg:block" aria-hidden>
            <div className="animate-fade-up delay-1 absolute right-0 top-0 h-[400px] w-[62%] overflow-hidden rounded-t-full border-4 border-white/15">
              <Image src={HERO.main} alt="" fill priority sizes="260px" className="animate-slow-zoom object-cover" />
            </div>
            <div className="animate-fade-up delay-2 absolute bottom-0 left-0 h-[210px] w-[46%] overflow-hidden rounded-3xl border-4 border-ink shadow-2xl">
              <Image src={HERO.second} alt="" fill sizes="200px" className="object-cover" />
            </div>
            <Suspense fallback={null}>
              <HeroBadge />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Ô TÌM KIẾM nổi lên chồng lên hero */}
      <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 md:-mt-20">
        <Suspense fallback={<div className="h-20 animate-pulse rounded-3xl bg-white shadow-xl" />}>
          <HeroSearch />
        </Suspense>
      </div>

      {/* LỢI ÍCH */}
      <section className="mx-auto max-w-6xl px-4 pt-12">
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Icon size={22} aria-hidden />
              </span>
              <span>
                <b className="block text-[15px]">{title}</b>
                <span className="text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ĐIỂM ĐẾN */}
      <section id="diem-den" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Điểm đến</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Bạn muốn đi đâu?</h2>
          <p className="max-w-sm text-sm text-muted">Các thành phố đang có khách sạn trên hệ thống, cập nhật theo thời gian thực.</p>
        </div>
        <div className="mt-8">
          <Suspense fallback={<div className="h-[380px] animate-pulse rounded-3xl bg-border" />}>
            <Destinations />
          </Suspense>
        </div>
      </section>

      {/* NỔI BẬT */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Được chọn nhiều nhất</p>
        <div className="mt-2 mb-8 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Khách sạn nổi bật</h2>
          <Link href="/hotels" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            Xem tất cả <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <Suspense fallback={<GridSkeleton n={6} />}>
          <Featured />
        </Suspense>
      </section>

      {/* CÂU CHUYỆN + SỐ LIỆU */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="grid overflow-hidden rounded-[2rem] bg-ink text-white lg:grid-cols-2">
          <div className="relative min-h-72 lg:min-h-[420px]">
            <Image src={HERO.story} alt="Hồ bơi nhìn ra khu nghỉ dưỡng nhiệt đới" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
          </div>
          <div className="p-8 md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Vì sao chọn chúng tôi</p>
            <h2 className="font-display mt-3 text-3xl font-semibold leading-tight md:text-4xl">Đặt phòng rõ ràng, không bất ngờ</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              Mỗi khách sạn hiển thị phòng còn trống đúng theo ngày bạn chọn, chính sách hủy ghi rõ từ đầu và tổng tiền được tính một lần,
              không phát sinh khi thanh toán.
            </p>
            <Suspense fallback={<div className="mt-8 h-24 animate-pulse rounded-2xl bg-white/10" />}>
              <StoryStats />
            </Suspense>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Testimonials />
      </Suspense>

      {/* KÊU GỌI HÀNH ĐỘNG */}
      <section className="mx-auto max-w-6xl px-4 pt-24">
        <div className="relative isolate overflow-hidden rounded-[2rem] px-6 py-16 text-center text-white md:py-20">
          <Image src={HERO.cta} alt="" fill sizes="1152px" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/55 to-ink/40" />
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold leading-tight md:text-5xl">Chuyến đi tiếp theo bắt đầu từ một cái chạm</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">Chọn điểm đến, chọn ngày, chốt phòng. Hủy miễn phí theo chính sách của từng khách sạn.</p>
          <Link href="/hotels" className="mt-8 inline-flex items-center gap-2 rounded-full bg-sun px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-black/20 transition hover:brightness-110">
            Tìm phòng ngay <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
