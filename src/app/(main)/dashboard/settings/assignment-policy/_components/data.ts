export interface AssignmentPolicy {
  id: number;
  name: string;
  description: string;
  active: boolean;
  order: "round_robin" | "balanced";
  priority: "earliest_created" | "longest_waiting";
  maxPerAgent: number;
  window: number;
  staleDays: number;
  inboxes: number[];
}

export interface CapacityPolicy {
  id: number;
  name: string;
  description: string;
  limits: { inbox: number; max: number }[];
  labels: string[];
  excludeOlderThan: number;
  agents: number[];
}

export const orderLabel = { round_robin: "Round robin", balanced: "Balanced" } as const;
export const priorityLabel = { earliest_created: "Earliest created", longest_waiting: "Longest waiting" } as const;

export const assignmentPolicies: AssignmentPolicy[] = [
  {
    id: 1,
    name: "Front desk",
    description: "Even split of website chat across the whole support team.",
    active: true,
    order: "round_robin",
    priority: "earliest_created",
    maxPerAgent: 100,
    window: 60,
    staleDays: 7,
    // F161: only Website Chat — Support Email and Phone have auto assignment off, so they cannot sit in a policy.
    inboxes: [2],
  },
  {
    id: 2,
    name: "Billing queue",
    description: "WhatsApp billing and invoice questions, longest waiting first.",
    active: true,
    order: "balanced",
    priority: "longest_waiting",
    maxPerAgent: 40,
    window: 60,
    staleDays: 14,
    inboxes: [3],
  },
  {
    id: 3,
    name: "Social channels",
    description: "Instagram and Facebook messages, paused while the social team is hiring.",
    active: false,
    order: "round_robin",
    priority: "longest_waiting",
    maxPerAgent: 60,
    window: 120,
    staleDays: 7,
    inboxes: [4, 5],
  },
];

export const capacityPolicies: CapacityPolicy[] = [
  {
    id: 1,
    name: "Full-time agents",
    description: "Standard workload for full-time support agents.",
    limits: [
      { inbox: 1, max: 8 },
      { inbox: 2, max: 10 },
      { inbox: 3, max: 6 },
    ],
    labels: ["vip", "partner"],
    excludeOlderThan: 48,
    agents: [1, 2, 3],
  },
  {
    id: 2,
    name: "Part-time & weekend",
    description: "Lower caps for the weekend shift and part-time agents.",
    limits: [
      { inbox: 1, max: 4 },
      { inbox: 5, max: 5 },
    ],
    labels: ["lead"],
    excludeOlderThan: 24,
    agents: [4],
  },
];

// Labels of the account, the same five as Contacts and Conversations (studio-ui.tsx labelTones).
export const accountLabels = ["vip", "billing", "lead", "partner", "support"];
