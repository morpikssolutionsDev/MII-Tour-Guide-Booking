"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { t } from "@/i18n/id";
import { formatMonthYear, formatMonthShort, formatNumber, formatRupiah } from "@/lib/format";

const st = t.reports.summary.trend;
const AXIS = { fontSize: 12, fill: "var(--color-kabut-600)" };
const GRID = "var(--color-kabut-100)";

type TooltipEntry = { dataKey?: string; name?: string; value?: number; color?: string };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1 font-medium">{label ? formatMonthYear(label) : null}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular">{p.dataKey === "revenue" ? formatRupiah(Number(p.value)) : formatNumber(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

/** Ringkasan "Tren order & revenue": monthly order columns (left axis) with the revenue line (right axis, Rp jt). */
export function OrderRevenueChart({ buckets }: { buckets: { bucket: string; orders: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={buckets} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="bucket" tickFormatter={formatMonthShort} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--color-kabut-200)" }} />
        <YAxis yAxisId="orders" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={40} />
        <YAxis
          yAxisId="revenue"
          orientation="right"
          tickFormatter={(v: number) => formatNumber(Math.round(v / 1_000_000))}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip cursor={{ fill: "var(--color-kabut-50)" }} content={<ChartTooltip />} />
        <Legend verticalAlign="top" height={28} iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="orders" dataKey="orders" name={st.orders} fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          name={st.revenue}
          stroke="var(--color-merah-500)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-merah-500)" }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** 100% stacked bar for "Ingin berkunjung lagi" (3 segments, 2px gaps, direct labels). */
export function RevisitBar({ yes, maybe, no }: { yes: number; maybe: number; no: number }) {
  const total = yes + maybe + no;
  if (total === 0) return null;
  const segs = [
    { key: "yes", label: t.feedback.revisitAnswers.yes, value: yes, color: "var(--color-chart-1)" },
    { key: "maybe", label: t.feedback.revisitAnswers.maybe, value: maybe, color: "var(--color-chart-2)" },
    { key: "no", label: t.feedback.revisitAnswers.no, value: no, color: "var(--color-chart-3)" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded" role="img" aria-label={segs.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}>
        {segs.map((s) => (s.value > 0 ? <span key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} /> : null))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segs.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label} <span className="font-semibold tabular">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
