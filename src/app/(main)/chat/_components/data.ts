import type { LucideIcon } from "lucide-react";
import { Mail, MessageCircle, Phone } from "lucide-react";

import { contacts as directory } from "@/app/(main)/dashboard/contacts/_components/data";
import { isWebsiteContactOnline, WEBSITE_CHANNEL } from "@/lib/cw/presence/website-presence";

export type Conversation = {
  id: number;
  group: "Today" | "Yesterday";
  name: string;
  subject: string;
  preview: string;
  time: string;
  isUnread: boolean;
  unreadCount: number;
  channel: NavItem["id"]; // F149: channel id from channelItems (email, chat, whatsapp, …)
  contact: Contact;
  messages: Message[];
  ago?: number; // F159: minutes since the last activity (Today conversations), see realClockAges
};

export type Message = {
  id: number;
  align: "start" | "end";
  text: string;
  time: string;
  reaction?: string;
  ago?: number; // F159: minutes since the message was sent (Today conversations)
};

export type Contact = {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  timezone: string;
  status: string;
  qualifiedAt: string;
  tags: string[];
};

export type NavItem = {
  id: string;
  title: string;
  label?: string;
  icon: LucideIcon;
  isActive: boolean;
};

// Studio template threads; the people are swapped for the Contacts page people below (F159).
// Unattended threads (#3, #8, #15, #16, #21) have no agent reply yet: the customer is still waiting (Chatwoot
// Unattended = no first reply).
// T-130 (Fahad 21:21 "ازل"): no Pinned group; #1, #2 and #3 (last active 1, 5 and 8 min ago) are in Today.
const templateConversations: Conversation[] = [
  // Today
  {
    id: 1,
    group: "Today",
    channel: "whatsapp",
    name: "Olivia Rhye",
    subject: "Deployment pipeline failing on staging since last deploy",
    preview: "We're seeing 502 errors after the latest build went out. Rollback didn't help.",
    time: "Just now",
    isUnread: true,
    unreadCount: 4,
    contact: {
      name: "Olivia Rhye",
      role: "Senior DevOps Engineer",
      company: "Railway Systems Inc.",
      email: "olivia.rhye@weblabs.studio",
      phone: "+1 (415) 555-0123",
      website: "railway.co",
      location: "San Francisco, CA, USA",
      timezone: "PDT (UTC-7)",
      status: "Lead",
      qualifiedAt: "Mar 5, 2026",
      tags: ["DevOps", "Enterprise", "P0"],
    },
    messages: [
      {
        id: 101,
        align: "start",
        text: "We're seeing 502s on staging right after the latest build. We rolled back, but the health checks are still red.",
        time: "10 min ago",
      },
      {
        id: 102,
        align: "end",
        text: "Thanks, Olivia. I'm checking the deploy logs and upstream gateway config now.",
        time: "8 min ago",
      },
      {
        id: 103,
        align: "start",
        text: "The weird part is API traffic looks fine, but the web container is failing readiness probes.",
        time: "5 min ago",
      },
      {
        id: 104,
        align: "end",
        text: "Found a mismatch in the staging environment variables. I'm applying the fix and will confirm once the probes recover.",
        time: "3 min ago",
        reaction: "👍",
      },
      {
        id: 105,
        align: "start",
        text: "Great. Keep me posted, this is blocking our QA pass.",
        time: "1 min ago",
        reaction: "👀",
      },
    ],
  },
  {
    id: 2,
    group: "Today",
    channel: "email",
    name: "Phoenix Baker",
    subject: "Refund for order #8823 — double charged",
    preview: "I was billed twice on the 3rd. Can someone look into this and reverse the duplicate?",
    time: "5m",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Phoenix Baker",
      role: "Operations Lead",
      company: "Meridian Retail Group",
      email: "phoenix.baker@weblabs.studio",
      phone: "+1 (312) 555-0184",
      website: "meridianretail.com",
      location: "Chicago, IL, USA",
      timezone: "CDT (UTC-5)",
      status: "Customer",
      qualifiedAt: "Jan 18, 2026",
      tags: ["Billing", "Enterprise"],
    },
    messages: [
      {
        id: 201,
        align: "start",
        text: "I was charged twice for order #8823. One payment cleared on the 3rd and the duplicate posted this morning.",
        time: "5 min ago",
      },
      {
        id: 202,
        align: "end",
        text: "Thanks for flagging it, Phoenix. I can see both transactions and I'm checking which one was attached to the invoice.",
        time: "4 min ago",
      },
      {
        id: 203,
        align: "start",
        text: "Please reverse the duplicate if possible. Our finance team is closing the week today.",
        time: "3 min ago",
      },
      {
        id: 204,
        align: "end",
        text: "The duplicate was a retry from the old payment method. I've started the refund and sent the receipt to your billing email.",
        time: "2 min ago",
        reaction: "👍",
      },
      {
        id: 205,
        align: "start",
        text: "Perfect, thanks. I'll let finance know to expect it.",
        time: "1 min ago",
        reaction: "✅",
      },
    ],
  },
  {
    id: 3,
    group: "Today",
    channel: "instagram",
    name: "Lana Steiner",
    subject: "Access to analytics dashboard — permissions issue",
    preview: "I'm getting a 403 since the role update yesterday. Tried clearing cache already.",
    time: "8m",
    isUnread: true,
    unreadCount: 2,
    contact: {
      name: "Lana Steiner",
      role: "Data Platform Lead",
      company: "Monsoon Analytics",
      email: "lana.steiner@acme.inc",
      phone: "+91 98765 43210",
      website: "monsoonanalytics.in",
      location: "Bengaluru, India",
      timezone: "IST (UTC+5:30)",
      status: "Qualified",
      qualifiedAt: "Apr 2, 2026",
      tags: ["IAM", "Enterprise", "High Value"],
    },
    messages: [
      {
        id: 301,
        align: "start",
        text: "I'm getting a 403 on the analytics dashboard since yesterday's role update. Clearing cache did not change anything.",
        time: "8 min ago",
      },
      {
        id: 303,
        align: "start",
        text: "I still have access to exports, just not the dashboard views. Other admins on my team can open them.",
        time: "5 min ago",
      },
    ],
  },
  {
    id: 5,
    group: "Today",
    channel: "facebook",
    name: "Demi Wilkinson",
    subject: "Sustainability report inquiry",
    preview: "Hi team, I'm looking for the latest ESG disclosure for our upcoming board meeting.",
    time: "10:42 AM",
    isUnread: true,
    unreadCount: 5,
    contact: {
      name: "Demi Wilkinson",
      role: "Sustainability Manager",
      company: "BrightFuture Co.",
      email: "demi.wilkinson@weblabs.studio",
      phone: "+1 (415) 555-0189",
      website: "brightfuture.co",
      location: "San Francisco, CA, USA",
      timezone: "PDT (UTC-7)",
      status: "Qualified",
      qualifiedAt: "Jan 22, 2026",
      tags: ["Sustainability", "Enterprise", "FinServ"],
    },
    messages: [
      {
        id: 501,
        align: "start",
        text: "Hi, we're preparing board materials and need your latest ESG disclosure, especially the carbon footprint section.",
        time: "10:42 AM",
      },
      {
        id: 502,
        align: "end",
        text: "Hi Demi. I can share the 2025 report and the carbon accounting appendix. Do you need the raw emissions data too?",
        time: "10:44 AM",
      },
      {
        id: 503,
        align: "start",
        text: "Yes, raw Scope 3 data would help. Our board packet needs supply-chain numbers, not just the summary.",
        time: "10:47 AM",
      },
      {
        id: 504,
        align: "end",
        text: "Got it. I'll send the executive summary, Scope 3 CSV, and the methodology note in one bundle.",
        time: "10:49 AM",
        reaction: "👍",
      },
      { id: 505, align: "start", text: "Perfect. That should cover everything for Thursday.", time: "10:50 AM" },
    ],
  },
  {
    id: 6,
    group: "Today",
    channel: "whatsapp",
    name: "Candice Wu",
    subject: "Bulk export keeps timing out",
    preview: "Tried three times this morning. It gets to about 60% then throws a gateway error.",
    time: "10:15 AM",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Candice Wu",
      role: "Data Engineer",
      company: "Harbor Ops",
      email: "candice.wu@sandbox.dev",
      phone: "+1 (206) 555-0172",
      website: "harborops.com",
      location: "Seattle, WA, USA",
      timezone: "PDT (UTC-7)",
      status: "Lead",
      qualifiedAt: "May 10, 2026",
      tags: ["Data", "Performance"],
    },
    messages: [
      {
        id: 601,
        align: "start",
        text: "The bulk export keeps timing out. It reaches about 60 percent and then throws a gateway error.",
        time: "10:15 AM",
      },
      {
        id: 602,
        align: "end",
        text: "Thanks, Candice. Is this for the full shipment history export or a filtered date range?",
        time: "10:12 AM",
      },
      {
        id: 603,
        align: "start",
        text: "Full history. We need it for a warehouse migration, so the file is pretty large.",
        time: "10:09 AM",
      },
      {
        id: 604,
        align: "end",
        text: "I'll queue it as an async export and email the download link once it finishes. That avoids the gateway timeout.",
        time: "10:06 AM",
        reaction: "✅",
      },
    ],
  },
  {
    id: 7,
    group: "Today",
    channel: "email",
    name: "Natali Craig",
    subject: "Invoice INV-4821 still marked unpaid",
    preview: "Our payment cleared on Friday — screenshot of the confirmation attached here.",
    time: "9:58 AM",
    isUnread: true,
    unreadCount: 1,
    contact: {
      name: "Natali Craig",
      role: "Finance Manager",
      company: "Lumen Studio",
      email: "natali.craig@weblabs.studio",
      phone: "+39 02 5555 0184",
      website: "lumenstudio.co",
      location: "Milan, Italy",
      timezone: "CEST (UTC+2)",
      status: "Customer",
      qualifiedAt: "Oct 14, 2025",
      tags: ["Billing", "SMB"],
    },
    messages: [
      {
        id: 701,
        align: "start",
        text: "Invoice INV-4821 still shows unpaid even though our bank transfer cleared last Friday.",
        time: "9:58 AM",
      },
      {
        id: 702,
        align: "end",
        text: "Thanks, Natali. Can you send the transfer reference so I can match it against our payment processor records?",
        time: "9:54 AM",
      },
      {
        id: 703,
        align: "start",
        text: "It is on the confirmation screenshot I attached. The reference ends in 9147.",
        time: "9:50 AM",
      },
      {
        id: 704,
        align: "end",
        text: "Found it. The payment was received but not reconciled to the invoice. I've marked INV-4821 as paid.",
        time: "9:46 AM",
        reaction: "🙏",
      },
    ],
  },
  {
    id: 8,
    group: "Today",
    channel: "chat",
    name: "Drew Cano",
    subject: "Onboarding docs for new hire — where to start?",
    preview: "Got a new backend dev starting Monday. Need the standard checklist and repo access steps.",
    time: "9:32 AM",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Drew Cano",
      role: "Engineering Manager",
      company: "AtlasWorks",
      email: "drew.cano@internal.tools",
      phone: "+1 (512) 555-0166",
      website: "atlasworks.co",
      location: "Austin, TX, USA",
      timezone: "CDT (UTC-5)",
      status: "Customer",
      qualifiedAt: "Aug 3, 2025",
      tags: ["Onboarding", "Platform", "NPS Promoter"],
    },
    messages: [
      {
        id: 801,
        align: "start",
        text: "We have a backend developer starting Monday. What's the best onboarding path for repo access and environment setup?",
        time: "9:32 AM",
      },
      {
        id: 803,
        align: "start",
        text: "Please include staging credentials and any branch naming rules if those are documented.",
        time: "9:24 AM",
      },
    ],
  },
  {
    id: 9,
    group: "Today",
    channel: "email",
    name: "Orlando Diggs",
    subject: "Downgrade from Enterprise to Pro plan",
    preview: "We're winding down the project at end of quarter. Is there an early termination fee?",
    time: "9:12 AM",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Orlando Diggs",
      role: "CTO",
      company: "Northstar Workspace",
      email: "orlando.diggs@acme.inc",
      phone: "+1 (720) 555-0195",
      website: "northstarworkspace.com",
      location: "Denver, CO, USA",
      timezone: "MDT (UTC-6)",
      status: "At-Risk",
      qualifiedAt: "Dec 1, 2025",
      tags: ["Churn Risk", "Enterprise", "Downgrade"],
    },
    messages: [
      {
        id: 901,
        align: "start",
        text: "We're winding down the current project and need to downgrade from Enterprise to Pro at the end of the quarter.",
        time: "9:12 AM",
      },
      {
        id: 902,
        align: "end",
        text: "Understood, Orlando. I can walk through the downgrade path and confirm whether any contract terms apply.",
        time: "9:08 AM",
      },
      {
        id: 903,
        align: "start",
        text: "Main question is whether there is an early termination fee or if we can switch at renewal.",
        time: "9:04 AM",
      },
      {
        id: 904,
        align: "end",
        text: "Your agreement allows downgrade at renewal with 30 days notice. I'll send the date and feature impact summary.",
        time: "9:00 AM",
      },
    ],
  },
  {
    id: 10,
    group: "Today",
    channel: "phone",
    name: "Andi Lane",
    subject: "API rate limit hitting hard during peak",
    preview: "Our batch jobs are getting 429s every 15 minutes between 9 and 11 AM. Need a bump.",
    time: "8:47 AM",
    isUnread: true,
    unreadCount: 3,
    contact: {
      name: "Andi Lane",
      role: "Backend Lead",
      company: "LedgerLoop",
      email: "andi.lane@weblabs.studio",
      phone: "+353 1 555 0189",
      website: "ledgerloop.io",
      location: "Dublin, Ireland",
      timezone: "IST (UTC+1)",
      status: "Lead",
      qualifiedAt: "Apr 19, 2026",
      tags: ["API", "Scaling", "Enterprise"],
    },
    messages: [
      {
        id: 1001,
        align: "start",
        text: "Our batch jobs are hitting 429s every few minutes during peak hours. We need a temporary rate limit bump.",
        time: "8:47 AM",
      },
      {
        id: 1002,
        align: "end",
        text: "Thanks, Andi. Which API keys are affected and what peak window are you seeing?",
        time: "8:43 AM",
      },
      {
        id: 1003,
        align: "start",
        text: "Mostly invoice-sync and customer-import, between 9 and 11 AM Dublin time.",
        time: "8:39 AM",
      },
      {
        id: 1004,
        align: "end",
        text: "I can raise the limit for those keys for seven days while we review your long-term quota.",
        time: "8:35 AM",
      },
    ],
  },
  {
    id: 11,
    group: "Today",
    channel: "email",
    name: "Kate Morrison",
    subject: "Custom domain SSL cert expired overnight",
    preview: "Users are seeing certificate warnings when they hit our shop page. This is urgent.",
    time: "8:05 AM",
    isUnread: true,
    unreadCount: 6,
    contact: {
      name: "Kate Morrison",
      role: "Product Manager",
      company: "Storefront Labs",
      email: "kate.morrison@weblabs.studio",
      phone: "+1 (213) 555-0192",
      website: "storefrontlabs.com",
      location: "Los Angeles, CA, USA",
      timezone: "PDT (UTC-7)",
      status: "Customer",
      qualifiedAt: "Jun 2, 2026",
      tags: ["Urgent", "SMB", "SSL"],
    },
    messages: [
      {
        id: 1101,
        align: "start",
        text: "Our custom domain started showing certificate warnings overnight. Users cannot complete checkout.",
        time: "8:05 AM",
      },
      {
        id: 1102,
        align: "end",
        text: "Thanks, Kate. I'm checking the certificate renewal job and DNS validation now.",
        time: "8:01 AM",
      },
      {
        id: 1103,
        align: "start",
        text: "DNS has not changed on our side. The warning says the certificate expired at midnight.",
        time: "7:57 AM",
      },
      {
        id: 1104,
        align: "end",
        text: "The renewal job failed on CAA validation. I've reissued the certificate manually and it's propagating.",
        time: "7:53 AM",
        reaction: "⚡",
      },
    ],
  },
  {
    id: 12,
    group: "Today",
    channel: "chat",
    name: "Alec Whitten",
    subject: "Upgrade to annual billing — is there a discount?",
    preview: "We're ready to commit for the year. Can you send over the annual pricing sheet?",
    time: "7:38 AM",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Alec Whitten",
      role: "Head of IT",
      company: "Crescent Media Group",
      email: "alec.whitten@internal.tools",
      phone: "+974 4455 1234",
      website: "crescentmedia.qa",
      location: "Doha, Qatar",
      timezone: "AST (UTC+3)",
      status: "Qualified",
      qualifiedAt: "May 28, 2026",
      tags: ["Upgrade", "Enterprise", "Media"],
    },
    messages: [
      {
        id: 1201,
        align: "start",
        text: "We're ready to move to annual billing. Is there a discount if we commit for the full year?",
        time: "7:38 AM",
      },
      {
        id: 1202,
        align: "end",
        text: "Hi Alec. Yes, annual billing includes a discount. I can send a quote with the annual terms today.",
        time: "7:34 AM",
      },
      {
        id: 1203,
        align: "start",
        text: "Please include the media team seats and the analytics add-on in the quote.",
        time: "7:30 AM",
      },
      {
        id: 1204,
        align: "end",
        text: "Done. I'll include both and mark the quote for annual prepay so procurement can review it quickly.",
        time: "7:26 AM",
        reaction: "✅",
      },
    ],
  },
  {
    id: 13,
    group: "Today",
    channel: "email",
    name: "Ariana Decker",
    subject: "Bug: date picker off by one in reports",
    preview: "Selecting June 5 produces June 4 in the CSV export. Screenshot attached for reference.",
    time: "6:52 AM",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Ariana Decker",
      role: "QA Analyst",
      company: "Northstar Health",
      email: "ariana.decker@weblabs.studio",
      phone: "+1 (617) 555-0188",
      website: "northstarhealth.com",
      location: "Boston, MA, USA",
      timezone: "EDT (UTC-4)",
      status: "Customer",
      qualifiedAt: "Mar 14, 2026",
      tags: ["Bug", "Reports"],
    },
    messages: [
      {
        id: 1301,
        align: "start",
        text: "The report date picker is off by one. Selecting June 5 exports June 4 in the CSV.",
        time: "6:52 AM",
      },
      {
        id: 1302,
        align: "end",
        text: "Thanks, Ariana. Does the UI show the right date before export, or is it wrong there too?",
        time: "6:48 AM",
      },
      {
        id: 1303,
        align: "start",
        text: "The UI looks correct. Only the CSV output is shifted.",
        time: "6:44 AM",
      },
      {
        id: 1304,
        align: "end",
        text: "That points to timezone conversion in the export job. I'll attach your screenshot to the bug ticket.",
        time: "6:40 AM",
      },
    ],
  },
  {
    id: 14,
    group: "Today",
    channel: "whatsapp",
    name: "Steven Tey",
    subject: "Webhook delivery failures for Zapier integration",
    preview: "Getting intermittent 500s on the webhook endpoint since roughly 2 AM UTC. Logs linked.",
    time: "6:10 AM",
    isUnread: true,
    unreadCount: 2,
    contact: {
      name: "Steven Tey",
      role: "Solutions Architect",
      company: "BridgeWork Inc.",
      email: "steven.tey@sandbox.dev",
      phone: "+1 (404) 555-0141",
      website: "bridgework.io",
      location: "Atlanta, GA, USA",
      timezone: "EDT (UTC-4)",
      status: "Lead",
      qualifiedAt: "Apr 8, 2026",
      tags: ["Integrations", "Platform", "Zapier"],
    },
    messages: [
      {
        id: 1401,
        align: "start",
        text: "Zapier webhook delivery is failing intermittently with 500s. It started around 2 AM UTC.",
        time: "6:10 AM",
      },
      {
        id: 1402,
        align: "end",
        text: "Thanks, Steven. Can you share one failed delivery ID and the endpoint path?",
        time: "6:06 AM",
      },
      {
        id: 1403,
        align: "start",
        text: "Delivery ID wh_72a9. Endpoint is /hooks/zapier/customer-created.",
        time: "6:02 AM",
      },
      {
        id: 1404,
        align: "end",
        text: "I found retries backing up on that endpoint. We're increasing worker capacity and replaying the failed deliveries.",
        time: "5:58 AM",
      },
    ],
  },
  {
    id: 15,
    group: "Today",
    channel: "email",
    name: "Lori Bryson",
    subject: "Request: granular RBAC for team leads",
    preview: "Our engineering leads need read-only on production but full write access on staging.",
    time: "5:44 AM",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Lori Bryson",
      role: "Platform Architect",
      company: "KumoWorks K.K.",
      email: "lori.bryson@acme.inc",
      phone: "+81 3 5555 0173",
      website: "kumoworks.jp",
      location: "Tokyo, Japan",
      timezone: "JST (UTC+9)",
      status: "Qualified",
      qualifiedAt: "Feb 9, 2026",
      tags: ["RBAC", "Enterprise", "Feature Request"],
    },
    messages: [
      {
        id: 1501,
        align: "start",
        text: "Our team leads need read-only production access but full write permissions in staging. Can RBAC support that split?",
        time: "5:44 AM",
      },
      {
        id: 1503,
        align: "start",
        text: "We also need audit logs to show who changed staging configs.",
        time: "5:36 AM",
      },
    ],
  },
  {
    id: 16,
    group: "Today",
    channel: "chat",
    name: "Koray Okumus",
    subject: "Mobile app crashes on Android 14 after update",
    preview: "Three users reported the same crash on launch. Stack trace from Firebase attached.",
    time: "5:18 AM",
    isUnread: true,
    unreadCount: 2,
    contact: {
      name: "Koray Okumus",
      role: "Mobile Lead",
      company: "MobiSolar Ltd.",
      email: "koray.okumus@weblabs.studio",
      phone: "+254 711 555 0182",
      website: "mobisolar.co.ke",
      location: "Nairobi, Kenya",
      timezone: "EAT (UTC+3)",
      status: "Customer",
      qualifiedAt: "Jan 5, 2026",
      tags: ["Mobile", "Android", "Bug"],
    },
    messages: [
      {
        id: 1601,
        align: "start",
        text: "Our Android users on version 14 are seeing crashes right after the splash screen. Firebase shows three affected devices so far.",
        time: "5:18 AM",
      },
      {
        id: 1603,
        align: "start",
        text: "I linked the stack trace in the ticket. Looks like a null pointer in the payment module init.",
        time: "4:52 AM",
      },
    ],
  },
  // Yesterday
  {
    id: 17,
    group: "Yesterday",
    channel: "email",
    name: "Josh Miller",
    subject: "Partnership proposal for Latin American market",
    preview: "We're expanding into Mexico and Brazil next quarter. Would love to explore a reseller deal.",
    time: "Yesterday",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Josh Miller",
      role: "CEO",
      company: "Nexo Digital MX",
      email: "josh.miller@internal.tools",
      phone: "+52 55 5555 0165",
      website: "nexodigital.mx",
      location: "Mexico City, Mexico",
      timezone: "CST (UTC-6)",
      status: "Lead",
      qualifiedAt: "May 15, 2026",
      tags: ["Partnership", "LATAM", "Reseller"],
    },
    messages: [
      {
        id: 1701,
        align: "start",
        text: "We're expanding into Mexico and Brazil next quarter and want to explore a reseller partnership.",
        time: "Yesterday",
      },
      {
        id: 1702,
        align: "end",
        text: "Thanks, Josh. That sounds aligned with our LATAM plans. Do you already have target customer segments in mind?",
        time: "Yesterday",
      },
      {
        id: 1703,
        align: "start",
        text: "Mostly mid-market logistics and retail teams. We can bring initial pipeline if the reseller terms work.",
        time: "Yesterday",
      },
      {
        id: 1704,
        align: "end",
        text: "I'll introduce you to our partnerships lead and share the reseller tier overview before Friday.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 18,
    group: "Yesterday",
    channel: "facebook",
    name: "Mollie Hall",
    subject: "Data export — need all logs from May",
    preview: "Our compliance audit starts next week. I need a full activity log dump for the auditors.",
    time: "Yesterday",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Mollie Hall",
      role: "Compliance Officer",
      company: "NovaPay Ltd.",
      email: "mollie.hall@weblabs.studio",
      phone: "+44 20 5555 0178",
      website: "novapay.co.uk",
      location: "London, UK",
      timezone: "BST (UTC+1)",
      status: "Customer",
      qualifiedAt: "Nov 8, 2025",
      tags: ["Compliance", "FinServ", "Audit"],
    },
    messages: [
      {
        id: 1801,
        align: "start",
        text: "Our compliance audit starts next week. We need activity logs for all May workspace events.",
        time: "Yesterday",
      },
      {
        id: 1802,
        align: "end",
        text: "Hi Mollie. We can export admin activity, login events, and file access logs. Do auditors need CSV or JSON?",
        time: "Yesterday",
      },
      {
        id: 1803,
        align: "start",
        text: "CSV is fine, but it needs user IDs and timestamps in UTC.",
        time: "Yesterday",
      },
      {
        id: 1804,
        align: "end",
        text: "Understood. I'll prepare the May export with UTC timestamps and send it through the secure file link.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 19,
    group: "Yesterday",
    channel: "email",
    name: "Rene Wells",
    subject: "White-label options for our reseller program",
    preview: "We have five partners asking about branded dashboards. Do you offer white-label tiers?",
    time: "Yesterday",
    isUnread: true,
    unreadCount: 1,
    contact: {
      name: "Rene Wells",
      role: "Product Director",
      company: "Jambo Digital KE",
      email: "rene.wells@acme.inc",
      phone: "+254 722 555 0194",
      website: "jambodigital.ke",
      location: "Nairobi, Kenya",
      timezone: "EAT (UTC+3)",
      status: "Qualified",
      qualifiedAt: "Apr 25, 2026",
      tags: ["White-Label", "Reseller", "Platform"],
    },
    messages: [
      {
        id: 1901,
        align: "start",
        text: "We have five reseller partners asking whether the dashboard can be white-labeled.",
        time: "Yesterday",
      },
      {
        id: 1902,
        align: "end",
        text: "Hi Rene. White-labeling is available on the partner tier. Are they asking about custom domain, logo, or full theme control?",
        time: "Yesterday",
      },
      {
        id: 1903,
        align: "start",
        text: "All three, ideally. They want their own domain and branded reports for clients.",
        time: "Yesterday",
      },
      {
        id: 1904,
        align: "end",
        text: "That is supported. I'll send the partner tier doc and a sample branded report template.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 20,
    group: "Yesterday",
    channel: "chat",
    name: "Rylee Howard",
    subject: "MFA enforcement rollout — questions",
    preview: "Our security team wants to know if SMS fallback is still supported after the enforcement date.",
    time: "Yesterday",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Rylee Howard",
      role: "Security Architect",
      company: "Grupo Financiero Sur",
      email: "rylee.howard@sandbox.dev",
      phone: "+57 601 555 0180",
      website: "gfsur.com.co",
      location: "Bogotá, Colombia",
      timezone: "COT (UTC-5)",
      status: "Qualified",
      qualifiedAt: "Mar 30, 2026",
      tags: ["Security", "Enterprise", "MFA"],
    },
    messages: [
      {
        id: 2001,
        align: "start",
        text: "Our security team has questions about the MFA enforcement rollout. Is SMS fallback still supported?",
        time: "Yesterday",
      },
      {
        id: 2002,
        align: "end",
        text: "Hi Rylee. SMS fallback remains available, but we recommend authenticator apps or security keys for admins.",
        time: "Yesterday",
      },
      {
        id: 2003,
        align: "start",
        text: "Can we enforce security keys for admins and allow SMS only for contractors?",
        time: "Yesterday",
      },
      {
        id: 2004,
        align: "end",
        text: "Yes. You can configure that by user group. I'll send the policy setup steps.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 21,
    group: "Yesterday",
    channel: "instagram",
    name: "Sienna Hewitt",
    subject: "Missing line items in CSV export",
    preview: "The January invoice export is short by three line items. The PDF version is correct though.",
    time: "Yesterday",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Sienna Hewitt",
      role: "Finance Director",
      company: "Volta Energy AB",
      email: "sienna.hewitt@weblabs.studio",
      phone: "+46 73 555 0168",
      website: "voltaenergy.se",
      location: "Malmö, Sweden",
      timezone: "CEST (UTC+2)",
      status: "Customer",
      qualifiedAt: "Sep 12, 2025",
      tags: ["Billing", "Export", "Bug"],
    },
    messages: [
      {
        id: 2101,
        align: "start",
        text: "The January invoice CSV is missing three line items. The PDF invoice looks correct.",
        time: "Yesterday",
      },
      {
        id: 2103,
        align: "start",
        text: "Two of them are usage charges and one is a tax adjustment. They all appear in the PDF.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 22,
    group: "Yesterday",
    channel: "email",
    name: "Noah Pierre",
    subject: "Demo request for procurement team — Friday",
    preview: "Need a 30-minute walkthrough of the vendor portal for our finance leads this Friday.",
    time: "Yesterday",
    isUnread: true,
    unreadCount: 5,
    contact: {
      name: "Noah Pierre",
      role: "Procurement Manager",
      company: "First Atlantic Bank NG",
      email: "noah.pierre@weblabs.studio",
      phone: "+234 805 555 0125",
      website: "firstatlanticbank.ng",
      location: "Abuja, Nigeria",
      timezone: "WAT (UTC+1)",
      status: "Lead",
      qualifiedAt: "May 20, 2026",
      tags: ["Demo", "FinServ", "Enterprise"],
    },
    messages: [
      {
        id: 2201,
        align: "start",
        text: "Could we schedule a 30-minute demo for our procurement and finance leads this Friday?",
        time: "Yesterday",
      },
      {
        id: 2202,
        align: "end",
        text: "Absolutely, Noah. Should the walkthrough focus on vendor onboarding, approvals, or reporting?",
        time: "Yesterday",
      },
      {
        id: 2203,
        align: "start",
        text: "Vendor onboarding and approval routing are the priority. Reporting can be a quick overview.",
        time: "Yesterday",
      },
      {
        id: 2204,
        align: "end",
        text: "Great. I'll send a Friday slot with an agenda tailored to those two workflows.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 23,
    group: "Yesterday",
    channel: "email",
    name: "Eve Lechner",
    subject: "SSO integration with Azure AD",
    preview: "We're migrating from Okta to Azure AD. What's the typical setup timeline for SSO?",
    time: "Yesterday",
    isUnread: false,
    unreadCount: 0,
    contact: {
      name: "Eve Lechner",
      role: "IT Director",
      company: "Northlane IT",
      email: "eve.lechner@acme.inc",
      phone: "+420 222 555 013",
      website: "northlaneit.com",
      location: "Prague, Czechia",
      timezone: "CEST (UTC+2)",
      status: "Qualified",
      qualifiedAt: "Feb 14, 2026",
      tags: ["SSO", "Azure", "Enterprise"],
    },
    messages: [
      {
        id: 2301,
        align: "start",
        text: "We're moving from Okta to Azure AD and need to understand the SSO setup timeline.",
        time: "Yesterday",
      },
      {
        id: 2302,
        align: "end",
        text: "Hi Eve. Typical Azure AD SSO setup takes one to two business days once metadata is exchanged.",
        time: "Yesterday",
      },
      {
        id: 2303,
        align: "start",
        text: "We can share metadata today. Will there be downtime during the switch?",
        time: "Yesterday",
      },
      {
        id: 2304,
        align: "end",
        text: "No downtime if we test with a pilot group first. I'll send the Azure AD checklist and rollout plan.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 24,
    group: "Yesterday",
    // F159: WhatsApp (was Phone): the customer attaches documents, and its 24 hour reply window has closed
    // (Chatwoot can_reply = false, cw-data.ts canReply).
    channel: "whatsapp",
    name: "Zahir McClure",
    subject: "Cancellation request — account owner left",
    preview: "Our ops lead resigned last week. Need to transfer ownership to me before we can cancel.",
    time: "Yesterday",
    isUnread: true,
    unreadCount: 2,
    contact: {
      name: "Zahir McClure",
      role: "Operations Director",
      company: "Cedar Grove Ventures",
      email: "zahir.mcclure@internal.tools",
      phone: "+1 (615) 555-0175",
      website: "cedargrove.vc",
      location: "Nashville, TN, USA",
      timezone: "CDT (UTC-5)",
      status: "At-Risk",
      qualifiedAt: "Jun 15, 2025",
      tags: ["Churn Risk", "Account", "SMB"],
    },
    messages: [
      {
        id: 2401,
        align: "start",
        text: "Our ops lead Jamal resigned last week and he was the only account owner. I need ownership transferred to me before we can proceed with anything.",
        time: "Yesterday",
      },
      {
        id: 2402,
        align: "end",
        text: "Hi Zahir, I can help with that. We'll need verification — can you confirm your role and provide a copy of Jamal's resignation notice?",
        time: "Yesterday",
      },
      {
        id: 2403,
        align: "start",
        text: "Absolutely. I'm the Operations Director. I've attached his signed notice and HR confirmation.",
        time: "Yesterday",
      },
      {
        id: 2404,
        align: "end",
        text: "Verified. I've initiated the ownership transfer. It takes about 2 hours to propagate. You'll get a confirmation email once it's done.",
        time: "Yesterday",
      },
    ],
  },
];

// F159: the same people and companies as the Contacts page (dashboard/contacts/_components/data.ts), so the
// conversations, the contact panel and the Contacts page tell one story. Each person keeps one job title across
// their conversations; first names inside the messages follow the new person.
type Person = { id: number; role: string; website: string; timezone: string; status: string };

// T-285 (Fahad 125.7): a job title shows only with a source: the signature of the person's own email (Support Email
// mail view, chat-mail-store.ts) or their own words (Omar #24: "I'm the Operations Director"). Sarah 3 (Instagram,
// website chat) and James 6 (WhatsApp) send no email, so their title stays empty.
const people: Record<number, Person> = {
  1: { id: 1, role: "Head of Digital Operations", website: "ooredoo.qa", timezone: "AST (UTC+3)", status: "Customer" },
  2: { id: 2, role: "Procurement Manager", website: "emiratesnbd.com", timezone: "GST (UTC+4)", status: "Lead" },
  3: { id: 3, role: "", website: "qf.org.qa", timezone: "AST (UTC+3)", status: "Customer" },
  4: { id: 4, role: "Partnerships Director", website: "stc.com.sa", timezone: "AST (UTC+3)", status: "Qualified" },
  5: { id: 5, role: "Quality & Compliance Lead", website: "hamad.qa", timezone: "AST (UTC+3)", status: "Lead" },
  6: { id: 6, role: "", website: "dpworld.com", timezone: "GST (UTC+4)", status: "Customer" },
  7: { id: 7, role: "IT Security Manager", website: "etihad.com", timezone: "GST (UTC+4)", status: "Customer" },
  8: { id: 8, role: "Mobile Product Lead", website: "qatarairways.com", timezone: "AST (UTC+3)", status: "Customer" },
  9: { id: 9, role: "Finance Manager", website: "aramco.com", timezone: "AST (UTC+3)", status: "Customer" },
  10: { id: 10, role: "Backend Engineering Lead", website: "qnb.com", timezone: "AST (UTC+3)", status: "Customer" },
  12: { id: 12, role: "Operations Director", website: "adnoc.ae", timezone: "GST (UTC+4)", status: "At-Risk" },
};

// conversation id -> contact id
const personOf: Record<number, number> = {
  1: 1,
  2: 1,
  3: 3,
  5: 12,
  6: 6,
  7: 9,
  8: 3,
  9: 12,
  10: 10,
  11: 8,
  12: 2,
  13: 5,
  14: 6,
  15: 10,
  16: 8,
  17: 4,
  18: 5,
  19: 4,
  20: 7,
  21: 9,
  22: 2,
  23: 7,
  24: 12,
};

// T-268: online only for a Website contact with a live widget heartbeat (lib/cw/presence/website-presence.ts).
// Other channels and recent activity are never presence; until a heartbeat is bound this is always null.
export function isPersonOnline(conversationId: number): true | null {
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) return null;
  return isWebsiteContactOnline(conversation.channel, contactIdOf(conversationId)) || null;
}

// The same for a contact (contacts page): only a contact who writes on the Website channel can be online.
export function isContactOnline(contactId: number): true | null {
  const onWebsite = conversations.some((c) => c.channel === WEBSITE_CHANNEL && contactIdOf(c.id) === contactId);
  return (onWebsite && isWebsiteContactOnline(WEBSITE_CHANNEL, contactId)) || null;
}

// Lines that only made sense for the template people.
const textFixes: Record<number, [string, string][]> = {
  10: [["Dublin time", "Doha time"]],
  // The customer attaches a CSV export (report-export-june.csv in the dashboard thread), not a screenshot.
  13: [
    ["Screenshot attached for reference", "CSV export attached for reference"],
    ["attach your screenshot", "attach your CSV export"],
  ],
  17: [
    ["Latin American market", "North African market"],
    ["Mexico and Brazil", "Egypt and Morocco"],
    ["our LATAM plans", "our regional plans"],
  ],
};

function swapPerson(conversation: Conversation): Conversation {
  const contactId = personOf[conversation.id];
  const person = contactId ? people[contactId] : undefined;
  const entry = directory.find((item) => item.id === contactId);
  if (!person || !entry) return conversation;
  const oldFirst = conversation.name.split(" ")[0];
  const newFirst = entry.name.split(" ")[0];
  const fixes = textFixes[conversation.id] ?? [];
  const fix = (text: string) => {
    let next = text.replace(new RegExp(`\\b${oldFirst}\\b`, "g"), newFirst);
    for (const [from, to] of fixes) next = next.split(from).join(to);
    return next;
  };
  return {
    ...conversation,
    name: entry.name,
    subject: fix(conversation.subject),
    preview: fix(conversation.preview),
    contact: {
      ...conversation.contact,
      name: entry.name,
      role: person.role,
      company: entry.company,
      email: entry.email,
      phone: entry.phone,
      website: person.website,
      // T-285 (125.7): an unknown city stays out instead of leaving ", Qatar".
      location: [entry.city, entry.country].filter(Boolean).join(", "),
      timezone: person.timezone,
      status: person.status,
      qualifiedAt: entry.createdAt,
    },
    messages: conversation.messages.map((message) => ({ ...message, text: fix(message.text) })),
  };
}

// Some template threads count their clock times down from top to bottom, so the answer is timed before the
// question. Keep the message order and reverse the time values, so the newest message sits at the bottom and
// matches the list row time.
function clockMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
  if (!match) return null;
  const hours = (Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0);
  return hours * 60 + Number(match[2]);
}

function risingTimes(conversation: Conversation): Conversation {
  const first = clockMinutes(conversation.messages[0]?.time ?? "");
  const last = clockMinutes(conversation.messages.at(-1)?.time ?? "");
  if (first === null || last === null || first <= last) return conversation;
  const times = conversation.messages.map((message) => message.time).reverse();
  return { ...conversation, messages: conversation.messages.map((message, i) => ({ ...message, time: times[i] })) };
}

// F159: times are ages counted back from the real clock, the way the Support Email view dates its mails
// (chat-mail-store.ts), so a conversation shows the same age on /chat, /dashboard/chat and in the mail view, and no
// time is later than now. Rows use Chatwoot's short form ("14m", "2h"); messages say "14 min ago" or "1h 12m ago".
// The gaps between a thread's messages stay as in the template. Yesterday's conversations keep "Yesterday".
const lastActivity: Record<number, number> = {
  1: 1,
  2: 5,
  3: 8,
  5: 14,
  6: 27,
  7: 41,
  8: 56,
  9: 72,
  10: 88,
  11: 104,
  12: 121,
  13: 138,
  14: 155,
  15: 172,
  16: 190,
};

export function rowAge(minutes: number): string {
  // Chatwoot shortTimestamp: "less than a minute ago" -> "now", "1 minute ago" -> "1m" (the Contacts page says
  // "1 minute ago" for the same person).
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (24 * 60))}d`;
}

export function messageAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m ago` : `${hours}h ago`;
}

// "10:42 AM" or "10 min ago" on one scale (bigger = later), to keep the gaps between a thread's messages.
function stamp(time: string): number | null {
  const clock = clockMinutes(time);
  if (clock !== null) return clock;
  const ago = /^(\d+) min ago$/.exec(time);
  return ago ? -Number(ago[1]) : null;
}

function realClockAges(conversation: Conversation): Conversation {
  const last = lastActivity[conversation.id];
  if (last === undefined) return conversation;
  const end = stamp(conversation.messages.at(-1)?.time ?? "");
  const messages = conversation.messages.map((message) => {
    const at = stamp(message.time);
    const ago = end !== null && at !== null ? last + (end - at) : last;
    return { ...message, time: messageAge(ago), ago };
  });
  return { ...conversation, time: rowAge(last), ago: last, messages };
}

// F159: the row preview is the thread's last message, as in Chatwoot (getLastMessage), so the mail view and the
// /dashboard/chat cards show the same line.
function lastMessagePreview(conversation: Conversation): Conversation {
  return { ...conversation, preview: conversation.messages.at(-1)?.text ?? conversation.preview };
}

export const conversations: Conversation[] = templateConversations
  .map(swapPerson)
  .map(risingTimes)
  .map(realClockAges)
  .map(lastMessagePreview);

const initialConversationsSnapshot: Conversation[] = [...conversations];
const initialPersonOfSnapshot: Record<number, number> = { ...personOf };

/** U-2: Replace the in-memory conversations and contact-id map in-place when linked mode loads. */
export function replaceConversations(next: Conversation[], nextPersonOf: Record<number, number>): void {
  conversations.splice(0, conversations.length, ...next);
  for (const key of Object.keys(personOf)) delete personOf[Number(key)];
  Object.assign(personOf, nextPersonOf);
}

/** U-2: Restore the original preview conversations and contact-id map when leaving linked mode. */
export function restorePreviewConversations(): void {
  conversations.splice(0, conversations.length, ...initialConversationsSnapshot);
  for (const key of Object.keys(personOf)) delete personOf[Number(key)];
  Object.assign(personOf, initialPersonOfSnapshot);
}

// F159: channel counts for the channels bar (chat-channel-strip.tsx), from the conversations above.
function channelCount(id: string): string {
  return String(conversations.filter((conversation) => conversation.channel === id).length);
}

export const channelItems: NavItem[] = [
  { id: "email", title: "Email", label: channelCount("email"), icon: Mail, isActive: false },
  { id: "chat", title: "Chat", label: channelCount("chat"), icon: MessageCircle, isActive: false },
  { id: "whatsapp", title: "WhatsApp", label: channelCount("whatsapp"), icon: Phone, isActive: false },
  { id: "instagram", title: "Instagram", label: channelCount("instagram"), icon: Phone, isActive: false },
  { id: "facebook", title: "Facebook", label: channelCount("facebook"), icon: Phone, isActive: false },
  { id: "phone", title: "Phone", label: channelCount("phone"), icon: Phone, isActive: false },
];

// F161: a conversation started from "New conversation" joins the same list (newest activity first) and keeps the
// person's Contacts page id. Module state like the rest of the mock: it stays while moving around, not on reload.
export function addConversation(conversation: Conversation, contactId: number | null): void {
  conversations.unshift(conversation);
  if (contactId !== null) personOf[conversation.id] = contactId;
}

// Contact id on the Contacts page for a conversation (used by "View Profile").
export function contactIdOf(conversationId: number): number | null {
  return personOf[conversationId] ?? null;
}

export const currentUser = {
  name: "Arham Khan",
  email: "arham.khan@weblabs.studio",
};
