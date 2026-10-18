// M129-C (Fahad 129.9): the ready-made templates of the Template library page.
// 1. Meta's Template Library (F-14, Fahad 129.9 «يجب تجلبون القوالب الجاهزه كلها»): every library template that
//    Meta's own documentation prints, read on 2026-10-15 (META_COPIED_ON). Meta lists the whole library only in
//    WhatsApp Manager or through GET /message_template_library with a connected WhatsApp Business Account's token
//    (template-library page, "Using the API"); this preview has no connected account. Meta's page prints two templates
//    as JSON (variables and types given), and its WhatsApp Manager screenshots show more: some with their variables
//    marked ({{…}} in green), some only with sample values. Nothing below is made up: a template whose variables Meta
//    does not mark keeps the text exactly as the screenshot shows it, and says so (`variablesMarked: false`).
//    Source copies: monitor-workers/f14-wa-template-library/sources (page HTML/text and the screenshots).
// 2. Studio's ready-made templates: the 11 message templates of the T-278 automation library
//    (settings/automation/_flow/template-data.ts, kind "message_template"; ids, titles and Meta category are the same,
//    checked by monitor-workers/m129-c-templates-campaigns/tests). T-278 describes each one in words; the wording
//    below is the ready text in English and Arabic. They were never submitted to Meta: copying one makes a draft that
//    still has to be submitted for approval.

import { PRODUCT_NAME } from "@/config/app-config";

import {
  AUTH_BODY,
  AUTH_SECURITY,
  authExpiryLine,
  type Category,
  type TemplateButton,
  type TemplateDraft,
} from "./template-model";

/** Meta's Template Library industry filter values (template-library page, "Template filters"). */
export type MetaIndustry = "E_COMMERCE" | "FINANCIAL_SERVICES";

/** What Meta's documentation states about a library template (Meta entries only). */
export interface MetaFacts {
  /** The library template name (library_template_name). null: Meta's screenshot does not show it. */
  libraryName: string | null;
  /** Meta's topic, when Meta states it (JSON "topic" or the dialog path "Utility › Order management"). */
  topic?: string;
  /** Meta's use case, when Meta states it (JSON "usecase"). */
  useCase?: string;
  /** Meta's industries (JSON "industry"). Empty: Meta's documentation does not state them for this template. */
  industry: MetaIndustry[];
  /** True when Meta marks which words are variables; false when its screenshot shows only sample values. */
  variablesMarked: boolean;
  /** Parameter types, when Meta states them (JSON body_param_types, or {{text}} in the parameters screenshot). */
  paramTypes?: string[];
  /** A WhatsApp Flow button ("Form" in WhatsApp Manager). Studio's builder has no Flow button. */
  flowButton?: string;
  /** Where on Meta's page the template is printed. */
  evidence: string;
}

export interface LibraryEntry {
  id: string;
  title: string;
  category: Category;
  /** Meta use case or the T-278 id. */
  tag: string;
  source: string;
  sourceLabel: string;
  note?: string;
  meta?: MetaFacts;
  versions: { code: string; draft: Partial<TemplateDraft> & Pick<TemplateDraft, "name" | "body"> }[];
}

const META_LIBRARY =
  "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-library";
const META_AUTH =
  "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates";
const META_AUTH_PREVIEW =
  "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/template-preview";

export const META_LIBRARY_SOURCE = META_LIBRARY;
/** The day the Meta entries were copied from Meta's documentation. */
export const META_COPIED_ON = "2026-10-15";
/** Meta's own WhatsApp Manager screenshot on the template-library page: "Utility (63)", English (US) templates. */
export const META_SHOWN_TOTAL = 63;
/** Library templates Meta's page names without printing their text (the POST and query examples). */
export const META_NAMED_ONLY = ["delivery_update_1", "verify_otp_usecase"];

export const INDUSTRY_LABEL: Record<MetaIndustry, string> = {
  E_COMMERCE: "E-commerce",
  FINANCIAL_SERVICES: "Financial services",
};

/** Meta's library topics (template-library page, "Template filters"). */
export const META_TOPICS = ["ACCOUNT_UPDATE", "CUSTOMER_FEEDBACK", "ORDER_MANAGEMENT", "PAYMENTS"];

/** Meta's library use cases (template-library page), shown so the user knows what WhatsApp Manager offers. */
export const META_USE_CASES = [
  "ACCOUNT_CREATION_CONFIRMATION",
  "AUTO_PAY_REMINDER",
  "DELIVERY_CONFIRMATION",
  "DELIVERY_FAILED",
  "DELIVERY_UPDATE",
  "FEEDBACK_SURVEY",
  "FRAUD_ALERT",
  "LOW_BALANCE_WARNING",
  "ORDER_ACTION_NEEDED",
  "ORDER_CONFIRMATION",
  "ORDER_DELAY",
  "ORDER_OR_TRANSACTION_CANCEL",
  "ORDER_PICK_UP",
  "PAYMENT_ACTION_REQUIRED",
  "PAYMENT_CONFIRMATION",
  "PAYMENT_DUE_REMINDER",
  "PAYMENT_OVERDUE",
  "PAYMENT_REJECT_FAIL",
  "PAYMENT_SCHEDULED",
  "RECEIPT_ATTACHMENT",
  "RETURN_CONFIRMATION",
  "SHIPMENT_CONFIRMATION",
  "STATEMENT_ATTACHMENT",
  "STATEMENT_AVAILABLE",
  "TRANSACTION_ALERT",
];

const SHOT_GRID = "Screenshot of WhatsApp Manager's Template library on Meta's Template Library page";
const SHOT_FORMS = "Screenshot of the Form templates on Meta's Template Library page (section Forms)";
const UNMARKED =
  "Meta's screenshot shows this template with sample values and does not mark its variables. The copy keeps the text exactly as shown: replace the sample values with {{1}}, {{2}}… before you submit. Edited library text goes to Meta's review.";
const FORM_NOTE = `In Meta's library this is a Form: its button opens a WhatsApp Flow, which only accounts with raised messaging limits get. The ${PRODUCT_NAME} builder has no Flow button, so the copy keeps the text only.`;
const verify = (path: string): TemplateButton => ({
  type: "url",
  text: "Verify",
  url: `https://weblabs.studio/${path}`,
  example: "",
});

export const metaLibrary: LibraryEntry[] = [
  {
    id: "meta-low_balance_warning_1",
    title: "Low balance warning",
    category: "UTILITY",
    tag: "PAYMENTS · LOW_BALANCE_WARNING",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (example in Meta's documentation)",
    note: "Library text is fixed; only the variables and the button inputs change. Library templates need no review unless you customize them.",
    meta: {
      libraryName: "low_balance_warning_1",
      topic: "PAYMENTS",
      useCase: "LOW_BALANCE_WARNING",
      industry: ["FINANCIAL_SERVICES"],
      variablesMarked: true,
      evidence: "API example response (GET message_template_library) on Meta's Template Library page",
    },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "low_balance_warning_1",
          headerType: "text",
          headerText: "Your account balance is low",
          // Meta's JSON text exactly (template-library.md): single line breaks.
          body: "Hi {{1}},\nThis is to notify you that your {{2}} in your {{3}} account, ending in {{4}} is below your pre-set {{5}} of {{6}}.\nClick the button to deposit more {{7}}.\n{{8}}",
          examples: [
            "Jim",
            "available funds",
            "CS Mutual checking plus",
            "1234",
            "limit",
            "$75.00",
            "funds",
            "CS Mutual",
          ],
          buttons: [
            { type: "url", text: "Make a deposit", url: "https://weblabs.studio/deposit", example: "" },
            { type: "phone", text: "Call us", phone: "+974 4400 1100" },
          ],
          library: { name: "low_balance_warning_1", customized: false },
        },
      },
    ],
  },
  {
    id: "meta-delivery_failed_2_form",
    title: "Delivery failed (form)",
    category: "UTILITY",
    tag: "ORDER_MANAGEMENT · DELIVERY_FAILED",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (example in Meta's documentation)",
    note: FORM_NOTE,
    meta: {
      libraryName: "delivery_failed_2_form",
      topic: "ORDER_MANAGEMENT",
      useCase: "DELIVERY_FAILED",
      industry: ["E_COMMERCE"],
      variablesMarked: true,
      paramTypes: ["TEXT", "TEXT"],
      flowButton: "Reschedule",
      evidence: "API example response in the Forms section of Meta's Template Library page",
    },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "delivery_failed_2_form",
          body: "We were unable to deliver order {{1}} today.\n\nPlease {{2}} to schedule another delivery attempt.",
          examples: ["#12345", "try a redelivery"],
          library: { name: "delivery_failed_2_form", customized: false },
        },
      },
    ],
  },
  {
    id: "meta-account_creation_confirmation_2",
    title: "Your account was set up",
    category: "UTILITY",
    tag: "account_creation_confirmation_2",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: "Library text is fixed; only the variables and the button inputs change. Meta's parameters screenshot marks all four variables as {{text}}.",
    meta: {
      libraryName: "account_creation_confirmation_2",
      industry: [],
      variablesMarked: true,
      paramTypes: ["TEXT", "TEXT", "TEXT", "TEXT"],
      evidence:
        "Screenshots of account_creation_confirmation_2 (sample values and parameters) on Meta's Template Library page",
    },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "account_creation_confirmation_2",
          headerType: "text",
          headerText: "Your account was set up",
          body: "Hi {{1}},\n\nWelcome to {{2}}! Your new account has been created. Please {{3}} to activate your account.\n\nThanks,\n{{4}}",
          examples: ["Jim", "CS Mutual", "verify your email address", "CS Mutual"],
          buttons: [verify("verify")],
          library: { name: "account_creation_confirmation_2", customized: false },
        },
      },
    ],
  },
  {
    id: "meta-delivery_confirmation_3",
    title: "Delivery complete",
    category: "UTILITY",
    tag: "ORDER_MANAGEMENT · delivery_confirmation_3",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: "Library text is fixed; only the variables and the button inputs change. In WhatsApp Manager you add your website URL to the button.",
    meta: {
      libraryName: "delivery_confirmation_3",
      topic: "ORDER_MANAGEMENT",
      industry: [],
      variablesMarked: true,
      evidence:
        "Screenshot of the delivery_confirmation_3 dialog (Utility › Order management) on Meta's Template Library page",
    },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "delivery_confirmation_3",
          headerType: "text",
          headerText: "Delivery complete",
          body: "Your package was delivered to {{1}} on {{2}}.\nThank you for your business.\n\n{{3}}",
          examples: ["1234 Baker street. Palo Alto, CA 94301", "Mar 14, 2024", "Jasper's Market"],
          buttons: [{ type: "url", text: "View order details", url: "https://weblabs.studio/orders", example: "" }],
          library: { name: "delivery_confirmation_3", customized: false },
        },
      },
    ],
  },
  {
    id: "meta-account_creation_confirmation_1",
    title: "Your new account was created",
    category: "UTILITY",
    tag: "account_creation_confirmation_1",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: UNMARKED,
    meta: { libraryName: "account_creation_confirmation_1", industry: [], variablesMarked: false, evidence: SHOT_GRID },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "account_creation_confirmation_1",
          headerType: "text",
          headerText: "Jim, your new account was created",
          body: "Congratulations, your CS Mutual checking account has been created. Confirm your email address to verify your account.\n\nCS Mutual",
          buttons: [verify("verify")],
          library: { name: "account_creation_confirmation_1", customized: true },
        },
      },
    ],
  },
  {
    id: "meta-account_creation_confirmation_3",
    title: "Account created! Verification needed",
    category: "UTILITY",
    tag: "account_creation_confirmation_3",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: UNMARKED,
    meta: { libraryName: "account_creation_confirmation_3", industry: [], variablesMarked: false, evidence: SHOT_GRID },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "account_creation_confirmation_3",
          headerType: "text",
          headerText: "Account created! Verification needed",
          body: "Hi Jim,\n\nYour new account has been created. Please verify your email address to complete your profile and start using our services.\n\nThanks,\nCS Mutual",
          buttons: [verify("verify")],
          library: { name: "account_creation_confirmation_3", customized: true },
        },
      },
    ],
  },
  {
    id: "meta-shot-scheduled_auto_payment",
    title: "Scheduled auto-payment",
    category: "UTILITY",
    tag: "screenshot · Scheduled auto-payment",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: `Meta's screenshot cuts off this card's library name. ${UNMARKED}`,
    meta: { libraryName: null, industry: [], variablesMarked: false, evidence: SHOT_GRID },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "scheduled_auto_payment",
          headerType: "text",
          headerText: "Scheduled auto-payment",
          body: "Hi Jim,\n\nYour automatic payment is scheduled on Mar 30, 2024 for $222.32 from CS Mutual Checking.\nEnsure your balance is sufficient to avoid late fees.\n\nRegards,\nCS Mutual",
          buttons: [{ type: "url", text: "View account", url: "https://weblabs.studio/account", example: "" }],
        },
      },
    ],
  },
  {
    id: "meta-shot-upcoming_automatic_payment",
    title: "Upcoming automatic payment",
    category: "UTILITY",
    tag: "screenshot · Upcoming automatic payment",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: `Meta's screenshot cuts off this card's library name. ${UNMARKED}`,
    meta: { libraryName: null, industry: [], variablesMarked: false, evidence: SHOT_GRID },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "upcoming_automatic_payment",
          headerType: "text",
          headerText: "Upcoming automatic payment",
          body: "Your auto-pay is coming up:\n- Date: Mar 30, 2024\n- Account: Market Credit Plus\n- Amount: $222.32\n\nThank you and have a nice day.\nCS Mutual",
          buttons: [{ type: "url", text: "View details", url: "https://weblabs.studio/account", example: "" }],
        },
      },
    ],
  },
  {
    id: "meta-shot-auto_pay_reminder",
    title: "Auto-pay reminder",
    category: "UTILITY",
    tag: "screenshot · Auto-pay reminder",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: `Meta's screenshot cuts off this card's library name. ${UNMARKED}`,
    meta: { libraryName: null, industry: [], variablesMarked: false, evidence: SHOT_GRID },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "auto_pay_reminder",
          headerType: "text",
          headerText: "Auto-pay reminder",
          body: "A reminder your auto-pay for CS Mutual Credit Plus card ending in 1234 for $222.32 is scheduled on Mar 22, 2024.\n\nCS Mutual",
        },
      },
    ],
  },
  {
    id: "meta-feedback_survey_3_form",
    title: "Customer feedback survey (form)",
    category: "UTILITY",
    tag: "feedback_survey_3_form",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: `${FORM_NOTE} ${UNMARKED}`,
    meta: {
      libraryName: "feedback_survey_3_form",
      industry: [],
      variablesMarked: false,
      flowButton: "Take survey",
      evidence: SHOT_FORMS,
    },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "feedback_survey_3_form",
          body: "At Jasper's Market, we value customer feedback and use it to continually improve our products.\n\nPlease fill out a short survey, linked below, to let us know more about your recent purchase with us.\n\nThank you in advance.",
          library: { name: "feedback_survey_3_form", customized: true },
        },
      },
    ],
  },
  {
    id: "meta-feedback_survey_form_1",
    title: "Rate your experience (form)",
    category: "UTILITY",
    tag: "feedback_survey_form_1",
    source: META_LIBRARY,
    sourceLabel: "Meta Template Library (screenshot in Meta's documentation)",
    note: `${FORM_NOTE} ${UNMARKED}`,
    meta: {
      libraryName: "feedback_survey_form_1",
      industry: [],
      variablesMarked: false,
      flowButton: "Take survey",
      evidence: SHOT_FORMS,
    },
    versions: [
      {
        code: "en_US",
        draft: {
          name: "feedback_survey_form_1",
          headerType: "text",
          headerText: "Rate your experience",
          body: "Your feedback is important to us.\n\nPlease take a quick survey about your recent flight booking experience.",
          library: { name: "feedback_survey_form_1", customized: true },
        },
      },
    ],
  },
  {
    id: "meta-auth-copy-code",
    title: "Verification code (copy code)",
    category: "AUTHENTICATION",
    tag: "AUTHENTICATION · COPY_CODE",
    source: META_AUTH,
    sourceLabel: "Meta authentication template (preset text)",
    note: `Meta writes the text of authentication templates in every language; you only choose the optional lines and the button. Meta also offers a one-tap autofill or zero-tap button (Android); the ${PRODUCT_NAME} builder makes the copy code button.`,
    meta: {
      libraryName: null,
      industry: [],
      variablesMarked: true,
      evidence: "Preset text on Meta's Authentication templates page",
    },
    versions: [
      {
        code: "en",
        draft: {
          name: "verification_code",
          body: AUTH_BODY,
          examples: ["123456"],
          authSecurity: true,
          authExpiry: null,
        },
      },
    ],
  },
  {
    id: "meta-auth-copy-code-expiry",
    title: "Verification code with expiry",
    category: "AUTHENTICATION",
    tag: "AUTHENTICATION · COPY_CODE",
    source: META_AUTH_PREVIEW,
    sourceLabel: "Meta authentication template (preset text)",
    note: `Adds Meta's optional lines: "${AUTH_SECURITY}" and "${authExpiryLine(10)}" (1 to 90 minutes). Meta prints this exact en_US text in its template previews example.`,
    meta: {
      libraryName: null,
      industry: [],
      variablesMarked: true,
      evidence: "Example response of the Message Template Previews API on Meta's Template previews page",
    },
    versions: [
      {
        code: "en",
        draft: {
          name: "verification_code_expiry",
          body: AUTH_BODY,
          examples: ["123456"],
          authSecurity: true,
          authExpiry: 10,
        },
      },
    ],
  },
];

const T278 = `${PRODUCT_NAME} automation library T-278 (settings/automation/_flow/template-data.ts)`;
const url = (text: string, path: string, example: string): TemplateButton => ({
  type: "url",
  text,
  url: `https://weblabs.studio/${path}/{{1}}`,
  example,
});
const quick = (...texts: string[]): TemplateButton[] => texts.map((text) => ({ type: "quick_reply", text }));

export const studioLibrary: LibraryEntry[] = [
  {
    id: "order_confirmation_message",
    title: "Order confirmation",
    category: "UTILITY",
    tag: "order_confirmation_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "order_confirmation",
          body: "Hi {{1}}, thank you for your order {{2}}. We will deliver it to {{3}} and send you the delivery time as soon as it is scheduled.",
          examples: ["Noura", "ORD-8824", "West Bay, Doha"],
          buttons: [url("Track order", "orders", "ORD-8824")],
        },
      },
      {
        code: "ar",
        draft: {
          name: "order_confirmation",
          body: "مرحباً {{1}}، شكراً لطلبك رقم {{2}}. سنوصله إلى {{3}} ونرسل لك موعد التوصيل فور تحديده.",
          examples: ["نورة", "ORD-8824", "الخليج الغربي، الدوحة"],
          buttons: [url("تتبع الطلب", "orders", "ORD-8824")],
        },
      },
    ],
  },
  {
    id: "cod_confirmation_message",
    title: "Cash on delivery confirmation",
    category: "UTILITY",
    tag: "cod_confirmation_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "cod_confirmation",
          body: "Hi {{1}}, your order {{2}} is ready. The amount to pay in cash on delivery is {{3}}. Please confirm the order, cancel it or change the address.",
          examples: ["Noura", "ORD-8824", "QAR 1,250"],
          buttons: quick("Confirm order", "Cancel order", "Change address"),
        },
      },
      {
        code: "ar",
        draft: {
          name: "cod_confirmation",
          body: "مرحباً {{1}}، طلبك رقم {{2}} جاهز. المبلغ المطلوب عند الاستلام {{3}}. يرجى تأكيد الطلب أو إلغاؤه أو تغيير العنوان.",
          examples: ["نورة", "ORD-8824", "1,250 ر.ق"],
          buttons: quick("تأكيد الطلب", "إلغاء الطلب", "تغيير العنوان"),
        },
      },
    ],
  },
  {
    id: "shipping_update_message",
    title: "Shipping update",
    category: "UTILITY",
    tag: "shipping_update_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "shipping_update",
          body: "Hi {{1}}, your order {{2}} has shipped and is on its way to you. Follow it with the button below.",
          examples: ["Noura", "ORD-8824"],
          buttons: [url("Track shipment", "track", "ORD-8824")],
        },
      },
      {
        code: "ar",
        draft: {
          name: "shipping_update",
          body: "مرحباً {{1}}، تم شحن طلبك رقم {{2}} وهو في الطريق إليك. تابعه من الزر أدناه.",
          examples: ["نورة", "ORD-8824"],
          buttons: [url("تتبع الشحنة", "track", "ORD-8824")],
        },
      },
    ],
  },
  {
    id: "appointment_reminder_message",
    title: "Appointment reminder",
    category: "UTILITY",
    tag: "appointment_reminder_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "appointment_reminder",
          body: "Hi {{1}}, this is a reminder of your appointment on {{2}} at {{3}}. Please confirm it or ask to reschedule.",
          examples: ["Noura", "Sunday, Oct 18", "10:30 AM"],
          buttons: quick("Confirm", "Reschedule"),
        },
      },
      {
        code: "ar",
        draft: {
          name: "appointment_reminder",
          body: "مرحباً {{1}}، نذكّرك بموعدك يوم {{2}} الساعة {{3}}. يرجى تأكيد الموعد أو طلب تأجيله.",
          examples: ["نورة", "الأحد 18 أكتوبر", "10:30 صباحاً"],
          buttons: quick("تأكيد الموعد", "تأجيل"),
        },
      },
    ],
  },
  {
    id: "payment_reminder_message",
    title: "Payment reminder",
    category: "UTILITY",
    tag: "payment_reminder_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "payment_reminder",
          body: "Hi {{1}}, invoice {{2}} for {{3}} is due on {{4}}. You can pay securely with the button below.",
          examples: ["Noura", "INV-4821", "QAR 1,250", "Oct 20, 2026"],
          buttons: [url("Pay now", "pay", "INV-4821")],
        },
      },
      {
        code: "ar",
        draft: {
          name: "payment_reminder",
          body: "مرحباً {{1}}، الفاتورة رقم {{2}} بمبلغ {{3}} مستحقة بتاريخ {{4}}. يمكنك الدفع بأمان من الزر أدناه.",
          examples: ["نورة", "INV-4821", "1,250 ر.ق", "20 أكتوبر 2026"],
          buttons: [url("ادفع الآن", "pay", "INV-4821")],
        },
      },
    ],
  },
  {
    id: "abandoned_cart_message",
    title: "Abandoned cart",
    category: "MARKETING",
    tag: "abandoned_cart_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "abandoned_cart",
          body: "Hi {{1}}, you left some items in your cart. Complete your order before they sell out.",
          examples: ["Noura"],
          buttons: [...quick("Stop promotions"), url("Complete order", "cart", "c-5521")],
        },
      },
      {
        code: "ar",
        draft: {
          name: "abandoned_cart",
          body: "مرحباً {{1}}، تركت بعض المنتجات في سلتك. أكمل طلبك قبل نفادها.",
          examples: ["نورة"],
          buttons: [...quick("إيقاف العروض"), url("إكمال الطلب", "cart", "c-5521")],
        },
      },
    ],
  },
  {
    id: "ramadan_greeting_message",
    title: "Ramadan greeting",
    category: "MARKETING",
    tag: "ramadan_greeting_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "ramadan_greeting",
          body: "Ramadan Kareem, {{1}}! Everyone at Weblabs Studio wishes you a blessed month, and our team is here for you throughout it.",
          examples: ["Noura"],
          buttons: quick("Stop promotions"),
        },
      },
      {
        code: "ar",
        draft: {
          name: "ramadan_greeting",
          body: "رمضان كريم يا {{1}}! يتمنى لك فريق Weblabs Studio شهراً مباركاً، ونحن في خدمتك طوال الشهر.",
          examples: ["نورة"],
          buttons: quick("إيقاف العروض"),
        },
      },
    ],
  },
  {
    id: "eid_greeting_message",
    title: "Eid greeting",
    category: "MARKETING",
    tag: "eid_greeting_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "eid_greeting",
          body: "Eid Mubarak, {{1}}! Our offices are closed for the Eid holiday and we will be back on {{2}}. Wishing you and your family a happy Eid.",
          examples: ["Noura", "Sunday, March 22"],
          buttons: quick("Stop promotions"),
        },
      },
      {
        code: "ar",
        draft: {
          name: "eid_greeting",
          body: "عيد مبارك يا {{1}}! مكاتبنا مغلقة لإجازة العيد ونعود يوم {{2}}. كل عام وأنتم بخير.",
          examples: ["نورة", "الأحد 22 مارس"],
          buttons: quick("إيقاف العروض"),
        },
      },
    ],
  },
  {
    id: "opt_in_confirmation_message",
    title: "Opt-in confirmation",
    category: "UTILITY",
    tag: "opt_in_confirmation_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "opt_in_confirmation",
          body: "Hi {{1}}, you are now subscribed to order and appointment updates from Weblabs Studio on WhatsApp. Reply STOP at any time to unsubscribe.",
          examples: ["Noura"],
        },
      },
      {
        code: "ar",
        draft: {
          name: "opt_in_confirmation",
          body: "مرحباً {{1}}، تم اشتراكك في تحديثات الطلبات والمواعيد من Weblabs Studio على واتساب. أرسل «إيقاف» في أي وقت لإلغاء الاشتراك.",
          examples: ["نورة"],
        },
      },
    ],
  },
  {
    id: "csat_survey_message",
    title: "Satisfaction survey",
    category: "UTILITY",
    tag: "csat_survey_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    versions: [
      {
        code: "en",
        draft: {
          name: "csat_survey",
          body: "Hi {{1}}, how would you rate the help you received from our team today?",
          examples: ["Noura"],
          buttons: quick("Very good", "Okay", "Not good"),
        },
      },
      {
        code: "ar",
        draft: {
          name: "csat_survey",
          body: "مرحباً {{1}}، كيف تقيّم المساعدة التي تلقيتها من فريقنا اليوم؟",
          examples: ["نورة"],
          buttons: quick("ممتاز", "مقبول", "سيئ"),
        },
      },
    ],
  },
  {
    id: "otp_code_message",
    title: "One-time code",
    category: "AUTHENTICATION",
    tag: "otp_code_message",
    source: T278,
    sourceLabel: `${PRODUCT_NAME} ready-made (T-278)`,
    note: "Authentication templates use Meta's preset text in each language (Meta writes the Arabic wording), so only the English preset is shown here.",
    versions: [
      {
        code: "en",
        draft: { name: "otp_code", body: AUTH_BODY, examples: ["482913"], authSecurity: true, authExpiry: 5 },
      },
    ],
  },
];
