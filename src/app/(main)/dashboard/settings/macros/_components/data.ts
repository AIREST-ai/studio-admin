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
  "Send Webhook Event",
];

// F159: creators are the agents of the Conversations area (cw-data.ts), teams and labels are the ones its sidebar
// shows. The two private macros belong to Arham Khan, the signed-in agent, so he can see and run them.
export const macros: Macro[] = [
  {
    id: 1,
    name: "Refund approved",
    createdBy: "Arham Khan",
    updatedBy: "Yousef Al-Harbi",
    visibility: "Public",
    actions: [
      { action: "Add a Label", value: "billing" },
      {
        action: "Send a Message",
        value: "Your refund has been approved. It will reach your card in 5 to 7 working days.",
      },
      { action: "Resolve Conversation", value: "" },
    ],
  },
  {
    id: 2,
    name: "Escalate to Technical",
    createdBy: "Lina Haddad",
    updatedBy: "Arham Khan",
    visibility: "Public",
    actions: [
      { action: "Assign a Team", value: "Technical" },
      { action: "Add a Private Note", value: "Customer needs an engineer on a call. Please call within 2 hours." },
      { action: "Change Priority", value: "High" },
    ],
  },
  {
    id: 3,
    name: "Late delivery apology",
    createdBy: "Priya Nair",
    updatedBy: "Yousef Al-Harbi",
    visibility: "Public",
    actions: [
      { action: "Add a Label", value: "support" },
      {
        action: "Send a Message",
        value: "We are sorry for the delay. Your order is now with the driver and arrives today.",
      },
    ],
  },
  {
    id: 4,
    name: "Send transcript and close",
    createdBy: "Arham Khan",
    updatedBy: "Arham Khan",
    visibility: "Private",
    actions: [
      { action: "Send an Email Transcript", value: "Customer email" },
      { action: "Resolve Conversation", value: "" },
    ],
  },
  {
    id: 5,
    name: "Snooze until Sunday",
    createdBy: "Arham Khan",
    updatedBy: "Arham Khan",
    visibility: "Private",
    actions: [{ action: "Snooze Conversation", value: "Next week" }],
  },
  {
    id: 6,
    name: "Hand over to Sales",
    createdBy: "Priya Nair",
    updatedBy: "Arham Khan",
    visibility: "Public",
    actions: [
      { action: "Remove Assigned Agent", value: "" },
      { action: "Assign a Team", value: "Sales" },
      { action: "Add a Label", value: "lead" },
    ],
  },
];
