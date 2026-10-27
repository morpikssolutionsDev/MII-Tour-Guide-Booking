import type { Channel } from "@/db/schema";
import type { PriceSnapshot } from "@/domain/pricing";

export type WizardConfigView = {
  today: string;
  maxDate: string;
  holdHours: number;
  /** 12 BR-12-P1: false = bookings are confirmed and paid by the system at creation. */
  paymentConfirmation: boolean;
  languages: { id: string; code: string; nameId: string }[];
  packages: {
    id: string;
    name: string;
    description: string | null;
    pricePerGuide: number;
    maxPeoplePerGuide: number;
    includedAddonIds: string[];
    facilityNames: string[];
    facilities: { name: string; icon: string }[];
  }[];
  addons: { id: string; name: string; price: number; unit: "per_booking" | "per_person" }[];
  rules: { type: "weekend" | "holiday"; name: string; kind: "percent" | "flat_per_guide"; value: number; isActive: boolean }[];
  holidays: { date: string; name: string }[];
};

export type CustomerForm = { phone: string; name: string; nationality: string; email: string; notes: string };

export type ScheduleForm = {
  languageId: string;
  people: number;
  packageId: string;
  date: string | null;
  slotId: string | null;
  addonIds: string[];
  specialNeeds: string;
};

export type SlotView = { slotId: string; label: string; startTime: string; available: boolean; eligibleCount: number; reasonText: string | null };

export type CandidateView = {
  guideId: string;
  displayName: string;
  fullName: string;
  photoUrl: string | null;
  languageCodes: string[];
  weekLoad: number;
  avgRating: number | null;
  ratingCount: number;
  recommended: boolean;
};

export type RescheduleContext = {
  bookingId: string;
  code: string;
  customerName: string;
  status: string;
  hasPayments: boolean;
  before: {
    languageId: string;
    people: number;
    packageId: string;
    date: string;
    slotId: string;
    slotLabel: string;
    guideIds: string[];
    guideNames: Record<string, string>;
    snapshot: PriceSnapshot;
  };
};

export type { Channel };
