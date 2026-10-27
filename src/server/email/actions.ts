"use server";

import { z } from "zod";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { t } from "@/i18n/id";
import { smtpConfig } from "@/lib/flags";
import { ActionError, defineAction } from "../action";
import { resendEmailRow, sendTestEmails } from "./send";
import { emailSettingsSchema, MAX_RECIPIENTS } from "./settings";

const se = t.emailSettings;

const recipientList = z
  .array(z.string().trim().toLowerCase().email(se.invalidEmail))
  .max(MAX_RECIPIENTS, se.tooMany(MAX_RECIPIENTS));

/** 12 §3.6 "Simpan". */
export const saveEmailSettings = defineAction(
  { roles: ["admin"], input: z.object({ enabled: z.boolean(), recipients: recipientList }) },
  async (input, me) => {
    const values = emailSettingsSchema.parse({ email_enabled: input.enabled, email_recipients: input.recipients });
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(values)) {
        await tx
          .insert(settings)
          .values({ key, value, updatedBy: me.id })
          .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: me.id, updatedAt: new Date().toISOString() } });
      }
    });
    return null;
  },
);

/** 12 BR-12-E7 "Kirim email uji": unsaved recipients included. */
export const sendTestEmail = defineAction(
  { roles: ["admin"], input: z.object({ recipients: recipientList.min(1, se.needRecipient) }) },
  async (input) => {
    if (!smtpConfig().configured) throw new ActionError("INVALID_STATE", se.notConfigured);
    return sendTestEmails([...new Set(input.recipients)]);
  },
);

/** 12 BR-12-E8 "Kirim ulang" from the Outbox. */
export const resendEmail = defineAction({ roles: ["admin"], input: z.object({ notificationId: z.string() }) }, async (input) => {
  if (!smtpConfig().configured) throw new ActionError("INVALID_STATE", se.notConfigured);
  const result = await resendEmailRow(input.notificationId);
  if (!result) throw new ActionError("NOT_FOUND", t.errors.notFound);
  return result;
});
