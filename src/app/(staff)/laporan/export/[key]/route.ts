import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { buildReportCsv, CSV_KEYS, type CsvKey } from "@/server/reports/csv";
import { requireRole } from "@/server/session";

/** 11 BR-11-10: `/laporan/export/{key}?{same filters as the page}`. */
export async function GET(request: NextRequest, { params }: RouteContext<"/laporan/export/[key]">) {
  await requireRole("admin", "staff");
  const { key } = await params;
  if (!(CSV_KEYS as readonly string[]).includes(key)) notFound();
  const { filename, body } = await buildReportCsv(key as CsvKey, Object.fromEntries(request.nextUrl.searchParams));
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
