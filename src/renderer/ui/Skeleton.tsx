export function Skeleton({ width = "100%", height = 14, radius, lines = 1 }: { width?: number | string; height?: number; radius?: number; lines?: number }) {
  return (
    <span className="skeleton-group" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton" style={{ width: i === lines - 1 && lines > 1 ? "62%" : width, height, borderRadius: radius }} />
      ))}
    </span>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="loading-block">
      <span className="sr-only">{label}…</span>
      <Skeleton height={16} width="40%" />
      <Skeleton lines={3} />
    </div>
  );
}
