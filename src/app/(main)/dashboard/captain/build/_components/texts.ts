// «اربط ذكاءك» (Fahad items 50–52, 54–55): every visible string lives here, so the build's machine translation
// of literal JSX text never touches it. The fields are the standard ones that respond.io (AI Assist: persona,
// test) and ManyChat (Integrations: ChatGPT / Claude with an API secret) offer: provider, model, key, base URL,
// instructions, a history window, temperature and reply length. No private memory of ours.
import type { LucideIcon } from "lucide-react";
import { Aperture, Asterisk, Fish, Gem, Server } from "lucide-react";

export const T = {
  title: "اربط ذكاءك",
  subtitle: "اربط ذكاءك الخاص عبر API بالإعدادات القياسية المعروفة، وجرّبه قبل تشغيله.",
  connected: "متصل",
  notConnected: "غير متصل",

  connectionTitle: "الربط",
  connectionDesc: "اختر مزوّد الذكاء، ثم أدخل اسم النموذج ومفتاحك.",
  provider: "المزوّد",
  model: "اسم النموذج",
  modelHint: "اكتبه كما يظهر في حسابك لدى المزوّد.",
  modelPlaceholder: "مثال: gpt-4.1-mini",
  apiKey: "مفتاح API",
  apiKeyHint: "يُحفظ مشفّراً، ولا يظهر لأحد بعد الحفظ.",
  apiKeyPlaceholder: "الصق المفتاح هنا",
  showKey: "إظهار المفتاح",
  hideKey: "إخفاء المفتاح",
  baseUrl: "رابط الخادم",
  baseUrlHint: "رابط خادم متوافق مع أوبن إيه آي، وينتهي عادةً بـ /v1.",
  baseUrlPlaceholder: "https://api.example.com/v1",
  saveAndTest: "حفظ واختبار",
  testing: "جارٍ الاختبار…",
  testOkTitle: "تم الاتصال بنجاح",
  testOkDesc: "ردّ النموذج خلال",
  ms: "ملّي ثانية",
  needKey: "أدخل مفتاح API أولاً.",
  needModel: "أدخل اسم النموذج أولاً.",
  needUrl: "أدخل رابط الخادم أولاً.",
  save: "حفظ",
  saved: "تم حفظ الإعدادات",
  savedAndConnected: "تم الحفظ، والاتصال يعمل",
  linkLead: "بعد الربط، اختر القنوات التي يرد عليها ذكاؤك.",
  linkApi: "اربط API",

  promptTitle: "التعليمات",
  promptDesc: "ما تكتبه هنا يُرسل مع كل محادثة: من هو، وماذا يقول، وما الذي يتجنبه.",
  prompt: "تعليمات النظام",
  promptPlaceholder: "مثال: أنت موظف خدمة عملاء لمتجر… أجب باختصار وبلطف، ولا تعطِ أسعاراً غير موجودة في السياق.",
  context: "معلومات إضافية",
  contextHint: "ساعات العمل، العنوان، السياسات… تُضاف بعد التعليمات.",
  contextPlaceholder: "مثال: نعمل من 9 صباحاً حتى 10 مساءً، والتوصيل خلال يومين.",
  chars: "حرفاً",
  advanced: "إعدادات متقدمة",
  advancedHint: "المعلومات الإضافية، وعدد الرسائل التي يتذكرها، والإبداع، وطول الرد.",

  memory: "عدد الرسائل التي يتذكرها",
  memoryDesc: "عدد الرسائل السابقة التي تُرسل مع كل رد. لا توجد ذاكرة غيرها.",
  temperature: "الإبداع",
  temperatureDesc: "قيمة منخفضة لردود ثابتة ودقيقة، وعالية لردود أكثر تنوعاً.",
  precise: "دقيق",
  creative: "مبدع",
  maxLength: "أقصى طول للرد",
  maxLengthDesc: "يحدّ من طول الرد ومن التكلفة.",

  chatTitle: "جرّب ذكاءك",
  chatDesc: "محادثة تجريبية بالإعدادات الحالية، لا تصل لأي عميل.",
  chatLocked: "اضغط «حفظ واختبار»، وتبدأ التجربة هنا تلقائياً.",
  chatEmpty: "اكتب رسالة كما يكتبها عميلك.",
  chatPlaceholder: "اكتب رسالتك…",
  send: "إرسال",
  clear: "مسح المحادثة",
  you: "أنت",
  memoryNote: "يتذكر آخر",
  messages: "رسائل",
  mockReply: "أهلاً بك! هذا رد تجريبي من نموذجك بعد قراءة تعليماتك. في التشغيل الفعلي يصل الرد من حسابك لدى المزوّد.",
} as const;

export type ProviderId = "openai" | "anthropic" | "google" | "deepseek" | "custom";

export const providers: {
  id: ProviderId;
  label: string;
  hint: string;
  icon: LucideIcon;
  model: string;
  models: string[];
}[] = [
  {
    id: "openai",
    label: "أوبن إيه آي",
    hint: "نماذج جي بي تي",
    icon: Aperture,
    model: "gpt-4.1-mini",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "anthropic",
    label: "أنثروبيك",
    hint: "نماذج كلود",
    icon: Asterisk,
    model: "claude-sonnet-4-5",
    models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"],
  },
  {
    id: "google",
    label: "جوجل",
    hint: "نماذج جيميناي",
    icon: Gem,
    model: "gemini-2.5-flash",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  },
  {
    id: "deepseek",
    label: "ديب سيك",
    hint: "نماذج ديب سيك",
    icon: Fish,
    model: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "custom",
    label: "خادم مخصص",
    hint: "متوافق مع أوبن إيه آي",
    icon: Server,
    model: "",
    models: [],
  },
];

export const memoryOptions = [
  { value: "0", label: "بلا ذاكرة (الرسالة الأخيرة فقط)" },
  { value: "5", label: "آخر 5 رسائل" },
  { value: "10", label: "آخر 10 رسائل" },
  { value: "20", label: "آخر 20 رسالة" },
  { value: "50", label: "آخر 50 رسالة" },
];

export const lengthOptions = [
  { value: "256", label: "قصير (حتى 256 رمزاً)" },
  { value: "512", label: "متوسط (حتى 512 رمزاً)" },
  { value: "1024", label: "طويل (حتى 1024 رمزاً)" },
  { value: "2048", label: "طويل جداً (حتى 2048 رمزاً)" },
];

export const CHANNELS_HREF = "/dashboard/settings/inboxes/new";
