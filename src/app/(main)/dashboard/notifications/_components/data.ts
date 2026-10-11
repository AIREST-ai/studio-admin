export type NotificationType =
  | "conversation_mention"
  | "conversation_assignment"
  | "conversation_creation"
  | "assigned_conversation_new_message"
  | "participating_conversation_new_message"
  | "sla_missed_first_response"
  | "sla_missed_resolution";

export type Priority = "urgent" | "high" | "medium" | "low" | null;

export interface Message {
  from: "contact" | "agent" | "note";
  author: string;
  body: string;
  time: string;
}

export interface InboxNotification {
  id: number;
  conversationId: number;
  type: NotificationType;
  actor: string;
  contact: string;
  pushMessage: string;
  inbox: "WhatsApp" | "Website" | "Email" | "Instagram";
  priority: Priority;
  minutesAgo: number;
  time: string;
  unread: boolean;
  snoozedFor?: string;
  snoozeEnded?: boolean;
  labels: string[];
  messages: Message[];
}

export const typeLabels: Record<NotificationType, string> = {
  conversation_mention: "Mentioned",
  conversation_assignment: "Assigned to you",
  conversation_creation: "New Conversation",
  assigned_conversation_new_message: "New message",
  participating_conversation_new_message: "New message",
  sla_missed_first_response: "SLA breach",
  sla_missed_resolution: "SLA breach",
};

export const priorityRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export const notifications: InboxNotification[] = [
  {
    id: 1,
    conversationId: 4821,
    type: "conversation_mention",
    actor: "Lina Haddad",
    contact: "Noura Al-Thani",
    pushMessage: "Lina Haddad: @Fahad can you approve the free delivery for Noura? She is a repeat customer.",
    inbox: "WhatsApp",
    priority: "high",
    minutesAgo: 4,
    time: "4m",
    unread: true,
    labels: ["delivery", "vip"],
    messages: [
      {
        from: "contact",
        author: "Noura Al-Thani",
        body: "Is the Thursday delivery slot still available for Al Waab?",
        time: "10:12 AM",
      },
      {
        from: "agent",
        author: "Lina Haddad",
        body: "Let me check with the warehouse and come back to you in a few minutes.",
        time: "10:14 AM",
      },
      {
        from: "note",
        author: "Lina Haddad",
        body: "@Fahad can you approve the free delivery for Noura? She is a repeat customer.",
        time: "10:15 AM",
      },
    ],
  },
  {
    id: 2,
    conversationId: 4830,
    type: "conversation_assignment",
    actor: "Ahmed Saleh",
    contact: "Khalid Al-Mansoori",
    pushMessage: "Khalid Al-Mansoori: I need a copy of last month's invoice with the VAT number.",
    inbox: "Website",
    priority: "medium",
    minutesAgo: 18,
    time: "18m",
    unread: true,
    labels: ["billing"],
    messages: [
      {
        from: "contact",
        author: "Khalid Al-Mansoori",
        body: "Hello, I need a copy of last month's invoice with the VAT number.",
        time: "9:58 AM",
      },
      {
        from: "note",
        author: "Ahmed Saleh",
        body: "Assigning to Fahad, he has access to the finance portal.",
        time: "10:01 AM",
      },
    ],
  },
  {
    id: 3,
    conversationId: 4836,
    type: "sla_missed_first_response",
    actor: "",
    contact: "Omar Al-Harbi",
    pushMessage: "Omar Al-Harbi: My order from Riyadh still shows processing after 5 days.",
    inbox: "WhatsApp",
    priority: "urgent",
    minutesAgo: 42,
    time: "42m",
    unread: true,
    labels: ["complaint"],
    messages: [
      {
        from: "contact",
        author: "Omar Al-Harbi",
        body: "My order from Riyadh still shows processing after 5 days. Order number NH-20931.",
        time: "9:31 AM",
      },
    ],
  },
  {
    id: 4,
    conversationId: 4812,
    type: "assigned_conversation_new_message",
    actor: "",
    contact: "Fatima Al-Kuwari",
    pushMessage: "Fatima Al-Kuwari: Thank you! Can I also change the pickup to Lusail Marina?",
    inbox: "Instagram",
    priority: null,
    minutesAgo: 75,
    time: "1h",
    unread: false,
    labels: [],
    messages: [
      { from: "agent", author: "Fahad", body: "Your booking is confirmed for Saturday at 5 PM.", time: "8:40 AM" },
      {
        from: "contact",
        author: "Fatima Al-Kuwari",
        body: "Thank you! Can I also change the pickup to Lusail Marina?",
        time: "8:52 AM",
      },
    ],
  },
  {
    id: 5,
    conversationId: 4799,
    type: "conversation_creation",
    actor: "",
    contact: "Hessa Al-Naimi",
    pushMessage: "Hessa Al-Naimi: Do you have English classes for a 5 year old on weekends?",
    inbox: "Website",
    priority: "low",
    minutesAgo: 160,
    time: "3h",
    unread: false,
    snoozedFor: "tomorrow",
    labels: ["lead"],
    messages: [
      {
        from: "contact",
        author: "Hessa Al-Naimi",
        body: "Do you have English classes for a 5 year old on weekends?",
        time: "7:20 AM",
      },
    ],
  },
  {
    id: 6,
    conversationId: 4774,
    type: "participating_conversation_new_message",
    actor: "",
    contact: "Rashid Al-Shamsi",
    pushMessage: "Rashid Al-Shamsi: The container cleared customs at Jebel Ali this morning.",
    inbox: "Email",
    priority: null,
    minutesAgo: 300,
    time: "5h",
    unread: false,
    labels: ["shipping"],
    messages: [
      {
        from: "contact",
        author: "Rashid Al-Shamsi",
        body: "The container cleared customs at Jebel Ali this morning. ETA Hamad Port is Sunday.",
        time: "5:10 AM",
      },
    ],
  },
  {
    id: 7,
    conversationId: 4760,
    type: "sla_missed_resolution",
    actor: "",
    contact: "Mariam Al-Sulaiti",
    pushMessage: "Mariam Al-Sulaiti: Still waiting for the refund on my cancelled booking.",
    inbox: "WhatsApp",
    priority: "high",
    minutesAgo: 1440,
    time: "1d",
    unread: false,
    snoozeEnded: true,
    labels: ["refund"],
    messages: [
      {
        from: "contact",
        author: "Mariam Al-Sulaiti",
        body: "Still waiting for the refund on my cancelled booking.",
        time: "Yesterday",
      },
      {
        from: "agent",
        author: "Fahad",
        body: "Sorry for the delay, finance is processing it today.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 8,
    conversationId: 4741,
    type: "conversation_mention",
    actor: "Ahmed Saleh",
    contact: "Abdullah Al-Qahtani",
    pushMessage: "Ahmed Saleh: @Fahad this customer asked for the Arabic contract version.",
    inbox: "Email",
    priority: null,
    minutesAgo: 2880,
    time: "2d",
    unread: false,
    labels: [],
    messages: [
      {
        from: "contact",
        author: "Abdullah Al-Qahtani",
        body: "Could you send the contract in Arabic please?",
        time: "Mon",
      },
      {
        from: "note",
        author: "Ahmed Saleh",
        body: "@Fahad this customer asked for the Arabic contract version.",
        time: "Mon",
      },
    ],
  },
  {
    id: 9,
    conversationId: 4702,
    type: "conversation_assignment",
    actor: "Lina Haddad",
    contact: "Yousef Al-Marri",
    pushMessage: "Yousef Al-Marri: Is the gym open during Eid?",
    inbox: "Instagram",
    priority: null,
    minutesAgo: 7200,
    time: "5d",
    unread: false,
    labels: [],
    messages: [{ from: "contact", author: "Yousef Al-Marri", body: "Is the gym open during Eid?", time: "Wed" }],
  },
];

export const snoozeOptions = ["Until an hour from now", "Until tomorrow", "Until next week", "Until next month"];
