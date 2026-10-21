// موظف الذكاء البشري (بنود فهد 5-11، والمقترح المدموج القسم 3): كل النصوص الظاهرة هنا، وبيانات تجريبية بلا خادم.
import {
  AtSign,
  GraduationCap,
  Inbox,
  type LucideIcon,
  MessagesSquare,
  Radio,
  ShieldCheck,
  Tag,
  User,
  Users,
} from "lucide-react";

// العدد بالعربية: بند واحد، بندين، 3 بنود، 11 بنداً.
export function termCount(n: number) {
  if (n === 1) return "بند واحد";
  if (n === 2) return "بندين";
  if (n <= 10) return `${n} بنود`;
  return `${n} بنداً`;
}

export const T = {
  title: "موظف الذكاء البشري",
  subtitle: "عيّن الذكاء الاصطناعي موظفاً لديك: اتفق معه على البنود، ثم اختر طريقة عمله، ثم شغّله.",

  // شريط الخطوات (غير مقفل، يُضغط أي خطوة في أي وقت)
  stepsLabel: "خطوات تعيين الموظف",
  next: "التالي",
  back: "السابق",

  // الخطوة الأولى: الاتفاق
  chatTitle: "الاتفاق على البنود",
  chatDesc: "أخبر المساعد بما تريد منه، وكل ما تتفقان عليه يُضاف إلى القائمة.",
  greeting: "مرحباً، أنا مساعدك لهذه الوظيفة. دعنا نتفق على البنود: ماذا تريد مني أن أقوم به؟",
  you: "أنت",
  assistant: "المساعد",
  inputPlaceholder: "اكتب ما تريد من المساعد...",
  send: "إرسال",
  suggestions: "اقتراحات",
  replyAdded: (term: string) => `اتفقنا: «${term}». هل تريد إضافة بند آخر؟`,
  replyDone: (n: number) => `ممتاز، اتفقنا على ${termCount(n)}. اختر الآن طريقة عملي.`,

  termsTitle: "البنود المتفق عليها",
  termsDesc: "يمكنك تعديل أي بند أو حذفه.",
  termsEmpty: "لم نتفق على أي بند بعد. اكتب في المحادثة ما تريد من المساعد، أو اختر من الاقتراحات.",
  agreed: "تم الاتفاق",
  edit: "تعديل",
  remove: "حذف",
  saveTerm: "حفظ",
  cancel: "إلغاء",

  // الخطوة الثانية: طريقة العمل
  modeTitle: "وضع العمل",
  modeDesc: "ما يفعله الموظف في كل محادثة، ويمكنك الجمع بين أكثر من خيار.",
  doesNone: "اختر خياراً واحداً على الأقل ليعمل الموظف.",
  // البند 10
  autoLabel: "العمل بشكل مستقل",
  autoDesc: "يعمل وحده دون انتظار موافقة أحد من فريقك، فيرد على العملاء وينهي المحادثات بنفسه وفق البنود المتفق عليها.",
  autoOn: "يعمل مستقلاً",

  learnTitle: "التعلم",
  learnDesc: "كيف يتعلم الموظف ويكتب ردوده.",

  sourceTitle: "مصدر التعلم",
  sourceDesc: "من أين يتعلم الموظف طريقة الرد.",
  pickAgent: "اختر الموظف",
  pickLabel: "اختر الوسم",
  pickMention: "اختر الإشارة",
  pickPlaceholder: "اختر من القائمة",
  pickMissing: "اختر من القائمة ليبدأ التعلم من هذا المصدر.",

  sizeTitle: "العينة",
  sizeDesc: "عدد المحادثات التي يتعلم منها الموظف.",
  costNote: "كلما اخترت عدداً أكبر زادت التكلفة عليك.",
  costLabel: "التكلفة المقدّرة",
  points: "نقطة",

  advancedTitle: "إعدادات متقدمة",
  advancedDesc: "مراجعة الرسائل قبل الإرسال، ولمن يُحال.",
  // من إعدادات فهد السابقة (البند 7أ، خريطة صفحة الذكاء: 35، 39، 40، 32)
  prevTitle: "من إعداداتك السابقة",
  prevDesc: "إعدادات اعتمدتها سابقاً للموظف، جمعناها هنا.",
  handoffLabel: "لمن يُحال",
  handoffDesc: "من يستلم المحادثة حين يحوّلها الموظف.",

  // الخطوة الثالثة: التشغيل
  launchTitle: "التشغيل",
  launchDesc: "راجع ما اخترته، ثم شغّل الموظف.",
  activeLabel: "تشغيل موظف الذكاء",
  activeDesc: "موظف موجود لديك، يبدأ العمل عند تشغيل هذا المفتاح.",
  summaryTitle: "ملخص ما اخترته",
  sumTerms: "البنود",
  sumTermsValue: (n: number) => (n ? `اتفقنا على ${termCount(n)}` : "لم نتفق على بنود بعد"),
  sumMode: "وضع العمل",
  sumLearn: "التعلم",
  sumLearnNone: "لا يتعلم",
  sumSource: "مصدر التعلم",
  sumPickMissing: "لم تختر بعد",
  sumSize: "العينة",
  sumHandoff: "لمن يُحال",
  listSep: "، ",
  running: "يعمل",
  stopped: "متوقف",
  notLaunched: "لم يُشغَّل بعد",
  launch: "تشغيل",
  saveStopped: "حفظ",
  unsaved: "لديك تغييرات لم تُحفظ",
  revert: "إلغاء التغييرات",
  launched: "تم تشغيل الموظف بالإعدادات المختارة",
  savedStopped: "تم حفظ الإعدادات، والموظف متوقف",
  reverted: "تم التراجع عن التغييرات",
} as const;

export type StepKey = "agree" | "work" | "launch";

export const steps: { key: StepKey; label: string; desc: string }[] = [
  { key: "agree", label: "الاتفاق", desc: "البنود وما تريده منه" },
  { key: "work", label: "طريقة العمل", desc: "كيف يعمل ومن أين يتعلم" },
  { key: "launch", label: "التشغيل", desc: "راجع وشغّل الموظف" },
];

export const suggestedTerms = [
  "الرد على أسئلة العملاء",
  "متابعة الطلبات والشحن",
  "حجز المواعيد",
  "الرد على الأسعار والعروض",
  "تحويل الشكاوى إلى الفريق",
];

// ما يفعله في المحادثة (خريطة صفحة الذكاء 40: يضيف، يقترح، يتعلم؛ و32: الأسلوب الآلي يتعلم من ردود وكلائك).
// قابلة للجمع كما كانت.
export type DoesKey = "add" | "suggest" | "learn";

export const doesOptions: { value: DoesKey; label: string; desc: string }[] = [
  { value: "add", label: "يضيف", desc: "يضيف الرد مباشرة" },
  { value: "suggest", label: "يقترح", desc: "يقترح الرد على الموظف" },
  { value: "learn", label: "يتعلم", desc: "يتعلم من ردود وكلائك" },
];

// البند 7: «تعلم التحدث مثل البشر ... تعلم من الرسائل ومراجعة الرسائل». الأولان في بطاقة التعلم، والمراجعة في المتقدم.
export type WorkKey = "human" | "learn" | "review";

export const workOptions: Record<WorkKey, { icon: LucideIcon; label: string; desc: string }> = {
  human: {
    icon: MessagesSquare,
    label: "تعلّم التحدث مثل البشر",
    desc: "يكتب بأسلوب طبيعي قريب من أسلوب فريقك.",
  },
  learn: {
    icon: GraduationCap,
    label: "تعلّم من الرسائل ومراجعتها",
    desc: "يستفيد من الرسائل السابقة ويراجعها ليجيب بدقة أكبر.",
  },
  review: {
    icon: ShieldCheck,
    label: "مراجعة الرسائل قبل الإرسال",
    desc: "يراجع كل رد قبل إرساله ليتأكد من صحته.",
  },
};

export const learningKeys: WorkKey[] = ["human", "learn"];

// تكلفة تقريبية بالنقاط لكل حجم (تجريبية).
export const sizeOptions = [
  { value: "50", label: "آخر 50 محادثة", desc: "أسرع وأقل تكلفة.", cost: 250 },
  { value: "100", label: "آخر 100 محادثة", desc: "تعلّم أعمق وتكلفة أعلى.", cost: 500 },
];

export type SourceKey = "inboxes" | "channels" | "agents" | "agent" | "label" | "mention";

export const sourceOptions: { value: SourceKey; icon: LucideIcon; label: string; desc: string }[] = [
  { value: "inboxes", icon: Inbox, label: "كل الصناديق", desc: "كل الرسائل في كل صناديق الوارد." },
  { value: "channels", icon: Radio, label: "كل القنوات", desc: "واتساب وإنستغرام وفيسبوك وغيرها." },
  { value: "agents", icon: Users, label: "كل الموظفين", desc: "ردود كل موظفي فريقك." },
  { value: "agent", icon: User, label: "موظف واحد", desc: "ردود موظف واحد تختاره." },
  { value: "label", icon: Tag, label: "وسم واحد", desc: "المحادثات التي تحمل وسماً تختاره." },
  { value: "mention", icon: AtSign, label: "إشارة واحدة", desc: "المحادثات التي فيها إشارة تختارها." },
];

export const mockAgents = ["سارة الكعبي", "محمد العلي", "نورة المري", "خالد الهاجري", "ريم السليطي"];
export const mockLabels = ["مبيعات", "دعم فني", "شكوى", "عميل مميز", "استرجاع"];
export const mockMentions = ["@فريق المبيعات", "@الدعم الفني", "@المدير", "@الحسابات"];

export const pickLists: Partial<Record<SourceKey, { label: string; items: string[] }>> = {
  agent: { label: T.pickAgent, items: mockAgents },
  label: { label: T.pickLabel, items: mockLabels },
  mention: { label: T.pickMention, items: mockMentions },
};

export const handoffOptions = ["إضافة تلقائية للموظفين", ...mockAgents];

export const sectorOptions = [
  { value: "cars", label: "معرض سيارات" },
  { value: "restaurant", label: "مطعم وكافيه" },
  { value: "perfume", label: "عطور وتجميل" },
  { value: "sweets", label: "حلويات ومخابز" },
  { value: "kindergarten", label: "روضة أطفال وتعليم" },
  { value: "bank", label: "بنك وخدمات مالية" },
] as const;

export const LIVE_DISCOVERY_T = {
  cardTitle: "ما اكتشفه الموظف اليوم من صناديق فريقك وآخر 100 محادثة",
  cardSub: "يقرأ المحادثات الحية وصناديق الموظفين آلياً ليتعلم أسلوبهم ويكتشف المشاكل المتكررة.",
  sectorLabel: "نشاط الشركة:",
  nameLabel: "اسم الموظف الذكي:",
  rescanBtn: "تعلّم الآن من آخر المحادثات",
  scanning: "جارٍ فحص الصناديق…",
  learnedToast: "تم تحديث ذاكرة الموظف من صناديق الفريق بنجاح",
  solveAction: "حلّ تلقائياً",
  suggestAction: "اقترح على الموظف",
  escalateAction: "حوّل للمختص",
  inboxesBadge: "متصل بصناديق الموظفين الحية",
} as const;

export interface EmployeeSettings {
  name?: string;
  sector?: string;
  terms: string[];
  agreed: boolean;
  does: Record<DoesKey, boolean>;
  auto: boolean;
  work: Record<WorkKey, boolean>;
  size: string;
  source: SourceKey;
  pick: string;
  handoff: string;
  active: boolean;
}

export const initialSettings: EmployeeSettings = {
  name: "إيمه",
  sector: "cars",
  terms: [
    "الرد بأسلوب بشري طبيعي قريب من فريق المبيعات والدعم",
    "قراءة صناديق الموظفين واكتشاف المشاكل المتكررة يومياً",
  ],
  agreed: false,
  does: { add: true, suggest: true, learn: true },
  auto: false,
  work: { human: true, learn: true, review: true },
  size: "100",
  source: "inboxes",
  pick: "",
  handoff: handoffOptions[0],
  active: true,
};

export type Patch = (p: Partial<EmployeeSettings>) => void;
