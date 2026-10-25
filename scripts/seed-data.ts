// Static seed data (overview §10). Bookings are generated in seed.ts.

export const PASSWORD = "tmii1234";

export const STAFF_USERS = [
  { key: "admin", name: "Maya Anggraini", email: "admin@tmii.test", role: "admin", channel: null },
  { key: "sales", name: "Dewi Lestari", email: "sales@tmii.test", role: "staff", channel: "sales" },
  { key: "callcenter", name: "Budi Santoso", email: "callcenter@tmii.test", role: "staff", channel: "call_center" },
  { key: "ops", name: "Agus Pratama", email: "ops@tmii.test", role: "staff", channel: "on_the_spot" },
] as const;

export const LANGUAGES = [
  { code: "en", nameId: "Inggris", nameEn: "English" },
  { code: "ar", nameId: "Arab", nameEn: "Arabic" },
  { code: "ru", nameId: "Rusia", nameEn: "Russian" },
] as const;

export const SLOTS = [
  { startTime: "09:00", endTime: "12:00" },
  { startTime: "12:00", endTime: "15:00" },
  { startTime: "16:00", endTime: "19:00" },
] as const;

// 8 guides: all speak English, 3 also Arabic, 2 also Russian (overview §10).
export const GUIDES = [
  { fullName: "Rina Kartika Sari", displayName: "Rina", phone: "+6281211002001", langs: ["en", "ar"], days: [1, 2, 3, 4, 5, 6] },
  { fullName: "Dimas Prasetyo", displayName: "Dimas", phone: "+6281211002002", langs: ["en", "ru"], days: [2, 3, 4, 5, 6, 7] },
  { fullName: "Ayu Paramitha", displayName: "Ayu", phone: "+6281211002003", langs: ["en"], days: [1, 2, 3, 4, 5, 7] },
  { fullName: "Fajar Nugroho", displayName: "Fajar", phone: "+6281211002004", langs: ["en", "ar"], days: [3, 4, 5, 6, 7] },
  { fullName: "Siti Rahmawati", displayName: "Siti", phone: "+6281211002005", langs: ["en", "ar"], days: [1, 2, 4, 5, 6, 7] },
  { fullName: "Yoga Saputra", displayName: "Yoga", phone: "+6281211002006", langs: ["en", "ru"], days: [1, 3, 5, 6, 7] },
  { fullName: "Putri Maharani", displayName: "Putri", phone: "+6281211002007", langs: ["en"], days: [1, 2, 3, 4, 6, 7] },
  { fullName: "Hendra Wijaya", displayName: "Hendra", phone: "+6281211002008", langs: ["en"], days: [1, 2, 3, 5, 6, 7] },
] as const;

export const FACILITIES = [
  { key: "snack", name: "Snack", icon: "Cookie" },
  { key: "water", name: "Air mineral", icon: "GlassWater" },
  { key: "merch", name: "Voucher merchandise", icon: "Ticket" },
  { key: "sarinah", name: "Voucher Sarinah & FnB", icon: "ShoppingBag" },
  { key: "lounge", name: "Ruang tunggu", icon: "Armchair" },
  { key: "vipLounge", name: "Ruang tunggu eksklusif", icon: "Crown" },
] as const;

export const ADDONS = [
  { key: "fastTrack", name: "Fast Track (Angling)", description: "Antrean prioritas di wahana dan anjungan.", price: 50_000, unit: "per_person" },
  { key: "photo", name: "Dokumentasi foto", description: "Fotografer mendampingi selama tur.", price: 150_000, unit: "per_booking" },
  { key: "snackBox", name: "Snack box tambahan", description: "Snack box untuk setiap peserta.", price: 25_000, unit: "per_person" },
] as const;

export const PACKAGES = [
  {
    key: "reguler",
    name: "Reguler",
    description: "Tur keliling TMII bersama tour guide berbahasa asing.",
    pricePerGuide: 500_000,
    maxPeoplePerGuide: 8,
    facilities: ["snack", "water", "merch", "sarinah", "lounge"],
    includedAddons: [],
  },
  {
    key: "premium",
    name: "Premium",
    description: "Reguler plus Fast Track di wahana pilihan.",
    pricePerGuide: 750_000,
    maxPeoplePerGuide: 8,
    facilities: ["snack", "water", "merch", "sarinah", "lounge"],
    includedAddons: ["fastTrack"],
  },
  {
    key: "vip",
    name: "VIP Private",
    description: "Tur privat kelompok kecil dengan ruang tunggu eksklusif.",
    pricePerGuide: 1_200_000,
    maxPeoplePerGuide: 4,
    facilities: ["snack", "water", "merch", "sarinah", "lounge", "vipLounge"],
    includedAddons: ["fastTrack"],
  },
] as const;

export const PRICE_RULES = [
  { type: "weekend", name: "Akhir pekan", kind: "percent", value: 20 },
  { type: "holiday", name: "Hari libur nasional", kind: "percent", value: 25 },
] as const;

// Indonesian national holidays. Fixed-date holidays are exact; lunar-calendar dates
// (Islamic, Chinese, Saka, Buddhist) are estimates to verify against the official SKB.
export const HOLIDAYS = [
  ["2026-01-01", "Tahun Baru 2026 Masehi"],
  ["2026-01-16", "Isra Mikraj Nabi Muhammad SAW"],
  ["2026-02-17", "Tahun Baru Imlek 2577 Kongzili"],
  ["2026-03-19", "Hari Suci Nyepi Tahun Baru Saka 1948"],
  ["2026-03-20", "Idul Fitri 1447 Hijriah"],
  ["2026-03-21", "Idul Fitri 1447 Hijriah"],
  ["2026-04-03", "Wafat Yesus Kristus"],
  ["2026-04-05", "Kebangkitan Yesus Kristus (Paskah)"],
  ["2026-05-01", "Hari Buruh Internasional"],
  ["2026-05-14", "Kenaikan Yesus Kristus"],
  ["2026-05-27", "Idul Adha 1447 Hijriah"],
  ["2026-05-31", "Hari Raya Waisak 2570 BE"],
  ["2026-06-01", "Hari Lahir Pancasila"],
  ["2026-06-16", "Tahun Baru Islam 1448 Hijriah"],
  ["2026-08-17", "Hari Kemerdekaan Republik Indonesia"],
  ["2026-08-25", "Maulid Nabi Muhammad SAW"],
  ["2026-12-25", "Hari Raya Natal"],
  ["2027-01-01", "Tahun Baru 2027 Masehi"],
  ["2027-01-05", "Isra Mikraj Nabi Muhammad SAW"],
  ["2027-02-06", "Tahun Baru Imlek 2578 Kongzili"],
  ["2027-03-08", "Hari Suci Nyepi Tahun Baru Saka 1949"],
  ["2027-03-10", "Idul Fitri 1448 Hijriah"],
  ["2027-03-11", "Idul Fitri 1448 Hijriah"],
  ["2027-03-26", "Wafat Yesus Kristus"],
  ["2027-03-28", "Kebangkitan Yesus Kristus (Paskah)"],
  ["2027-05-01", "Hari Buruh Internasional"],
  ["2027-05-06", "Kenaikan Yesus Kristus"],
  ["2027-05-17", "Idul Adha 1448 Hijriah"],
  ["2027-05-20", "Hari Raya Waisak 2571 BE"],
  ["2027-06-01", "Hari Lahir Pancasila"],
  ["2027-06-06", "Tahun Baru Islam 1449 Hijriah"],
  ["2027-08-15", "Maulid Nabi Muhammad SAW"],
  ["2027-08-17", "Hari Kemerdekaan Republik Indonesia"],
  ["2027-12-25", "Hari Raya Natal"],
] as const;

export const CHECKLIST = [
  { systemKey: "guide_ack", label: "Guide sudah dikonfirmasi", description: "Tercentang otomatis saat semua guide menekan “Saya siap”." },
  { systemKey: null, label: "Materi briefing sudah dibaca", description: "Pastikan guide membaca materi briefing paket ini." },
  { systemKey: null, label: "Fasilitas disiapkan (snack, air mineral, voucher)", description: null },
  { systemKey: null, label: "Konfirmasi ke tim operasional", description: "Informasikan jadwal dan jumlah peserta ke tim operasional." },
] as const;

export const SETTINGS = {
  hold_expiry_hours: 24,
  booking_horizon_days: 90,
  notice_days: 2,
  feedback_link_days: 14,
  low_rating_threshold: 2,
  payment_instructions_en:
    "Please complete your payment within 24 hours to secure your guide. Bank transfer: Bank Mandiri 123-00-0000000-0 a.n. PT Taman Wisata Mini Indonesia Indah (sample). QRIS and card payments are also accepted at the TMII Tour Guide counter. Please send your payment receipt to this WhatsApp number with your booking code.",
};

export const BRIEFINGS = [
  {
    title: "Rute tur standar TMII",
    bodyHtml:
      "<p>Rute 3 jam yang disarankan untuk wisatawan mancanegara:</p><ol><li><strong>Anjungan daerah</strong>: pilih 3–4 anjungan sesuai minat rombongan.</li><li><strong>Museum Indonesia</strong>: kenalkan keragaman budaya Nusantara.</li><li><strong>Danau Arsipel</strong>: titik foto utama, jelaskan peta kepulauan Indonesia.</li><li><strong>Istana Anak-Anak Indonesia</strong>: akhiri tur dan arahkan ke area kuliner.</li></ol><p>Selalu sesuaikan tempo dengan usia dan kondisi peserta.</p>",
    linkUrl: null,
    packages: null,
  },
  {
    title: "Protokol Fast Track (Angling)",
    bodyHtml:
      "<p>Untuk paket Premium dan VIP Private:</p><ul><li>Tunjukkan kartu Fast Track kepada petugas wahana.</li><li>Antrean prioritas berlaku untuk seluruh anggota rombongan.</li><li>Laporkan kendala ke tim operasional melalui grup WhatsApp.</li></ul>",
    linkUrl: null,
    packages: ["premium", "vip"],
  },
  {
    title: "Etika melayani wisatawan Timur Tengah",
    bodyHtml:
      "<p>Hal yang perlu diperhatikan:</p><ul><li>Informasikan lokasi musala dan waktu salat.</li><li>Arahkan ke gerai makanan bersertifikat halal.</li><li>Hormati preferensi interaksi antara pria dan wanita.</li></ul>",
    linkUrl: "https://www.tamanmini.com",
    packages: null,
  },
] as const;

// Tourists. Nationality drives the usual language.
export const CUSTOMERS = [
  ["Olivia Bennett", "AU"], ["James Carter", "GB"], ["Emily Johnson", "US"], ["Lucas Müller", "DE"],
  ["Sophie van Dijk", "NL"], ["Hiroshi Tanaka", "JP"], ["Mei Ling Tan", "SG"], ["Aiman Hakim", "MY"],
  ["Chloé Martin", "FR"], ["Ji-woo Park", "KR"], ["Noah Williams", "NZ"], ["Isabella Rossi", "IT"],
  ["Ahmed Al-Farsi", "SA"], ["Fatima Al-Zahra", "SA"], ["Omar Haddad", "AE"], ["Layla Mansour", "AE"],
  ["Yousef Al-Kandari", "KW"], ["Mariam Al-Thani", "QA"], ["Khalid Al-Harbi", "SA"], ["Noura Saleh", "OM"],
  ["Ivan Petrov", "RU"], ["Anastasia Volkova", "RU"], ["Dmitri Sokolov", "RU"], ["Ekaterina Ivanova", "RU"],
  ["Sergei Morozov", "RU"], ["Grace Thompson", "CA"], ["Liam O'Connor", "IE"], ["Anna Kowalska", "PL"],
  ["Carlos Mendes", "PT"], ["Elena García", "ES"], ["Mohammed Rahman", "AE"], ["Sara Lindqvist", "SE"],
  ["Daniel Cohen", "US"], ["Priya Nair", "IN"], ["Wei Zhang", "CN"], ["Thomas Dubois", "BE"],
  ["Hannah Schmidt", "AT"], ["Mateo Fernández", "AR"], ["Aisha Bakr", "EG"], ["Natalia Smirnova", "RU"],
] as const;

export const ARABIC_COUNTRIES = ["SA", "AE", "KW", "QA", "OM", "EG"];

export const FEEDBACK_COMMENTS = {
  high: [
    "Our guide was wonderful and explained every pavilion with so much passion.",
    "Great tour! The kids loved the Arsipel lake and the castle.",
    "Very knowledgeable guide, perfect English, and great photo spots.",
    "The Fast Track saved us so much time. Highly recommended.",
    "A beautiful introduction to Indonesian culture. Thank you!",
    "Friendly, punctual, and full of stories. We will come back.",
  ],
  mid: [
    "Nice tour but it was very hot, more shade breaks would help.",
    "Good guide, though the route felt a bit rushed at the end.",
    "Enjoyed it overall. The snack could be better.",
  ],
  low: [
    "The guide arrived late and seemed unprepared.",
    "We expected more explanation at the museum. Disappointing.",
  ],
} as const;
