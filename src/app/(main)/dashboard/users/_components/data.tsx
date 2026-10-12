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

/** The signed-in agent (Chatwoot hides Edit and Delete on your own row): Arham Khan, the sidebar user.
 * Ids 1-5 are the five agents of Conversations and Settings (cw-data.ts, settings/inboxes data.ts). */
export const CURRENT_USER_ID = 1;

export const users: UserRow[] = [
  { id: 1, name: "Arham Khan", email: "arham.khan@weblabs.studio", role: "administrator", customRoleId: null, availability: "online", confirmed: true, provider: "email", team: "Operations", inboxes: ["Website", "WhatsApp", "Email"], joinedDate: "02 Feb 2024, 9:10 AM" },
  { id: 2, name: "Priya Nair", email: "priya.nair@weblabs.studio", role: "agent", customRoleId: null, availability: "online", confirmed: true, provider: "email", team: "Operations", inboxes: ["Website", "Email"], joinedDate: "14 Mar 2024, 11:25 AM" },
  { id: 3, name: "Yousef Al-Harbi", email: "yousef.harbi@weblabs.studio", role: "agent", customRoleId: 1, availability: "busy", confirmed: true, provider: "email", team: "Support", inboxes: ["Website", "WhatsApp", "Instagram"], joinedDate: "21 Apr 2024, 8:40 AM" },
  { id: 4, name: "Lina Haddad", email: "lina.haddad@weblabs.studio", role: "agent", customRoleId: null, availability: "online", confirmed: true, provider: "email", team: "Support", inboxes: ["Website", "WhatsApp"], joinedDate: "05 May 2024, 2:15 PM" },
  { id: 5, name: "Ravi Menon", email: "ravi.menon@weblabs.studio", role: "agent", customRoleId: 2, availability: "offline", confirmed: true, provider: "email", team: "Support", inboxes: ["WhatsApp"], joinedDate: "19 May 2024, 10:05 AM" },
  { id: 6, name: "Karim Mansour", email: "karim.mansour@weblabs.studio", role: "agent", customRoleId: 3, availability: "online", confirmed: true, provider: "email", team: "Sales", inboxes: ["WhatsApp", "Instagram"], joinedDate: "03 Jun 2024, 4:30 PM" },
  { id: 7, name: "Noor Saleh", email: "noor.saleh@weblabs.studio", role: "agent", customRoleId: null, availability: "offline", confirmed: false, provider: "email", team: "Sales", inboxes: ["Website"], joinedDate: "08 Oct 2026, 9:45 AM" },
  { id: 8, name: "Ahmed Rashid", email: "ahmed.rashid@weblabs.studio", role: "agent", customRoleId: null, availability: "offline", confirmed: true, provider: "email", team: "Billing", inboxes: ["Email"], joinedDate: "17 Jul 2024, 1:20 PM" },
  { id: 9, name: "Hana Youssef", email: "hana.youssef@weblabs.studio", role: "agent", customRoleId: 4, availability: "offline", confirmed: true, provider: "email", team: "Customer Success", inboxes: ["Email"], joinedDate: "29 Aug 2024, 3:55 PM" },
  { id: 10, name: "Marco Bianchi", email: "marco.bianchi@weblabs.studio", role: "agent", customRoleId: 5, availability: "busy", confirmed: true, provider: "saml", team: "Operations", inboxes: ["Website", "Email"], joinedDate: "11 Sep 2024, 12:00 PM" },
  { id: 11, name: "Sofia Martins", email: "sofia.martins@weblabs.studio", role: "agent", customRoleId: null, availability: "online", confirmed: true, provider: "email", team: "Support", inboxes: ["Website", "Telegram"], joinedDate: "02 Oct 2024, 7:35 AM" },
  { id: 12, name: "Tariq Aziz", email: "tariq.aziz@weblabs.studio", role: "agent", customRoleId: null, availability: "offline", confirmed: false, provider: "email", team: "Billing", inboxes: ["Email"], joinedDate: "10 Oct 2026, 5:10 PM" },
  { id: 13, name: "Huda Saleem", email: "huda.saleem@weblabs.studio", role: "agent", customRoleId: 2, availability: "online", confirmed: true, provider: "email", team: "Support", inboxes: ["WhatsApp", "Telegram"], joinedDate: "26 Nov 2024, 9:00 AM" },
  { id: 14, name: "Ali Hassan", email: "ali.hassan@weblabs.studio", role: "agent", customRoleId: 3, availability: "offline", confirmed: false, provider: "email", team: "Sales", inboxes: ["Instagram"], joinedDate: "11 Oct 2026, 11:40 AM" },
  { id: 15, name: "Rania Khalil", email: "rania.khalil@weblabs.studio", role: "agent", customRoleId: null, availability: "busy", confirmed: true, provider: "email", team: "Billing", inboxes: ["Email", "Website"], joinedDate: "14 Jan 2025, 2:50 PM" },
  { id: 16, name: "Tom Becker", email: "tom.becker@weblabs.studio", role: "agent", customRoleId: null, availability: "offline", confirmed: true, provider: "saml", team: "Customer Success", inboxes: ["Email"], joinedDate: "03 Mar 2025, 10:30 AM" },
  { id: 17, name: "Dana Bakr", email: "dana.bakr@weblabs.studio", role: "administrator", customRoleId: null, availability: "offline", confirmed: false, provider: "email", team: "Operations", inboxes: ["Website"], joinedDate: "12 Oct 2026, 8:15 AM" },
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
