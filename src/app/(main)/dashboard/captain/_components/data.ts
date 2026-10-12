export interface Assistant {
  id: number;
  name: string;
  description: string;
  productName: string;
  inboxes: number;
  documents: number;
  faqs: number;
  updatedAt: string;
}

export const assistants: Assistant[] = [
  {
    id: 1,
    name: "Noor",
    description: "Answers questions about fibre plans, billing and roaming for home customers in Qatar.",
    productName: "Ooredoo Home Fibre",
    inboxes: 3,
    documents: 14,
    faqs: 126,
    updatedAt: "2 hours ago",
  },
  {
    id: 2,
    name: "Salma",
    description: "Helps patients book, move or cancel clinic appointments and explains visit preparation.",
    productName: "Sidra Outpatient Clinics",
    inboxes: 2,
    documents: 8,
    faqs: 64,
    updatedAt: "Yesterday",
  },
  {
    id: 3,
    name: "Rashid",
    description: "Tracks orders, delivery slots and returns for online grocery shoppers across the UAE.",
    productName: "Lulu Online Grocery",
    inboxes: 4,
    documents: 21,
    faqs: 210,
    updatedAt: "3 days ago",
  },
  {
    id: 4,
    name: "Hala",
    description: "Draft assistant for school transport questions: bus routes, pick-up times and fees in Doha.",
    productName: "Doha School Transport",
    inboxes: 0,
    documents: 2,
    faqs: 12,
    updatedAt: "Oct 1, 2026",
  },
];

export type DocStatus = "Updated" | "Needs update" | "Updating" | "Failed";

export interface CaptainDocument {
  id: number;
  name: string;
  source: "web" | "pdf";
  url: string;
  status: DocStatus;
  syncedAgo: string;
  faqs: number;
  conversations: number;
  createdAt: string;
}

export const documents: CaptainDocument[] = [
  {
    id: 1,
    name: "Home Fibre plans and prices",
    source: "web",
    url: "https://www.ooredoo.qa/web/en/home/fibre-plans",
    status: "Updated",
    syncedAgo: "2 hours ago",
    faqs: 24,
    conversations: 312,
    createdAt: "Aug 12, 2026",
  },
  {
    id: 2,
    name: "Roaming packs for GCC travel",
    source: "web",
    url: "https://www.ooredoo.qa/web/en/roaming/gcc",
    status: "Updated",
    syncedAgo: "5 hours ago",
    faqs: 18,
    conversations: 188,
    createdAt: "Aug 14, 2026",
  },
  {
    id: 3,
    name: "Router setup guide (Huawei HG8245)",
    source: "pdf",
    url: "router-setup-guide-hg8245.pdf",
    status: "Needs update",
    syncedAgo: "12 days ago",
    faqs: 11,
    conversations: 97,
    createdAt: "Jul 30, 2026",
  },
  {
    id: 4,
    name: "Bill payment and e-invoice",
    source: "web",
    url: "https://www.ooredoo.qa/web/en/support/pay-bill",
    status: "Updating",
    syncedAgo: "1 day ago",
    faqs: 15,
    conversations: 241,
    createdAt: "Aug 2, 2026",
  },
  {
    id: 5,
    name: "Moving house: relocation of service",
    source: "web",
    url: "https://www.ooredoo.qa/web/en/support/relocation",
    status: "Updated",
    syncedAgo: "3 hours ago",
    faqs: 9,
    conversations: 54,
    createdAt: "Sep 3, 2026",
  },
  {
    id: 6,
    name: "Terms and conditions 2026",
    source: "pdf",
    url: "home-fibre-terms-2026.pdf",
    status: "Failed",
    syncedAgo: "4 days ago",
    faqs: 0,
    conversations: 0,
    createdAt: "Sep 20, 2026",
  },
  {
    id: 7,
    name: "TV channel packages (Arabic and sports)",
    source: "web",
    url: "https://www.ooredoo.qa/web/en/tv/packages",
    status: "Updated",
    syncedAgo: "6 hours ago",
    faqs: 21,
    conversations: 166,
    createdAt: "Aug 21, 2026",
  },
];

export interface Faq {
  id: number;
  question: string;
  answer: string;
  status: "approved" | "pending";
  source: string;
  createdAt: string;
}

export const faqs: Faq[] = [
  {
    id: 1,
    question: "How long does a new fibre installation take in Doha?",
    answer:
      "Most installations in Doha are completed within 3 working days after the order is confirmed. You will receive an SMS with the technician's visit slot one day before.",
    status: "approved",
    source: "Home Fibre plans and prices",
    createdAt: "Oct 9, 2026",
  },
  {
    id: 2,
    question: "Can I pause my plan while I travel in summer?",
    answer:
      "Yes. You can suspend your home plan for up to 3 months once a year. A small monthly fee of QAR 30 applies during the suspension period.",
    status: "approved",
    source: "Conversation #4821",
    createdAt: "Oct 8, 2026",
  },
  {
    id: 3,
    question: "Which roaming pack works in Saudi Arabia and the UAE?",
    answer:
      "The GCC Roaming Pass covers Saudi Arabia, the UAE, Kuwait, Bahrain and Oman. It includes 10 GB of data and 100 local minutes for 7 days.",
    status: "approved",
    source: "Roaming packs for GCC travel",
    createdAt: "Oct 7, 2026",
  },
  {
    id: 4,
    question: "Why is my bill higher this month?",
    answer:
      "A higher bill is usually caused by an upgrade done mid-cycle, added TV packages or roaming usage. Open the bill in the app to see each item.",
    status: "approved",
    source: "Bill payment and e-invoice",
    createdAt: "Oct 6, 2026",
  },
  {
    id: 5,
    question: "How do I change my Wi-Fi password?",
    answer:
      "Open 192.168.1.1 in your browser, sign in with the details printed under the router, then go to WLAN settings and change the key.",
    status: "pending",
    source: "Router setup guide (Huawei HG8245)",
    createdAt: "Oct 11, 2026",
  },
  {
    id: 6,
    question: "Do you offer a discount for Qatari families with many lines?",
    answer:
      "Family bundles give 15% off each extra line when all lines are on the same account. Ask an agent to merge your accounts.",
    status: "pending",
    source: "Conversation #4907",
    createdAt: "Oct 11, 2026",
  },
  {
    id: 7,
    question: "Can I move my fibre to a new villa in Al Wakrah?",
    answer: "Yes. Request a relocation at least 7 days before you move. Relocation inside Qatar is free once a year.",
    status: "approved",
    source: "Moving house: relocation of service",
    createdAt: "Oct 4, 2026",
  },
  {
    id: 8,
    question: "Which package includes beIN Sports?",
    answer: "beIN Sports is included in the Sports Max package and can be added to any TV plan for QAR 99 per month.",
    status: "approved",
    source: "TV channel packages (Arabic and sports)",
    createdAt: "Oct 2, 2026",
  },
];

export interface Suggestion {
  id: number;
  question: string;
  answer: string;
  conversations: number;
}

export const suggestions: Suggestion[] = [
  {
    id: 1,
    question: "How do I get a refund for a duplicate bill payment?",
    answer:
      "If you paid the same bill twice, the extra amount is kept as credit on your account. To get it back to your card, ask an agent and it will be returned in 5 to 7 working days.",
    conversations: 38,
  },
  {
    id: 2,
    question: "Is the internet slower during Ramadan evenings?",
    answer:
      "Usage peaks after Iftar. If speed drops below your plan, restart the router and run a speed test in the app so we can check the line.",
    conversations: 26,
  },
  {
    id: 3,
    question: "Can a visitor on a tourist visa get a prepaid SIM?",
    answer: "Yes. Visitors can buy a Hala Visitor SIM at the airport or any shop with a valid passport.",
    conversations: 17,
  },
  {
    id: 4,
    question: "How do I add a second TV box in another room?",
    answer: "You can order an extra TV box from the app. Each extra box costs QAR 25 per month.",
    conversations: 9,
  },
];

export interface Tool {
  id: number;
  title: string;
  description: string;
  method: "GET" | "POST";
  endpoint: string;
  auth: string;
  enabled: boolean;
  params: number;
}

export const tools: Tool[] = [
  {
    id: 1,
    title: "Order Lookup",
    description: "Looks up a fibre order and installation slot by order number.",
    method: "GET",
    endpoint: "https://api.home-services.qa/orders/{{ order_id }}",
    auth: "Bearer Token",
    enabled: true,
    params: 1,
  },
  {
    id: 2,
    title: "Outage Check",
    description: "Checks for a known network outage in the customer's area by zone number.",
    method: "GET",
    endpoint: "https://api.home-services.qa/outages?zone={{ zone }}",
    auth: "API Key",
    enabled: true,
    params: 1,
  },
  {
    id: 3,
    title: "Bill Balance",
    description: "Returns the outstanding balance and due date for an account.",
    method: "GET",
    endpoint: "https://api.home-services.qa/accounts/{{ account_no }}/balance",
    auth: "Bearer Token",
    enabled: true,
    params: 1,
  },
  {
    id: 4,
    title: "Book Technician Visit",
    description: "Books a technician visit for a given date and time window.",
    method: "POST",
    endpoint: "https://api.home-services.qa/visits",
    auth: "Basic Auth",
    enabled: false,
    params: 3,
  },
];

export interface Scenario {
  id: number;
  title: string;
  description: string;
  instruction: string;
  tools: string[];
  enabled: boolean;
}

export const scenarios: Scenario[] = [
  {
    id: 1,
    title: "Internet is down",
    description: "Customer says their internet or Wi-Fi stopped working.",
    instruction:
      "Ask for the zone number, check for an outage, then guide a router restart. If nothing helps, offer to book a technician visit.",
    tools: ["Outage Check", "Book Technician Visit"],
    enabled: true,
  },
  {
    id: 2,
    title: "Order status",
    description: "Customer wants to know when their new fibre will be installed.",
    instruction:
      "Ask for the order number and share the installation slot. Never promise a date that is not in the order.",
    tools: ["Order Lookup"],
    enabled: true,
  },
  {
    id: 3,
    title: "Refund request",
    description: "Customer asks for money back for a duplicate or wrong payment.",
    instruction: "Check the balance, explain the credit, then hand off to the billing team with a short summary.",
    tools: ["Bill Balance"],
    enabled: true,
  },
  {
    id: 4,
    title: "Contract cancellation",
    description: "Customer wants to end their contract.",
    instruction: "Ask for the reason politely, mention any early-exit fee, and hand off to the retention team.",
    tools: [],
    enabled: false,
  },
];

export const exampleScenarios = [
  { title: "Customer is stuck", description: "Offer the next simple step and ask one question at a time." },
  {
    title: "Speaking in Arabic",
    description: "Reply in Gulf-friendly Modern Standard Arabic when the customer writes in Arabic.",
  },
];

export const guardrails = [
  "Do not share any customer's personal data with another customer.",
  "Do not discuss politics, religion or other companies' prices.",
  "Never confirm a refund amount. Hand billing disputes to the billing team.",
  "Do not give medical, legal or financial advice.",
];

export const exampleGuardrails = [
  "Only answer questions about our products and services.",
  "Do not ask for card numbers or passwords.",
];

export const guidelines = [
  "Greet the customer by first name when it is known.",
  "Keep replies under 80 words and use short sentences.",
  "Reply in the language the customer used (Arabic or English).",
  "Use QAR for prices and Qatar local time for dates.",
];

export const exampleGuidelines = ["Be warm and polite, but never use slang.", "End with a clear next step."];

export interface ConnectedInbox {
  id: number;
  name: string;
  channel: string;
  detail: string;
}

export const connectedInboxes: ConnectedInbox[] = [
  { id: 1, name: "Website chat", channel: "Website", detail: "ooredoo.qa" },
  { id: 2, name: "WhatsApp Support", channel: "WhatsApp", detail: "+974 4400 0111" },
  { id: 3, name: "Customer Care Email", channel: "Email", detail: "care@home-services.qa" },
];

export const availableInboxes = ["Instagram DMs", "Facebook Page", "SMS Doha", "Telegram Bot"];

export const handoffReasons = [
  { label: "Customer requested", value: 34 },
  { label: "Missing knowledge", value: 22 },
  { label: "Unsupported request", value: 15 },
  { label: "Policy restriction", value: 11 },
  { label: "Tool failure", value: 6 },
  { label: "Pending customer clarification", value: 8 },
  { label: "Unclassified", value: 4 },
];

export const trend = [
  { day: "Oct 6", handled: 182, resolved: 121 },
  { day: "Oct 7", handled: 204, resolved: 139 },
  { day: "Oct 8", handled: 196, resolved: 141 },
  { day: "Oct 9", handled: 231, resolved: 160 },
  { day: "Oct 10", handled: 158, resolved: 112 },
  { day: "Oct 11", handled: 175, resolved: 129 },
  { day: "Oct 12", handled: 214, resolved: 158 },
];

export const models = [
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", credits: 1 },
  { value: "gpt-4.1", label: "GPT-4.1", credits: 3 },
  { value: "gpt-5-mini", label: "GPT-5 Mini", credits: 2 },
];

// Document limit of the plan; Chatwoot's LimitBanner shows only when the assistant reaches it.
export const documentLimit = 50;
