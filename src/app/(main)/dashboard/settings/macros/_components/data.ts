export interface MacroAction {
  action: string;
  value: string;
}

export interface Macro {
  id: number;
  name: string;
  createdBy: string;
  updatedBy: string;
  visibility: "Public" | "Private";
  actions: MacroAction[];
}

export const macroActionTypes = [
  "Assign a Team",
  "Assign an Agent",
  "Add a Label",
  "Remove a Label",
  "Remove Assigned Agent",
  "Remove Assigned Team",
  "Send an Email Transcript",
  "Mute Conversation",
  "Snooze Conversation",
  "Resolve Conversation",
  "Send Attachment",
  "Send a Message",
  "Add a Private Note",
  "Change Priority",
];

export const macros: Macro[] = [
  {
    id: 1,
    name: "Refund approved",
    createdBy: "Noura Al-Thani",
    updatedBy: "Noura Al-Thani",
    visibility: "Public",
    actions: [
      { action: "Add a Label", value: "billing" },
      { action: "Send a Message", value: "Your refund has been approved. It will reach your card in 5 to 7 working days." },
      { action: "Resolve Conversation", value: "" },
    ],
  },
  {
    id: 2,
    name: "Escalate to Riyadh showroom",
    createdBy: "Faisal Al-Otaibi",
    updatedBy: "Mariam Al-Kuwari",
    visibility: "Public",
    actions: [
      { action: "Assign a Team", value: "Riyadh Showroom" },
      { action: "Add a Private Note", value: "Customer wants an in-store visit. Please call within 2 hours." },
      { action: "Change Priority", value: "High" },
    ],
  },
  {
    id: 3,
    name: "Late delivery apology",
    createdBy: "Mariam Al-Kuwari",
    updatedBy: "Ahmed Al-Mansoori",
    visibility: "Public",
    actions: [
      { action: "Add a Label", value: "delivery-delay" },
      { action: "Send a Message", value: "We are sorry for the delay. Your order is now with the driver and arrives today." },
    ],
  },
  {
    id: 4,
    name: "Send transcript and close",
    createdBy: "Ahmed Al-Mansoori",
    updatedBy: "Ahmed Al-Mansoori",
    visibility: "Private",
    actions: [
      { action: "Send an Email Transcript", value: "Customer email" },
      { action: "Resolve Conversation", value: "" },
    ],
  },
  {
    id: 5,
    name: "Snooze until Sunday",
    createdBy: "Hessa Al-Marri",
    updatedBy: "Hessa Al-Marri",
    visibility: "Private",
    actions: [{ action: "Snooze Conversation", value: "Next week" }],
  },
  {
    id: 6,
    name: "Hand over to Dubai sales",
    createdBy: "Omar Al-Suwaidi",
    updatedBy: "Noura Al-Thani",
    visibility: "Public",
    actions: [
      { action: "Remove Assigned Agent", value: "" },
      { action: "Assign a Team", value: "Dubai Sales" },
      { action: "Add a Label", value: "lead-uae" },
    ],
  },
];
