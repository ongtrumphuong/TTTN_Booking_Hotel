import Link from "next/link";
import { formatVND } from "@/lib/format";

export type FilterState = {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
  sort: "recommended" | "price-asc" | "price-desc" | "rating";
  minPrice?: number;
  maxPrice?: number;
  minStars?: number;
  amenities: string[];
};

const STAR_CHOICES = [
  { value: "", label: "Tất cả" },
  { value: "3", label: "Từ 3 sao" },
  { value: "4", label: "Từ 4 sao" },
  { value: "5", label: "5 sao" },
];

const field = "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function activeFilterCount(f: FilterState) {
  return (f.minPrice !== undefined ? 1 : 0) + (f.maxPrice !== undefined ? 1 : 0) + (f.minStars ? 1 : 0) + f.amenities.length;
}

/** Bộ lọc dạng form GET thuần: không cần JavaScript, giữ nguyên điểm đến, ngày và số khách đang tìm. */
export function FilterForm({
  state,
  options,
  clearHref,
}: {
  state: FilterState;
  options: { amenities: string[]; minPrice: number; maxPrice: number };
  clearHref: string;
}) {
  const hidden: [string, string | undefined][] = [
    ["city", state.city],
    ["checkIn", state.checkIn],
    ["checkOut", state.checkOut],
    ["guests", String(state.guests)],
    ["sort", state.sort],
  ];

  return (
    <form action="/hotels" className="space-y-6 rounded-2xl border border-border bg-white p-5">
      {hidden.map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}

      <fieldset>
        <legend className="mb-2 text-sm font-bold">Giá mỗi đêm (₫)</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="minPrice"
            min={0}
            step={100000}
            inputMode="numeric"
            defaultValue={state.minPrice}
            placeholder="Từ"
            aria-label="Giá thấp nhất"
            className={field}
          />
          <span className="text-muted" aria-hidden>–</span>
          <input
            type="number"
            name="maxPrice"
            min={0}
            step={100000}
            inputMode="numeric"
            defaultValue={state.maxPrice}
            placeholder="Đến"
            aria-label="Giá cao nhất"
            className={field}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Hiện có từ {formatVND(options.minPrice)} đến {formatVND(options.maxPrice)}
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-bold">Hạng sao</legend>
        <div className="flex flex-wrap gap-2">
          {STAR_CHOICES.map((c) => (
            <label
              key={c.value}
              className="cursor-pointer rounded-full border border-border bg-white px-3 py-1.5 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white"
            >
              <input
                type="radio"
                name="minStars"
                value={c.value}
                defaultChecked={(state.minStars ? String(state.minStars) : "") === c.value}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-bold">Tiện nghi</legend>
        <div className="space-y-2">
          {options.amenities.map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" name="amenity" value={a} defaultChecked={state.amenities.includes(a)} className="size-4 accent-[#0b5fff]" />
              {a}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-dark">
          Áp dụng
        </button>
        {activeFilterCount(state) > 0 && (
          <Link href={clearHref} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-brand">
            Xóa lọc
          </Link>
        )}
      </div>
    </form>
  );
}
