// F159: Chatwoot v4.18 Agents merged into Studio's Users table.
// Chatwoot fields: name, email, role (administrator/agent) or custom role, availability, confirmed, provider.
// Studio duplicate fields kept: team, inboxes (Studio "workspace" column), joined date.

export type Availability = "online" | "busy" | "offline";
export type AgentRole = "administrator" | "agent";
export type UserStatus = "Verified" | "Verification Pending";

export const teamValues = ["Support", "Sales", "Billing", "Operations", "Customer Success"] as const;
export type UserTeam = (typeof teamValues)[number];

export const inboxValues = ["Website", "WhatsApp", "Email", "Instagram", "Telegram"] as const;

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: AgentRole;
  customRoleId: number | null;
  availability: Availability;
  confirmed: boolean;
  provider: "email" | "saml";
  team: UserTeam;
  inboxes: string[];
  joinedDate: string;
};

/** The signed-in agent (Chatwoot hides Edit and Delete on your own row). */
export const CURRENT_USER_ID = 1;

export const users: UserRow[] = [
  { id: 1, name: "Sara Al-Mahmoud", email: "sara@souqline.qa", role: "administrator", customRoleId: null, availability: "online", confirmed: true, provider: "email", team: "Operations", inboxes: ["Website", "WhatsApp", "Email"], joinedDate: "02 Feb 2024, 9:10 AM" },
  { id: 2, name: "Omar Haddad", email: "omar.haddad@souqline.qa", role: "administrator", customRoleId: null, availability: "busy", confirmed: true, provider: "email", team: "Operations", inboxes: ["Website", "Email"], joinedDate: "14 Mar 2024, 11:25 AM" },
  { id: 3, name: "Lina Farouk", email: "lina.farouk@souqline.qa", role: "agent", customRoleId: 1, availability: "online", confirmed: true, provider: "email", team: "Support", inboxes: ["Website", "WhatsApp", "Instagram"], joinedDate: "21 Apr 2024, 8:40 AM" },
  { id: 4, name: "Yousef Nasser", email: "yousef.nasser@souqline.qa", role: "agent", customRoleId: null, availability: "online", confirmed: true, provider: "email", team: "Support", inboxes: ["Website", "WhatsApp"], joinedDate: "05 May 2024, 2:15 PM" },
  { id: 5, name: "Maryam Al-Kuwari", email: "maryam.k@souqline.qa", role: "agent", customRoleId: 2, availability: "busy", confirmed: true, provider: "email", team: "Support", inboxes: ["WhatsApp"], joinedDate: "19 May 2024, 10:05 AM" },
  { id: 6, name: "Karim Mansour", email: "karim.mansour@souqline.qa", role: "agent", customRoleId: 3, availability: "online", confirmed: true, provider: "email", team: "Sales", inboxes: ["WhatsApp", "Instagram"], joinedDate: "03 Jun 2024, 4:30 PM" },
  { id: 7, name: "Noor Saleh", email: "noor.saleh@souqline.qa", role: "agent", customRoleId: null, availability: "offline", confirmed: false, provider: "email", team: "Sales", inboxes: ["Website"], joinedDate: "08 Oct 2026, 9:45 AM" },
  { id: 8, name: "Ahmed Rashid", email: "ahmed.rashid@souqline.qa", role: "agent", customRoleId: null, availability: "offline", confirmed: true, provider: "email", team: "Billing", inboxes: ["Email"], joinedDate: "17 Jul 2024, 1:20 PM" },
  { id: 9, name: "Hana Youssef", email: "hana.youssef@souqline.qa", role: "agent", customRoleId: 4, availability: "offline", confirmed: true, provider: "email", team: "Customer Success", inboxes: ["Email"], joinedDate: "29 Aug 2024, 3:55 PM" },
  { id: 10, name: "Daniel Brooks", email: "daniel.brooks@souqline.qa", role: "agent", customRoleId: 5, availability: "busy", confirmed: true, provider: "saml", team: "Operations", inboxes: ["Website", "Email"], joinedDate: "11 Sep 2024, 12:00 PM" },
  { id: 11, name: "Priya Menon", email: "priya.menon@souqline.qa", role: "agent", customRoleId: null, availability: "online", confirmed: true, provider: "email", team: "Support", inboxes: ["Website", "Telegram"], joinedDate: "02 Oct 2024, 7:35 AM" },
  { id: 12, name: "Tariq Aziz", email: "tariq.aziz@souqline.qa", role: "agent", customRoleId: null, availability: "offline", confirmed: false, provider: "email", team: "Billing", inboxes: ["Email"], joinedDate: "10 Oct 2026, 5:10 PM" },
  { id: 13, name: "Fatima Zahra", email: "fatima.zahra@souqline.qa", role: "agent", customRoleId: 2, availability: "online", confirmed: true, provider: "email", team: "Support", inboxes: ["WhatsApp", "Telegram"], joinedDate: "26 Nov 2024, 9:00 AM" },
  { id: 14, name: "Ali Hassan", email: "ali.hassan@souqline.qa", role: "agent", customRoleId: 3, availability: "offline", confirmed: false, provider: "email", team: "Sales", inboxes: ["Instagram"], joinedDate: "11 Oct 2026, 11:40 AM" },
  { id: 15, name: "Reem Khalil", email: "reem.khalil@souqline.qa", role: "agent", customRoleId: null, availability: "busy", confirmed: true, provider: "email", team: "Billing", inboxes: ["Email", "Website"], joinedDate: "14 Jan 2025, 2:50 PM" },
  { id: 16, name: "James Carter", email: "james.carter@souqline.qa", role: "agent", customRoleId: null, availability: "offline", confirmed: true, provider: "saml", team: "Customer Success", inboxes: ["Email"], joinedDate: "03 Mar 2025, 10:30 AM" },
  { id: 17, name: "Aisha Bakr", email: "aisha.bakr@souqline.qa", role: "administrator", customRoleId: null, availability: "offline", confirmed: false, provider: "email", team: "Operations", inboxes: ["Website"], joinedDate: "12 Oct 2026, 8:15 AM" },
];

export const availabilityLabels: Record<Availability, string> = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
};

export function userStatus(user: Pick<UserRow, "confirmed">): UserStatus {
  return user.confirmed ? "Verified" : "Verification Pending";
}

export const statusMeta: Record<UserStatus, { badgeClass: string; dotClass: string }> = {
  Verified: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "Verification Pending": {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
};

export const availabilityMeta: Record<Availability, { badgeClass: string; dotClass: string }> = {
  online: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  busy: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  offline: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};

export function nowJoinedDate() {
  const d = new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${String(d.getDate()).padStart(2, "0")} ${month} ${d.getFullYear()}, ${time}`;
}
