export const AVAILABLE_CUSTOM_ROLE_PERMISSIONS = [
  "conversation_manage",
  "conversation_unassigned_manage",
  "conversation_participating_manage",
  "contact_manage",
  "report_manage",
  "knowledge_base_manage",
] as const;

export type Permission = (typeof AVAILABLE_CUSTOM_ROLE_PERMISSIONS)[number];

export const MANAGE_ALL_CONVERSATION_PERMISSIONS: Permission = "conversation_manage";
export const CONVERSATION_UNASSIGNED_PERMISSIONS: Permission = "conversation_unassigned_manage";
export const CONVERSATION_PARTICIPATING_PERMISSIONS: Permission = "conversation_participating_manage";

export const permissionLabels: Record<Permission, string> = {
  conversation_manage: "إدارة جميع المحادثات",
  conversation_unassigned_manage: "إدارة المحادثات غير المعيّنة والمُسندة للموظف",
  conversation_participating_manage: "إدارة المحادثات المشارك فيها والمُسندة للموظف",
  contact_manage: "إدارة جهات الاتصال",
  report_manage: "الاطلاع على التقارير وإدارتها",
  knowledge_base_manage: "إدارة بنك المعرفة ومركز المساعدة",
};

export const permissionShortLabels: Record<Permission, string> = {
  conversation_manage: "كل المحادثات",
  conversation_unassigned_manage: "غير المعيّنة",
  conversation_participating_manage: "المشارك فيها",
  contact_manage: "جهات الاتصال",
  report_manage: "التقارير",
  knowledge_base_manage: "بنك المعرفة",
};

export type RoleGroup = "System roles" | "Custom roles";

export type Role = {
  key: string;
  customRoleId: number | null;
  name: string;
  description: string;
  group: RoleGroup;
  accessLevel: "Full" | "Scoped";
  permissions: Permission[];
  lastReview: string;
  owner: string;
  status: RoleStatus;
};

export type RoleStatus = "Active" | "Needs review";

export function todayLabel() {
  return new Date().toLocaleDateString("ar-SA", { month: "short", day: "numeric", year: "numeric" });
}

export const systemRoles: Role[] = [
  {
    key: "administrator",
    customRoleId: null,
    name: "مدير النظام (المالك)",
    description: "وصول كامل إلى جميع الصناديق والمحادثات والتقارير وإعدادات الشركة والذكاء الاصطناعي.",
    group: "System roles",
    accessLevel: "Full",
    permissions: [...AVAILABLE_CUSTOM_ROLE_PERMISSIONS],
    lastReview: "١٢ أبريل ٢٠٢٥",
    owner: "النظام",
    status: "Active",
  },
  {
    key: "agent",
    customRoleId: null,
    name: "موظف خدمة عملاء",
    description: "يعرض ويرد على المحادثات في الصناديق المخصصة له فقط.",
    group: "System roles",
    accessLevel: "Scoped",
    permissions: ["conversation_unassigned_manage", "conversation_participating_manage", "contact_manage"],
    lastReview: "١ مايو ٢٠٢٥",
    owner: "النظام",
    status: "Active",
  },
];

export function customRole(
  id: number,
  name: string,
  description: string,
  permissions: Permission[],
  meta: Partial<Pick<Role, "lastReview" | "owner" | "status">> = {},
): Role {
  return {
    key: `custom_${id}`,
    customRoleId: id,
    name,
    description,
    group: "Custom roles",
    accessLevel: "Scoped",
    permissions,
    lastReview: meta.lastReview ?? todayLabel(),
    owner: meta.owner ?? "أرحم خان",
    status: meta.status ?? "Active",
  };
}

export const roles: Role[] = [
  ...systemRoles,
  customRole(
    1,
    "مشرف الدعم الفني",
    "يشرف على طابور الدعم ويعيد توجيه المحادثات ويراجع تقارير الفريق وتنبيهات التهرب.",
    [
      "conversation_manage",
      "conversation_unassigned_manage",
      "conversation_participating_manage",
      "contact_manage",
      "report_manage",
    ],
    { lastReview: "٢ سبتمبر ٢٠٢٦", owner: "أرحم خان", status: "Needs review" },
  ),
  customRole(
    2,
    "دعم المستوى الأول",
    "يستلم المحادثات الجديدة من الطابور غير المعيّن ويحيل الحالات المتقدمة.",
    ["conversation_unassigned_manage", "conversation_participating_manage"],
    { lastReview: "١٨ أغسطس ٢٠٢٦", owner: "بريا ناير", status: "Active" },
  ),
  customRole(
    3,
    "مسؤول مبيعات",
    "يتابع العملاء المحتملين القادمين من واتساب ومحادثة الموقع.",
    ["conversation_participating_manage", "contact_manage"],
    { lastReview: "٢٧ يوليو ٢٠٢٦", owner: "أرحم خان", status: "Needs review" },
  ),
  customRole(4, "محرر بنك المعرفة", "يكتب ويحدّث مقالات مركز المساعدة وملفات المعرفة.", ["knowledge_base_manage"], {
    lastReview: "٣٠ سبتمبر ٢٠٢٦",
    owner: "دانا بكر",
    status: "Active",
  }),
  customRole(5, "محلل تقارير وجودة", "يراجع تقارير رضا العملاء وأداء الموظفين الأسبوعية.", ["report_manage"], {
    lastReview: "٩ يونيو ٢٠٢٦",
    owner: "بريا ناير",
    status: "Needs review",
  }),
];

export function roleKeyOf(user: { role: "administrator" | "agent"; customRoleId: number | null }) {
  return user.customRoleId ? `custom_${user.customRoleId}` : user.role;
}
