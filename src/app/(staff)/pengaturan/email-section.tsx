import { smtpConfig } from "@/lib/flags";
import { getEmailSettings } from "@/server/email/settings";
import { EmailSettingsForm } from "./email-client";

/** 12 §3.6: SMTP status (never the password) plus on/off and recipients. */
export async function EmailSection() {
  const smtp = smtpConfig();
  const settings = await getEmailSettings();
  return (
    <EmailSettingsForm
      initial={{ enabled: settings.email_enabled, recipients: settings.email_recipients }}
      smtp={{ configured: smtp.configured, missing: smtp.missing, host: smtp.host, port: smtp.port, from: smtp.from }}
    />
  );
}
