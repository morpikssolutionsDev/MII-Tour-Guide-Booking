// `npm run db:seed` resets the database and fills it with a populated demo (overview §10).
// Deterministic: a fixed PRNG seed, with dates relative to today (WIB).
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { rankCandidates } from "../src/domain/allocation";
import { evaluateSlots, type GuideForAvailability } from "../src/domain/availability";
import { formatBookingCode } from "../src/domain/booking-code";
import { computeHoldExpiry } from "../src/domain/hold";
import { calculatePrice, type PricingAddon, type PricingPackage, type PricingRule } from "../src/domain/pricing";
import { addDays, daysBetween, isoWeekRange, toWib, wibToUtc } from "../src/domain/time";
import * as s from "../src/db/schema";
import { client, db, target } from "./db";
import { seedNotifications } from "./seed-notifications";
import * as data from "./seed-data";

/* ---------------- deterministic randomness ---------------- */

let state = 20261025;
function rand(): number {
  state = (state + 0x6d2b79f5) | 0;
  let x = Math.imul(state ^ (state >>> 15), 1 | state);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number) => rand() < p;
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) if ((r -= w) <= 0) return value;
  return entries[entries.length - 1][0];
}
const uuid = () => crypto.randomUUID();
const iso = (d: Date) => d.toISOString();
const plusMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
const minDate = (...dates: Date[]) => new Date(Math.min(...dates.map((d) => d.getTime())));

/* ---------------- reset ---------------- */

async function reset() {
  const tables = [
    s.feedbackGuideRatings, s.feedback, s.notifications, s.bookingChecklistItems, s.payments,
    s.bookingEvents, s.bookingAddons, s.bookingGuides, s.bookings, s.customers,
    s.briefingMaterialPackages, s.briefingMaterials, s.packageIncludedAddons, s.packageFacilities,
    s.addons, s.packages, s.facilities, s.priceRules, s.holidays, s.checklistTemplateItems,
    s.settings, s.guideLeaves, s.guideWorkingDays, s.guideLanguages, s.guides, s.slots,
    s.languages, s.users,
  ];
  for (const table of tables) await db.delete(table);
}

async function insertMany<T extends Record<string, unknown>>(table: Parameters<typeof db.insert>[0], rows: T[]) {
  for (let i = 0; i < rows.length; i += 100) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + 100) as any);
  }
}

/* ---------------- main ---------------- */

async function main() {
  const now = new Date();
  const nowWib = toWib(now);
  const today = nowWib.date;
  console.log(`Seeding ${target} relative to ${today} ${nowWib.time} WIB…`);
  await reset();

  /* ----- users ----- */
  const passwordHash = await bcrypt.hash(data.PASSWORD, 10);
  const longAgo = iso(new Date(now.getTime() - 120 * 86_400_000));
  const staff = data.STAFF_USERS.map((u) => ({
    id: uuid(),
    key: u.key,
    name: u.name,
    email: u.email,
    role: u.role,
    defaultChannel: u.channel,
  }));
  await insertMany(
    s.users,
    staff.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      defaultChannel: u.defaultChannel,
      passwordChangedAt: longAgo,
      createdAt: longAgo,
      lastLoginAt: iso(plusMinutes(now, -int(30, 2000))),
    })),
  );
  const admin = staff.find((u) => u.key === "admin")!;
  const staffCreators = staff.filter((u) => u.role === "staff");

  /* ----- settings: languages, slots, checklist, settings ----- */
  const languages = data.LANGUAGES.map((l, i) => ({ id: uuid(), ...l, sortOrder: i }));
  await insertMany(s.languages, languages);
  const langByCode = Object.fromEntries(languages.map((l) => [l.code, l]));

  const slots = data.SLOTS.map((sl) => ({ id: uuid(), ...sl }));
  await insertMany(s.slots, slots);

  const checklistTemplate = data.CHECKLIST.map((c, i) => ({ id: uuid(), ...c, sortOrder: i }));
  await insertMany(s.checklistTemplateItems, checklistTemplate);

  await insertMany(
    s.settings,
    Object.entries(data.SETTINGS).map(([key, value]) => ({ key, value, updatedBy: admin.id })),
  );

  /* ----- pricing ----- */
  const facilityRows = data.FACILITIES.map((f, i) => ({ id: uuid(), key: f.key, name: f.name, icon: f.icon, sortOrder: i }));
  await insertMany(s.facilities, facilityRows.map((f) => ({ id: f.id, name: f.name, icon: f.icon, sortOrder: f.sortOrder })));
  const facilityByKey = Object.fromEntries(facilityRows.map((f) => [f.key, f]));

  const addonRows = data.ADDONS.map((a, i) => ({ id: uuid(), ...a, sortOrder: i }));
  await insertMany(
    s.addons,
    addonRows.map((a) => ({ id: a.id, name: a.name, description: a.description, price: a.price, unit: a.unit, sortOrder: a.sortOrder })),
  );
  const addonByKey = Object.fromEntries(addonRows.map((a) => [a.key, a]));

  const packageRows = data.PACKAGES.map((p, i) => ({ id: uuid(), ...p, sortOrder: i }));
  await insertMany(
    s.packages,
    packageRows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      pricePerGuide: p.pricePerGuide,
      maxPeoplePerGuide: p.maxPeoplePerGuide,
      sortOrder: p.sortOrder,
    })),
  );
  await insertMany(
    s.packageFacilities,
    packageRows.flatMap((p) => p.facilities.map((f) => ({ packageId: p.id, facilityId: facilityByKey[f].id }))),
  );
  await insertMany(
    s.packageIncludedAddons,
    packageRows.flatMap((p) => p.includedAddons.map((a) => ({ packageId: p.id, addonId: addonByKey[a].id }))),
  );
  const packageByKey = Object.fromEntries(packageRows.map((p) => [p.key, p]));

  await insertMany(s.priceRules, data.PRICE_RULES.map((r) => ({ id: uuid(), ...r })));
  await insertMany(s.holidays, data.HOLIDAYS.map(([date, name]) => ({ id: uuid(), date, name })));

  const pricingPackages: Record<string, PricingPackage> = Object.fromEntries(
    packageRows.map((p) => [
      p.key,
      {
        id: p.id,
        name: p.name,
        pricePerGuide: p.pricePerGuide,
        maxPeoplePerGuide: p.maxPeoplePerGuide,
        includedAddonIds: p.includedAddons.map((a) => addonByKey[a].id),
        facilityNames: p.facilities.map((f) => facilityByKey[f].name),
      },
    ]),
  );
  const pricingAddons: PricingAddon[] = addonRows.map((a) => ({ id: a.id, name: a.name, price: a.price, unit: a.unit }));
  const pricingRules: PricingRule[] = data.PRICE_RULES.map((r) => ({ ...r, isActive: true }));
  const pricingHolidays = data.HOLIDAYS.map(([date, name]) => ({ date, name }));

  /* ----- briefing material ----- */
  for (const b of data.BRIEFINGS) {
    const materialId = uuid();
    await db.insert(s.briefingMaterials).values({
      id: materialId,
      title: b.title,
      bodyHtml: b.bodyHtml,
      linkUrl: b.linkUrl,
      appliesToAll: b.packages === null,
      updatedBy: admin.id,
    });
    if (b.packages) {
      await insertMany(
        s.briefingMaterialPackages,
        b.packages.map((key) => ({ materialId, packageId: packageByKey[key].id })),
      );
    }
  }

  /* ----- guides ----- */
  const guideRows = data.GUIDES.map((g) => ({
    ...g,
    id: uuid(),
    userId: uuid(),
    email: `${g.displayName.toLowerCase()}@tmii.test`,
  }));
  await insertMany(
    s.users,
    guideRows.map((g) => ({
      id: g.userId,
      name: g.fullName,
      email: g.email,
      passwordHash,
      role: "guide" as const,
      passwordChangedAt: longAgo,
      createdAt: longAgo,
    })),
  );
  await insertMany(
    s.guides,
    guideRows.map((g) => ({
      id: g.id,
      userId: g.userId,
      fullName: g.fullName,
      displayName: g.displayName,
      phoneE164: g.phone,
      createdAt: longAgo,
    })),
  );
  await insertMany(
    s.guideLanguages,
    guideRows.flatMap((g) => g.langs.map((code) => ({ guideId: g.id, languageId: langByCode[code].id }))),
  );
  await insertMany(
    s.guideWorkingDays,
    guideRows.flatMap((g) => g.days.map((weekday) => ({ guideId: g.id, weekday }))),
  );
  const guideByName = Object.fromEntries(guideRows.map((g) => [g.displayName, g]));

  // Leave: generated before bookings so approved leave blocks availability.
  const leaves = [
    { guide: "Ayu", start: addDays(today, 5), end: addDays(today, 6), reason: "Acara keluarga", status: "approved" },
    { guide: "Putri", start: addDays(today, -20), end: addDays(today, -18), reason: "Sakit", status: "approved" },
    { guide: "Yoga", start: addDays(today, -9), end: addDays(today, -8), reason: "Urusan pribadi", status: "rejected" },
    { guide: "Hendra", start: addDays(today, 10), end: addDays(today, 11), reason: "Menghadiri pernikahan saudara", status: "pending" },
    { guide: "Dimas", start: addDays(today, 3), end: addDays(today, 3), reason: "Kontrol ke dokter", status: "pending" },
  ] as const;
  await insertMany(
    s.guideLeaves,
    leaves.map((l) => {
      const g = guideByName[l.guide];
      const requestedAt = iso(plusMinutes(now, -int(60 * 24, 60 * 24 * 6)));
      return {
        id: uuid(),
        guideId: g.id,
        startDate: l.start,
        endDate: l.end,
        reason: l.reason,
        status: l.status,
        requestedBy: g.userId,
        decidedBy: l.status === "pending" ? null : admin.id,
        decidedAt: l.status === "pending" ? null : requestedAt,
        decisionNote: l.status === "rejected" ? "Sudah ada 3 tur Rusia di tanggal tersebut." : null,
        createdAt: requestedAt,
      };
    }),
  );
  const availabilityGuides: GuideForAvailability[] = guideRows.map((g) => ({
    id: g.id,
    displayName: g.displayName,
    isActive: true,
    languageIds: g.langs.map((code) => langByCode[code].id),
    weekdays: [...g.days],
    approvedLeaves: leaves
      .filter((l) => l.guide === g.displayName && l.status === "approved")
      .map((l) => ({ startDate: l.start, endDate: l.end })),
  }));

  /* ----- customers ----- */
  const customerRows = data.CUSTOMERS.map(([name, nationality], i) => ({
    id: uuid(),
    name,
    nationality,
    phoneE164: customerPhone(nationality, i),
    email: chance(0.6) ? `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com` : null,
    notes: i % 11 === 3 ? "Pengguna kursi roda" : i % 13 === 5 ? "Hanya makanan halal" : null,
    createdAt: longAgo,
  }));

  /* ----- bookings ----- */
  type Gen = {
    id: string;
    customer: (typeof customerRows)[number];
    createdBy: (typeof staffCreators)[number];
    channel: s.Channel;
    languageId: string;
    pkgKey: string;
    slot: (typeof slots)[number];
    tourDate: string;
    people: number;
    guideIds: string[];
    createdAt: Date;
    selectedAddonIds: string[];
    groupRef?: string;
  };
  const generated: Gen[] = [];
  const assignmentsByDate = new Map<string, { guideId: string; slotId: string; bookingId: string }[]>();
  const loadByWeek = new Map<string, number>();
  const weekKey = (guideId: string, date: string) => `${guideId}:${isoWeekRange(date).start}`;

  const pickCustomer = () =>
    // A small group of regulars returns, the rest are mostly first visits.
    chance(0.25) ? customerRows[int(0, 7)] : pick(customerRows);
  const languageFor = (nationality: string) => {
    if (data.ARABIC_COUNTRIES.includes(nationality) && chance(0.8)) return langByCode.ar.id;
    if (nationality === "RU" && chance(0.85)) return langByCode.ru.id;
    return langByCode.en.id;
  };

  function tryBook(tourDate: string, opts: { sameDay?: boolean } = {}): Gen | null {
    const customer = pickCustomer();
    const languageId = languageFor(customer.nationality);
    const people = weighted([[1, 5], [2, 25], [3, 14], [4, 18], [5, 8], [6, 8], [8, 7], [10, 6], [12, 5], [16, 3]] as const);
    const pkgKey = people <= 8 ? weighted([["reguler", 68], ["premium", 22], ["vip", 10]] as const) : weighted([["reguler", 75], ["premium", 25]] as const);
    const pkg = pricingPackages[pkgKey];
    const needed = Math.ceil(people / pkg.maxPeoplePerGuide);

    // Creation time: lead days before the tour; never in the future.
    const lead = opts.sameDay ? 0 : weighted([[0, 12], [1, 18], [2, 16], [3, 14], [5, 14], [7, 12], [10, 8], [14, 6]] as const);
    const createdDay = addDays(tourDate, -lead);
    let createdAt = wibToUtc(createdDay, `${String(int(7, 17)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}`);
    if (createdAt > now) createdAt = plusMinutes(now, -int(20, 600));

    const assignments = assignmentsByDate.get(tourDate) ?? [];
    const createdWib = toWib(createdAt);
    const options = evaluateSlots({
      date: tourDate,
      nowWib: createdWib,
      languageId,
      guidesNeeded: needed,
      slots,
      guides: availabilityGuides,
      assignments,
    }).filter((sl) => sl.available);
    if (options.length === 0) return null;
    const option = pick(options);
    const slot = slots.find((sl) => sl.id === option.slotId)!;

    const ranked = rankCandidates(
      option.eligibleGuideIds.map((guideId) => {
        const g = availabilityGuides.find((x) => x.id === guideId)!;
        return { guideId, displayName: g.displayName, weekLoad: loadByWeek.get(weekKey(guideId, tourDate)) ?? 0, avgRating: null, ratingCount: 0 };
      }),
    );
    // Staff usually accept the recommendation, sometimes pick another eligible guide.
    const guideIds = (chance(0.8) ? ranked : [...ranked].sort(() => rand() - 0.5)).slice(0, needed).map((c) => c.guideId);

    const creator = opts.sameDay
      ? (staffCreators.find((u) => u.defaultChannel === "on_the_spot") ?? pick(staffCreators))
      : pick(staffCreators);
    const channel = opts.sameDay ? "on_the_spot" : (creator.defaultChannel ?? "sales");
    const selectedAddonIds = [
      ...(pkgKey === "reguler" && chance(0.25) ? [addonByKey.fastTrack.id] : []),
      ...(chance(0.15) ? [addonByKey.photo.id] : []),
      ...(chance(0.1) ? [addonByKey.snackBox.id] : []),
    ];

    const gen: Gen = {
      id: uuid(),
      customer,
      createdBy: creator,
      channel,
      languageId,
      pkgKey,
      slot,
      tourDate,
      people,
      guideIds,
      createdAt,
      selectedAddonIds,
    };
    for (const guideId of guideIds) {
      assignments.push({ guideId, slotId: slot.id, bookingId: gen.id });
      loadByWeek.set(weekKey(guideId, tourDate), (loadByWeek.get(weekKey(guideId, tourDate)) ?? 0) + 1);
    }
    assignmentsByDate.set(tourDate, assignments);
    generated.push(gen);
    return gen;
  }

  for (let offset = -60; offset <= 14; offset++) {
    const date = addDays(today, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const base = offset <= 0 ? int(1, 4) : offset <= 7 ? int(1, 3) : int(0, 2);
    const count = base + (isWeekend ? int(1, 2) : 0);
    for (let i = 0; i < count; i++) tryBook(date);
    if (offset <= 0 && chance(0.35)) tryBook(date, { sameDay: true });
  }

  // One linked pair (BR-05-17): the same family split into English and Arabic.
  const linkDate = addDays(today, 4);
  const first = tryBook(linkDate);
  if (first) {
    const pairCustomer = customerRows.find((c) => c.nationality === "AE")!;
    first.customer = pairCustomer;
    first.groupRef = "pending";
    const second = tryBook(linkDate);
    if (second) {
      second.customer = pairCustomer;
      second.groupRef = "pending";
    }
  }

  /* ----- materialise bookings with statuses, payments, events ----- */
  generated.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const seqByDay = new Map<string, number>();
  const bookingRows: (typeof s.bookings.$inferInsert)[] = [];
  const bgRows: (typeof s.bookingGuides.$inferInsert)[] = [];
  const addonLineRows: (typeof s.bookingAddons.$inferInsert)[] = [];
  const eventRows: (typeof s.bookingEvents.$inferInsert)[] = [];
  const paymentRows: (typeof s.payments.$inferInsert)[] = [];
  const checklistRows: (typeof s.bookingChecklistItems.$inferInsert)[] = [];
  const feedbackRows: (typeof s.feedback.$inferInsert)[] = [];
  const ratingRows: (typeof s.feedbackGuideRatings.$inferInsert)[] = [];
  const consentByCustomer = new Map<string, string>();
  const usedCustomers = new Set<string>();
  const firstCodeByGroup: Record<string, string> = {};

  const event = (bookingId: string, type: string, at: Date, actor: string | null, payload: Record<string, unknown> = {}) =>
    eventRows.push({ id: uuid(), bookingId, type, actorUserId: actor, payload, at: iso(at) });

  for (const g of generated) {
    usedCustomers.add(g.customer.id);
    const createdWibDay = toWib(g.createdAt).date;
    const seq = (seqByDay.get(createdWibDay) ?? 0) + 1;
    seqByDay.set(createdWibDay, seq);
    const code = formatBookingCode(g.createdAt, seq);
    let groupRef: string | null = null;
    if (g.groupRef) {
      firstCodeByGroup.pair ??= code;
      groupRef = firstCodeByGroup.pair;
    }

    const snapshot = calculatePrice({
      date: g.tourDate,
      people: g.people,
      pkg: pricingPackages[g.pkgKey],
      selectedAddonIds: g.selectedAddonIds,
      addons: pricingAddons,
      rules: pricingRules,
      holidays: pricingHolidays,
      now: g.createdAt,
    });
    const slotStartAt = wibToUtc(g.tourDate, g.slot.startTime);
    const slotEndAt = wibToUtc(g.tourDate, g.slot.endTime);
    const holdExpiry = computeHoldExpiry(g.createdAt, data.SETTINGS.hold_expiry_hours, g.tourDate, g.slot.startTime);
    const creatorId = g.createdBy.id;
    const guideUser = (guideId: string) => guideRows.find((x) => x.id === guideId)!.userId;

    event(g.id, "created", g.createdAt, creatorId, { channel: g.channel });
    for (const guideId of g.guideIds) event(g.id, "guide_assigned", g.createdAt, creatorId, { guideId });

    // Decide the outcome.
    const tourStarted = now >= slotStartAt;
    const tourEnded = now >= slotEndAt;
    let status: s.BookingStatus;
    let cancel: { reason: s.CancelReason; at: Date; by: string | null; detail?: string } | null = null;
    const holdStillOpen = holdExpiry > now;

    if (holdStillOpen && !tourStarted && chance(0.55)) {
      status = "awaiting_payment";
    } else if (chance(tourStarted ? 0.05 : 0.04)) {
      // Never paid: expired automatically.
      status = "cancelled";
      cancel = { reason: "expired", at: holdExpiry, by: null };
    } else {
      status = "confirmed";
    }

    const paidAt =
      status === "confirmed"
        ? minDate(plusMinutes(g.createdAt, int(10, 60 * 18)), plusMinutes(slotStartAt, -15), plusMinutes(now, -5))
        : null;
    if (paidAt && paidAt < g.createdAt) {
      // Same-day bookings close to the slot: paid right away.
      paidAt.setTime(plusMinutes(g.createdAt, 2).getTime());
    }

    // Paid bookings may still be cancelled by staff, or end as no-show / completed.
    if (status === "confirmed" && chance(0.05)) {
      const cancelAt = minDate(plusMinutes(paidAt!, int(60, 60 * 48)), plusMinutes(slotStartAt, -30), now);
      status = "cancelled";
      cancel = {
        reason: weighted([["tourist_request", 6], ["weather", 2], ["duplicate", 1]] as const),
        at: cancelAt < paidAt! ? plusMinutes(paidAt!, 5) : cancelAt,
        by: creatorId,
      };
    }

    const assignedRows = g.guideIds.map((guideId) => ({
      id: uuid(),
      bookingId: g.id,
      guideId,
      tourDate: g.tourDate,
      slotId: g.slot.id,
      assignedAt: iso(g.createdAt),
      releasedAt: null as string | null,
      notifiedAt: null as string | null,
      shortNotice: false,
      acknowledgedAt: null as string | null,
    }));

    let completedAt: Date | null = null;
    let completedBy: string | null = null;
    let checklistAllChecked = false;

    if (paidAt) {
      const method = g.channel === "on_the_spot" ? weighted([["cash", 5], ["qris", 4], ["edc", 2]] as const) : weighted([["bank_transfer", 5], ["qris", 4], ["edc", 1], ["cash", 1]] as const);
      const mismatch = chance(0.03);
      const amount = mismatch ? snapshot.total - pick([5_000, 6_500, 50_000]) : snapshot.total;
      paymentRows.push({
        id: uuid(),
        bookingId: g.id,
        kind: "payment",
        method,
        amount,
        paidAt: iso(paidAt),
        reference: method === "cash" ? null : `${method === "qris" ? "RRN" : method === "edc" ? "APV" : "TRX"}${int(100000, 999999)}`,
        recordedBy: creatorId,
        createdAt: iso(paidAt),
      });
      event(g.id, "payment_confirmed", paidAt, creatorId, { method, amount, mismatch });
      event(g.id, "status_changed", paidAt, creatorId, { from: "awaiting_payment", to: "confirmed" });

      const shortNotice = daysBetween(toWib(paidAt).date, g.tourDate) < data.SETTINGS.notice_days;
      for (const row of assignedRows) {
        row.notifiedAt = iso(paidAt);
        row.shortNotice = shortNotice;
      }
      event(g.id, "notification_sent", paidAt, null, { eventKey: "guide_assigned", recipients: assignedRows.length });

      if (status !== "cancelled") {
        // Acknowledgements: past tours always; upcoming mostly.
        for (const row of assignedRows) {
          const ackAt = minDate(plusMinutes(paidAt, int(15, 60 * 10)), plusMinutes(slotStartAt, -10), now);
          if (tourStarted || chance(0.7)) {
            row.acknowledgedAt = iso(ackAt < paidAt ? plusMinutes(paidAt, 1) : ackAt);
            event(g.id, "guide_acknowledged", new Date(row.acknowledgedAt), guideUser(row.guideId), { guideId: row.guideId });
          }
        }
        const allAcked = assignedRows.every((r) => r.acknowledgedAt);
        const manualDone = tourStarted ? chance(0.9) : chance(0.55);
        checklistAllChecked = allAcked && manualDone;
        const opsUser = staffCreators.find((u) => u.defaultChannel === "on_the_spot")!;
        checklistTemplate.forEach((item, index) => {
          const isSystem = item.systemKey === "guide_ack";
          const checked = isSystem ? allAcked : manualDone || index === 1;
          const checkedAt = checked ? minDate(plusMinutes(paidAt, int(30, 60 * 20)), plusMinutes(slotStartAt, -5), now) : null;
          checklistRows.push({
            id: uuid(),
            bookingId: g.id,
            systemKey: item.systemKey,
            label: item.label,
            description: item.description,
            sortOrder: item.sortOrder,
            checkedAt: checkedAt ? iso(checkedAt < paidAt ? plusMinutes(paidAt, 2) : checkedAt) : null,
            checkedBy: checked && !isSystem ? opsUser.id : null,
          });
        });
        if (checklistAllChecked) {
          status = "ready";
          event(g.id, "status_changed", plusMinutes(paidAt, 60), null, { from: "confirmed", to: "ready", cause: "checklist" });
        }

        if (tourEnded) {
          const outcomeNoShow = chance(0.04);
          completedAt = plusMinutes(slotEndAt, int(-20, 40));
          if (completedAt > now) completedAt = plusMinutes(now, -1);
          const byGuide = chance(0.7);
          completedBy = byGuide ? guideUser(g.guideIds[0]) : opsUser.id;
          status = outcomeNoShow ? "no_show" : "completed";
          event(g.id, "status_changed", completedAt, completedBy, { from: checklistAllChecked ? "ready" : "confirmed", to: status });
        }
      }
    }

    if (status === "cancelled" && cancel) {
      for (const row of assignedRows) row.releasedAt = iso(cancel.at);
      if (cancel.reason === "expired") {
        event(g.id, "hold_expired", cancel.at, null, {});
      } else {
        event(g.id, "cancelled", cancel.at, cancel.by, { reason: cancel.reason });
        if (paidAt && cancel.reason === "tourist_request" && chance(0.7)) {
          const refund = Math.round(snapshot.total * 0.5);
          paymentRows.push({
            id: uuid(),
            bookingId: g.id,
            kind: "adjustment",
            method: "bank_transfer",
            amount: -refund,
            paidAt: iso(plusMinutes(cancel.at, 60)),
            reference: `RFD${int(100000, 999999)}`,
            note: "Refund 50% sesuai kebijakan pembatalan",
            recordedBy: creatorId,
            createdAt: iso(plusMinutes(cancel.at, 60)),
          });
          event(g.id, "adjustment_recorded", plusMinutes(cancel.at, 60), creatorId, { amount: -refund });
        }
      }
    }

    // Feedback for completed tours (10).
    if (status === "completed" && completedAt) {
      const token = randomBytes(32).toString("base64url");
      const expires = new Date(completedAt.getTime() + data.SETTINGS.feedback_link_days * 86_400_000);
      const submitted = chance(0.78);
      const feedbackId = uuid();
      if (submitted) {
        const submittedAt = minDate(plusMinutes(completedAt, int(5, 60 * 30)), plusMinutes(now, -1));
        const overall = weighted([[5, 55], [4, 30], [3, 10], [2, 5]] as const);
        const source = weighted([["tourist", 85], ["staff", 10], ["guide", 5]] as const);
        const consent = chance(0.4);
        const commentPool = overall >= 4 ? data.FEEDBACK_COMMENTS.high : overall === 3 ? data.FEEDBACK_COMMENTS.mid : data.FEEDBACK_COMMENTS.low;
        feedbackRows.push({
          id: feedbackId,
          bookingId: g.id,
          token,
          tokenExpiresAt: iso(expires),
          submittedAt: iso(submittedAt),
          source,
          enteredBy: source === "staff" ? creatorId : source === "guide" ? guideUser(g.guideIds[0]) : null,
          overallRating: overall,
          comment: chance(0.7) ? pick(commentPool) : null,
          wouldRevisit: overall >= 4 ? weighted([["yes", 8], ["maybe", 2]] as const) : overall === 3 ? "maybe" : weighted([["maybe", 1], ["no", 2]] as const),
          contactConsent: consent,
          createdAt: iso(completedAt),
        });
        for (const guideId of g.guideIds) {
          ratingRows.push({ feedbackId, guideId, rating: Math.max(1, Math.min(5, overall + weighted([[0, 7], [1, 2], [-1, 1]] as const))) });
        }
        if (consent) consentByCustomer.set(g.customer.id, iso(submittedAt));
        event(g.id, "feedback_received", submittedAt, source === "tourist" ? null : (source === "staff" ? creatorId : guideUser(g.guideIds[0])), { source, overall });
        event(g.id, "status_changed", submittedAt, null, { from: "completed", to: "evaluated" });
        status = "evaluated";
      } else {
        feedbackRows.push({ id: feedbackId, bookingId: g.id, token, tokenExpiresAt: iso(expires), createdAt: iso(completedAt) });
      }
    }

    bgRows.push(...assignedRows);
    for (const line of snapshot.addons) {
      addonLineRows.push({
        bookingId: g.id,
        addonId: line.id,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        included: line.included,
      });
    }
    bookingRows.push({
      id: g.id,
      code,
      customerId: g.customer.id,
      channel: g.channel,
      createdBy: creatorId,
      languageId: g.languageId,
      packageId: pricingPackages[g.pkgKey].id,
      slotId: g.slot.id,
      slotStart: g.slot.startTime,
      slotEnd: g.slot.endTime,
      tourDate: g.tourDate,
      people: g.people,
      guidesNeeded: snapshot.guidesNeeded,
      status,
      priceSnapshot: snapshot,
      totalAmount: snapshot.total,
      holdExpiresAt: status === "awaiting_payment" ? iso(holdExpiry) : null,
      specialNeeds: g.customer.notes,
      groupRef,
      cancelReason: cancel?.reason ?? null,
      cancelledAt: cancel ? iso(cancel.at) : null,
      cancelledBy: cancel?.by ?? null,
      completedAt: completedAt ? iso(completedAt) : null,
      completedBy,
      createdAt: iso(g.createdAt),
      updatedAt: iso(now),
    });
  }

  await insertMany(
    s.customers,
    customerRows
      .filter((c) => usedCustomers.has(c.id))
      .map((c) => ({
        ...c,
        marketingConsent: consentByCustomer.has(c.id),
        marketingConsentAt: consentByCustomer.get(c.id) ?? null,
      })),
  );
  await insertMany(s.bookings, bookingRows);
  await insertMany(s.bookingGuides, bgRows);
  await insertMany(s.bookingAddons, addonLineRows);
  await insertMany(s.payments, paymentRows);
  await insertMany(s.bookingChecklistItems, checklistRows);
  await insertMany(s.bookingEvents, eventRows);
  await insertMany(s.feedback, feedbackRows);
  await insertMany(s.feedbackGuideRatings, ratingRows);
  const notificationCount = await seedNotifications(now, {
    paymentInstructions: data.SETTINGS.payment_instructions_en,
    lowRatingThreshold: data.SETTINGS.low_rating_threshold,
  });

  const byStatus = bookingRows.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Users: ${staff.length + guideRows.length}, guides: ${guideRows.length}, customers: ${usedCustomers.size}`);
  console.log(`Bookings: ${bookingRows.length}`, byStatus);
  console.log(`Payments: ${paymentRows.length}, feedback: ${feedbackRows.length}, events: ${eventRows.length}, notifications: ${notificationCount}`);
  console.log(`Logins (password "${data.PASSWORD}"): ${[...staff.map((u) => u.email), ...guideRows.map((g) => g.email)].join(", ")}`);
}

/** Valid-looking mobile numbers per country, unique per customer. */
function customerPhone(country: string, index: number): string {
  const n = String(1000 + index).padStart(4, "0");
  const patterns: Record<string, string> = {
    AU: `+6141200${n}`, GB: `+4477009${n}`, US: `+120255${n.padStart(5, "0")}`, DE: `+491511234${n}`,
    NL: `+316123${n}`, JP: `+8190123${n}`, SG: `+659123${n}`, MY: `+60123456${n}`, FR: `+336123${n}`,
    KR: `+8210123${n}`, NZ: `+64211234${n.slice(1)}`, IT: `+393123456${n}`, SA: `+9665012${n}`,
    AE: `+9715012${n}`, KW: `+9655001${n}`, QA: `+9743312${n}`, OM: `+9689212${n}`, RU: `+7916123${n}`,
    CA: `+141655${n.padStart(5, "0")}`, IE: `+353851${n}`, PL: `+48501${n}${n.slice(0, 2)}`,
    PT: `+3519123${n}`, ES: `+346123${n}`, SE: `+46701${n}${n.slice(0, 2)}`, IN: `+919812${n}`,
    CN: `+861381234${n}`, BE: `+324701${n}`, AT: `+436641234${n}`, AR: `+5491123${n}`, EG: `+201001${n}`,
  };
  return patterns[country] ?? `+6281299${n}`;
}

main()
  .then(() => client.close())
  .catch((error) => {
    console.error(error);
    client.close();
    process.exit(1);
  });
