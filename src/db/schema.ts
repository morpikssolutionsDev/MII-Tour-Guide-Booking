// Database schema for every module (docs/spec/00-overview.md §6).
// Conventions: English snake_case columns, text UUID ids, ISO-UTC timestamps,
// dates as `YYYY-MM-DD` (WIB) and times as `HH:mm` (WIB), money as integer rupiah.
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const nowIso = () => new Date().toISOString();
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => text("created_at").notNull().$defaultFn(nowIso);
const updatedAt = () => text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso);
const bool = (name: string) => integer(name, { mode: "boolean" });

export const ROLES = ["admin", "staff", "guide"] as const;
export const CHANNELS = ["sales", "call_center", "on_the_spot"] as const;
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export const ADDON_UNITS = ["per_booking", "per_person"] as const;
export const PRICE_RULE_TYPES = ["weekend", "holiday"] as const;
export const PRICE_RULE_KINDS = ["percent", "flat_per_guide"] as const;
export const BOOKING_STATUSES = [
  "awaiting_payment",
  "confirmed",
  "ready",
  "completed",
  "evaluated",
  "no_show",
  "cancelled",
] as const;
export const CANCEL_REASONS = [
  "tourist_request",
  "unpaid",
  "guide_unavailable",
  "weather",
  "duplicate",
  "other",
  "expired",
] as const;
export const PAYMENT_KINDS = ["payment", "adjustment"] as const;
export const PAYMENT_METHODS = ["bank_transfer", "qris", "cash", "edc"] as const;
export const NOTIFICATION_CHANNELS = ["in_app", "whatsapp_mock"] as const;
export const FEEDBACK_SOURCES = ["tourist", "staff", "guide"] as const;
export const REVISIT_ANSWERS = ["yes", "maybe", "no"] as const;

/* ---------------- 01 Auth & users ---------------- */

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  defaultChannel: text("default_channel", { enum: CHANNELS }),
  isActive: bool("is_active").notNull().default(true),
  lastLoginAt: text("last_login_at"),
  passwordChangedAt: text("password_changed_at").notNull().$defaultFn(nowIso),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ---------------- 04 Settings ---------------- */

export const languages = sqliteTable("languages", {
  id: id(),
  code: text("code").notNull().unique(),
  nameId: text("name_id").notNull().unique(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const slots = sqliteTable("slots", {
  id: id(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const checklistTemplateItems = sqliteTable("checklist_template_items", {
  id: id(),
  systemKey: text("system_key").unique(),
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const briefingMaterials = sqliteTable("briefing_materials", {
  id: id(),
  title: text("title").notNull(),
  bodyHtml: text("body_html").notNull(),
  linkUrl: text("link_url"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  appliesToAll: bool("applies_to_all").notNull().default(true),
  isActive: bool("is_active").notNull().default(true),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const briefingMaterialPackages = sqliteTable(
  "briefing_material_packages",
  {
    materialId: text("material_id")
      .notNull()
      .references(() => briefingMaterials.id),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
  },
  (t) => [primaryKey({ columns: [t.materialId, t.packageId] })],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: updatedAt(),
});

/* ---------------- 02 Tour guides ---------------- */

export const guides = sqliteTable("guides", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  fullName: text("full_name").notNull(),
  displayName: text("display_name").notNull(),
  phoneE164: text("phone_e164").notNull().unique(),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const guideLanguages = sqliteTable(
  "guide_languages",
  {
    guideId: text("guide_id")
      .notNull()
      .references(() => guides.id),
    languageId: text("language_id")
      .notNull()
      .references(() => languages.id),
  },
  (t) => [primaryKey({ columns: [t.guideId, t.languageId] })],
);

export const guideWorkingDays = sqliteTable(
  "guide_working_days",
  {
    guideId: text("guide_id")
      .notNull()
      .references(() => guides.id),
    // ISO weekday: 1 = Senin … 7 = Minggu
    weekday: integer("weekday").notNull(),
  },
  (t) => [primaryKey({ columns: [t.guideId, t.weekday] })],
);

export const guideLeaves = sqliteTable(
  "guide_leaves",
  {
    id: id(),
    guideId: text("guide_id")
      .notNull()
      .references(() => guides.id),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    reason: text("reason").notNull(),
    status: text("status", { enum: LEAVE_STATUSES }).notNull().default("pending"),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id),
    decidedBy: text("decided_by").references(() => users.id),
    decidedAt: text("decided_at"),
    decisionNote: text("decision_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ix_leaves_guide_status").on(t.guideId, t.status, t.startDate)],
);

/* ---------------- 03 Pricing ---------------- */

export const facilities = sqliteTable("facilities", {
  id: id(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const packages = sqliteTable("packages", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  pricePerGuide: integer("price_per_guide").notNull(),
  maxPeoplePerGuide: integer("max_people_per_guide").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const packageFacilities = sqliteTable(
  "package_facilities",
  {
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.facilityId] })],
);

export const addons = sqliteTable("addons", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  unit: text("unit", { enum: ADDON_UNITS }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const packageIncludedAddons = sqliteTable(
  "package_included_addons",
  {
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    addonId: text("addon_id")
      .notNull()
      .references(() => addons.id),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.addonId] })],
);

export const priceRules = sqliteTable("price_rules", {
  id: id(),
  type: text("type", { enum: PRICE_RULE_TYPES }).notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind", { enum: PRICE_RULE_KINDS }).notNull(),
  value: integer("value").notNull(),
  isActive: bool("is_active").notNull().default(true),
  updatedAt: updatedAt(),
});

export const holidays = sqliteTable("holidays", {
  id: id(),
  date: text("date").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ---------------- 05 Booking ---------------- */

export const customers = sqliteTable("customers", {
  id: id(),
  name: text("name").notNull(),
  phoneE164: text("phone_e164").notNull().unique(),
  nationality: text("nationality").notNull(),
  email: text("email"),
  notes: text("notes"),
  marketingConsent: bool("marketing_consent").notNull().default(false),
  marketingConsentAt: text("marketing_consent_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: id(),
    code: text("code").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    channel: text("channel", { enum: CHANNELS }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    languageId: text("language_id")
      .notNull()
      .references(() => languages.id),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    slotId: text("slot_id")
      .notNull()
      .references(() => slots.id),
    slotStart: text("slot_start").notNull(),
    slotEnd: text("slot_end").notNull(),
    tourDate: text("tour_date").notNull(),
    people: integer("people").notNull(),
    guidesNeeded: integer("guides_needed").notNull(),
    status: text("status", { enum: BOOKING_STATUSES }).notNull(),
    priceSnapshot: text("price_snapshot", { mode: "json" }).notNull(),
    totalAmount: integer("total_amount").notNull(),
    holdExpiresAt: text("hold_expires_at"),
    specialNeeds: text("special_needs"),
    internalNotes: text("internal_notes"),
    groupRef: text("group_ref"),
    cancelReason: text("cancel_reason", { enum: CANCEL_REASONS }),
    cancelDetail: text("cancel_detail"),
    refundNote: text("refund_note"),
    cancelledAt: text("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => users.id),
    completedAt: text("completed_at"),
    completedBy: text("completed_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ix_bookings_date_slot").on(t.tourDate, t.slotId),
    index("ix_bookings_status_hold").on(t.status, t.holdExpiresAt),
    index("ix_bookings_customer").on(t.customerId),
    index("ix_bookings_created").on(t.createdAt),
  ],
);

export const bookingGuides = sqliteTable(
  "booking_guides",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id),
    guideId: text("guide_id")
      .notNull()
      .references(() => guides.id),
    tourDate: text("tour_date").notNull(),
    slotId: text("slot_id")
      .notNull()
      .references(() => slots.id),
    assignedAt: text("assigned_at").notNull().$defaultFn(nowIso),
    releasedAt: text("released_at"),
    notifiedAt: text("notified_at"),
    shortNotice: bool("short_notice").notNull().default(false),
    acknowledgedAt: text("acknowledged_at"),
  },
  (t) => [
    // Double-booking guard (05 §4): one active assignment per guide per date + slot.
    uniqueIndex("ux_guide_slot")
      .on(t.guideId, t.tourDate, t.slotId)
      .where(sql`released_at IS NULL`),
    index("ix_booking_guides_booking").on(t.bookingId),
  ],
);

export const bookingAddons = sqliteTable(
  "booking_addons",
  {
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id),
    addonId: text("addon_id")
      .notNull()
      .references(() => addons.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    amount: integer("amount").notNull(),
    included: bool("included").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.addonId] })],
);

export const bookingEvents = sqliteTable(
  "booking_events",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id),
    type: text("type").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id),
    payload: text("payload", { mode: "json" }).notNull().$defaultFn(() => ({})),
    at: text("at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("ix_booking_events_booking").on(t.bookingId, t.at)],
);

/* ---------------- 06 Payment ---------------- */

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id),
    kind: text("kind", { enum: PAYMENT_KINDS }).notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull(),
    amount: integer("amount").notNull(),
    paidAt: text("paid_at").notNull(),
    reference: text("reference"),
    proofUrl: text("proof_url"),
    proofName: text("proof_name"),
    note: text("note"),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    voidedAt: text("voided_at"),
    voidedBy: text("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
  },
  (t) => [index("ix_payments_booking").on(t.bookingId), index("ix_payments_paid_at").on(t.paidAt)],
);

/* ---------------- 07 Preparation ---------------- */

export const bookingChecklistItems = sqliteTable(
  "booking_checklist_items",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id),
    systemKey: text("system_key"),
    label: text("label").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    checkedAt: text("checked_at"),
    checkedBy: text("checked_by").references(() => users.id),
  },
  (t) => [
    index("ix_checklist_booking").on(t.bookingId),
    uniqueIndex("ux_checklist_system")
      .on(t.bookingId, t.systemKey)
      .where(sql`system_key IS NOT NULL`),
  ],
);

/* ---------------- 09 Notifications ---------------- */

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    eventKey: text("event_key").notNull(),
    channel: text("channel", { enum: NOTIFICATION_CHANNELS }).notNull(),
    locale: text("locale", { enum: ["id", "en"] }).notNull(),
    recipientUserId: text("recipient_user_id").references(() => users.id),
    recipientPhone: text("recipient_phone"),
    recipientName: text("recipient_name").notNull(),
    bookingId: text("booking_id").references(() => bookings.id),
    leaveId: text("leave_id").references(() => guideLeaves.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    context: text("context", { mode: "json" }).notNull().$defaultFn(() => ({})),
    dedupeKey: text("dedupe_key").unique(),
    readAt: text("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ix_notifications_recipient").on(t.recipientUserId, t.readAt, t.createdAt),
    index("ix_notifications_booking").on(t.bookingId),
    index("ix_notifications_channel").on(t.channel, t.createdAt),
  ],
);

/* ---------------- 10 Feedback ---------------- */

export const feedback = sqliteTable("feedback", {
  id: id(),
  bookingId: text("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id),
  token: text("token").notNull().unique(),
  tokenExpiresAt: text("token_expires_at").notNull(),
  submittedAt: text("submitted_at"),
  source: text("source", { enum: FEEDBACK_SOURCES }),
  enteredBy: text("entered_by").references(() => users.id),
  overallRating: integer("overall_rating"),
  comment: text("comment"),
  wouldRevisit: text("would_revisit", { enum: REVISIT_ANSWERS }),
  contactConsent: bool("contact_consent"),
  invalidAttempts: integer("invalid_attempts").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const feedbackGuideRatings = sqliteTable(
  "feedback_guide_ratings",
  {
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id),
    guideId: text("guide_id")
      .notNull()
      .references(() => guides.id),
    rating: integer("rating").notNull(),
  },
  (t) => [primaryKey({ columns: [t.feedbackId, t.guideId] })],
);

export type Role = (typeof ROLES)[number];
export type Channel = (typeof CHANNELS)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export type CancelReason = (typeof CANCEL_REASONS)[number];
