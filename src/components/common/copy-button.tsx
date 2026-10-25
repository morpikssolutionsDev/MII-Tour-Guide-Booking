"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";

export function CopyButton({ value, iconOnly = false, label = t.common.copy }: { value: string; iconOnly?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the value stays visible to copy manually */
    }
  };
  return (
    <Button type="button" variant="secondary" size={iconOnly ? "icon" : "default"} onClick={copy} disabled={!value} aria-label={label}>
      {copied ? <Check /> : <Copy />}
      {!iconOnly && (copied ? t.common.copied : label)}
    </Button>
  );
}
