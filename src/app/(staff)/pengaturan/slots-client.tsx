"use client";

import { MoreVertical, Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
import { ConflictList, isBookingRefs } from "@/components/common/conflict-list";
import { Field } from "@/components/common/field";
import { TimeSelect } from "@/components/common/time-select";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { createSlot, setSlotActive, updateSlot } from "@/server/settings-actions";

type Slot = { id: string; startTime: string; endTime: string; isActive: boolean };
const ss = t.settings.slots;

export function SlotDialogButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {ss.add}
      </Button>
      <SlotDialog open={open} onOpenChange={setOpen} slot={null} upcoming={0} />
    </>
  );
}

function SlotDialog({
  open,
  onOpenChange,
  slot,
  upcoming,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slot: Slot | null;
  upcoming: number;
}) {
  const [startTime, setStart] = useState(slot?.startTime ?? "");
  const [endTime, setEnd] = useState(slot?.endTime ?? "");
  const opts = { successMessage: ss.saved, onSuccess: () => onOpenChange(false) };
  const create = useAction(createSlot, opts);
  const update = useAction(updateSlot, opts);
  const action = slot ? update : create;
  const locked = slot !== null && upcoming > 0; // BR-04-2

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={slot ? ss.edit : ss.add}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            pending={action.pending}
            disabled={locked}
            onClick={() => (slot ? update.run({ id: slot.id, startTime, endTime }) : create.run({ startTime, endTime }))}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {locked && (
          <Alert variant="warning">
            <AlertDescription>{ss.locked(upcoming)}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field id="slot-start" label={ss.start} required error={action.fieldErrors.startTime}>
            <TimeSelect id="slot-start" label={ss.start} minuteStep={15} minHour={6} maxHour={21} value={startTime} disabled={locked} onChange={setStart} invalid={Boolean(action.fieldErrors.startTime)} />
          </Field>
          <Field id="slot-end" label={ss.end} required error={action.fieldErrors.endTime}>
            <TimeSelect id="slot-end" label={ss.end} minuteStep={15} minHour={6} maxHour={21} value={endTime} disabled={locked} onChange={setEnd} invalid={Boolean(action.fieldErrors.endTime)} />
          </Field>
        </div>
        {action.failure?.code === "CONFLICT" && isBookingRefs(action.failure.details) && (
          <ConflictList conflicts={action.failure.details} />
        )}
      </div>
    </ResponsiveDialog>
  );
}

export function SlotActions({ slot, upcoming }: { slot: Slot; upcoming: number }) {
  const [editOpen, setEditOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const toggle = useAction(setSlotActive, {
    successMessage: ss.saved,
    quiet: ["CONFLICT"],
    onError: (f) => f.code === "CONFLICT" && setConflictOpen(true),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            {t.common.edit}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toggle.run({ id: slot.id, isActive: !slot.isActive })}>
            <Power />
            {slot.isActive ? t.common.deactivate : t.common.activate}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editOpen && <SlotDialog open={editOpen} onOpenChange={setEditOpen} slot={slot} upcoming={upcoming} />}
      <ResponsiveDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        title={t.conflicts.title}
        description={toggle.failure?.error}
        footer={<Button onClick={() => setConflictOpen(false)}>{t.common.close}</Button>}
      >
        {isBookingRefs(toggle.failure?.details) && <ConflictList conflicts={toggle.failure.details} />}
      </ResponsiveDialog>
    </>
  );
}
