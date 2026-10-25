"use client";

import { CalendarDays, ChevronLeft, ChevronRight, MoreVertical, Pencil, Plus, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { InactiveBadge, Pill } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DatePicker } from "@/components/common/date-picker";
import { EmptyState } from "@/components/common/empty-state";
import { Field, fieldAria } from "@/components/common/field";
import { MoneyInput } from "@/components/common/money-input";
import { NumberStepper } from "@/components/common/number-stepper";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { FACILITY_ICONS, facilityIcon } from "@/lib/facility-icons";
import { formatDateLong, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deleteHoliday,
  saveAddon,
  saveFacility,
  saveHoliday,
  savePackage,
  setAddonActive,
  setFacilityActive,
  setPackageActive,
  updatePriceRule,
} from "@/server/pricing/actions";

const sp = t.pricing;

type Facility = { id: string; name: string; icon: string; sortOrder: number; isActive: boolean; usedIn: string[] };
type Addon = { id: string; name: string; description: string | null; price: number; unit: "per_booking" | "per_person"; sortOrder: number; isActive: boolean; includedIn: string[] };
type Package = {
  id: string;
  name: string;
  description: string | null;
  pricePerGuide: number;
  maxPeoplePerGuide: number;
  sortOrder: number;
  isActive: boolean;
  facilities: { id: string; name: string; icon: string; isActive: boolean }[];
  includedAddons: { id: string; name: string; isActive: boolean }[];
};
type Rule = { id: string; type: "weekend" | "holiday"; name: string; kind: "percent" | "flat_per_guide"; value: number; isActive: boolean };
type Holiday = { id: string; date: string; name: string };

function RowMenu({ onEdit, isActive, onToggle }: { onEdit: () => void; isActive: boolean; onToggle: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          {t.common.edit}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggle}>
          <Power />
          {isActive ? t.common.deactivate : t.common.activate}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const unitLabel = (unit: Addon["unit"]) => sp.unit[unit];

/* ---------------- Paket ---------------- */

export function PackagesTab({ canEdit, packages, facilities, addons }: { canEdit: boolean; packages: Package[]; facilities: Facility[]; addons: Addon[] }) {
  const [editing, setEditing] = useState<Package | "new" | null>(null);
  const toggle = useAction(setPackageActive, { successMessage: sp.packages.saved });
  return (
    <section className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {sp.packages.add}
          </Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => (
          <PackageCard key={p.id} pkg={p} action={canEdit && <RowMenu isActive={p.isActive} onEdit={() => setEditing(p)} onToggle={() => toggle.run({ id: p.id, isActive: !p.isActive })} />} />
        ))}
      </div>
      {editing && <PackageDialog pkg={editing === "new" ? null : editing} facilities={facilities} addons={addons} nextOrder={packages.length} onClose={() => setEditing(null)} />}
    </section>
  );
}

export function PackageCard({ pkg, action, className }: { pkg: Pick<Package, "name" | "description" | "pricePerGuide" | "maxPeoplePerGuide" | "isActive" | "facilities" | "includedAddons">; action?: React.ReactNode; className?: string }) {
  return (
    <article className={cn("flex flex-col rounded-lg border bg-card p-5 shadow-card", !pkg.isActive && "opacity-80", className)}>
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-lg font-semibold">{pkg.name}</h3>
        {!pkg.isActive && <InactiveBadge />}
        {action}
      </div>
      <p className="mt-2 text-kpi font-bold tabular">
        {formatRupiah(pkg.pricePerGuide)} <span className="text-sm font-medium text-muted-foreground">{sp.perGuide}</span>
      </p>
      <p className="text-xs font-medium text-muted-foreground">{sp.maxPerGuide(pkg.maxPeoplePerGuide)}</p>
      {pkg.description && <p className="mt-3 text-sm">{pkg.description}</p>}
      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">{sp.includes}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {pkg.facilities.filter((f) => f.isActive).map((f) => {
            const Icon = facilityIcon(f.icon);
            return (
              <li key={f.id}>
                <Pill tone="danau" icon={Icon}>
                  {f.name}
                </Pill>
              </li>
            );
          })}
          {pkg.includedAddons.filter((a) => a.isActive).map((a) => (
            <li key={a.id}>
              <Pill tone="senja">{a.name}</Pill>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function PackageDialog({ pkg, facilities, addons, nextOrder, onClose }: { pkg: Package | null; facilities: Facility[]; addons: Addon[]; nextOrder: number; onClose: () => void }) {
  const [name, setName] = useState(pkg?.name ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [price, setPrice] = useState<number | null>(pkg?.pricePerGuide ?? null);
  const [max, setMax] = useState(String(pkg?.maxPeoplePerGuide ?? 8));
  const [facilityIds, setFacilityIds] = useState(pkg?.facilities.map((f) => f.id) ?? []);
  const [addonIds, setAddonIds] = useState(pkg?.includedAddons.map((a) => a.id) ?? []);
  const [sortOrder, setSortOrder] = useState(String(pkg?.sortOrder ?? nextOrder));
  const save = useAction(savePackage, { successMessage: sp.packages.saved, onSuccess: onClose });
  const e = save.fieldErrors;
  const toggleIn = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

  return (
    <ResponsiveDialog
      open
      wide
      onOpenChange={(v) => !v && onClose()}
      title={pkg ? sp.packages.edit : sp.packages.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            pending={save.pending}
            onClick={() =>
              save.run({
                id: pkg?.id,
                name,
                description,
                pricePerGuide: price ?? -1,
                maxPeoplePerGuide: Number(max),
                facilityIds,
                includedAddonIds: addonIds,
                sortOrder: Number(sortOrder) || 0,
              })
            }
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="pkg-name" label={sp.packages.name} required error={e.name}>
          <Input id="pkg-name" maxLength={40} value={name} onChange={(ev) => setName(ev.target.value)} {...fieldAria("pkg-name", e.name)} />
        </Field>
        <Field id="pkg-order" label={sp.packages.sortOrder} error={e.sortOrder}>
          <NumberStepper id="pkg-order" min={0} max={999} value={sortOrder === "" ? null : Number(sortOrder)} onChange={(v) => setSortOrder(v === null ? "" : String(v))} />
        </Field>
        <Field id="pkg-desc" label={sp.packages.description} error={e.description} className="md:col-span-2">
          <Textarea id="pkg-desc" maxLength={160} value={description} onChange={(ev) => setDescription(ev.target.value)} />
        </Field>
        <Field id="pkg-price" label={sp.packages.price} required error={e.pricePerGuide ? t.errors.validation : undefined}>
          <MoneyInput id="pkg-price" value={price} onChange={setPrice} {...fieldAria("pkg-price", e.pricePerGuide)} />
        </Field>
        <Field id="pkg-max" label={sp.packages.maxPeople} required error={e.maxPeoplePerGuide ? "1–50" : undefined}>
          <NumberStepper id="pkg-max" min={1} max={50} value={max === "" ? null : Number(max)} onChange={(v) => setMax(v === null ? "" : String(v))} invalid={Boolean(e.maxPeoplePerGuide)} unit="orang" />
        </Field>
        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-sm font-medium">{sp.packages.facilities}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {facilities.filter((f) => f.isActive || facilityIds.includes(f.id)).map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <Checkbox id={`fac-${f.id}`} checked={facilityIds.includes(f.id)} onCheckedChange={(v) => setFacilityIds((l) => toggleIn(l, f.id, Boolean(v)))} />
                <Label htmlFor={`fac-${f.id}`}>{f.name}</Label>
              </div>
            ))}
          </div>
        </fieldset>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">{sp.packages.includedAddons}</legend>
          <p className="mb-2 text-xs text-muted-foreground">{sp.packages.includedAddonsHelp}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {addons.filter((a) => a.isActive || addonIds.includes(a.id)).map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <Checkbox id={`inc-${a.id}`} checked={addonIds.includes(a.id)} onCheckedChange={(v) => setAddonIds((l) => toggleIn(l, a.id, Boolean(v)))} />
                <Label htmlFor={`inc-${a.id}`}>{a.name}</Label>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{sp.packages.preview}</p>
          <PackageCard
            pkg={{
              name: name || sp.packages.name,
              description,
              pricePerGuide: price ?? 0,
              maxPeoplePerGuide: Number(max) || 1,
              isActive: true,
              facilities: facilities.filter((f) => facilityIds.includes(f.id)),
              includedAddons: addons.filter((a) => addonIds.includes(a.id)),
            }}
            className="shadow-none"
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}

/* ---------------- Add-on ---------------- */

export function AddonsTab({ canEdit, addons }: { canEdit: boolean; addons: Addon[] }) {
  const [editing, setEditing] = useState<Addon | "new" | null>(null);
  const toggle = useAction(setAddonActive, { successMessage: sp.addons.saved });
  return (
    <section className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {sp.addons.add}
          </Button>
        </div>
      )}
      <ul className="divide-y rounded-lg border bg-card shadow-card">
        {addons.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.name}</p>
              {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
              {a.includedIn.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {sp.addons.colIncludedIn}: {a.includedIn.join(", ")}
                </p>
              )}
            </div>
            <p className="font-semibold tabular">
              {formatRupiah(a.price)} <span className="text-sm font-normal text-muted-foreground">/ {unitLabel(a.unit)}</span>
            </p>
            {!a.isActive && <InactiveBadge />}
            {canEdit && <RowMenu isActive={a.isActive} onEdit={() => setEditing(a)} onToggle={() => toggle.run({ id: a.id, isActive: !a.isActive })} />}
          </li>
        ))}
      </ul>
      {editing && <AddonDialog addon={editing === "new" ? null : editing} nextOrder={addons.length} onClose={() => setEditing(null)} />}
    </section>
  );
}

function AddonDialog({ addon, nextOrder, onClose }: { addon: Addon | null; nextOrder: number; onClose: () => void }) {
  const [name, setName] = useState(addon?.name ?? "");
  const [description, setDescription] = useState(addon?.description ?? "");
  const [price, setPrice] = useState<number | null>(addon?.price ?? null);
  const [unit, setUnit] = useState<Addon["unit"]>(addon?.unit ?? "per_booking");
  const [sortOrder, setSortOrder] = useState(String(addon?.sortOrder ?? nextOrder));
  const save = useAction(saveAddon, { successMessage: sp.addons.saved, onSuccess: onClose });
  const e = save.fieldErrors;
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={addon ? sp.addons.edit : sp.addons.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button pending={save.pending} onClick={() => save.run({ id: addon?.id, name, description, price: price ?? -1, unit, sortOrder: Number(sortOrder) || 0 })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="ad-name" label={sp.addons.name} required error={e.name}>
          <Input id="ad-name" maxLength={40} value={name} onChange={(ev) => setName(ev.target.value)} {...fieldAria("ad-name", e.name)} />
        </Field>
        <Field id="ad-desc" label={sp.addons.description}>
          <Textarea id="ad-desc" maxLength={160} value={description} onChange={(ev) => setDescription(ev.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="ad-price" label={sp.addons.price} required error={e.price ? t.errors.validation : undefined}>
            <MoneyInput id="ad-price" value={price} onChange={setPrice} {...fieldAria("ad-price", e.price)} />
          </Field>
          <Field id="ad-order" label={sp.packages.sortOrder}>
            <NumberStepper id="ad-order" min={0} max={999} value={sortOrder === "" ? null : Number(sortOrder)} onChange={(v) => setSortOrder(v === null ? "" : String(v))} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {sp.addons.unit} <span aria-hidden>*</span>
          </legend>
          <RadioGroup value={unit} onValueChange={(v) => setUnit(v as Addon["unit"])} className="flex gap-6">
            {(["per_booking", "per_person"] as const).map((u) => (
              <div key={u} className="flex items-center gap-2">
                <RadioGroupItem id={`unit-${u}`} value={u} />
                <Label htmlFor={`unit-${u}`}>{sp.unitLabel[u]}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
      </div>
    </ResponsiveDialog>
  );
}

/* ---------------- Fasilitas ---------------- */

export function FacilitiesTab({ canEdit, facilities }: { canEdit: boolean; facilities: Facility[] }) {
  const [editing, setEditing] = useState<Facility | "new" | null>(null);
  const toggle = useAction(setFacilityActive, { successMessage: sp.facilities.saved });
  return (
    <section className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {sp.facilities.add}
          </Button>
        </div>
      )}
      <ul className="divide-y rounded-lg border bg-card shadow-card">
        {facilities.map((f) => {
          const Icon = facilityIcon(f.icon);
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-danau-50 text-danau-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {sp.facilities.usedIn}: {f.usedIn.length ? f.usedIn.join(", ") : t.common.none}
                </p>
              </div>
              {!f.isActive && <InactiveBadge />}
              {canEdit && <RowMenu isActive={f.isActive} onEdit={() => setEditing(f)} onToggle={() => toggle.run({ id: f.id, isActive: !f.isActive })} />}
            </li>
          );
        })}
      </ul>
      {editing && <FacilityDialog facility={editing === "new" ? null : editing} nextOrder={facilities.length} onClose={() => setEditing(null)} />}
    </section>
  );
}

function FacilityDialog({ facility, nextOrder, onClose }: { facility: Facility | null; nextOrder: number; onClose: () => void }) {
  const [name, setName] = useState(facility?.name ?? "");
  const [icon, setIcon] = useState(facility?.icon ?? "Gift");
  const save = useAction(saveFacility, { successMessage: sp.facilities.saved, onSuccess: onClose });
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={facility ? sp.facilities.edit : sp.facilities.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button pending={save.pending} onClick={() => save.run({ id: facility?.id, name, icon: icon as (typeof FACILITY_ICONS)[number], sortOrder: facility?.sortOrder ?? nextOrder })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="fac-name" label={sp.facilities.name} required error={save.fieldErrors.name}>
          <Input id="fac-name" maxLength={40} value={name} onChange={(ev) => setName(ev.target.value)} {...fieldAria("fac-name", save.fieldErrors.name)} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {sp.facilities.icon} <span aria-hidden>*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {FACILITY_ICONS.map((name) => {
              const Icon = facilityIcon(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={icon === name}
                  aria-label={name}
                  onClick={() => setIcon(name)}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-md border",
                    icon === name ? "border-danau-700 bg-danau-50 text-danau-800" : "border-input-border bg-card",
                  )}
                >
                  <Icon className="size-5" />
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </ResponsiveDialog>
  );
}

/* ---------------- Aturan Harga ---------------- */

export function RulesTab({ canEdit, rules }: { canEdit: boolean; rules: Rule[] }) {
  const [editing, setEditing] = useState<Rule | null>(null);
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{sp.rules.caption}</p>
      <ul className="divide-y rounded-lg border bg-card shadow-card">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{sp.rules.when[r.type]}</p>
            </div>
            <p className="text-lg font-bold tabular">{r.kind === "percent" ? `+${r.value}%` : `+${formatRupiah(r.value)} / guide`}</p>
            {!r.isActive && <InactiveBadge />}
            {canEdit && (
              <Button variant="ghost" size="icon-sm" aria-label={`${t.common.edit}: ${r.name}`} onClick={() => setEditing(r)}>
                <Pencil />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editing && <RuleDialog rule={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function RuleDialog({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const [kind, setKind] = useState(rule.kind);
  const [value, setValue] = useState<number | null>(rule.value);
  const [isActive, setIsActive] = useState(rule.isActive);
  const save = useAction(updatePriceRule, { successMessage: sp.rules.saved, onSuccess: onClose });
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${sp.rules.edit}: ${rule.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button pending={save.pending} onClick={() => save.run({ id: rule.id, kind, value: value ?? -1, isActive })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{sp.rules.kind}</legend>
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as Rule["kind"])} className="flex flex-wrap gap-6">
            {(["percent", "flat_per_guide"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <RadioGroupItem id={`kind-${k}`} value={k} />
                <Label htmlFor={`kind-${k}`}>{sp.rules.kinds[k]}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        <Field id="rule-value" label={sp.rules.value} required error={save.fieldErrors.value}>
          {kind === "percent" ? (
            <NumberStepper id="rule-value" min={0} max={100} step={5} value={value} onChange={setValue} unit="%" invalid={Boolean(save.fieldErrors.value)} />
          ) : (
            <MoneyInput id="rule-value" value={value} onChange={setValue} className="max-w-56" />
          )}
        </Field>
        <div className="flex items-center gap-3">
          <Switch id="rule-active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="rule-active">{sp.rules.active}</Label>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

/* ---------------- Hari Libur ---------------- */

export function HolidaysTab({ canEdit, year, currentYear, holidays }: { canEdit: boolean; year: number; currentYear: number; holidays: Holiday[] }) {
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const remove = useAction(deleteHoliday, { successMessage: sp.holidays.deleted, onSuccess: () => setDeleting(null) });
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild aria-label={String(year - 1)}>
            <Link href={`/harga?tab=libur&tahun=${year - 1}`} scroll={false}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-16 text-center font-semibold tabular">{year}</span>
          <Button variant="ghost" size="icon-sm" asChild aria-label={String(year + 1)}>
            <Link href={`/harga?tab=libur&tahun=${year + 1}`} scroll={false}>
              <ChevronRight />
            </Link>
          </Button>
          {year !== currentYear && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/harga?tab=libur" scroll={false}>
                {currentYear}
              </Link>
            </Button>
          )}
        </div>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {sp.holidays.add}
          </Button>
        )}
      </div>
      {holidays.length === 0 ? (
        <EmptyState title={sp.holidays.empty} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-card">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center gap-3 p-4">
              <CalendarDays className="size-5 shrink-0 text-senja-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{formatDateLong(h.date)}</p>
                <p className="text-sm text-muted-foreground">{h.name}</p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`${t.common.edit}: ${h.name}`} onClick={() => setEditing(h)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-merah-700" aria-label={`${t.common.delete}: ${h.name}`} onClick={() => setDeleting(h)}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <HolidayDialog holiday={editing === "new" ? null : editing} defaultDate={`${year}-01-01`} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={deleting ? sp.holidays.deleteConfirm(deleting.name) : ""}
        body={sp.holidays.deleteBody}
        confirmLabel={`Ya, ${t.common.delete.toLowerCase()}`}
        pending={remove.pending}
        onConfirm={() => deleting && remove.run({ id: deleting.id })}
      />
    </section>
  );
}

function HolidayDialog({ holiday, defaultDate, onClose }: { holiday: Holiday | null; defaultDate: string; onClose: () => void }) {
  const [date, setDate] = useState(holiday?.date ?? defaultDate);
  const [name, setName] = useState(holiday?.name ?? "");
  const save = useAction(saveHoliday, { successMessage: sp.holidays.saved, onSuccess: onClose });
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={holiday ? sp.holidays.edit : sp.holidays.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button pending={save.pending} onClick={() => save.run({ id: holiday?.id, date, name })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="hol-date" label={sp.holidays.date} required error={save.fieldErrors.date}>
          <DatePicker id="hol-date" value={date} onChange={setDate} invalid={Boolean(save.fieldErrors.date)} />
        </Field>
        <Field id="hol-name" label={sp.holidays.name} required error={save.fieldErrors.name}>
          <Input id="hol-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} {...fieldAria("hol-name", save.fieldErrors.name)} />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
