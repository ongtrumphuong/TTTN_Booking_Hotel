import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { AdminFallback } from "@/components/admin/fallback";
import { ReviewActions } from "@/components/admin/review-actions";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Quản lý đánh giá" };

const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "visible", label: "Đang hiển thị" },
  { value: "hidden", label: "Đã ẩn" },
];

async function ReviewsList({ searchParams }: Pick<PageProps<"/admin/reviews">, "searchParams">) {
  await requireAdmin("/admin/reviews");
  const sp = await searchParams;
  const raw = Array.isArray(sp.show) ? sp.show[0] : sp.show;
  const show = FILTERS.find((f) => f.value === raw)?.value ?? "all";

  const [reviews, hiddenCount] = await Promise.all([
    prisma.review.findMany({
      where: show === "hidden" ? { isHidden: true } : show === "visible" ? { isHidden: false } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } }, hotel: { select: { name: true, slug: true } } },
    }),
    prisma.review.count({ where: { isHidden: true } }),
  ]);

  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">Đánh giá</h1>
      <p className="mb-4 text-sm text-muted">Ẩn đánh giá không phù hợp: đánh giá bị ẩn không hiện ở trang khách sạn và không tính vào điểm trung bình.</p>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/reviews" : `/admin/reviews?show=${f.value}`}
            className={`rounded-full border px-3 py-1.5 font-medium ${show === f.value ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}
          >
            {f.label}
            {f.value === "hidden" && hiddenCount > 0 && ` (${hiddenCount})`}
          </Link>
        ))}
      </div>

      <ul className="space-y-3">
        {reviews.length === 0 && <li className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted">Không có đánh giá nào.</li>}
        {reviews.map((r) => (
          <li key={r.id} className={`rounded-2xl border bg-white p-4 ${r.isHidden ? "border-amber-300 bg-amber-50/40" : "border-border"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <Link href={`/hotels/${r.hotel.slug}`} className="font-bold text-brand hover:underline">{r.hotel.name}</Link>
                  <span className="text-muted"> · {r.user.name} ({r.user.email}) · {formatDate(r.createdAt)}</span>
                </p>
                <p className="mt-1 flex items-center gap-1" aria-label={`${r.rating} trên 5 sao`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={14} className={i < r.rating ? "fill-accent text-accent" : "text-border"} aria-hidden />
                  ))}
                  {r.isHidden && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Đã ẩn</span>}
                </p>
                <p className="mt-2 whitespace-pre-line break-words text-sm">{r.comment}</p>
              </div>
              <ReviewActions reviewId={r.id} hidden={r.isHidden} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function AdminReviewsPage(props: PageProps<"/admin/reviews">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <ReviewsList searchParams={props.searchParams} />
    </Suspense>
  );
}
