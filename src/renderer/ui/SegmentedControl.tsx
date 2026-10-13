import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** Tablist-style segmented control with a sliding indicator (spring easing). */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  idPrefix,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  idPrefix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [value, segments]);

  const onKey = (e: KeyboardEvent) => {
    const i = segments.findIndex((s) => s.value === value);
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % segments.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + segments.length) % segments.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = segments.length - 1;
    else return;
    e.preventDefault();
    onChange(segments[n].value);
    ref.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(segments[n].value)}"]`)?.focus();
  };

  return (
    <div className="segmented" role="tablist" aria-label={label} ref={ref} onKeyDown={onKey}>
      {ind && <span className="segmented__indicator" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
      {segments.map((s) => (
        <button
          key={s.value}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${s.value}` : undefined}
          aria-controls={idPrefix ? `${idPrefix}-panel-${s.value}` : undefined}
          aria-selected={s.value === value}
          tabIndex={s.value === value ? 0 : -1}
          data-value={s.value}
          className="segmented__item"
          onClick={() => onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
