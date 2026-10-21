// «كل شيء سمارت» (بنود فهد 1–4): نصوص الصفحة وما يستطيع المساعد تجهيزه. بيانات تجريبية فقط، بلا خادم.
import type { LucideIcon } from "lucide-react";
import { Clock, Headset, Languages, MessageSquareReply, Smile } from "lucide-react";
import { type SimpleIcon, siFacebook, siInstagram, siMessenger, siTiktok, siWhatsapp } from "simple-icons";

export const T = {
  title: "كل شيء سمارت",
  subtitle: "إيمه بيدها كل الإعدادات: تسألك ما تريد، وتربط قنواتك في نفس المكان بضغطة زر.",
  restart: "ابدأ من جديد",
  emptyHint: "كل ما تتفق عليه مع إيمه يظهر هنا فوراً",
  agreedTitle: "ما اتفقنا عليه",
  added: "أُضيف:",
  progress: "تم تجهيز",
  of: "من",
  done: "اكتمل الإعداد",
  activate: "فعّل كل شيء",
  activated: "كل شيء مفعّل",
  active: "مفعّل",
  emmaName: "إيمه",
  emmaRole: "مساعدتك الذكية في الإعداد والربط الفوري",
  typing: "إيمه تكتب…",
  emmaAlt: "إيمه، مساعدتك في الإعداد",
  you: "أنت",
  placeholder: "اكتب لإيمه ما تريد ربطه أو تجهيزه…",
  send: "إرسال",
  yes: "نعم، أضِفه",
  no: "لا، لاحقاً",
  all: "جهّز الباقي عني",
  connectNow: "اربط الآن",
  connectedBadge: "مربوط الآن",
  channelsBarLabel: "ربط القنوات الفوري في نفس المكان:",
  connectModalTitle: "ربط القناة مباشرة مع إيمه",
  connectModalDesc: "يتم الربط هنا في نفس المكان دون الانتقال إلى أي صفحة أخرى.",
  accountLabel: "اسم الحساب أو الرقم",
  accountPlaceholder: "مثال: +966 50 000 0000 أو @account",
  instantOAuth: "ربط سحابي سريع بنقرة واحدة (موصى به)",
  confirmConnect: "تأكيد الربط الفوري",
  cancel: "إلغاء",
  connectedToast: (name: string) => `تم ربط ${name} بنجاح في نفس المكان`,
  greeting:
    "مرحباً! أنا إيمه، وكل الإعدادات بين يدي. اختر أي قناة أو اضغط «اربط الآن» لأربطها لك في نفس المكان دون مغادرة محادثتنا. هل نبدأ بواتساب؟",
  allPrefix: "حاضر، جهّزت الباقي عنك:",
  joiner: "، ",
  skipped: "لا بأس، تركته الآن.",
  already: "هذا جاهز ومربوط عندك في القائمة.",
  unknown: "فهمتك، وسأرتّب ذلك لك فوراً.",
  allDone: "انتهينا! كل شيء جاهز ومربوط الآن، وتستطيع تعديل أي شيء متى شئت بكتابته لي.",
} as const;

export type Kind = "channel" | "card" | "chip";

export interface Topic {
  id: string;
  kind: Kind;
  label: string;
  keywords: string[];
  doneLine: string;
  ask: string;
  icon?: LucideIcon;
  brand?: SimpleIcon;
  lines?: string[];
  quote?: string;
}

export const topics: Topic[] = [
  {
    id: "whatsapp",
    kind: "channel",
    label: "واتساب",
    keywords: ["واتساب", "واتس", "وتساب", "whatsapp"],
    brand: siWhatsapp,
    lines: ["مربوط مع إيمه للرد الفوري على عملائك في واتساب"],
    doneLine: "تم، ربطت واتساب في نفس المكان، وسأرد على رسائل عملائك فيه.",
    ask: "هل تريد أن نربط واتساب الآن بضغطة زر؟",
  },
  {
    id: "messenger",
    kind: "channel",
    label: "ماسنجر",
    keywords: ["ماسنجر", "مسنجر", "messenger"],
    brand: siMessenger,
    lines: ["مربوط للرد الفوري على رسائل ماسنجر"],
    doneLine: "تم ربط ماسنجر في نفس المكان، وسأستقبل رسائل العملاء عليه.",
    ask: "وما رأيك بربط ماسنجر الآن في نفس المكان؟",
  },
  {
    id: "facebook",
    kind: "channel",
    label: "فيسبوك",
    keywords: ["فيسبوك", "فيس بوك", "فيس", "facebook"],
    brand: siFacebook,
    lines: ["سأرد على تعليقات ورسائل صفحتك في فيسبوك"],
    doneLine: "أضفت فيسبوك وربطت صفحتك بنجاح.",
    ask: "وفيسبوك؟ أستطيع ربط صفحتك والرد على التعليقات والرسائل.",
  },
  {
    id: "instagram",
    kind: "channel",
    label: "إنستغرام",
    keywords: ["انستغرام", "انستقرام", "انستجرام", "انستا", "instagram"],
    brand: siInstagram,
    lines: ["سأرد على الرسائل الخاصة والتعليقات في إنستغرام"],
    doneLine: "أضفت إنستغرام، وسأرد على الرسائل الخاصة والتعليقات.",
    ask: "ما رأيك بإنستغرام أيضاً؟ أربطه لك الآن للرد على الرسائل الخاصة والتعليقات.",
  },
  {
    id: "tiktok",
    kind: "channel",
    label: "تيك توك",
    keywords: ["تيك توك", "تيكتوك", "tiktok"],
    brand: siTiktok,
    lines: ["سأرد على رسائل واستفسارات عملائك في تيك توك"],
    doneLine: "تم ربط تيك توك في نفس المكان بنجاح.",
    ask: "وهل نربط حساب تيك توك أيضاً في نفس المكان؟",
  },
  {
    id: "hours",
    kind: "card",
    label: "ساعات العمل",
    keywords: ["ساعات", "دوام", "وقت العمل", "مواعيد", "اوقات", "وقت"],
    icon: Clock,
    lines: ["من الأحد إلى الخميس", "من ٩ صباحاً إلى ٩ مساءً", "خارج الدوام: رسالة لطيفة بموعد العودة"],
    doneLine: "حددت ساعات العمل من الأحد إلى الخميس، من ٩ صباحاً إلى ٩ مساءً.",
    ask: "متى تعمل؟ أقترح من الأحد إلى الخميس، من ٩ صباحاً إلى ٩ مساءً. هل يناسبك؟",
  },
  {
    id: "autoReply",
    kind: "card",
    label: "الرد التلقائي",
    keywords: ["رد تلقائي", "الرد التلقائي", "تلقائي", "ترحيب", "رساله ترحيب"],
    icon: MessageSquareReply,
    quote: "أهلاً بك! كيف أقدر أخدمك اليوم؟",
    lines: ["أول رسالة يراها كل عميل جديد"],
    doneLine: "جهزت رسالة ترحيب تصل لكل عميل جديد.",
    ask: "ما رأيك برسالة ترحيب تلقائية لكل عميل جديد؟",
  },
  {
    id: "handoff",
    kind: "card",
    label: "التحويل لموظف",
    keywords: ["تحويل", "حول", "موظف", "بشري", "شخص"],
    icon: Headset,
    lines: ["عندما يطلب العميل موظفاً أحوّله فوراً", "وأرسل للموظف ملخص المحادثة"],
    doneLine: "إذا طلب العميل موظفاً سأحوّله فوراً مع ملخص المحادثة.",
    ask: "إذا طلب العميل موظفاً، هل أحوّله لفريقك فوراً؟",
  },
  {
    id: "tone",
    kind: "chip",
    label: "أسلوب ودود",
    keywords: ["اسلوب", "نبره", "نبرة", "ودود", "لطيف", "رسمي"],
    icon: Smile,
    doneLine: "سأرد بأسلوب ودود ومختصر.",
    ask: "كيف تحب أن أتكلم مع عملائك؟ أقترح أسلوباً ودوداً ومختصراً.",
  },
  {
    id: "language",
    kind: "chip",
    label: "العربية والإنجليزية",
    keywords: ["لغه", "لغة", "عربي", "انجليزي", "العربيه"],
    icon: Languages,
    doneLine: "سأرد بلغة العميل: العربية أو الإنجليزية.",
    ask: "وأخيراً اللغة: هل أرد بلغة العميل، العربية أو الإنجليزية؟",
  },
];

export const yesWords = [
  "نعم",
  "ايوه",
  "ايه",
  "اكيد",
  "موافق",
  "تمام",
  "طيب",
  "اوكي",
  "يناسبني",
  "نعم اضفه",
  "اربط",
  "اربط الان",
];
export const noWords = ["لا", "لاحقا", "مو الان", "ليس الان", "التالي", "لا التالي", "لا تربط", "تخطي"];
export const allWords = ["كل شيء", "كل شي", "الباقي", "جهز كل", "جهز الباقي"];

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[،,.!؟?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
