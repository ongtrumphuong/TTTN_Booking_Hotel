import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterForm, activeFilterCount, type FilterState } from "@/components/filter-form";
import { SearchForm } from "@/components/search-form";
import { HotelCard } from "@/components/hotel-card";
import { ResultsView } from "@/components/map/results-view";
import { mapboxToken, type MapPoint } from "@/lib/map";
import { formatVND } from "@/lib/format";
import { getCities, getFilterOptions, searchHotels, type HotelSearch } from "@/lib/hotels";

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const nonNegInt = (v: string | undefined) => {
  if (!v || !/^\d{1,10}$/.test(v)) return undefined;
  return Number(v);
};

const SORTS: { value: NonNullable<HotelSearch["sort"]>; label: string }[] = [
  { value: "recommended", label: "Đề xuất" },
  { value: "price-asc", label: "Giá thấp đến cao" },
  { value: "price-desc", label: "Giá cao đến thấp" },
  { value: "rating", label: "Đánh giá cao nhất" },
];

/** Trang theo thành phố được lập chỉ mục; mọi tổ hợp bộ lọc, ngày, sắp xếp chỉ để người dùng nên không lập chỉ mục (tránh nội dung trùng lặp). */
export async function generateMetadata({ searchParams }: PageProps<"/hotels">): Promise<Metadata> {
  const sp = await searchParams;
  const city = one(sp.city);
  const filtered = ["checkIn", "checkOut", "guests", "minPrice", "maxPrice", "minStars", "amenity", "sort"].some((k) => sp[k] !== undefined);
  return {
    title: city ? `Khách sạn tại ${city}` : "Tìm khách sạn",
    description: city ? `Đặt phòng khách sạn tại ${city} giá tốt, xác nhận nhanh cùng Không Gian Số Stay.` : "Tìm và đặt khách sạn trên khắp Việt Nam với giá tốt cùng Không Gian Số Stay.",
    alternates: { canonical: city ? `/hotels?city=${encodeURIComponent(city)}` : "/hotels" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

function parse(sp: SP): FilterState {
  const guests = Number(one(sp.guests)) || 2;
  const sort = SORTS.find((s) => s.value === one(sp.sort))?.value ?? "recommended";
  const stars = Number(one(sp.minStars));
  return {
    city: one(sp.city),
    checkIn: one(sp.checkIn),
    checkOut: one(sp.checkOut),
    guests: Math.min(Math.max(guests, 1), 10),
    sort,
    minPrice: nonNegInt(one(sp.minPrice)),
    maxPrice: nonNegInt(one(sp.maxPrice)),
    minStars: stars >= 1 && stars <= 5 ? stars : undefined,
    amenities: many(sp.amenity).slice(0, 12),
  };
}

function toQuery(f: FilterState, over: Partial<FilterState> = {}, keepFilters = true) {
  const s = { ...f, ...over };
  const p = new URLSearchParams();
  if (s.city) p.set("city", s.city);
  if (s.checkIn) p.set("checkIn", s.checkIn);
  if (s.checkOut) p.set("checkOut", s.checkOut);
  p.set("guests", String(s.guests));
  if (s.sort !== "recommended") p.set("sort", s.sort);
  if (keepFilters) {
    if (s.minPrice !== undefined) p.set("minPrice", String(s.minPrice));
    if (s.maxPrice !== undefined) p.set("maxPrice", String(s.maxPrice));
    if (s.minStars) p.set("minStars", String(s.minStars));
    for (const a of s.amenities) p.append("amenity", a);
  }
  return `/hotels?${p.toString()}`;
}

async function Results({ searchParams }: { searchParams: Promise<SP> }) {
  const f = parse(await searchParams);
  const [hotels, options] = await Promise.all([searchHotels(f), getFilterOptions()]);
  const count = activeFilterCount(f);

  // Các thẻ lọc đang bật, bấm × để bỏ từng điều kiện.
  const chips: { label: string; href: string }[] = [];
  if (f.minPrice !== undefined) chips.push({ label: `Từ ${formatVND(f.minPrice)}`, href: toQuery(f, { minPrice: undefined }) });
  if (f.maxPrice !== undefined) chips.push({ label: `Đến ${formatVND(f.maxPrice)}`, href: toQuery(f, { maxPrice: undefined }) });
  if (f.minStars) chips.push({ label: f.minStars === 5 ? "5 sao" : `Từ ${f.minStars} sao`, href: toQuery(f, { minStars: undefined }) });
  for (const a of f.amenities) chips.push({ label: a, href: toQuery(f, { amenities: f.amenities.filter((x) => x !== a) }) });

  const filterForm = <FilterForm state={f} options={options} clearHref={toQuery(f, {}, false)} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside>
        <details className="group lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl border border-border bg-white px-4 py-3 text-sm font-bold">
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={16} aria-hidden /> Bộ lọc{count > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">{count}</span>}
            </span>
            <span className="text-xs font-medium text-muted group-open:hidden">Mở</span>
            <span className="hidden text-xs font-medium text-muted group-open:inline">Thu gọn</span>
          </summary>
          <div className="mt-3">{filterForm}</div>
        </details>
        <div className="hidden lg:sticky lg:top-24 lg:block">{filterForm}</div>
      </aside>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold">
            {f.city ? `Khách sạn tại ${f.city}` : "Tất cả khách sạn"}{" "}
            <span className="text-sm font-medium text-muted">({hotels.length} kết quả)</span>
          </h1>
          <div className="flex flex-wrap gap-2 text-sm">
            {SORTS.map((s) => (
              <Link
                key={s.value}
                href={toQuery(f, { sort: s.value })}
                className={`rounded-full border px-3 py-1.5 font-medium ${
                  f.sort === s.value ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {chips.length > 0 && (
          <ul className="mb-5 flex flex-wrap gap-2" aria-label="Bộ lọc đang dùng">
            {chips.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/20">
                  {c.label} <X size={12} aria-label="Bỏ lọc" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hotels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <p className="font-bold">Không tìm thấy khách sạn phù hợp</p>
            <p className="mt-1 text-sm text-muted">Hãy thử nới bộ lọc, đổi ngày, số khách hoặc điểm đến khác.</p>
            {count > 0 && (
              <Link href={toQuery(f, {}, false)} className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">
                Xóa tất cả bộ lọc
              </Link>
            )}
          </div>
        ) : (
          <ResultsOrList hotels={hotels}>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {hotels.map((h) => (
                <HotelCard key={h.id} hotel={h} />
              ))}
            </div>
          </ResultsOrList>
        )}
      </div>
    </div>
  );
}

/** Có token Mapbox và có khách sạn có tọa độ thì cho chuyển giữa danh sách và bản đồ có ghim giá; ngược lại chỉ hiện danh sách. */
function ResultsOrList({ hotels, children }: { hotels: Awaited<ReturnType<typeof searchHotels>>; children: React.ReactNode }) {
  const token = mapboxToken();
  const points: MapPoint[] = hotels
    .filter((h) => h.latitude !== null && h.longitude !== null)
    .map((h) => ({ id: h.id, slug: h.slug, name: h.name, city: h.city, lat: h.latitude!, lng: h.longitude!, price: h.minPrice, image: h.image, rating: h.avgRating, stars: h.starRating }));
  if (!token || points.length === 0) return <>{children}</>;
  return <ResultsView token={token} points={points}>{children}</ResultsView>;
}

async function Form({ searchParams }: { searchParams: Promise<SP> }) {
  // Tuần tự: chờ searchParams (thông tin của yêu cầu) rồi mới đọc cơ sở dữ liệu, để lúc build không chạy truy vấn nào.
  const sp = await searchParams;
  const cities = await getCities();
  const q = parse(sp);
  return <SearchForm compact cities={cities.map((c) => c.city)} defaults={q} />;
}

export default function HotelsPage(props: PageProps<"/hotels">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-border" />}>
          <Form searchParams={props.searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-border" />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
