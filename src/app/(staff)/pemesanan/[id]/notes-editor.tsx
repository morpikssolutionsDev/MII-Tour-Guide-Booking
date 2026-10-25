"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { updateBookingNotes } from "@/server/bookings/actions";

/** Inline edit (pencil → textarea → "Simpan"), BR-05-16. */
export function NotesEditor({
  bookingId,
  field,
  label,
  value,
  editable,
}: {
  bookingId: string;
  field: "specialNeeds" | "internalNotes";
  label: string;
  value: string | null;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const save = useAction(updateBookingNotes, { successMessage: t.booking.detail.notesSaved, onSuccess: () => setEditing(false) });
  const id = `notes-${field}`;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-label`} className="text-sm font-semibold">
          {label}
        </h3>
        {editable && !editing && (
          <Button variant="ghost" size="xs" onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
            <Pencil />
            {t.booking.detail.editNotes}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea id={id} aria-labelledby={`${id}-label`} maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              {t.common.cancel}
            </Button>
            <Button size="sm" pending={save.pending} onClick={() => save.run({ id: bookingId, field, value: draft })}>
              {t.common.save}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{value || t.booking.detail.none}</p>
      )}
    </div>
  );
}
