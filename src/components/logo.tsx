export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap sm:gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="9" fill="#0b5fff" />
        <path d="M8 25V12l9-5 9 5v13" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        <rect x="14" y="16" width="6" height="9" rx="1" fill="#ffb020" />
      </svg>
      <span className="leading-tight">
        <span className={`block text-[15px] font-extrabold tracking-tight ${light ? "text-white" : "text-foreground"}`}>
          Không Gian Số
        </span>
        <span className={`block text-[11px] font-semibold uppercase tracking-[0.18em] ${light ? "text-white/70" : "text-brand"}`}>
          Stay
        </span>
      </span>
    </span>
  );
}
