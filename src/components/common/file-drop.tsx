"use client";

/* eslint-disable @next/next/no-img-element */
import { ImageIcon, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";

/** design-system §7.2 file upload: dashed drop zone, thumbnail, remove. */
export function ImageDrop({ id, file, onChange, label }: { id: string; file: File | null; onChange: (file: File | null) => void; label: string }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (file && preview) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-surface-muted p-2">
        <img src={preview} alt="" className="size-14 rounded object-cover" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {file.name}
          <span className="block text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus" onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    );
  }
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input-border bg-card p-4 text-sm hover:bg-kabut-50"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onChange(dropped);
      }}
    >
      <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}
