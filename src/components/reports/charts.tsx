"use client";

import { BarChart3, Download, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n/id";
import { formatDayMonth, formatMonthYear, formatNumber, formatRupiah, formatRupiahShort } from "@/lib/format";

const sc = t.reports.charts;
const AXIS = { fontSize: 12, fill: "var(--color-kabut-600)" };
const GRID = "var(--color-kabut-100)";

/** Card with "Lihat tabel" toggle and CSV download (design-system §3.5). */
export function ChartCard({
  title,
  csvHref,
  table,
  children,
  empty,
  extra,
}: {
  title: string;
  csvHref: string;
  table: { header: string[]; rows: (string | number)[][] };
  children: ReactNode;
  empty: boolean;
  extra?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-lg border bg-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">{title}</h2>
        {extra}
        <Button variant="ghost" size="xs" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
          {showTable ? <BarChart3 /> : <Table2 />}
          {showTable ? sc.showChart : sc.showTable}
        </Button>
        <Button variant="ghost" size="xs" asChild>
          <a href={csvHref} download>
            <Download />
            {sc.download}
          </a>
        </Button>
      </div>
      {empty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{sc.empty}</p>
      ) : showTable ? (
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {table.header.map((h) => (
                  <TableHead key={h} scope="col">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className={j > 0 ? "text-right tabular" : undefined}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function ChartTooltip({ active, payload, label, money }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular">{money ? formatRupiah(Number(p.value)) : formatNumber(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

/** Single-series magnitude comparison: one colour (chart slot 1), labels at bar ends. */
export function BreakdownChart({ data, layout = "horizontal" }: { data: { label: string; count: number }[]; layout?: "horizontal" | "vertical" }) {
  if (layout === "vertical") {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--color-kabut-200)" }} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--color-kabut-50)" }} content={<ChartTooltip />} />
          <Bar dataKey="count" name={sc.count} fill="var(--color-chart-1)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: "var(--color-kabut-900)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 44 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={110} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "var(--color-kabut-50)" }} content={<ChartTooltip />} />
        <Bar dataKey="count" name={sc.count} fill="var(--color-chart-1)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: "var(--color-kabut-900)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const CHANNEL_SERIES = [
  { key: "sales", label: t.channels.sales, color: "var(--color-chart-1)" },
  { key: "call_center", label: t.channels.call_center, color: "var(--color-chart-2)" },
  { key: "on_the_spot", label: t.channels.on_the_spot, color: "var(--color-chart-3)" },
] as const;

type TrendBucket = { bucket: string; total: number; sales: number; call_center: number; on_the_spot: number };

/** Revenue trend; optional split into the 3 channels (categorical slots 1–3, legend shown). */
export function TrendChart({ buckets, granularity, split }: { buckets: TrendBucket[]; granularity: "day" | "week" | "month"; split: boolean }) {
  const tick = (v: string) => (granularity === "month" ? formatMonthYear(v) : formatDayMonth(v));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={buckets} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="bucket" tickFormatter={tick} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--color-kabut-200)" }} minTickGap={24} />
        <YAxis tickFormatter={(v: number) => formatRupiahShort(v).replace("Rp ", "")} tick={AXIS} tickLine={false} axisLine={false} width={56} />
        <Tooltip content={<ChartTooltip money />} labelFormatter={(v) => tick(String(v))} />
        {split ? (
          <>
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {CHANNEL_SERIES.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            ))}
          </>
        ) : (
          <Line type="monotone" dataKey="total" name={sc.amount} stroke="var(--color-chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Trend card with the "Pisah per kanal" switch. */
export function TrendCard({ buckets, granularity, csvHref }: { buckets: TrendBucket[]; granularity: "day" | "week" | "month"; csvHref: string }) {
  const [split, setSplit] = useState(false);
  const tick = (v: string) => (granularity === "month" ? formatMonthYear(v) : formatDayMonth(v));
  return (
    <ChartCard
      title={sc.trend}
      csvHref={csvHref}
      empty={buckets.every((b) => b.total === 0)}
      table={{
        header: ["Periode", t.channels.sales, t.channels.call_center, t.channels.on_the_spot, sc.amount],
        rows: buckets.map((b) => [tick(b.bucket), formatRupiah(b.sales), formatRupiah(b.call_center), formatRupiah(b.on_the_spot), formatRupiah(b.total)]),
      }}
      extra={
        <span className="flex items-center gap-2">
          <Switch id="split-channel" checked={split} onCheckedChange={setSplit} />
          <Label htmlFor="split-channel" className="text-xs">
            {sc.splitByChannel}
          </Label>
        </span>
      }
    >
      <TrendChart buckets={buckets} granularity={granularity} split={split} />
    </ChartCard>
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
