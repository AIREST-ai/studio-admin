import type { BoardState, Channel, Column, TaskOwnerProfile } from "./types";

export const columns = [
  { id: "detected", title: "Dodge detected", hint: "A reply left the problem open" },
  { id: "in-progress", title: "In progress", hint: "Owner contacts the customer" },
  { id: "waiting", title: "Waiting on customer", hint: "Fix sent, customer to confirm" },
  { id: "solved", title: "Solved", hint: "Problem over" },
] as const satisfies readonly Column[];

export const columnIds = columns.map((column) => column.id);

export const channelTones: Record<Channel, string> = {
  WhatsApp: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Messenger: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Instagram: "bg-pink-500/10 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  TikTok: "bg-zinc-500/10 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-200",
};

const staff = {
  noura: {
    name: "Noura Khalid",
    tone: "[&_[data-slot=avatar-fallback]]:bg-violet-100 [&_[data-slot=avatar-fallback]]:text-violet-700 after:border-violet-200 dark:[&_[data-slot=avatar-fallback]]:bg-violet-500/15 dark:[&_[data-slot=avatar-fallback]]:text-violet-300 dark:after:border-violet-500/20",
  },
  faisal: {
    name: "Faisal Mansour",
    tone: "[&_[data-slot=avatar-fallback]]:bg-sky-100 [&_[data-slot=avatar-fallback]]:text-sky-700 after:border-sky-200 dark:[&_[data-slot=avatar-fallback]]:bg-sky-500/15 dark:[&_[data-slot=avatar-fallback]]:text-sky-300 dark:after:border-sky-500/20",
  },
  reem: {
    name: "Reem Ali",
    tone: "[&_[data-slot=avatar-fallback]]:bg-fuchsia-100 [&_[data-slot=avatar-fallback]]:text-fuchsia-700 after:border-fuchsia-200 dark:[&_[data-slot=avatar-fallback]]:bg-fuchsia-500/15 dark:[&_[data-slot=avatar-fallback]]:text-fuchsia-300 dark:after:border-fuchsia-500/20",
  },
  omar: {
    name: "Omar Saeed",
    tone: "[&_[data-slot=avatar-fallback]]:bg-lime-100 [&_[data-slot=avatar-fallback]]:text-lime-700 after:border-lime-200 dark:[&_[data-slot=avatar-fallback]]:bg-lime-500/15 dark:[&_[data-slot=avatar-fallback]]:text-lime-300 dark:after:border-lime-500/20",
  },
} satisfies Record<string, TaskOwnerProfile>;

// Sample cards only: fake customers and chats, no live data.
export const initialBoard: BoardState = {
  detected: [
    {
      id: "dodge-1048",
      customer: "Mariam Al-Kuwari",
      channel: "WhatsApp",
      problem: "Delivery 3 days late",
      dodge: "Please wait a bit, it's on the way.",
      betterReply: "Order #4821 is at our Doha hub and arrives tomorrow by 6 pm. Here is the tracking link.",
      dueDate: "Oct 11",
      owner: staff.noura,
      conversationHref: "#",
    },
    {
      id: "dodge-1047",
      customer: "Abdullah Al-Marri",
      channel: "Instagram",
      problem: "Wrong size delivered",
      dodge: "Sizes can vary a little between brands.",
      betterReply: "Sorry, we sent the wrong size. Our driver swaps it for size 42 tomorrow, free of charge.",
      dueDate: "Oct 12",
      owner: staff.faisal,
      conversationHref: "#",
    },
    {
      id: "dodge-1046",
      customer: "Fatima Hassan",
      channel: "TikTok",
      problem: "Payment failed",
      dodge: "Please try again later.",
      betterReply: "The 189 QAR is only on hold and your bank releases it within 3 days. Here is a new payment link.",
      dueDate: "Oct 11",
      owner: staff.reem,
      conversationHref: "#",
    },
    {
      id: "dodge-1045",
      customer: "Khalid Al-Sulaiti",
      channel: "Messenger",
      problem: "Refund not received",
      dodge: "Refunds take time, we already sent it.",
      betterReply: "Your 240 QAR refund left us on Oct 8, ref RF-1193. It reaches your bank within 5 working days.",
      dueDate: "Oct 12",
      owner: staff.omar,
      conversationHref: "#",
    },
  ],
  "in-progress": [
    {
      id: "dodge-1042",
      customer: "Aisha Rahman",
      channel: "WhatsApp",
      problem: "Item missing",
      dodge: "We'll look into it.",
      betterReply: "The scarf was left out of order #4790. We send it today with free delivery.",
      dueDate: "Oct 11",
      owner: staff.noura,
      conversationHref: "#",
    },
    {
      id: "dodge-1040",
      customer: "Yousef Al-Ansari",
      channel: "Instagram",
      problem: "Arrived damaged",
      dodge: "This sometimes happens with shipping.",
      betterReply: "Sorry it arrived broken. Send one photo and we replace it or refund you, your choice.",
      dueDate: "Oct 12",
      owner: staff.faisal,
      conversationHref: "#",
    },
    {
      id: "dodge-1039",
      customer: "Sara Al-Mannai",
      channel: "TikTok",
      problem: "Code not working",
      dodge: "Codes only work on some items.",
      betterReply: "Code EID15 expired yesterday. I applied the 15% to your cart by hand; it holds until tonight.",
      dueDate: "Oct 13",
      owner: staff.reem,
      conversationHref: "#",
    },
  ],
  waiting: [
    {
      id: "dodge-1036",
      customer: "Mohammed Saleh",
      channel: "WhatsApp",
      problem: "Wrong colour sent",
      dodge: "Colours look different on screens.",
      betterReply: "We sent grey, not navy. The navy one goes out today and our driver collects the grey.",
      dueDate: "Oct 12",
      owner: staff.omar,
      conversationHref: "#",
    },
    {
      id: "dodge-1034",
      customer: "Latifa Al-Dosari",
      channel: "Messenger",
      problem: "Order cancelled",
      dodge: "The system cancelled it automatically.",
      betterReply:
        "Our system cancelled it by mistake. I placed it again at the same price; please confirm your address.",
      dueDate: "Oct 13",
      owner: staff.noura,
      conversationHref: "#",
    },
    {
      id: "dodge-1033",
      customer: "Ahmed Nasser",
      channel: "Instagram",
      problem: "Pickup missed",
      dodge: "The courier is very busy these days.",
      betterReply:
        "The courier missed your pickup. It is booked again for tomorrow, 10 am to 12 pm. Reply OK to confirm.",
      dueDate: "Oct 12",
      owner: staff.faisal,
      conversationHref: "#",
    },
  ],
  solved: [
    {
      id: "dodge-1029",
      customer: "Noor Haddad",
      channel: "WhatsApp",
      problem: "Wrong address",
      dodge: "Please check the address you entered.",
      betterReply: "Your address was right; our driver made the mistake. Your order arrives today by 8 pm.",
      dueDate: "Oct 9",
      owner: staff.reem,
      conversationHref: "#",
    },
    {
      id: "dodge-1027",
      customer: "Bader Al-Mutairi",
      channel: "TikTok",
      problem: "Charged twice",
      dodge: "Please contact your bank.",
      betterReply: "You were charged twice by our error. The second 95 QAR is refunded, ref RF-1187.",
      dueDate: "Oct 8",
      owner: staff.omar,
      conversationHref: "#",
    },
    {
      id: "dodge-1025",
      customer: "Dana Al-Shammari",
      channel: "Messenger",
      problem: "Tracking link broken",
      dodge: "Restart the app and try again.",
      betterReply: "The tracking link had an error. Here is a working one: your parcel is with the driver now.",
      dueDate: "Oct 10",
      owner: staff.noura,
      conversationHref: "#",
    },
  ],
};
