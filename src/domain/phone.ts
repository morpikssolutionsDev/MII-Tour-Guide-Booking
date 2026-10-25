import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalises a WhatsApp number to E.164 (`+62…`). Numbers without a country code
 * are read as Indonesian. Returns null when the number is not valid.
 */
export function normalizePhone(input: string, defaultCountry: CountryCode = "ID"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** `+6281234567890` → `+62 812-3456-7890` for display. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Digits only, for wa.me links. */
export function waNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}
