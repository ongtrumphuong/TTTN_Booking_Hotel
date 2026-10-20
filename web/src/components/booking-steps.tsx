import { Check } from "lucide-react";

const STEPS = ["Chọn phòng", "Xác nhận", "Thanh toán", "Hoàn tất"];

/** Thanh các bước đặt phòng. `current` là chỉ số bước đang ở (0 = Chọn phòng ... 3 = Hoàn tất). */
export function BookingSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="mb-8 flex items-center" aria-label="Các bước đặt phòng">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={active ? "step" : undefined}>
            <span className="flex items-center gap-2.5">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-brand text-white" : active ? "bg-sun text-white shadow-lg shadow-sun/30" : "border border-border bg-white text-muted"
                }`}
              >
                {done ? <Check size={16} aria-hidden /> : i + 1}
              </span>
              <span className={`hidden text-sm font-semibold sm:block ${active ? "text-foreground" : done ? "text-brand" : "text-muted"}`}>{label}</span>
            </span>
            {i < STEPS.length - 1 && <span className={`mx-3 h-0.5 flex-1 rounded-full ${done ? "bg-brand" : "bg-border"}`} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
