"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { label: string; value: number };

function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}
function kfmt(n: number) {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
}

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-xs capitalize text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{money(payload[0].value)}</p>
    </div>
  );
}

type LastDotProps = { cx?: number; cy?: number; index?: number; payload?: Point };

/** Área de ingresos por mes. Serie = acento del estudio (var --primary → white-label). */
export function IncomeAreaChart({ data }: { data: Point[] }) {
  // Dot + valor SOLO en el último mes (el dato que el admin busca primero).
  const renderLastDot = (props: LastDotProps) => {
    const { cx, cy, index, payload } = props;
    if (index !== data.length - 1 || cx == null || cy == null) return <g key={`d-${index}`} />;
    return (
      <g key={`d-${index}`}>
        <circle cx={cx} cy={cy} r={4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
        <text
          x={cx - 10}
          y={cy - 10}
          textAnchor="end"
          fontSize={12}
          fontWeight={700}
          fill="var(--foreground)"
        >
          {kfmt(payload?.value ?? 0)}
        </text>
      </g>
    );
  };

  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            dy={6}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={kfmt}
          />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--primary)", strokeOpacity: 0.25 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#incomeFill)"
            isAnimationActive={false}
            dot={renderLastDot}
            activeDot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
