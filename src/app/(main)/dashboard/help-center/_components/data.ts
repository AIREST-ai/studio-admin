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
  /** Locale code of the article; English when left out. */
  locale?: string;
  /** Live title when the draft title differs (published article with unpublished edits). */
  liveTitle?: string;
  metaDescription?: string;
  metaTags?: string[];
  /** Body as [intro, heading, numbered steps, note]; an empty array is an article without content yet. */
  body?: string[];
}

export interface Locale {
  code: string;
  name: string;
  articles: number;
  categories: number;
  isDefault?: boolean;
  isDraft?: boolean;
}

// F159: the help center of Weblabs Studio, the same company as Conversations (support@weblabs.studio) and Settings >
// Inboxes. The reply box "Insert article" and the search Articles tab read these articles (cw-data.ts helpArticles).
export const portals: Portal[] = [
  {
    id: 1,
    name: "Weblabs Studio Help Center",
    slug: "weblabs",
    customDomain: "help.weblabs.studio",
    articles: 24,
    color: "#1f93ff",
    pageTitle: "Weblabs Studio — Help Center",
    headerText: "How can we help you today?",
    homePageLink: "https://weblabs.studio",
  },
  {
    id: 2,
    name: "Weblabs Developer Docs",
    slug: "weblabs-developers",
    customDomain: "",
    articles: 11,
    color: "#10b981",
    pageTitle: "Weblabs Studio — Developer Docs",
    headerText: "Build on the Weblabs API",
    homePageLink: "https://weblabs.studio/developers",
  },
  {
    id: 3,
    name: "Weblabs Partner Hub",
    slug: "weblabs-partners",
    customDomain: "partners.weblabs.studio",
    articles: 7,
    color: "#f59e0b",
    pageTitle: "Weblabs Studio — Partner Hub",
    headerText: "Resources for resellers and agencies",
    homePageLink: "https://weblabs.studio/partners",
  },
];

export const activePortal = portals[0];

// F159: the same agents as Conversations and Settings (cw-data.ts); id 1 is Arham Khan, the signed-in agent.
export const authors: Author[] = [
  { id: 1, name: "Arham Khan" },
  { id: 2, name: "Lina Haddad" },
  { id: 3, name: "Priya Nair" },
  { id: 4, name: "Yousef Al-Harbi" },
];

export const currentUserId = 1;

export const categories: Category[] = [
  {
    id: 1,
    name: "Getting started",
    slug: "getting-started",
    icon: "🚀",
    description: "First steps for a new workspace: your team, your domain and your first project.",
    articles: 6,
  },
  {
    id: 2,
    name: "Billing & plans",
    slug: "billing-plans",
    icon: "💳",
    description: "Plans, invoices, refunds, annual billing and changing or cancelling your subscription.",
    articles: 5,
  },
  {
    id: 3,
    name: "Reports & exports",
    slug: "reports-exports",
    icon: "📊",
    description: "Building reports, filtering by date and downloading your data as CSV.",
    articles: 4,
  },
  {
    id: 4,
    name: "Account & security",
    slug: "account-security",
    icon: "🔐",
    description: "Passwords, single sign-on, two-factor authentication and roles for your team.",
    articles: 5,
  },
  {
    id: 5,
    name: "Integrations & API",
    slug: "integrations-api",
    icon: "🔌",
    description: "API keys, rate limits, webhooks and connecting Zapier and other tools.",
    articles: 3,
  },
  {
    id: 6,
    name: "Release notes",
    slug: "release-notes",
    icon: "📣",
    description: "",
    articles: 1,
  },
];

export const articles: Article[] = [
  {
    id: 1,
    title: "Getting started with your Weblabs workspace",
    status: "published",
    authorId: 1,
    categoryId: 1,
    views: 4820,
    updated: "2 hours ago",
  },
  {
    id: 2,
    title: "Understanding your invoice",
    status: "published",
    authorId: 2,
    categoryId: 2,
    views: 3175,
    updated: "5 hours ago",
    pendingEdits: true,
    liveTitle: "Reading your invoice",
    metaDescription: "What each line of your Weblabs invoice means, and where to download past invoices.",
    metaTags: ["billing", "invoice"],
  },
  {
    id: 3,
    title: "Release notes: October 2026",
    status: "draft",
    authorId: 1,
    categoryId: 6,
    views: 0,
    updated: "Yesterday",
  },
  {
    id: 4,
    title: "Exporting reports to CSV",
    status: "published",
    authorId: 3,
    categoryId: 3,
    views: 2210,
    updated: "2 days ago",
  },
  {
    id: 5,
    title: "How to reset your password",
    status: "published",
    authorId: 4,
    categoryId: 4,
    views: 1964,
    updated: "3 days ago",
  },
  {
    id: 6,
    title: "Switching to annual billing",
    status: "published",
    authorId: 2,
    categoryId: 2,
    views: 1540,
    updated: "4 days ago",
  },
  {
    id: 7,
    title: "Inviting your team and choosing roles",
    status: "draft",
    authorId: 1,
    categoryId: 1,
    views: 0,
    updated: "5 days ago",
  },
  {
    id: 8,
    title: "API rate limits explained",
    status: "published",
    authorId: 3,
    categoryId: 5,
    views: 870,
    updated: "1 week ago",
  },
  {
    id: 9,
    title: "Setting up SSO with Azure AD",
    status: "published",
    authorId: 4,
    categoryId: 4,
    views: 2650,
    updated: "1 week ago",
  },
  {
    id: 10,
    title: "Exporting data from the old reports page",
    status: "archived",
    authorId: 2,
    categoryId: 3,
    views: 12480,
    updated: "3 months ago",
  },
  {
    id: 11,
    title: "Connecting a custom domain and SSL certificate",
    status: "published",
    authorId: 1,
    categoryId: null,
    views: 1320,
    updated: "2 weeks ago",
  },
  {
    id: 12,
    title: "Turning on two-factor authentication for your team",
    status: "draft",
    authorId: 3,
    categoryId: 4,
    views: 0,
    updated: "2 weeks ago",
  },
  {
    id: 13,
    title: "Onboarding checklist for new team members",
    status: "published",
    authorId: 4,
    categoryId: 1,
    views: 990,
    updated: "3 weeks ago",
  },
  {
    id: 14,
    title: "Getting a refund for a double charge",
    status: "published",
    authorId: 2,
    categoryId: 2,
    views: 640,
    updated: "1 month ago",
  },
  {
    id: 15,
    title: "Release notes: Android app 3.2",
    status: "archived",
    authorId: 1,
    categoryId: 6,
    views: 2105,
    updated: "4 months ago",
  },
];

// F159: translations of the English articles, shown when the Locale filter is Arabic or Urdu. Kept apart from
// `articles` so the reply box "Insert article" (cw-data.ts) keeps listing the English ones only.
export const translatedArticles: Article[] = [
  { id: 101, title: "البدء مع مساحة عمل ويبلابس", status: "published", authorId: 2, categoryId: 1, views: 1240, updated: "3 hours ago", locale: "ar", body: ["مساحة عمل ويبلابس هي المكان الذي يبني فيه فريقك المشاريع ويتابعها ويسلمها. يستغرق هذا الدليل خمس دقائق تقريباً.", "الخطوات", "1. افتح الإعدادات وأضف اسم شركتك وشعارها.\n2. ادعُ زملاءك واختر دوراً لكل واحد منهم.\n3. اربط نطاقك الخاص وفعّل شهادة SSL.\n4. أنشئ مشروعك الأول وشارك رابطه مع فريقك.", "هل تنتقل من أداة أخرى؟ استخدم استيراد البيانات في صفحة المشاريع لنقل مشاريعك وسجلها."] },
  { id: 102, title: "فهم فاتورتك", status: "published", authorId: 2, categoryId: 2, views: 860, updated: "1 day ago", locale: "ar", body: ["توضح هذه المقالة معنى كل سطر في فاتورة ويبلابس، وأين تجد فواتيرك السابقة.", "قراءة الفاتورة", "1. رقم الفاتورة وتاريخها في أعلى الصفحة.\n2. الخطة وعدد المقاعد في جدول البنود.\n3. الضريبة والإجمالي في أسفل الفاتورة.", "تجد كل الفواتير السابقة في الإعدادات ثم الفوترة، ويمكنك تنزيلها بصيغة PDF."] },
  { id: 103, title: "كيفية إعادة تعيين كلمة المرور", status: "published", authorId: 4, categoryId: 4, views: 705, updated: "2 days ago", locale: "ar", body: ["إذا نسيت كلمة المرور يمكنك تعيين كلمة جديدة خلال دقيقة واحدة.", "الخطوات", "1. اضغط «نسيت كلمة المرور» في صفحة الدخول.\n2. اكتب بريدك الإلكتروني واضغط إرسال.\n3. افتح الرابط في بريدك واختر كلمة مرور جديدة.", "لم تصلك الرسالة؟ تحقق من مجلد الرسائل غير المرغوبة أو تواصل معنا."] },
  { id: 104, title: "تصدير التقارير بصيغة CSV", status: "draft", authorId: 4, categoryId: 3, views: 0, updated: "4 days ago", locale: "ar", body: ["يمكنك تنزيل أي تقرير بصيغة CSV لفتحه في جداول البيانات.", "الخطوات", "1. افتح صفحة التقارير.\n2. اختر الفترة الزمنية والمرشحات.\n3. اضغط تصدير ثم CSV.", "يصل ملف التقارير الكبيرة إلى بريدك عند اكتماله."] },
  { id: 105, title: "التحويل إلى الفوترة السنوية", status: "published", authorId: 2, categoryId: 2, views: 312, updated: "1 week ago", locale: "ar", body: ["الفوترة السنوية توفر عليك شهرين مقارنة بالدفع الشهري.", "الخطوات", "1. افتح الإعدادات ثم الفوترة.\n2. اضغط تغيير الخطة واختر سنوي.\n3. أكد الدفع.", "يُحسب الرصيد المتبقي من شهرك الحالي تلقائياً."] },
  { id: 106, title: "إعداد الدخول الموحد مع Azure AD", status: "draft", authorId: 1, categoryId: 4, views: 0, updated: "2 weeks ago", locale: "ar", body: ["يتيح الدخول الموحد لفريقك الدخول بحسابات Azure AD نفسها.", "الخطوات", "1. أنشئ تطبيقاً جديداً في Azure AD.\n2. انسخ معرّف التطبيق والسر إلى إعدادات الأمان في ويبلابس.\n3. فعّل الدخول الموحد واختبره بحساب واحد.", "يحتاج هذا الإعداد إلى صلاحية مدير في الحسابين."] },
  { id: 107, title: "Apna Weblabs workspace shuru karein", status: "published", authorId: 3, categoryId: 1, views: 188, updated: "1 week ago", locale: "ur", body: ["آپ کا ویب لیبز ورک اسپیس وہ جگہ ہے جہاں آپ کی ٹیم پروجیکٹ بناتی اور مکمل کرتی ہے۔", "مراحل", "1. سیٹنگز کھولیں اور کمپنی کا نام اور لوگو شامل کریں۔\n2. اپنی ٹیم کو مدعو کریں اور ہر ایک کا کردار منتخب کریں۔\n3. اپنا پہلا پروجیکٹ بنائیں۔", "کسی اور ٹول سے آ رہے ہیں؟ پروجیکٹس کے صفحے پر امپورٹ استعمال کریں۔"] },
  { id: 108, title: "Password reset karne ka tareeqa", status: "draft", authorId: 3, categoryId: 4, views: 0, updated: "3 weeks ago", locale: "ur", body: ["اگر آپ پاس ورڈ بھول گئے ہیں تو ایک منٹ میں نیا پاس ورڈ بنا سکتے ہیں۔", "مراحل", "1. لاگ ان صفحے پر «پاس ورڈ بھول گئے» دبائیں۔\n2. اپنا ای میل لکھیں اور بھیجیں۔\n3. ای میل میں موجود لنک کھول کر نیا پاس ورڈ منتخب کریں۔", "ای میل نہیں ملی؟ اسپام فولڈر دیکھیں۔"] },
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
  "Your Weblabs workspace is where your team builds, tracks and ships projects. This guide takes about five minutes and covers what every new workspace owner sets up first.",
  "Steps",
  "1. Open Settings and add your company name and logo.\n2. Invite your teammates from Settings and choose a role for each one.\n3. Connect your custom domain and turn on SSL.\n4. Create your first project and share the link with your team.",
  "Moving from another tool? Use Import data on the Projects page to bring in your existing projects and their history.",
];
