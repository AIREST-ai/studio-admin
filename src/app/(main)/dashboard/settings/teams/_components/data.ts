export interface Team {
  id: number;
  name: string;
  description: string;
  icon: string;
  members: number[];
  autoAssign: boolean;
}

export const teams: Team[] = [
  {
    id: 1,
    name: "Patient Support",
    description: "First line for appointment questions, directions and general enquiries across Doha clinics.",
    icon: "🩺",
    members: [1, 2, 3, 5],
    autoAssign: true,
  },
  {
    id: 2,
    name: "Billing & Insurance",
    description: "Handles invoices, QLM and Bupa approvals, and refund requests.",
    icon: "💳",
    members: [2, 6],
    autoAssign: true,
  },
  {
    id: 3,
    name: "UAE Branch",
    description: "Dubai and Abu Dhabi patients, Arabic and English.",
    icon: "🏙️",
    members: [4],
    autoAssign: false,
  },
  {
    id: 4,
    name: "KSA Branch",
    description: "Riyadh clinic bookings and follow-ups.",
    icon: "🌴",
    members: [7, 8],
    autoAssign: true,
  },
  {
    id: 5,
    name: "Social Media",
    description: "Instagram and TikTok messages, reviews and campaign replies.",
    icon: "📣",
    members: [5, 8],
    autoAssign: false,
  },
];
