"use client";

import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Rendered rich text (already sanitised server-side, 04 BR-04-10). */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-relaxed [&_a]:font-medium [&_a]:text-danau-700 [&_a]:underline [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const TOOLS = [
  { command: "bold", icon: Bold, label: "Tebal" },
  { command: "italic", icon: Italic, label: "Miring" },
  { command: "insertUnorderedList", icon: List, label: "Daftar berbutir" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Daftar bernomor" },
] as const;

/** Minimal editor (design-system §7.2): bold, italic, bulleted/numbered lists, link. */
export function RichTextEditor({
  id,
  initialHtml,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  initialHtml: string;
  onChange: (html: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // Only on mount: the editor owns its DOM afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    onChange(ref.current?.innerHTML ?? "");
  };

  return (
    <div className={cn("rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring", invalid && "border-merah-700")}>
      <div className="flex gap-1 border-b p-1" role="toolbar" aria-controls={id}>
        {TOOLS.map(({ command, icon: Icon, label }) => (
          <Button key={command} type="button" variant="ghost" size="icon-sm" aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(command)}>
            <Icon />
          </Button>
        ))}
        <LinkButton editor={ref} onInsert={(url) => exec("createLink", url)} />
      </div>
      <div
        id={id}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className="min-h-48 px-3 py-2 text-sm leading-relaxed outline-none [&_a]:text-danau-700 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}

/** Link tool: remembers the editor selection, asks for the URL in a popover, then restores it. */
function LinkButton({ editor, onInsert }: { editor: React.RefObject<HTMLDivElement | null>; onInsert: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("https://");
  const range = useRef<Range | null>(null);
  const valid = /^https?:\/\/[^\s]+\.[^\s]+/.test(url);

  const remember = () => {
    const selection = window.getSelection();
    const current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    range.current = current && editor.current?.contains(current.commonAncestorContainer) ? current.cloneRange() : null;
  };
  const insert = () => {
    if (!valid) return;
    editor.current?.focus();
    const selection = window.getSelection();
    if (selection && range.current) {
      selection.removeAllRanges();
      selection.addRange(range.current);
    }
    onInsert(url);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          remember();
          setUrl("https://");
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Tautan" onMouseDown={(e) => e.preventDefault()}>
          <Link2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            insert();
          }}
          className="space-y-2"
        >
          <label htmlFor="rich-link-url" className="text-sm font-medium">
            URL tautan
          </label>
          <Input id="rich-link-url" type="url" inputMode="url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={!valid}>
              Sisipkan
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
