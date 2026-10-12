// Mock data imports, shaped like Chatwoot's data_imports API (status, source_provider, import_types, stats, cursor).
export type ImportStatus = "pending" | "processing" | "completed" | "completed_with_errors" | "failed" | "abandoned";
export type ImportStage =
  | "queued"
  | "contacts"
  | "conversations"
  | "finalizing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "abandoned";
export type ImportSource = "intercom" | "freshdesk" | "file";

export interface ImportError {
  code: string;
  sourceObject: string;
  message: string;
}

export interface SkipLog {
  kind: "skipped" | "failed";
  sourceObject: string;
  reason: string;
}

export interface DataImport {
  id: number;
  name: string;
  source: ImportSource;
  types: ("contacts" | "conversations")[];
  status: ImportStatus;
  stage: ImportStage;
  imported: number;
  total: number;
  created: string;
  duration: string;
  startedBy: string;
  errors: ImportError[];
  skipLogs: SkipLog[];
}

export const sourceLabel: Record<ImportSource, string> = {
  intercom: "Intercom",
  freshdesk: "Freshdesk",
  file: "File import",
};

export const stageLabel: Record<ImportStage, string> = {
  queued: "Queued",
  contacts: "Importing contacts",
  conversations: "Importing conversations",
  finalizing: "Finalizing import",
  completed: "Completed",
  completed_with_errors: "Completed with errors",
  failed: "Failed",
  abandoned: "Abandoned",
};

export const statusMeta: Record<ImportStatus, { dot: string; badge: string }> = {
  pending: {
    dot: "bg-amber-500 animate-pulse",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  processing: {
    dot: "bg-sky-500 animate-pulse",
    badge: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  completed: {
    dot: "bg-emerald-500",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  completed_with_errors: {
    dot: "bg-amber-500",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  failed: { dot: "bg-destructive", badge: "border-destructive/20 bg-destructive/10 text-destructive" },
  abandoned: { dot: "bg-muted-foreground", badge: "border-border bg-muted/50 text-muted-foreground" },
};

export const typeLabel = { contacts: "Contacts", conversations: "Conversations" } as const;

export const dataImports: DataImport[] = [
  {
    id: 1,
    name: "October support migration",
    source: "intercom",
    types: ["contacts", "conversations"],
    status: "processing",
    stage: "conversations",
    imported: 6240,
    total: 9800,
    created: "Oct 12, 2026, 9:05 AM",
    duration: "1h 12m",
    startedBy: "Arham Khan",
    errors: [],
    skipLogs: [
      { kind: "skipped", sourceObject: "contact: 6512998", reason: "Contact has no email or phone number" },
    ],
  },
  {
    id: 2,
    name: "Dubai branch helpdesk",
    source: "freshdesk",
    types: ["contacts", "conversations"],
    status: "completed_with_errors",
    stage: "completed_with_errors",
    imported: 4112,
    total: 4180,
    created: "Oct 4, 2026, 2:40 PM",
    duration: "48m",
    startedBy: "Khalid Al-Mansoori",
    errors: [
      {
        code: "attachment_too_large",
        sourceObject: "ticket: 88213",
        message: "Attachment exceeds the 40 MB limit and was not imported",
      },
      { code: "invalid_email", sourceObject: "contact: 50021", message: "Email address 'ahmed@@mail' is not valid" },
      {
        code: "rate_limited",
        sourceObject: "ticket: 88540",
        message: "Freshdesk API rate limit reached; record retried 3 times",
      },
    ],
    skipLogs: [
      { kind: "skipped", sourceObject: "contact: 50112", reason: "Duplicate of an existing contact (same email)" },
      { kind: "skipped", sourceObject: "ticket: 87001", reason: "Ticket has no messages" },
      { kind: "failed", sourceObject: "ticket: 88213", reason: "Attachment exceeds the 40 MB limit" },
    ],
  },
  {
    id: 3,
    name: "Riyadh customer list",
    source: "intercom",
    types: ["contacts"],
    status: "completed",
    stage: "completed",
    imported: 2875,
    total: 2875,
    created: "Sep 22, 2026, 11:18 AM",
    duration: "9m",
    startedBy: "Reem Al-Otaibi",
    errors: [],
    skipLogs: [],
  },
  {
    id: 4,
    name: "",
    source: "intercom",
    types: ["conversations"],
    status: "failed",
    stage: "failed",
    imported: 310,
    total: 5200,
    created: "Sep 15, 2026, 4:02 PM",
    duration: "6m",
    startedBy: "Arham Khan",
    errors: [{ code: "unauthorized", sourceObject: "-", message: "Intercom access key was revoked during the import" }],
    skipLogs: [],
  },
  {
    id: 5,
    name: "Old helpdesk tickets",
    source: "freshdesk",
    types: ["contacts", "conversations"],
    status: "abandoned",
    stage: "abandoned",
    imported: 0,
    total: 1450,
    created: "Aug 30, 2026, 10:30 AM",
    duration: "2m",
    startedBy: "Lina Haddad",
    errors: [],
    skipLogs: [],
  },
  {
    id: 6,
    name: "Contacts CSV — summer campaign",
    source: "file",
    types: ["contacts"],
    status: "completed",
    stage: "completed",
    imported: 1204,
    total: 1204,
    created: "Aug 12, 2026, 1:15 PM",
    duration: "1m",
    startedBy: "Lina Haddad",
    errors: [],
    skipLogs: [],
  },
];

export const isActive = (i: DataImport) => i.status === "pending" || i.status === "processing";
