import "server-only";
import { z } from "zod";
import { db, type Executor } from "@/db/client";
import { settings } from "@/db/schema";

// 04 §3.5 general settings with their defaults and ranges.
export const SETTING_DEFAULTS = {
  hold_expiry_hours: 24,
  booking_horizon_days: 90,
  notice_days: 2,
  feedback_link_days: 14,
  low_rating_threshold: 2,
  payment_instructions_en: "",
};

export const settingsSchema = z.object({
  hold_expiry_hours: z.coerce.number().int().min(1).max(168),
  booking_horizon_days: z.coerce.number().int().min(7).max(365),
  notice_days: z.coerce.number().int().min(1).max(7),
  feedback_link_days: z.coerce.number().int().min(1).max(60),
  low_rating_threshold: z.coerce.number().int().min(1).max(4),
  payment_instructions_en: z.string().max(1000),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Reads settings, falling back to the default for any missing or invalid key. */
export async function getSettings(ex: Executor = db): Promise<Settings> {
  const rows = await ex.select().from(settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const result = { ...SETTING_DEFAULTS };
  for (const key of Object.keys(SETTING_DEFAULTS) as (keyof Settings)[]) {
    const parsed = settingsSchema.shape[key].safeParse(stored[key]);
    if (parsed.success) (result as Record<string, unknown>)[key] = parsed.data;
  }
  return result;
}
