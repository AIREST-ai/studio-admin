export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  country: string;
  bio: string;
  lastActivity: string;
  lastActivityMinutes: number;
  createdAt: string;
  labels: string[];
}

// T-285 (Fahad 125.7): no value without a source, the unknown stays empty. Where each value comes from in this sample:
// - Email address: the email channel (Chatwoot makes the contact from the sender), or the Website pre-chat form, which
//   asks for the email (Settings > Inboxes > Website Chat > Pre Chat Form: Email Id on and required).
// - Phone: only a channel that carries a number: WhatsApp (Noura 1, James 6, Omar 12) or a phone call (Daniel 10).
//   Email, website chat, Messenger and Instagram give no number, so those contacts have none.
// - Company: the signature of the contact's own email in the Support Email mail view ("Name / Role, Company").
//   Sarah 3 (Instagram, website chat) and James 6 (WhatsApp) send no email, so they have no company.
// - Country: only the calling code of a known phone number (+974 Qatar, +971 United Arab Emirates). Email, website
//   chat, Messenger and Instagram give none here, so Khalid 2, Sarah 3, Abdullah 4, Maryam 5, Fatima 7, Hamad 8 and
//   Reem 9 have no country.
// - City: no channel in this sample gives one, so every city is empty until an agent enters one.
// - James 6 writes only on WhatsApp, so his email has no source either and stays empty (M129-A, after the T-285
//   judge). The inbox now keys a contact by its Contacts id, not its email (chat cw-store.ts contactKeyOf).
// - Aisha 11 has no conversation, so she was added by hand (Add contact); her email, country and note are what the
//   agent typed. Bio is the agent's own note on the contact.
export const contacts: Contact[] = [
  {
    id: 1,
    name: "Noura Al-Thani",
    email: "noura.althani@outlook.com",
    phone: "+974 5512 3348",
    company: "Ooredoo",
    city: "",
    country: "Qatar",
    bio: "Head of Digital Operations. Reports staging incidents and handles the Ooredoo billing account.",
    lastActivity: "1 minute ago",
    lastActivityMinutes: 1,
    createdAt: "Mar 14, 2026",
    labels: [],
  },
  {
    id: 2,
    name: "Khalid Al-Mansoori",
    email: "khalid.mansoori@gmail.com",
    phone: "",
    company: "Emirates NBD",
    city: "",
    country: "",
    bio: "Prefers WhatsApp. Follow up after Eid.",
    lastActivity: "2 hours ago",
    lastActivityMinutes: 121,
    createdAt: "Feb 2, 2026",
    labels: [],
  },
  {
    id: 3,
    name: "Sarah Mitchell",
    email: "sarah.mitchell@qf.org.qa",
    phone: "",
    company: "",
    city: "",
    country: "",
    bio: "Coordinator for the spring school programme.",
    lastActivity: "8 minutes ago",
    lastActivityMinutes: 8,
    createdAt: "Jan 19, 2026",
    labels: [],
  },
  {
    id: 4,
    name: "Abdullah Al-Qahtani",
    email: "a.qahtani@stc.com.sa",
    phone: "",
    company: "STC",
    city: "",
    country: "",
    bio: "",
    lastActivity: "Yesterday",
    lastActivityMinutes: 1440,
    createdAt: "Dec 8, 2025",
    labels: [],
  },
  {
    id: 5,
    name: "Maryam Al-Kuwari",
    email: "maryam.kuwari@hotmail.com",
    phone: "",
    company: "Hamad Medical Corporation",
    city: "",
    country: "",
    bio: "Booked a demo for the compliance team.",
    lastActivity: "2 hours ago",
    lastActivityMinutes: 138,
    createdAt: "Apr 1, 2026",
    labels: [],
  },
  {
    id: 6,
    name: "James Carter",
    email: "",
    phone: "+971 55 902 3318",
    company: "",
    city: "",
    country: "United Arab Emirates",
    bio: "",
    lastActivity: "27 minutes ago",
    lastActivityMinutes: 27,
    createdAt: "Nov 23, 2025",
    labels: [],
  },
  {
    id: 7,
    name: "Fatima Al-Suwaidi",
    email: "fatima.suwaidi@etihad.ae",
    phone: "",
    company: "Etihad Airways",
    city: "",
    country: "",
    bio: "Corporate travel desk.",
    lastActivity: "Yesterday",
    lastActivityMinutes: 1460,
    createdAt: "Oct 30, 2025",
    labels: [],
  },
  {
    id: 8,
    name: "Hamad Al-Marri",
    email: "hamad.almarri@qatarairways.com.qa",
    phone: "",
    company: "Qatar Airways",
    city: "",
    country: "",
    bio: "",
    lastActivity: "1 hour ago",
    lastActivityMinutes: 104,
    createdAt: "Sep 12, 2025",
    labels: [],
  },
  {
    id: 9,
    name: "Reem Al-Otaibi",
    email: "reem.otaibi@aramco.com",
    phone: "",
    company: "Saudi Aramco",
    city: "",
    country: "",
    bio: "Requested Arabic invoices.",
    lastActivity: "41 minutes ago",
    lastActivityMinutes: 41,
    createdAt: "Aug 4, 2025",
    labels: [],
  },
  {
    id: 10,
    name: "Daniel Hughes",
    email: "daniel.hughes@qnb.com",
    phone: "+974 3091 5567",
    company: "QNB",
    city: "",
    country: "Qatar",
    bio: "",
    lastActivity: "1 hour ago",
    lastActivityMinutes: 88,
    createdAt: "Jul 21, 2025",
    labels: [],
  },
  {
    id: 11,
    name: "Aisha Al-Hajri",
    email: "aisha.hajri@gmail.com",
    phone: "",
    company: "",
    city: "",
    country: "Qatar",
    bio: "Parent, interested in the kids English plan.",
    lastActivity: "3 weeks ago",
    lastActivityMinutes: 30240,
    createdAt: "Jun 15, 2025",
    labels: [],
  },
  {
    id: 12,
    name: "Omar Al-Shehhi",
    email: "omar.shehhi@adnoc.ae",
    phone: "+971 56 238 9050",
    company: "ADNOC",
    city: "",
    country: "United Arab Emirates",
    bio: "",
    lastActivity: "14 minutes ago",
    lastActivityMinutes: 14,
    createdAt: "May 2, 2025",
    labels: [],
  },
];

// The contact page's History and its Conversations / Open stats come from the inbox conversations
// (chat/_components/data.ts via contactIdOf), and its attributes from cw-data initialContactAttributes.

export const notes = [
  {
    author: "You",
    time: "2 days ago",
    body: "Called back, prefers Arabic. Wants a quote before the end of the month.",
  },
  { author: "Lina Haddad", time: "1 week ago", body: "Sent the pricing sheet by email." },
];

export const sortOptions = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone_number", label: "Phone number" },
  { value: "company", label: "Company" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "last_activity_at", label: "Last activity" },
  { value: "created_at", label: "Created at" },
];

// T-285 (Fahad 125.9): every country in the world, not six Gulf ones. The ISO 3166-1 codes give the full list and the
// browser's own English names (Intl.DisplayNames) name them, so no hand-typed names to go stale.
const countryCodes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const countries = countryCodes
  .split(" ")
  .map((code) => regionNames.of(code) ?? code)
  .sort((a, b) => a.localeCompare(b));

export const avatarTones = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
];

export function toneFor(id: number) {
  return avatarTones[id % avatarTones.length];
}
