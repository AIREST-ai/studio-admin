export type ArticleStatus = "published" | "draft" | "archived";

export interface Portal {
  id: number;
  name: string;
  slug: string;
  customDomain: string;
  articles: number;
  color: string;
  pageTitle: string;
  headerText: string;
  homePageLink: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  articles: number;
}

export interface Author {
  id: number;
  name: string;
}

export interface Article {
  id: number;
  title: string;
  status: ArticleStatus;
  authorId: number;
  categoryId: number | null;
  views: number;
  updated: string;
  pendingEdits?: boolean;
}

export interface Locale {
  code: string;
  name: string;
  articles: number;
  categories: number;
  isDefault?: boolean;
  isDraft?: boolean;
}

export const portals: Portal[] = [
  {
    id: 1,
    name: "Noor Clinics Help Center",
    slug: "noor-clinics",
    customDomain: "help.noorclinics.qa",
    articles: 24,
    color: "#1f93ff",
    pageTitle: "Noor Clinics — Patient Help",
    headerText: "How can we help you today?",
    homePageLink: "https://www.noorclinics.qa",
  },
  {
    id: 2,
    name: "Rawabi Delivery Guide",
    slug: "rawabi-guide",
    customDomain: "",
    articles: 11,
    color: "#10b981",
    pageTitle: "Rawabi Delivery — Guide",
    headerText: "Answers for riders and stores",
    homePageLink: "https://rawabi-delivery.ae",
  },
  {
    id: 3,
    name: "Dar Al Majd Tenants FAQ",
    slug: "dar-al-majd",
    customDomain: "faq.daralmajd.sa",
    articles: 7,
    color: "#f59e0b",
    pageTitle: "Dar Al Majd — Tenant FAQ",
    headerText: "Everything about your lease",
    homePageLink: "https://daralmajd.sa",
  },
];

export const activePortal = portals[0];

export const authors: Author[] = [
  { id: 1, name: "Fatima Al-Kuwari" },
  { id: 2, name: "Omar Haddad" },
  { id: 3, name: "Aisha Rahman" },
  { id: 4, name: "Yousef Al-Marri" },
];

export const currentUserId = 1;

export const categories: Category[] = [
  {
    id: 1,
    name: "Appointments",
    slug: "appointments",
    icon: "🗓️",
    description: "Booking, rescheduling and cancelling visits at any Noor branch or by video call.",
    articles: 6,
  },
  {
    id: 2,
    name: "Billing & insurance",
    slug: "billing-insurance",
    icon: "💳",
    description: "Accepted insurers in Qatar, co-payments, invoices and paying with card or Apple Pay.",
    articles: 5,
  },
  {
    id: 3,
    name: "Lab results",
    slug: "lab-results",
    icon: "🧪",
    description: "When results are ready, how to read them in the app and how to share them with your doctor.",
    articles: 4,
  },
  {
    id: 4,
    name: "App & account",
    slug: "app-account",
    icon: "📱",
    description: "Signing in with your QID, family profiles, notifications and changing your phone number.",
    articles: 5,
  },
  {
    id: 5,
    name: "Clinics & locations",
    slug: "clinics-locations",
    icon: "🏥",
    description: "Branches in West Bay, Al Waab and Lusail, parking, and opening hours.",
    articles: 3,
  },
  {
    id: 6,
    name: "Ramadan & holidays",
    slug: "ramadan-holidays",
    icon: "🌙",
    description: "",
    articles: 1,
  },
];

export const articles: Article[] = [
  {
    id: 101,
    title: "How to book an appointment in the Noor app",
    status: "published",
    authorId: 1,
    categoryId: 1,
    views: 4820,
    updated: "2 hours ago",
  },
  {
    id: 102,
    title: "Which insurance providers do you accept in Qatar?",
    status: "published",
    authorId: 2,
    categoryId: 2,
    views: 3175,
    updated: "5 hours ago",
    pendingEdits: true,
  },
  {
    id: 103,
    title: "Ramadan 2027 clinic opening hours",
    status: "draft",
    authorId: 1,
    categoryId: 6,
    views: 0,
    updated: "Yesterday",
  },
  {
    id: 104,
    title: "Reading your blood test results in the app",
    status: "published",
    authorId: 3,
    categoryId: 3,
    views: 2210,
    updated: "2 days ago",
  },
  {
    id: 105,
    title: "Adding your children to a family profile",
    status: "published",
    authorId: 4,
    categoryId: 4,
    views: 1964,
    updated: "3 days ago",
  },
  {
    id: 106,
    title: "Paying your invoice with Apple Pay or a debit card",
    status: "published",
    authorId: 2,
    categoryId: 2,
    views: 1540,
    updated: "4 days ago",
  },
  {
    id: 107,
    title: "Rescheduling or cancelling a video consultation",
    status: "draft",
    authorId: 1,
    categoryId: 1,
    views: 0,
    updated: "5 days ago",
  },
  {
    id: 108,
    title: "Parking at the Lusail Marina branch",
    status: "published",
    authorId: 3,
    categoryId: 5,
    views: 870,
    updated: "1 week ago",
  },
  {
    id: 109,
    title: "Signing in with your Qatar ID (QID)",
    status: "published",
    authorId: 4,
    categoryId: 4,
    views: 2650,
    updated: "1 week ago",
  },
  {
    id: 110,
    title: "Old COVID-19 PCR booking steps",
    status: "archived",
    authorId: 2,
    categoryId: 3,
    views: 12480,
    updated: "3 months ago",
  },
  {
    id: 111,
    title: "Getting a sick leave certificate after your visit",
    status: "published",
    authorId: 1,
    categoryId: null,
    views: 1320,
    updated: "2 weeks ago",
  },
  {
    id: 112,
    title: "Changing the phone number on your account",
    status: "draft",
    authorId: 3,
    categoryId: 4,
    views: 0,
    updated: "2 weeks ago",
  },
  {
    id: 113,
    title: "What to bring to your first visit",
    status: "published",
    authorId: 4,
    categoryId: 1,
    views: 990,
    updated: "3 weeks ago",
  },
  {
    id: 114,
    title: "Claiming a refund for a cancelled lab test",
    status: "published",
    authorId: 2,
    categoryId: 2,
    views: 640,
    updated: "1 month ago",
  },
  {
    id: 115,
    title: "Eid Al Adha emergency contact numbers",
    status: "archived",
    authorId: 1,
    categoryId: 6,
    views: 2105,
    updated: "4 months ago",
  },
];

export const locales: Locale[] = [
  { code: "en", name: "English", articles: 24, categories: 6, isDefault: true },
  { code: "ar", name: "Arabic", articles: 19, categories: 6 },
  { code: "ur", name: "Urdu", articles: 6, categories: 3 },
  { code: "ml", name: "Malayalam", articles: 2, categories: 1, isDraft: true },
];

export const allLocaleOptions = [
  "English (en)",
  "Arabic (ar)",
  "Urdu (ur)",
  "Hindi (hi)",
  "Malayalam (ml)",
  "Tagalog (tl)",
  "Bengali (bn)",
  "French (fr)",
  "Persian (fa)",
];

export function authorOf(article: Article) {
  return authors.find((a) => a.id === article.authorId);
}

export function categoryOf(article: Article) {
  return categories.find((c) => c.id === article.categoryId);
}

export const statusLabel: Record<ArticleStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

export const statusTone: Record<ArticleStatus, string> = {
  published: "text-emerald-600 dark:text-emerald-400",
  draft: "text-amber-600 dark:text-amber-400",
  archived: "text-muted-foreground",
};

export const sampleArticleBody = [
  "You can book a visit with any Noor doctor in under a minute from the Noor app. Bookings are free, and you will get a reminder by SMS and WhatsApp the day before.",
  "Steps",
  "1. Open the Noor app and tap Book appointment on the home screen.\n2. Choose the speciality, for example Paediatrics or Dermatology.\n3. Pick a branch (West Bay, Al Waab or Lusail Marina) or choose Video consultation.\n4. Select a doctor and a time that suits you, then tap Confirm.",
  "Booking for your child? Switch to their profile from the top of the screen first, so the visit is saved to the right medical record.",
];
