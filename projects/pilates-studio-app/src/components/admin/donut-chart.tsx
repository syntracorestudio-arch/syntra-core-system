/**
 * Donut (SVG puro, server-safe) para desgloses de 2-5 segmentos.
 * Colores por segmento vía CSS vars (token-driven → white-label OK).
 */
export type DonutSlice = { label: string; value: number; color: string };

export function DonutChart({
  slices,
  size = 132,
  stroke = 18,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="relative inline-flex">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        {total > 0
          ? slices
              .filter((s) => s.value > 0)
              .map((s, i) => {
                const frac = s.value / total;
                const dash = frac * c;
                const el = (
                  <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-acc * c}
                    strokeLinecap="butt"
                  />
                );
                acc += frac;
                return el;
              })
          : null}
      </svg>
      {centerValue ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-base font-bold tabular-nums text-foreground">{centerValue}</span>
          {centerLabel ? <span className="text-[10px] text-muted-foreground">{centerLabel}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
