import "server-only";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type Executor } from "@/db/client";
import { settings } from "@/db/schema";

// 12 §4 / BR-12-E1: on/off and recipients live in `settings`; the SMTP connection is env-only.

export const MAX_RECIPIENTS = 20;

export const emailSettingsSchema = z.object({
  email_enabled: z.boolean(),
  email_recipients: z
    .array(z.string().trim().toLowerCase().email())
    .max(MAX_RECIPIENTS)
    .transform((list) => [...new Set(list)]),
});

export type EmailSettings = z.infer<typeof emailSettingsSchema>;

const DEFAULTS: EmailSettings = { email_enabled: false, email_recipients: [] };

export async function getEmailSettings(ex: Executor = db): Promise<EmailSettings> {
  const rows = await ex
    .select()
    .from(settings)
    .where(inArray(settings.key, ["email_enabled", "email_recipients"]));
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const enabled = emailSettingsSchema.shape.email_enabled.safeParse(stored.email_enabled);
  const recipients = emailSettingsSchema.shape.email_recipients.safeParse(stored.email_recipients);
  return {
    email_enabled: enabled.success ? enabled.data : DEFAULTS.email_enabled,
    email_recipients: recipients.success ? recipients.data : DEFAULTS.email_recipients,
  };
}
