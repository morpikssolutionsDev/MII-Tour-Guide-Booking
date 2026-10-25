import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** design-system §7.2: label above, helper caption, error caption with icon. */
export function Field({
  id,
  label,
  required,
  helper,
  error,
  children,
  className,
}: {
  id?: string;
  label: ReactNode;
  required?: boolean;
  helper?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </Label>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} className="flex items-center gap-1 text-xs font-medium text-merah-700" aria-live="polite">
          <AlertCircle className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : (
        helper && <p className="text-xs font-medium text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}

/** Props to link a control to its Field error (aria-invalid + aria-describedby). */
export function fieldAria(id: string, error?: string) {
  return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}
