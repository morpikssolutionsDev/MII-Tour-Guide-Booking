import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { bookingGuides, bookings, customers, guides, languages, users, type BookingStatus, type Channel } from "@/db/schema";
import type { PriceSnapshot } from "@/domain/pricing";

/** Everything the team email and its xlsx show about one booking (12 BR-12-E5, E6). */
export type BookingEmailFacts = {
  bookingId: string;
  code: string;
  status: BookingStatus;
  channel: Channel;
  createdByName: string;
  createdAt: string;
  tourDate: string;
  slotStart: string;
  slotEnd: string;
  languageName: string;
  people: number;
  customer: { name: string; phone: string; nationality: string };
  guides: { name: string; phone: string }[];
  specialNeeds: string | null;
  internalNotes: string | null;
  snapshot: PriceSnapshot;
};

export async function loadBookingEmailFacts(ex: Executor, bookingId: string): Promise<BookingEmailFacts | null> {
  const [row] = await ex
    .select({ booking: bookings, customer: customers, languageName: languages.nameId, createdByName: users.name })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(languages, eq(languages.id, bookings.languageId))
    .innerJoin(users, eq(users.id, bookings.createdBy))
    .where(eq(bookings.id, bookingId));
  if (!row) return null;
  const b = row.booking;
  // A merged booking is served by its host's guides (12 BR-12-M1).
  const assigned = await ex
    .select({ name: guides.displayName, phone: guides.phoneE164 })
    .from(bookingGuides)
    .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
    .where(and(eq(bookingGuides.bookingId, b.mergeGroupId ?? b.id), isNull(bookingGuides.releasedAt)));
  return {
    bookingId: b.id,
    code: b.code,
    status: b.status,
    channel: b.channel,
    createdByName: row.createdByName,
    createdAt: b.createdAt,
    tourDate: b.tourDate,
    slotStart: b.slotStart,
    slotEnd: b.slotEnd,
    languageName: row.languageName,
    people: b.people,
    customer: { name: row.customer.name, phone: row.customer.phoneE164, nationality: row.customer.nationality },
    guides: assigned,
    specialNeeds: b.specialNeeds,
    internalNotes: b.internalNotes,
    snapshot: b.priceSnapshot as PriceSnapshot,
  };
}

/** Fixed sample for "Kirim email uji" (BR-12-E7). */
export function sampleBookingEmailFacts(): BookingEmailFacts {
  const total = 1_150_000;
  return {
    bookingId: "contoh",
    code: "TG-000000-001",
    status: "confirmed",
    channel: "call_center",
    createdByName: "Contoh Staf",
    createdAt: new Date().toISOString(),
    tourDate: new Date().toISOString().slice(0, 10),
    slotStart: "09:00",
    slotEnd: "12:00",
    languageName: "Inggris",
    people: 12,
    customer: { name: "Contoh Wisatawan", phone: "+61412345678", nationality: "AU" },
    guides: [
      { name: "Rina", phone: "+6281200000001" },
      { name: "Dimas", phone: "+6281200000002" },
    ],
    specialNeeds: "Satu peserta memakai kursi roda.",
    internalNotes: null,
    snapshot: {
      version: 1,
      calculatedAt: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      people: 12,
      package: { id: "contoh", name: "Reguler", pricePerGuide: 500_000, maxPeoplePerGuide: 8 },
      guidesNeeded: 2,
      packageSubtotal: 1_000_000,
      surcharge: null,
      addons: [{ id: "contoh", name: "Air mineral", unit: "per_person", unitPrice: 12_500, quantity: 12, amount: 150_000, included: false }],
      facilities: [],
      total,
    },
  };
}
