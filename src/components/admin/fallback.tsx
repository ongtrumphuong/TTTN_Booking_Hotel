export function AdminFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-border" />
      <div className="h-64 animate-pulse rounded-2xl bg-border" />
    </div>
  );
}
