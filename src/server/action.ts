import "server-only";
import { z } from "zod";
import type { Role } from "@/db/schema";
import { t } from "@/i18n/id";
import { getCurrentUser, type CurrentUser } from "./session";

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "UNEXPECTED";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionErrorCode;
      error: string;
      fieldErrors?: Record<string, string>;
      /** Extra data for the UI, e.g. a list of conflicting bookings. */
      details?: unknown;
    };

/** Throw inside an action handler to return a typed failure. */
export class ActionError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
    public details?: unknown,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export function fieldError(field: string, message: string): ActionError {
  return new ActionError("VALIDATION", message, undefined, { [field]: message });
}

function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Wraps a server action: loads the user from the database, enforces roles (server-side,
 * overview §4), validates input with zod, and turns thrown ActionErrors into results.
 */
export function defineAction<S extends z.ZodType, T>(
  options: { roles: readonly Role[]; input: S },
  handler: (input: z.output<S>, user: CurrentUser) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (raw) => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, code: "UNAUTHENTICATED", error: t.errors.sessionExpired };
    if (!options.roles.includes(user.role)) return { ok: false, code: "FORBIDDEN", error: t.errors.forbidden };

    const parsed = options.input.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, code: "VALIDATION", error: t.errors.validation, fieldErrors: flattenIssues(parsed.error) };
    }
    try {
      return { ok: true, data: await handler(parsed.data, user) };
    } catch (error) {
      if (error instanceof ActionError) {
        return {
          ok: false,
          code: error.code,
          error: error.message,
          details: error.details,
          fieldErrors: error.fieldErrors,
        };
      }
      // Let Next.js redirects and notFound() propagate.
      if (error && typeof error === "object" && "digest" in error) throw error;
      console.error(error);
      return { ok: false, code: "UNEXPECTED", error: t.errors.unexpected };
    }
  };
}
