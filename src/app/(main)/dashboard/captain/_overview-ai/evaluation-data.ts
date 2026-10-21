// أمر فهد (2026-10-18 16:09)، البنود 48 و49 و53: بيانات تجريبية فقط (بلا خادم) لبطاقات تقييم الموظفين ورأس الرصيد
// في صفحة النظرة العامة. أسماء أسباب القوة والضعف هي كلمات فهد نفسها (البنود 32 و33 و34 و38).

export interface Reason {
  label: string;
  count: number;
}

export interface Evidence {
  id: number;
  positive: boolean;
  reason: string;
  customer: string;
  reply: string;
  time: string;
}

export interface EmployeeEval {
  id: string;
  name: string;
  team: string;
  conversations: number;
  score: number;
  positive: number;
  trend: number;
  why: string;
  strengths: Reason[];
  weaknesses: Reason[];
  examples: Evidence[];
}

export const S = {
  happy: "سعادة العميل",
  solved: "معالجة المشكلة فعلياً",
  need: "فهم حاجة العميل",
  kind: "الرد بود",
  better: "اقتراحات أفضل",
} as const;

export const W = {
  dodge: "التهرب من معالجة المشكلة",
  unknown: "عدم معرفة الإجابة",
  late: "التأخر بالرد",
  hanging: "ترك المحادثة معلقة",
  upset: "استياء العميل",
} as const;

const r = (label: string, count: number): Reason => ({ label, count });

export const employees: EmployeeEval[] = [
  {
    id: "maryam",
    name: "مريم الكواري",
    team: "الدعم الفني",
    conversations: 168,
    score: 92,
    positive: 91,
    trend: 4,
    why: "تحل المشكلة من أول رد وتطمئن العميل، والعملاء يشكرونها في آخر المحادثة.",
    strengths: [r(S.happy, 121), r(S.solved, 112), r(S.kind, 96), r(S.need, 74), r(S.better, 31)],
    weaknesses: [r(W.late, 9), r(W.hanging, 4), r(W.unknown, 2)],
    examples: [
      {
        id: 4921,
        positive: true,
        reason: S.solved,
        customer: "الراوتر يفصل كل ساعة تقريباً.",
        reply: "غيّرت قناة الشبكة من عندنا، جرّب الآن وأخبرني إن تكرر الفصل.",
        time: "قبل ساعة",
      },
      {
        id: 4890,
        positive: true,
        reason: S.happy,
        customer: "شكراً، أول مرة تنحل مشكلتي بهذه السرعة!",
        reply: "العفو، يسعدنا ذلك. أنا هنا إن احتجت أي شيء.",
        time: "قبل 3 ساعات",
      },
      {
        id: 4812,
        positive: false,
        reason: W.late,
        customer: "مرحباً؟ هل أحد هنا؟",
        reply: "أعتذر عن التأخير، كنت أتحقق من خطك. المشكلة حُلّت الآن.",
        time: "أمس",
      },
    ],
  },
  {
    id: "khalid",
    name: "خالد المنصوري",
    team: "المبيعات",
    conversations: 142,
    score: 85,
    positive: 84,
    trend: 2,
    why: "يفهم ما يحتاجه العميل ويقترح الباقة المناسبة، لكنه أحياناً لا يعرف تفاصيل العروض الجديدة.",
    strengths: [r(S.need, 98), r(S.better, 77), r(S.kind, 70), r(S.happy, 66), r(S.solved, 51)],
    weaknesses: [r(W.unknown, 14), r(W.late, 8), r(W.hanging, 3)],
    examples: [
      {
        id: 4918,
        positive: true,
        reason: S.need,
        customer: "أسافر إلى الرياض أسبوعين، أي باقة تجوال تناسبني؟",
        reply: "باقة الخليج لأسبوعين تكفيك وأوفر من الباقة اليومية، أفعّلها لك؟",
        time: "قبل 34 دقيقة",
      },
      {
        id: 4855,
        positive: false,
        reason: W.unknown,
        customer: "هل عرض رمضان يشمل الخطوط الإضافية؟",
        reply: "لست متأكداً، سأتحقق وأعود إليك.",
        time: "قبل يومين",
      },
    ],
  },
  {
    id: "sara",
    name: "سارة العتيبي",
    team: "خدمة العملاء",
    conversations: 156,
    score: 88,
    positive: 88,
    trend: 5,
    why: "ترد بود ولطف حتى مع العميل الغاضب، وتهدئه قبل أن تحل مشكلته.",
    strengths: [r(S.kind, 118), r(S.happy, 104), r(S.solved, 88), r(S.need, 69), r(S.better, 22)],
    weaknesses: [r(W.late, 11), r(W.unknown, 5), r(W.hanging, 3)],
    examples: [
      {
        id: 4899,
        positive: true,
        reason: S.kind,
        customer: "هذه ثالث مرة أتواصل معكم ولم يحل أحد شيئاً!",
        reply: "أتفهم انزعاجك تماماً، وسأتابع طلبك بنفسي حتى يُحل اليوم.",
        time: "قبل ساعتين",
      },
      {
        id: 4866,
        positive: true,
        reason: S.solved,
        customer: "لم تصلني الفاتورة الإلكترونية.",
        reply: "أرسلتها الآن إلى بريدك، وفعّلت لك الإرسال التلقائي كل شهر.",
        time: "قبل 6 ساعات",
      },
    ],
  },
  {
    id: "fatima",
    name: "فاطمة السويدي",
    team: "المبيعات",
    conversations: 133,
    score: 82,
    positive: 81,
    trend: 1,
    why: "تعالج طلب العميل فعلياً حتى النهاية، وتحتاج أن تسرع ردها الأول قليلاً.",
    strengths: [r(S.solved, 92), r(S.need, 80), r(S.happy, 71), r(S.kind, 60), r(S.better, 38)],
    weaknesses: [r(W.late, 15), r(W.upset, 6), r(W.hanging, 4)],
    examples: [
      {
        id: 4907,
        positive: true,
        reason: S.solved,
        customer: "هل عندكم خصم للعائلات مع عدة خطوط؟",
        reply: "نعم، أضفت خطوطك الأربعة لباقة العائلة ووفرت عليك 25٪ شهرياً.",
        time: "قبل ساعة",
      },
      {
        id: 4840,
        positive: false,
        reason: W.late,
        customer: "أنتظر منذ نصف ساعة.",
        reply: "أعتذر جداً، كان الضغط عالياً. سأكمل طلبك الآن.",
        time: "قبل يومين",
      },
    ],
  },
  {
    id: "noura",
    name: "نورة آل ثاني",
    team: "الفوترة",
    conversations: 121,
    score: 76,
    positive: 78,
    trend: -3,
    why: "إجاباتها صحيحة ومهذبة، لكنها تتأخر بالرد في أوقات الذروة فيستاء بعض العملاء.",
    strengths: [r(S.kind, 74), r(S.solved, 63), r(S.need, 52), r(S.happy, 48)],
    weaknesses: [r(W.late, 19), r(W.upset, 9), r(W.hanging, 5), r(W.unknown, 3)],
    examples: [
      {
        id: 4884,
        positive: false,
        reason: W.late,
        customer: "أريد إضافة باقة بي إن سبورت، أنتظر الرد منذ ساعة.",
        reply: "أعتذر عن التأخير، أضفتها لك الآن.",
        time: "قبل 4 ساعات",
      },
      {
        id: 4921,
        positive: true,
        reason: S.solved,
        customer: "دفعت فاتورة أكتوبر مرتين بالخطأ.",
        reply: "تأكدت من الدفعتين، وأعدت المبلغ الزائد إلى بطاقتك خلال 3 أيام عمل.",
        time: "قبل 12 دقيقة",
      },
    ],
  },
  {
    id: "reem",
    name: "ريم الحمادي",
    team: "خدمة العملاء",
    conversations: 110,
    score: 69,
    positive: 70,
    trend: -2,
    why: "ودودة مع العملاء، لكنها لا تعرف إجابة كثير من الأسئلة التقنية ثم لا تكمل الرد.",
    strengths: [r(S.kind, 66), r(S.happy, 41), r(S.need, 35)],
    weaknesses: [r(W.unknown, 21), r(W.hanging, 9), r(W.late, 6), r(W.upset, 4)],
    examples: [
      {
        id: 4871,
        positive: false,
        reason: W.unknown,
        customer: "كيف أوقف خطي مؤقتاً في الصيف؟",
        reply: "لا أعرف إن كان ذلك ممكناً.",
        time: "قبل 5 ساعات",
      },
      {
        id: 4833,
        positive: true,
        reason: S.kind,
        customer: "آسف على الإزعاج، سؤال أخير.",
        reply: "لا إزعاج أبداً، تفضل بكل سرور.",
        time: "أمس",
      },
    ],
  },
  {
    id: "hamad",
    name: "حمد المري",
    team: "الدعم الفني",
    conversations: 97,
    score: 58,
    positive: 62,
    trend: -6,
    why: "يتهرب من معالجة المشكلة ويحوّل العميل دون محاولة، فيعود العميل مستاءً.",
    strengths: [r(S.need, 38), r(S.kind, 31), r(S.solved, 24)],
    weaknesses: [r(W.dodge, 22), r(W.upset, 13), r(W.late, 10), r(W.hanging, 7)],
    examples: [
      {
        id: 4890,
        positive: false,
        reason: W.dodge,
        customer: "ضوء الراوتر أحمر منذ الصباح.",
        reply: "هذه ليست من مهامي، تواصل مع قسم آخر.",
        time: "قبل 3 ساعات",
      },
      {
        id: 4826,
        positive: false,
        reason: W.upset,
        customer: "هذا ثالث موظف يحولني ولا أحد يحل المشكلة!",
        reply: "سأحولك مرة أخرى.",
        time: "أمس",
      },
      {
        id: 4801,
        positive: true,
        reason: S.need,
        customer: "النت بطيء في غرفة واحدة فقط.",
        reply: "غالباً تحتاج مقوي إشارة لتلك الغرفة، أرسل لك الخيارات؟",
        time: "قبل 3 أيام",
      },
    ],
  },
  {
    id: "omar",
    name: "عمر الشحي",
    team: "الفوترة",
    conversations: 84,
    score: 52,
    positive: 55,
    trend: -8,
    why: "يترك المحادثات معلقة بلا رد أخير، ويتأخر كثيراً، وهذا سبب أغلب التقييمات السلبية.",
    strengths: [r(S.kind, 29), r(S.solved, 22), r(S.need, 17)],
    weaknesses: [r(W.hanging, 18), r(W.late, 14), r(W.upset, 10), r(W.unknown, 6)],
    examples: [
      {
        id: 4860,
        positive: false,
        reason: W.hanging,
        customer: "هل تم إلغاء الرسوم الإضافية؟",
        reply: "سأتحقق وأعود إليك.",
        time: "قبل يومين",
      },
      {
        id: 4848,
        positive: false,
        reason: W.late,
        customer: "متى يُعاد المبلغ؟ سألت أمس ولم يرد أحد.",
        reply: "خلال أسبوع إن شاء الله.",
        time: "قبل يومين",
      },
    ],
  },
];

// الرصيد بالنقاط (تجريبي): ما صُرف هذا الشهر حتى اليوم 18 من أكتوبر، موزعاً بين التقييم وموظف الذكاء البشري.
export const balance = {
  available: 12480,
  spentEvaluation: 2140,
  spentEmployee: 1380,
  dayOfMonth: 18,
};

export interface SpendRow {
  id: number;
  kind: "evaluation" | "employee" | "topup";
  title: string;
  date: string;
  points: number;
}

export const spendLog: SpendRow[] = [
  { id: 1, kind: "evaluation", title: "تقييم 64 محادثة", date: "18 أكتوبر", points: -128 },
  { id: 2, kind: "employee", title: "212 رداً على العملاء", date: "18 أكتوبر", points: -84 },
  { id: 3, kind: "evaluation", title: "تقييم 71 محادثة", date: "17 أكتوبر", points: -142 },
  { id: 4, kind: "employee", title: "240 رداً على العملاء", date: "17 أكتوبر", points: -96 },
  { id: 5, kind: "topup", title: "شحن الرصيد", date: "15 أكتوبر", points: 10000 },
  { id: 6, kind: "evaluation", title: "تقييم 58 محادثة", date: "15 أكتوبر", points: -116 },
  { id: 7, kind: "employee", title: "198 رداً على العملاء", date: "14 أكتوبر", points: -79 },
  { id: 8, kind: "evaluation", title: "تقييم 66 محادثة", date: "14 أكتوبر", points: -132 },
];
