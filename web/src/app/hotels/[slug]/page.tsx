import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { BedDouble, Check, MapPin, Maximize2, Star, Users } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { Gallery } from "@/components/gallery";
import { HotelMap } from "@/components/hotel-map";
import { ReviewForm } from "@/components/review-form";
import { StayBar } from "@/components/stay-bar";
import { canReviewHotel } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/session";
import { NOINDEX, absoluteUrl, jsonLd } from "@/lib/site";
import { unavailableQuantity, parseStay, isoDate } from "@/lib/booking";
import { policyText } from "@/lib/cancellation";
import { formatVND } from "@/lib/format";
import { getHotelDetail } from "@/lib/hotels";
import { prisma } from "@/lib/prisma";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export async function generateMetadata({ params }: PageProps<"/hotels/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotelDetail(slug);
  if (!hotel) return { title: "Không tìm thấy khách sạn", robots: NOINDEX };

  const url = `/hotels/${hotel.slug}`;
  const description = `${hotel.name} tại ${hotel.city}, ${hotel.starRating} sao. ${hotel.description}`.slice(0, 200);
  const image = hotel.images[0] ? absoluteUrl(hotel.images[0]) : undefined;
  return {
    title: hotel.name,
    description,
    alternates: { canonical: url }, // địa chỉ chuẩn: bỏ các tham số ngày, số khách
    openGraph: { type: "website", title: hotel.name, description, url, images: image ? [{ url: image, alt: hotel.name }] : undefined },
    twitter: { card: "summary_large_image", title: hotel.name, description, images: image ? [image] : undefined },
  };
}

/** Ô viết đánh giá: phụ thuộc người dùng đang đăng nhập nên nằm riêng trong Suspense, không làm chậm phần còn lại. */
async function ReviewBox({ hotelId, hotelSlug }: { hotelId: string; hotelSlug: string }) {
  const user = await getCurrentUser();
  const note = "mb-5 rounded-2xl border border-dashed border-border bg-white p-4 text-sm text-muted";

  if (!user) {
    return (
      <p className={note}>
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/hotels/${hotelSlug}`)}`} className="font-semibold text-brand hover:underline">Đăng nhập</Link>{" "}
        để viết đánh giá sau khi lưu trú.
      </p>
    );
  }
  if (!(await canReviewHotel(user.id, hotelId))) {
    return <p className={note}>Bạn có thể đánh giá khách sạn này sau khi hoàn tất kỳ lưu trú.</p>;
  }

  const mine = await prisma.review.findUnique({
    where: { hotelId_userId: { hotelId, userId: user.id } },
    select: { rating: true, comment: true, isHidden: true },
  });
  return (
    <div className="mb-5 space-y-3">
      {mine?.isHidden && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          Đánh giá của bạn đang được ẩn khỏi trang công khai do quản trị viên kiểm duyệt.
        </p>
      )}
      <ReviewForm hotelId={hotelId} initial={mine ? { rating: mine.rating, comment: mine.comment } : undefined} />
    </div>
  );
}

async function HotelContent({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const hotel = await getHotelDetail(slug);
  if (!hotel) notFound();

  const stay = parseStay(one(sp.checkIn), one(sp.checkOut));
  const guests = Math.min(Math.max(Number(one(sp.guests)) || 2, 1), 10);

  if (stay) await connection(); // phòng trống phụ thuộc thời điểm hiện tại (hạn giữ chỗ), không dựng sẵn
  const rooms = await Promise.all(
    hotel.rooms.map(async (r) => {
      const left = stay ? r.quantity - (await unavailableQuantity(prisma, r.id, stay.checkIn, stay.checkOut)) : null;
      return { ...r, left };
    }),
  );

  const bookHref = (roomId: string) => {
    const p = new URLSearchParams({ checkIn: isoDate(stay!.checkIn), checkOut: isoDate(stay!.checkOut), guests: String(guests) });
    return `/book/${roomId}?${p.toString()}`;
  };

  const lowest = Math.min(...hotel.rooms.map((r) => r.pricePerNight));
  const highest = Math.max(...hotel.rooms.map((r) => r.pricePerNight));
  const structured = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: hotel.name,
    description: hotel.description,
    url: absoluteUrl(`/hotels/${hotel.slug}`),
    image: hotel.images.slice(0, 5).map(absoluteUrl),
    address: { "@type": "PostalAddress", streetAddress: hotel.address, addressLocality: hotel.city, addressCountry: "VN" },
    ...(hotel.latitude !== null && hotel.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: hotel.latitude, longitude: hotel.longitude } }
      : {}),
    starRating: { "@type": "Rating", ratingValue: hotel.starRating },
    priceRange: lowest === highest ? `${lowest} VND` : `${lowest}-${highest} VND`,
    amenityFeature: hotel.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })),
    ...(hotel.avgRating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(hotel.avgRating.toFixed(1)), reviewCount: hotel.reviews.length, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="flex items-center gap-0.5 font-semibold text-accent">
            {Array.from({ length: hotel.starRating }, (_, i) => (
              <Star key={i} size={14} className="fill-accent" aria-hidden />
            ))}
          </span>
          <span className="flex items-center gap-1"><MapPin size={14} aria-hidden /> {hotel.address}, {hotel.city}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">{hotel.name}</h1>
          <FavoriteButton hotelId={hotel.id} variant="pill" />
        </div>
        {hotel.avgRating && (
          <p className="mt-2 text-sm">
            <span className="rounded-lg bg-brand px-2 py-1 font-bold text-white">{hotel.avgRating.toFixed(1)}</span>{" "}
            <span className="text-muted">{hotel.reviews.length} đánh giá</span>
          </p>
        )}
      </div>

      <Gallery images={hotel.images} name={hotel.name} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-2 font-display text-2xl font-semibold">Giới thiệu</h2>
            <p className="leading-relaxed text-muted">{hotel.description}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {hotel.amenities.map((a) => (
                <li key={a} className="flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand">
                  <Check size={14} aria-hidden /> {a}
                </li>
              ))}
            </ul>
          </section>

          {hotel.latitude !== null && hotel.longitude !== null && (
            <section>
              <h2 className="mb-3 font-display text-2xl font-semibold">Vị trí</h2>
              <HotelMap lat={hotel.latitude} lng={hotel.longitude} name={hotel.name} address={`${hotel.address}, ${hotel.city}`} />
            </section>
          )}

          <section id="rooms" className="scroll-mt-24">
            <h2 className="mb-4 font-display text-2xl font-semibold">Chọn phòng</h2>
            <StayBar defaults={{ checkIn: one(sp.checkIn), checkOut: one(sp.checkOut), guests }} />
            {!stay && <p className="mt-3 text-sm text-muted">Chọn ngày nhận/trả phòng để xem phòng trống và đặt phòng.</p>}

            <div className="mt-5 space-y-4">
              {rooms.map((r) => {
                const tooMany = guests > r.capacity;
                const soldOut = r.left !== null && r.left <= 0;
                const total = stay ? r.pricePerNight * stay.nights : null;
                return (
                  <article key={r.id} className="grid overflow-hidden rounded-2xl border border-border bg-white sm:grid-cols-[220px_1fr]">
                    <div className="relative min-h-40 bg-border">
                      <Image src={r.images[0]} alt={r.name} fill sizes="220px" className="object-cover" />
                    </div>
                    <div className="flex flex-col gap-3 p-5">
                      <div>
                        <h3 className="text-lg font-bold">{r.name}</h3>
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                          <span className="flex items-center gap-1"><BedDouble size={14} aria-hidden /> {r.bedType}</span>
                          <span className="flex items-center gap-1"><Users size={14} aria-hidden /> Tối đa {r.capacity} khách</span>
                          {r.sizeM2 && <span className="flex items-center gap-1"><Maximize2 size={14} aria-hidden /> {r.sizeM2} m²</span>}
                        </p>
                      </div>
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xl font-extrabold text-brand">
                            {formatVND(r.pricePerNight)} <span className="text-xs font-medium text-muted">/đêm</span>
                          </p>
                          {total && stay && (
                            <p className="text-xs text-muted">Tổng {stay.nights} đêm: {formatVND(total)}</p>
                          )}
                          {r.left !== null && !soldOut && r.left <= 3 && (
                            <p className="text-xs font-semibold text-red-600">Chỉ còn {r.left} phòng</p>
                          )}
                        </div>
                        {!stay ? (
                          <span className="rounded-xl bg-border px-5 py-2.5 text-sm font-bold text-muted">Chọn ngày</span>
                        ) : soldOut ? (
                          <span className="rounded-xl bg-border px-5 py-2.5 text-sm font-bold text-muted">Hết phòng</span>
                        ) : tooMany ? (
                          <span className="rounded-xl bg-border px-5 py-2.5 text-sm font-bold text-muted">Quá số khách</span>
                        ) : (
                          <Link href={bookHref(r.id)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark">
                            Đặt phòng
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-2xl font-semibold">Chính sách hủy phòng</h2>
            <p className="rounded-2xl border border-border bg-white p-4 text-sm text-muted">
              {policyText(hotel.freeCancelDays, hotel.lateCancelFeePercent)} Đơn chưa thanh toán hủy lúc nào cũng không mất phí.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-display text-2xl font-semibold">Đánh giá của khách</h2>
            <Suspense fallback={null}>
              <ReviewBox hotelId={hotel.id} hotelSlug={hotel.slug} />
            </Suspense>
            {hotel.reviews.length === 0 ? (
              <p className="text-sm text-muted">Chưa có đánh giá nào.</p>
            ) : (
              <ul className="space-y-3">
                {hotel.reviews.map((rv) => (
                  <li key={rv.id} className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{rv.author}</p>
                      <p className="flex items-center gap-1 text-sm font-bold">
                        <Star size={14} className="fill-accent text-accent" aria-hidden /> {rv.rating}/5
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted">{rv.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-border bg-white p-5">
            <p className="text-xs text-muted">Giá từ</p>
            <p className="text-2xl font-extrabold text-brand">
              {formatVND(Math.min(...hotel.rooms.map((r) => r.pricePerNight)))}
              <span className="text-xs font-medium text-muted"> /đêm</span>
            </p>
            <a href="#rooms" className="mt-4 block rounded-xl bg-brand py-3 text-center text-sm font-bold text-white hover:bg-brand-dark">
              Chọn phòng
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function HotelPage(props: PageProps<"/hotels/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-border" />}>
        <HotelContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
