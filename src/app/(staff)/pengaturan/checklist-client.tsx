"use client";

import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Pill } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import {
  createChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  updateChecklistItem,
} from "@/server/settings-actions";

type Item = { id: string; label: string; description: string | null; system: boolean };
const sc = t.settings.checklist;

/** Ordered list with keyboard-accessible "Naikkan"/"Turunkan" reordering (04 §3.3). */
export function ChecklistEditor({ items }: { items: Item[] }) {
  const [order, setOrder] = useState(items);
  const [synced, setSynced] = useState(items);
  if (items !== synced) {
    setSynced(items);
    setOrder(items);
  }
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const reorder = useAction(reorderChecklistItems);
  const remove = useAction(deleteChecklistItem, { successMessage: sc.saved, onSuccess: () => setDeleting(null) });

  const move = (index: number, delta: number) => {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setOrder(next);
    reorder.run({ ids: next.map((i) => i.id) });
  };

  return (
    <>
      <ol className="divide-y rounded-lg border bg-card shadow-card">
        {order.map((item, index) => (
          <li key={item.id} className="flex items-start gap-3 p-4">
            <span className="mt-0.5 w-5 text-sm font-semibold text-muted-foreground tabular">{index + 1}.</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {item.label}
                {item.system && (
                  <Pill tone="kabut" icon={Lock}>
                    {sc.system}
                  </Pill>
                )}
              </p>
              {item.description && <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`${sc.moveUp}: ${item.label}`} disabled={index === 0 || reorder.pending} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`${sc.moveDown}: ${item.label}`} disabled={index === order.length - 1 || reorder.pending} onClick={() => move(index, 1)}>
                <ArrowDown />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`${t.common.edit}: ${item.label}`} onClick={() => setEditing(item)}>
                <Pencil />
              </Button>
              {!item.system && (
                <Button variant="ghost" size="icon-sm" className="text-merah-700" aria-label={`${t.common.delete}: ${item.label}`} onClick={() => setDeleting(item)}>
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Button variant="secondary" onClick={() => setEditing("new")}>
        <Plus />
        {sc.add}
      </Button>
      {editing && <ItemDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={deleting ? sc.deleteConfirm(deleting.label) : ""}
        confirmLabel={`Ya, ${t.common.delete.toLowerCase()}`}
        pending={remove.pending}
        onConfirm={() => deleting && remove.run({ id: deleting.id })}
      />
    </>
  );
}

function ItemDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const opts = { successMessage: sc.saved, onSuccess: onClose };
  const create = useAction(createChecklistItem, opts);
  const update = useAction(updateChecklistItem, opts);
  const action = item ? update : create;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={item ? sc.edit : sc.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button pending={action.pending} onClick={() => (item ? update.run({ id: item.id, label, description }) : create.run({ label, description }))}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="item-label" label={sc.label} required error={action.fieldErrors.label}>
          <Input id="item-label" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} {...fieldAria("item-label", action.fieldErrors.label)} />
        </Field>
        <Field id="item-desc" label={sc.description} error={action.fieldErrors.description}>
          <Textarea id="item-desc" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
