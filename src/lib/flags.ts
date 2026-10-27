import "server-only";

// Deployment switches read from the environment (12-perubahan-fase-2.md §4).
// Server-only: client components receive the values as props.

/** BR-12-P1: payment confirmation is on only for the exact value "true". */
export function isPaymentConfirmationEnabled(): boolean {
  return process.env.PAYMENT_CONFIRMATION === "true";
}

export type SmtpConfig = {
  configured: boolean;
  missing: string[];
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

/** BR-12-E1: SMTP comes from env; user and password must be both set or both empty. */
export function smtpConfig(): SmtpConfig {
  const env = (name: string) => process.env[name]?.trim() ?? "";
  const host = env("SMTP_HOST");
  const from = env("SMTP_FROM");
  const user = env("SMTP_USER");
  const password = env("SMTP_PASSWORD");
  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!from) missing.push("SMTP_FROM");
  if (user && !password) missing.push("SMTP_PASSWORD");
  if (password && !user) missing.push("SMTP_USER");
  const port = Number(env("SMTP_PORT")) || 587;
  return {
    configured: missing.length === 0,
    missing,
    host,
    port,
    secure: env("SMTP_SECURE") === "true" || port === 465,
    user,
    password,
    from,
  };
}
