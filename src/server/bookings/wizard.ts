import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingGuides, bookings, customers, guides, languages, slots } from "@/db/schema";
import { isPaymentConfirmationEnabled } from "@/lib/flags";
import type { PriceSnapshot } from "@/domain/pricing";
import { addDays, isValidDate, wibToday } from "@/domain/time";
import type { CurrentUser } from "../session";
import { getSettings } from "../settings";
import { listAddons, listAllHolidays, listPackagesFull, listPriceRules } from "../pricing/queries";
import { customerVisitCounts } from "./queries";

export type WizardConfig = Awaited<ReturnType<typeof loadWizardConfig>>;

/** Catalogue for the wizard. `keep` keeps inactive values an existing booking already uses. */
export async function loadWizardConfig(keep: { packageId?: string; languageId?: string } = {}) {
  const [settings, langs, pkgs, addonRows, rules, holidays] = await Promise.all([
    getSettings(),
    db.select().from(languages).orderBy(asc(languages.sortOrder)),
    listPackagesFull(),
    listAddons(),
    listPriceRules(),
    listAllHolidays(),
  ]);
  const today = wibToday();
  return {
    today,
    maxDate: addDays(today, settings.booking_horizon_days),
    holdHours: settings.hold_expiry_hours,
    paymentConfirmation: isPaymentConfirmationEnabled(),
    languages: langs
      .filter((l) => l.isActive || l.id === keep.languageId)
      .map((l) => ({ id: l.id, code: l.code, nameId: l.nameId })),
    packages: pkgs
      .filter((p) => p.isActive || p.id === keep.packageId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        pricePerGuide: p.pricePerGuide,
        maxPeoplePerGuide: p.maxPeoplePerGuide,
        includedAddonIds: p.includedAddons.filter((a) => a.isActive).map((a) => a.id),
        facilityNames: p.facilities.filter((f) => f.isActive).map((f) => f.name),
        facilities: p.facilities.filter((f) => f.isActive).map((f) => ({ name: f.name, icon: f.icon })),
      })),
    addons: addonRows.filter((a) => a.isActive).map((a) => ({ id: a.id, name: a.name, price: a.price, unit: a.unit })),
    rules: rules.map((r) => ({ type: r.type, name: r.name, kind: r.kind, value: r.value, isActive: r.isActive })),
    holidays,
  };
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export type WizardPrefill = {
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

/**
 * 05 §3.2 pre-fill from Papan Jadwal (`date`, `slot`, `guide`), the simulator (`people`,
 * `package`, `addons`) or a linked booking (`customer`, `group`). Invalid values are ignored.
 */
export async function parsePrefill(search: Search, config: WizardConfig): Promise<WizardPrefill> {
  const date = one(search.date);
  const slotId = one(search.slot);
  const guideId = one(search.guide);
  const people = Number(one(search.people));
  const packageId = one(search.package);
  const addonIds = one(search.addons).split(",").filter((id) => config.addons.some((a) => a.id === id));
  const customerId = one(search.customer);
  const groupId = one(search.group);
  const rebookId = one(search.ulang);

  const [slot] = slotId ? await db.select({ id: slots.id }).from(slots).where(and(eq(slots.id, slotId), eq(slots.isActive, true))) : [];
  const [guide] = guideId ? await db.select({ id: guides.id, name: guides.displayName }).from(guides).where(and(eq(guides.id, guideId), eq(guides.isActive, true))) : [];
  const [source] = groupId ? await db.select().from(bookings).where(eq(bookings.id, groupId)) : [];
  // BR-06-3: "Buat ulang pemesanan" pre-fills from an expired booking.
  const [rebook] = rebookId ? await db.select().from(bookings).where(eq(bookings.id, rebookId)) : [];
  const customerSource = customerId || source?.customerId || rebook?.customerId;
  const customer = customerSource ? await db.query.customers.findFirst({ where: eq(customers.id, customerSource) }) : null;
  const origin = source ?? rebook;
  const rebookAddons = rebook ? (rebook.priceSnapshot as PriceSnapshot).addons.filter((a) => !a.included).map((a) => a.id) : [];
  const visits = customer ? (await customerVisitCounts([customer.id])).get(customer.id) ?? 0 : 0;

  return {
    date: isValidDate(date) && date >= config.today && date <= config.maxDate ? date : origin && origin.tourDate >= config.today ? origin.tourDate : null,
    slotId: slot?.id ?? origin?.slotId ?? null,
    guide: guide ?? null,
    people: Number.isInteger(people) && people >= 1 && people <= 200 ? people : rebook?.people ?? null,
    packageId: config.packages.some((p) => p.id === packageId) ? packageId : rebook && config.packages.some((p) => p.id === rebook.packageId) ? rebook.packageId : null,
    addonIds: addonIds.length ? addonIds : rebookAddons.filter((id) => config.addons.some((a) => a.id === id)),
    customer: customer
      ? { phone: customer.phoneE164, name: customer.name, nationality: customer.nationality, email: customer.email ?? "", notes: customer.notes ?? "", visits }
      : null,
    groupFrom: source ? { id: source.id, code: source.code } : null,
    languageId: rebook && config.languages.some((l) => l.id === rebook.languageId) ? rebook.languageId : null,
  };
}

/** Current values of a booking for the reschedule page (05 §3.4). */
export async function loadRescheduleState(bookingId: string) {
  const [found, assigned] = await Promise.all([
    db
      .select({ booking: bookings, languageName: languages.nameId, customerName: customers.name })
      .from(bookings)
      .leftJoin(languages, eq(languages.id, bookings.languageId))
      .leftJoin(customers, eq(customers.id, bookings.customerId))
      .where(eq(bookings.id, bookingId))
      .limit(1),
    db
      .select({ guideId: bookingGuides.guideId, name: guides.displayName })
      .from(bookingGuides)
      .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
      .where(and(eq(bookingGuides.bookingId, bookingId), isNull(bookingGuides.releasedAt))),
  ]);
  const row = found[0];
  if (!row) return null;
  const booking = row.booking;
  const snapshot = booking.priceSnapshot as PriceSnapshot;
  return {
    booking,
    snapshot,
    guides: assigned,
    languageName: row.languageName ?? "",
    customerName: row.customerName ?? "",
    addonIds: snapshot.addons.filter((a) => !a.included).map((a) => a.id),
  };
}

export function defaultChannelFor(user: CurrentUser) {
  return user.defaultChannel ?? "sales";
}
