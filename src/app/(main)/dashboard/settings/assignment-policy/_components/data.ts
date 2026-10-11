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
    name: "Qatar front desk",
    description: "Even split across the Doha patient support agents during clinic hours.",
    active: true,
    order: "round_robin",
    priority: "earliest_created",
    maxPerAgent: 100,
    window: 60,
    staleDays: 7,
    inboxes: [1, 2, 6],
  },
  {
    id: 2,
    name: "Billing queue",
    description: "Longest-waiting insurance and invoice questions first.",
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
    name: "Gulf branches",
    description: "Dubai and Riyadh WhatsApp and Telegram inboxes.",
    active: false,
    order: "round_robin",
    priority: "longest_waiting",
    maxPerAgent: 60,
    window: 120,
    staleDays: 7,
    inboxes: [4, 7],
  },
];

export const capacityPolicies: CapacityPolicy[] = [
  {
    id: 1,
    name: "Full-time agents",
    description: "Standard workload for full-time patient support staff.",
    limits: [
      { inbox: 1, max: 8 },
      { inbox: 2, max: 10 },
      { inbox: 3, max: 6 },
    ],
    labels: ["vip", "follow-up"],
    excludeOlderThan: 48,
    agents: [1, 2, 3, 5],
  },
  {
    id: 2,
    name: "Part-time & weekend",
    description: "Lower caps for Saturday shift and part-time agents.",
    limits: [
      { inbox: 1, max: 4 },
      { inbox: 5, max: 5 },
    ],
    labels: ["spam"],
    excludeOlderThan: 24,
    agents: [7, 8],
  },
];
