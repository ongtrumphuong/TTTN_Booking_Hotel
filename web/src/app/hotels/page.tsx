import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SearchForm } from "@/components/search-form";
import { HotelCard } from "@/components/hotel-card";
import { getCities, searchHotels, type HotelSearch } from "@/lib/hotels";

export const metadata: Metadata = { title: "Tìm khách sạn" };

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const SORTS: { value: NonNullable<HotelSearch["sort"]>; label: string }[] = [
  { value: "recommended", label: "Đề xuất" },
  { value: "price-asc", label: "Giá thấp đến cao" },
  { value: "price-desc", label: "Giá cao đến thấp" },
  { value: "rating", label: "Đánh giá cao nhất" },
];

function parse(sp: SP) {
  const guests = Number(one(sp.guests)) || 2;
  const sort = SORTS.find((s) => s.value === one(sp.sort))?.value ?? "recommended";
  return {
    city: one(sp.city),
    checkIn: one(sp.checkIn),
    checkOut: one(sp.checkOut),
    guests: Math.min(Math.max(guests, 1), 10),
    sort,
  };
}

async function Results({ searchParams }: { searchParams: Promise<SP> }) {
  const q = parse(await searchParams);
  const hotels = await searchHotels(q);

  const link = (sort: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...q, sort })) if (v) p.set(k, String(v));
    return `/hotels?${p.toString()}`;
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">
          {q.city ? `Khách sạn tại ${q.city}` : "Tất cả khách sạn"}{" "}
          <span className="text-sm font-medium text-muted">({hotels.length} kết quả)</span>
        </h1>
        <div className="flex flex-wrap gap-2 text-sm">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={link(s.value)}
              className={`rounded-full border px-3 py-1.5 font-medium ${
                q.sort === s.value ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {hotels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <p className="font-bold">Không tìm thấy khách sạn phù hợp</p>
          <p className="mt-1 text-sm text-muted">Hãy thử đổi ngày, số khách hoặc điểm đến khác.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((h) => (
            <HotelCard key={h.id} hotel={h} />
          ))}
        </div>
      )}
    </>
  );
}

async function Form({ searchParams }: { searchParams: Promise<SP> }) {
  const [sp, cities] = await Promise.all([searchParams, getCities()]);
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
