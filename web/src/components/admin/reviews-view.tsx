import Link from "next/link";
import { Star } from "lucide-react";
import { ReviewActions } from "@/components/admin/review-actions";
import { ReviewReply } from "@/components/admin/review-reply";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "visible", label: "Đang hiển thị" },
  { value: "hidden", label: "Đã ẩn" },
  { value: "unanswered", label: "Chưa phản hồi" },
];

type SP = Record<string, string | string[] | undefined>;

/**
 * Danh sách đánh giá dùng chung. Quản trị viên thấy mọi đánh giá, ẩn/xóa được và phản hồi được;
 * đối tác chỉ thấy đánh giá của khách sạn mình và chỉ phản hồi (không ẩn/xóa, việc kiểm duyệt là của sàn).
 */
export async function ReviewsView({ searchParams, user }: { searchParams: Promise<SP>; user: Pick<SessionUser, "id" | "role"> }) {
  const isAdmin = user.role === "ADMIN";
  const base = isAdmin ? "/admin" : "/host";
  const sp = await searchParams;
  const raw = Array.isArray(sp.show) ? sp.show[0] : sp.show;
  const show = FILTERS.find((f) => f.value === raw && (isAdmin || f.value !== "hidden"))?.value ?? "all";
  const scope = isAdmin ? {} : { hotel: { ownerId: user.id }, isHidden: false };

  const [reviews, hiddenCount, unansweredCount] = await Promise.all([
    prisma.review.findMany({
      where: { ...scope, ...(show === "hidden" ? { isHidden: true } : show === "visible" ? { isHidden: false } : show === "unanswered" ? { reply: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } }, hotel: { select: { name: true, slug: true } } },
    }),
    isAdmin ? prisma.review.count({ where: { isHidden: true } }) : Promise.resolve(0),
    prisma.review.count({ where: { ...scope, reply: null } }),
  ]);

  return (
    <>
      <h1 className="font-display mb-1 text-3xl font-semibold">Đánh giá</h1>
      <p className="mb-4 text-sm text-muted">
        {isAdmin
          ? "Ẩn đánh giá không phù hợp: đánh giá bị ẩn không hiện ở trang khách sạn và không tính vào điểm trung bình. Khách sạn có thể phản hồi công khai."
          : "Phản hồi đánh giá của khách để thể hiện sự quan tâm; phản hồi hiện công khai dưới đánh giá ở trang khách sạn."}
      </p>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {FILTERS.filter((f) => isAdmin || f.value !== "hidden").map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? `${base}/reviews` : `${base}/reviews?show=${f.value}`}
            className={`rounded-full border px-3 py-1.5 font-medium ${show === f.value ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}
          >
            {f.label}
            {f.value === "hidden" && hiddenCount > 0 && ` (${hiddenCount})`}
            {f.value === "unanswered" && unansweredCount > 0 && ` (${unansweredCount})`}
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
                  <span className="font-bold text-brand">{r.hotel.name}</span>
                  <span className="text-muted"> · {r.user.name}{isAdmin ? ` (${r.user.email})` : ""} · {formatDate(r.createdAt)}</span>
                </p>
                <p className="mt-1 flex items-center gap-1" aria-label={`${r.rating} trên 5 sao`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={14} className={i < r.rating ? "fill-accent text-accent" : "text-border"} aria-hidden />
                  ))}
                  {r.isHidden && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Đã ẩn</span>}
                </p>
                <p className="mt-2 whitespace-pre-line break-words text-sm">{r.comment}</p>
                {r.reply && (
                  <div className="mt-3 rounded-2xl bg-brand/5 p-3 text-sm">
                    <p className="font-semibold text-brand">Phản hồi của khách sạn{r.repliedAt ? ` · ${formatDate(r.repliedAt)}` : ""}</p>
                    <p className="mt-0.5 whitespace-pre-line break-words text-muted">{r.reply}</p>
                  </div>
                )}
                <ReviewReply reviewId={r.id} initial={r.reply} />
              </div>
              {isAdmin && <ReviewActions reviewId={r.id} hidden={r.isHidden} />}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
