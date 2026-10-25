"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { t } from "@/i18n/id";
import type { ActionResult } from "@/server/action";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

/**
 * Runs a server action with pending state, field errors and toasts.
 * Validation failures stay in the form; other failures toast the message.
 */
export function useAction<I, O>(
  action: (input: I) => Promise<ActionResult<O>>,
  options: {
    successMessage?: string | ((data: O) => string);
    onSuccess?: (data: O) => void;
    onError?: (failure: Failure) => void;
    /** Failure codes the caller presents itself (no toast), e.g. CONFLICT dialogs. */
    quiet?: Failure["code"][];
    /** Refresh server components after success (default true). */
    refresh?: boolean;
  } = {},
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = useCallback(
    (input: I) =>
      new Promise<ActionResult<O>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<O>;
          try {
            result = await action(input);
          } catch {
            result = { ok: false, code: "UNEXPECTED", error: t.errors.network };
          }
          if (result.ok) {
            setFieldErrors({});
            setFailure(null);
            const message =
              typeof options.successMessage === "function" ? options.successMessage(result.data) : options.successMessage;
            if (message) toast.success(message);
            options.onSuccess?.(result.data);
            if (options.refresh !== false) router.refresh();
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            setFailure(result);
            if (result.code === "UNAUTHENTICATED") router.push("/keluar?alasan=sesi");
            else if (!options.quiet?.includes(result.code) && (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0)) toast.error(result.error);
            options.onError?.(result);
          }
          resolve(result);
        });
      }),
    [action, options, router],
  );

  return { run, pending, fieldErrors, failure, setFieldErrors, reset: () => { setFieldErrors({}); setFailure(null); } };
}
