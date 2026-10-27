"use client";

import { ArrowLeft, ArrowRight, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { PriceSummary } from "@/components/common/price-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { Channel } from "@/db/schema";
import { normalizePhone } from "@/domain/phone";
import { calculatePrice, type PriceSnapshot } from "@/domain/pricing";
import { useKeyedResource } from "@/hooks/use-keyed-resource";
import { t } from "@/i18n/id";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import {
  checkAvailability,
  checkAvailabilityRange,
  createBooking,
  findCustomerByPhone,
  rankGuides,
  rescheduleBooking,
} from "@/server/bookings/actions";
import { StepCustomer, type CustomerLookup } from "./step-customer";
import { StepGuides } from "./step-guides";
import { StepReview } from "./step-review";
import { StepSchedule } from "./step-schedule";
import type { CandidateView, CustomerForm, RescheduleContext, ScheduleForm, SlotView, WizardConfigView } from "./types";

const sw = t.booking.wizard;
const DRAFT_KEY = "tmii.booking-draft";

type Prefill = {
  date: string | null;
  slotId: string | null;
  guide: { id: string; name: string } | null;
  people: number | null;
  packageId: string | null;
  addonIds: string[];
  customer: { phone: string; name: string; nationality: string; email: string; notes: string; visits: number } | null;
  groupFrom: { id: string; code: string } | null;
  languageId: string | null;
};

type Draft = { customer: CustomerForm; channel: Channel; schedule: ScheduleForm; internalNotes: string };

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) {
    toast.error(result.error);
    throw new Error(result.error);
  }
  return result.data;
}

/** 05 §3.2 wizard (create) and §3.4 reschedule (steps 2–4 only). */
export function BookingWizard({
  config,
  defaultChannel,
  prefill,
  reschedule,
}: {
  config: WizardConfigView;
  defaultChannel: Channel;
  prefill?: Prefill;
  reschedule?: RescheduleContext;
}) {
  const router = useRouter();
  const isReschedule = Boolean(reschedule);
  const steps = isReschedule ? (["schedule", "guides", "review"] as const) : (["customer", "schedule", "guides", "review"] as const);
  const stepLabels = isReschedule ? sw.steps.slice(1) : sw.steps;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [customer, setCustomer] = useState<CustomerForm>({
    phone: prefill?.customer?.phone ?? "",
    name: prefill?.customer?.name ?? "",
    nationality: prefill?.customer?.nationality ?? "",
    email: prefill?.customer?.email ?? "",
    notes: prefill?.customer?.notes ?? "",
  });
  const [lookup, setLookup] = useState<CustomerLookup | null>(
    prefill?.customer ? { visits: prefill.customer.visits, lastVisit: null, name: prefill.customer.name, applied: true } : null,
  );
  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [schedule, setSchedule] = useState<ScheduleForm>(() =>
    reschedule
      ? {
          languageId: reschedule.before.languageId,
          people: reschedule.before.people,
          packageId: reschedule.before.packageId,
          date: reschedule.before.date,
          slotId: reschedule.before.slotId,
          addonIds: reschedule.before.snapshot.addons.filter((a) => !a.included).map((a) => a.id),
          specialNeeds: "",
        }
      : {
          languageId: prefill?.languageId ?? config.languages[0]?.id ?? "",
          people: prefill?.people ?? 2,
          packageId: prefill?.packageId ?? config.packages[0]?.id ?? "",
          date: prefill?.date ?? null,
          slotId: prefill?.slotId ?? null,
          addonIds: prefill?.addonIds ?? [],
          specialNeeds: prefill?.customer?.notes ?? "",
        },
  );
  const [selectedGuides, setSelectedGuides] = useState<string[]>([]);
  const [internalNotes, setInternalNotes] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const [dirty, setDirty] = useState(false);

  const pkg = config.packages.find((p) => p.id === schedule.packageId);
  const language = config.languages.find((l) => l.id === schedule.languageId);
  const guidesNeeded = pkg ? Math.ceil(Math.max(1, schedule.people) / pkg.maxPeoplePerGuide) : 1;

  /* ----- live price (same calculatePrice as the server) ----- */
  const snapshot: PriceSnapshot | null = useMemo(() => {
    if (!pkg || !schedule.date || schedule.people < 1 || schedule.people > 200) return null;
    return calculatePrice({
      date: schedule.date,
      people: schedule.people,
      pkg,
      selectedAddonIds: schedule.addonIds,
      addons: config.addons,
      rules: config.rules,
      holidays: config.holidays,
    });
  }, [pkg, schedule.date, schedule.people, schedule.addonIds, config]);

  /* ----- availability (BR-05-3, debounced 300 ms) ----- */
  const query = {
    date: schedule.date ?? "",
    languageId: schedule.languageId,
    people: schedule.people,
    packageId: schedule.packageId,
    excludeBookingId: reschedule?.bookingId,
  };
  const availabilityKey =
    schedule.date && schedule.languageId && schedule.packageId && schedule.people >= 1 && schedule.people <= 200
      ? JSON.stringify([query, refresh])
      : null;
  const availability = useKeyedResource(availabilityKey, async () => unwrap(await checkAvailability(query)), 300);
  const strip = useKeyedResource(availabilityKey, async () => unwrap(await checkAvailabilityRange(query)), 300);
  const slots: SlotView[] | null = availability.data?.slots ?? null;
  const selectedSlot = slots?.find((s) => s.slotId === schedule.slotId && s.available) ?? null;

  /* ----- guide ranking (BR-05-6) when on the guides step ----- */
  const rankKey = (step === "guides" || step === "review") && selectedSlot ? JSON.stringify([query, schedule.slotId, refresh]) : null;
  const ranking = useKeyedResource(rankKey, async () => {
    const data = unwrap(await rankGuides({ ...query, slotId: schedule.slotId! }));
    // Pre-select: current guides when rescheduling, a guide picked on Papan Jadwal, then the ranking.
    const eligible = data.candidates.map((c) => c.guideId);
    const preferred = [...(reschedule?.before.guideIds ?? []), ...(prefill?.guide ? [prefill.guide.id] : [])].filter((id) => eligible.includes(id));
    const pick = [...new Set([...preferred, ...eligible])].slice(0, data.guidesNeeded);
    setSelectedGuides(pick);
    return data;
  });
  const candidates: CandidateView[] | null = ranking.data?.candidates ?? null;
  const missingPrefillGuide = prefill?.guide && candidates && !candidates.some((c) => c.guideId === prefill.guide!.id) ? prefill.guide.name : null;

  /* ----- draft (sessionStorage, create mode only) ----- */
  const savedDraft = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return isReschedule ? null : sessionStorage.getItem(DRAFT_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const hasPrefill = Boolean(prefill && (prefill.date || prefill.customer || prefill.packageId));
  const [draftDismissed, setDraftDismissed] = useState(false);
  useEffect(() => {
    if (isReschedule || !dirty) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ customer, channel, schedule, internalNotes } satisfies Draft));
    } catch {
      /* storage blocked */
    }
  }, [customer, channel, schedule, internalNotes, dirty, isReschedule]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const restoreDraft = () => {
    try {
      const draft = JSON.parse(savedDraft ?? "") as Draft;
      setCustomer(draft.customer);
      setChannel(draft.channel);
      setSchedule(draft.schedule);
      setInternalNotes(draft.internalNotes);
      setDirty(true);
    } catch {
      /* corrupt draft */
    }
    setDraftDismissed(true);
  };
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  /* ----- setters that mark the form dirty ----- */
  const updateCustomer = (patch: Partial<CustomerForm>) => {
    setDirty(true);
    setCustomer((c) => ({ ...c, ...patch }));
  };
  const updateSchedule = (patch: Partial<ScheduleForm>) => {
    setDirty(true);
    setSchedule((s) => ({ ...s, ...patch }));
  };

  const lookupPhone = async () => {
    if (!normalizePhone(customer.phone)) return;
    const result = await findCustomerByPhone({ phone: customer.phone });
    if (result.ok && result.data.customer) {
      const c = result.data.customer;
      setLookup({ visits: c.visits, lastVisit: c.lastVisit, name: c.name, applied: false, data: c });
    } else {
      setLookup(null);
    }
  };

  /* ----- step validation (the server validates again) ----- */
  const validate = (target: (typeof steps)[number]): Record<string, string> => {
    const e: Record<string, string> = {};
    if (target === "customer") {
      if (!normalizePhone(customer.phone)) e["customer.phone"] = sw.customer.phoneInvalid;
      if (customer.name.trim().length < 2) e["customer.name"] = t.users.nameLength;
      if (!customer.nationality) e["customer.nationality"] = t.common.required;
      if (customer.email && !/^\S+@\S+\.\S+$/.test(customer.email)) e["customer.email"] = t.users.emailInvalid;
    }
    if (target === "schedule") {
      if (!schedule.languageId) e.languageId = t.common.required;
      if (!(schedule.people >= 1 && schedule.people <= 200)) e.people = "1–200";
      if (!schedule.packageId) e.packageId = t.common.required;
      if (!schedule.date) e.date = t.common.required;
      else if (!selectedSlot) e.slotId = t.common.required;
    }
    if (target === "guides" && selectedGuides.length !== guidesNeeded) e.guideIds = sw.guides.pickExactly(guidesNeeded);
    if (target === "review" && isReschedule && !reason.trim()) e.reason = t.common.required;
    return e;
  };

  const goNext = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const indexOf = (name: string) => (steps as readonly string[]).indexOf(name);
  const stepOfField = (field: string) => {
    if (field.startsWith("customer.")) return indexOf("customer");
    if (["languageId", "people", "packageId", "date", "slotId", "addonIds", "specialNeeds"].includes(field)) return indexOf("schedule");
    if (field === "guideIds") return indexOf("guides");
    return steps.length - 1;
  };

  const submit = () => {
    const e = validate("review");
    setErrors(e);
    if (Object.keys(e).length) return;
    const scheduleInput = {
      languageId: schedule.languageId,
      people: schedule.people,
      packageId: schedule.packageId,
      date: schedule.date!,
      slotId: schedule.slotId!,
      guideIds: selectedGuides,
      addonIds: schedule.addonIds.filter((id) => !pkg?.includedAddonIds.includes(id)),
      specialNeeds: schedule.specialNeeds,
    };
    startSubmit(async () => {
      const result = reschedule
        ? await rescheduleBooking({ id: reschedule.bookingId, ...scheduleInput, reason })
        : await createBooking({ customer, channel, ...scheduleInput, internalNotes, groupFrom: prefill?.groupFrom?.id });
      if (result.ok) {
        setDirty(false);
        clearDraft();
        if (reschedule) {
          toast.success(t.booking.reschedule.saved);
          router.push(`/pemesanan/${reschedule.bookingId}`);
        } else {
          const data = result.data as { id: string; code: string; confirmed: boolean };
          // 12 §3.4: without payment confirmation the booking is done; show the splash.
          if (data.confirmed) {
            router.push(`/pemesanan/${data.id}/dibuat`);
          } else {
            toast.success(sw.created(data.code));
            router.push(`/pemesanan/${data.id}?baru=1`);
          }
        }
        return;
      }
      if (result.code === "UNAUTHENTICATED") {
        router.push("/keluar?alasan=sesi");
        return;
      }
      toast.error(result.error);
      const fieldErrors = result.fieldErrors ?? {};
      setErrors(fieldErrors);
      const first = Object.keys(fieldErrors)[0];
      if (result.code === "CONFLICT") {
        // BR-05-9: someone booked the guide meanwhile; reload the ranking.
        setRefresh((r) => r + 1);
        setStepIndex(indexOf("guides"));
      } else if (first) {
        setStepIndex(Math.max(0, stepOfField(first)));
      }
    });
  };

  const isLast = stepIndex === steps.length - 1;
  const total = snapshot?.total ?? null;
  const priceDiff = reschedule && snapshot && reschedule.hasPayments ? snapshot.total - reschedule.before.snapshot.total : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <ol className="flex gap-1 overflow-x-auto" aria-label="Langkah">
          {stepLabels.map((label, i) => (
            <li key={label} className="flex-1">
              <span
                aria-current={i === stepIndex ? "step" : undefined}
                className={cn(
                  "flex min-w-24 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
                  i === stepIndex ? "border-danau-700 bg-danau-50 text-danau-800" : i < stepIndex ? "bg-card text-foreground" : "bg-card text-muted-foreground",
                )}
              >
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem]", i <= stepIndex ? "bg-danau-700 text-white" : "bg-kabut-100")}>
                  {i + 1}
                </span>
                {label}
              </span>
            </li>
          ))}
        </ol>

        {!isReschedule && savedDraft && !hasPrefill && !draftDismissed && !dirty && (
          <Alert variant="info">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              Draf pemesanan sebelumnya ditemukan.
              <Button size="xs" variant="secondary" onClick={restoreDraft}>
                Pulihkan
              </Button>
              <Button size="xs" variant="ghost" onClick={() => { clearDraft(); setDraftDismissed(true); }}>
                Buang
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {prefill?.groupFrom && (
          <Alert variant="info">
            <AlertDescription>
              {t.booking.linked}: {prefill.groupFrom.code}
            </AlertDescription>
          </Alert>
        )}

        <section className="rounded-lg border bg-card p-5 shadow-card md:p-6">
          {step === "customer" && (
            <StepCustomer
              customer={customer}
              onChange={updateCustomer}
              channel={channel}
              onChannel={(c) => { setDirty(true); setChannel(c); }}
              lookup={lookup}
              onLookup={lookupPhone}
              onApplyLookup={() => {
                if (lookup?.data) {
                  updateCustomer({ name: lookup.data.name, nationality: lookup.data.nationality, email: lookup.data.email ?? "", notes: lookup.data.notes ?? "" });
                  if (lookup.data.notes && !schedule.specialNeeds) updateSchedule({ specialNeeds: lookup.data.notes });
                  setLookup({ ...lookup, applied: true });
                }
              }}
              errors={errors}
            />
          )}
          {step === "schedule" && (
            <StepSchedule
              config={config}
              schedule={schedule}
              onChange={(patch) => {
                updateSchedule(patch);
                if ("people" in patch || "languageId" in patch || "packageId" in patch || "date" in patch) setSelectedGuides([]);
              }}
              guidesNeeded={guidesNeeded}
              slots={slots}
              slotsLoading={availability.loading}
              strip={strip.data}
              selectedSlotId={selectedSlot?.slotId ?? null}
              onRefresh={() => setRefresh((r) => r + 1)}
              errors={errors}
              customerNotes={customer.notes}
            />
          )}
          {step === "guides" && selectedSlot && schedule.date && (
            <StepGuides
              candidates={candidates}
              loading={ranking.loading}
              guidesNeeded={guidesNeeded}
              selected={selectedGuides}
              onToggle={(id) =>
                setSelectedGuides((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < guidesNeeded ? [...s, id] : s))
              }
              slotLabel={selectedSlot.label}
              date={schedule.date}
              languageName={language?.nameId ?? ""}
              error={errors.guideIds}
              missingPrefillGuide={missingPrefillGuide}
            />
          )}
          {(step === "guides" || step === "review") && !selectedSlot && (
            <div className="space-y-3" aria-busy>
              <div className="h-6 w-2/3 animate-pulse rounded bg-kabut-100" />
              <div className="h-24 animate-pulse rounded-lg bg-kabut-100" />
              <div className="h-24 animate-pulse rounded-lg bg-kabut-100" />
            </div>
          )}
          {step === "review" && snapshot && selectedSlot && schedule.date && (
            <StepReview
              config={config}
              customer={isReschedule ? null : customer}
              customerName={reschedule?.customerName ?? customer.name}
              channel={isReschedule ? null : channel}
              schedule={schedule}
              slot={selectedSlot}
              languageName={language?.nameId ?? ""}
              guideNames={selectedGuides.map((id) => candidates?.find((c) => c.guideId === id)?.displayName ?? reschedule?.before.guideNames[id] ?? id)}
              snapshot={snapshot}
              internalNotes={internalNotes}
              onInternalNotes={setInternalNotes}
              reschedule={reschedule ? { context: reschedule, reason, onReason: setReason, newGuideIds: selectedGuides, candidates: candidates ?? [] } : null}
              errors={errors}
            />
          )}
        </section>

        {/* Navigation: inline on desktop, sticky bottom bar on mobile (design-system §6.4). */}
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-card px-4 py-3 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
          <button type="button" className="flex flex-1 flex-col text-left md:hidden" onClick={() => setSummaryOpen(true)} aria-label={sw.showSummary}>
            <span className="text-xs text-muted-foreground">{t.pricing.summary.total}</span>
            <span className="font-bold tabular">{total === null ? t.common.none : formatRupiah(total)}</span>
          </button>
          {stepIndex > 0 && (
            <Button variant="secondary" onClick={goBack} disabled={submitting}>
              <ArrowLeft />
              <span className="hidden sm:inline">{sw.back}</span>
            </Button>
          )}
          <span className="hidden flex-1 md:block" />
          {isLast ? (
            <Button onClick={submit} pending={submitting} disabled={!snapshot}>
              {isReschedule ? t.booking.reschedule.save : sw.submit}
            </Button>
          ) : (
            <Button onClick={goNext}>
              {sw.next}
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      {/* Ringkasan: sticky right panel on desktop, bottom sheet on mobile. */}
      <aside className="hidden rounded-lg border bg-card p-5 shadow-card lg:sticky lg:top-20 lg:block lg:self-start">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <ReceiptText className="size-5 text-danau-700" />
          {sw.summaryTitle}
        </h2>
        {snapshot ? <PriceSummary snapshot={snapshot} priceDiff={priceDiff} /> : <p className="text-sm text-muted-foreground">{t.pricing.simulator.empty}</p>}
      </aside>
      <Drawer open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{sw.summaryTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">{snapshot ? <PriceSummary snapshot={snapshot} priceDiff={priceDiff} /> : <p className="text-sm text-muted-foreground">{t.pricing.simulator.empty}</p>}</div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
