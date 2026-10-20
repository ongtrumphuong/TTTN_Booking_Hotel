import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { HotelCard } from "@/components/hotel-card";
import { getHotelsByIds } from "@/lib/hotels";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Khách sạn yêu thích" };

async function List() {
  const user = await requireUser("/favorites");
  const favs = await prisma.favorite.findMany({ where: { userId: user.id }, select: { hotelId: true }, orderBy: { hotelId: "asc" } });
  const hotels = await getHotelsByIds(favs.map((f) => f.hotelId));

  if (hotels.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <p className="font-bold">Bạn chưa lưu khách sạn nào</p>
        <p className="mt-1 text-sm text-muted">Bấm biểu tượng trái tim trên khách sạn để lưu lại xem sau.</p>
        <Link href="/hotels" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">
          Khám phá khách sạn
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {hotels.map((h) => (
        <HotelCard key={h.id} hotel={h} />
      ))}
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-extrabold">Khách sạn yêu thích</h1>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-border" />}>
        <List />
      </Suspense>
    </div>
  );
}
