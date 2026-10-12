"use client";

import { useEffect, useSyncExternalStore } from "react";

import { siGoogledocs } from "simple-icons";

import { contacts as directory } from "@/app/(main)/dashboard/contacts/_components/data";
import type { Mail } from "@/app/(main)/mail/_components/data";
import { useMail } from "@/app/(main)/mail/_components/use-mail";

import { conversations } from "./data";

// F147 (Fahad: «سبام او غيرها … من القياسي»): mail boxes per RFC 6154 special-use mailboxes (+ RFC 8457 \Important):
// Inbox, Priority (\Important), Drafts, Sent, Archive, Trash, Spam (\Junk), Starred (\Flagged), All mail (\All).
// Local state only: moves (Report spam / Not spam) and stars reset on page reload.

export type MailBox = "inbox" | "priority" | "drafts" | "sent" | "archive" | "trash" | "spam" | "starred" | "all";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
// F159: the Support Email inbox of the helpdesk (same address as the "Support Email" channel).
const me = { name: "Weblabs Support", email: "support@weblabs.studio" };

function sample(
  id: string,
  folder: Mail["folder"],
  from: Mail["from"],
  subject: string,
  body: string,
  minutes: number,
): Mail {
  const isSpam = folder === "spam";
  return {
    id: `f147-${id}`,
    accountId: 1,
    from,
    to: [me],
    subject,
    body,
    receivedAt: ago(minutes),
    folder,
    isRead: !isSpam,
    isPinned: false,
    isPriority: false,
    labels: [],
  };
}

// F159: the inbox holds the email conversations of the chat data (same people as the Contacts page), instead of
// the generic template mails.
// The mail is dated like a mail thread: its last activity, the same age the conversation row shows on
// /dashboard/chat (data.ts `ago`). Yesterday's conversations become a day and a bit ago, keeping the list order.
function minutesOf(item: (typeof conversations)[number], index: number): number {
  if (item.ago === undefined) return 60 * 24 + index * 10;
  // F159: the mail list prints date-fns formatDistanceToNow, which rounds to the nearest hour, while the
  // conversation rows round down ("2h" for 2h50m). Snap to the whole hour the rows show; the left-over minutes stay
  // as seconds so the mails keep their order.
  if (item.ago < 60) return item.ago;
  return Math.floor(item.ago / 60) * 60 + (item.ago % 60) / 100;
}

const fromConversations: Mail[] = conversations
  .filter((item) => item.channel === "email")
  .map((item, index): Mail => {
    // The email itself is what the customer wrote before the first agent reply (later chat replies are not in it).
    const firstReply = item.messages.findIndex((message) => message.align === "end");
    const incoming = (firstReply >= 0 ? item.messages.slice(0, firstReply) : item.messages)
      .filter((message) => message.align === "start")
      .map((message) => message.text);
    return {
      id: `cw-${item.id}`,
      accountId: 1,
      from: { name: item.contact.name, email: item.contact.email },
      to: [me],
      subject: item.subject,
      body: `Hello,\n\n${incoming.join("\n\n")}\n\nBest regards,\n${item.contact.name}\n${item.contact.role}, ${item.contact.company}`,
      receivedAt: ago(minutesOf(item, index)),
      folder: "inbox",
      isRead: !item.isUnread,
      isPinned: index < 2,
      isPriority: index % 3 === 0,
      labels: [],
      messageCount: Math.max(1, item.messages.length),
      attachments:
        index === 0
          ? [{ id: `cw-${item.id}-pdf`, name: "bank-statement-oct.pdf", size: "212 KB", icon: siGoogledocs }]
          : undefined,
    };
  });

const person = (name: string) => {
  const entry = directory.find((item) => item.name === name);
  return { name, email: entry?.email ?? "" };
};

// Extra sample mails so every box has something to show.
const extraMails: Mail[] = [
  sample(
    "spam-1",
    "spam",
    { name: "Lottery Center", email: "winner@prize-claim.biz" },
    "You have WON $1,000,000!!!",
    "Congratulations! Send your bank details today to claim your prize.\n\n(sample spam)",
    35,
  ),
  sample(
    "spam-2",
    "spam",
    { name: "Security Team", email: "alert@secure-verify-login.co" },
    "Your account will be suspended – verify now",
    "We noticed unusual activity. Click the link and enter your password within 24 hours.\n\n(sample spam)",
    190,
  ),
  sample(
    "spam-3",
    "spam",
    { name: "Best Deals", email: "offers@deals4u.shop" },
    "Luxury watches 90% OFF – today only",
    "Limited stock! Buy now, pay later. Unsubscribe never.\n\n(sample spam)",
    1500,
  ),
  sample(
    "spam-4",
    "spam",
    { name: "Bank Support", email: "support@bank-update.info" },
    "Urgent: confirm your card number",
    "Reply with your card number and PIN to keep your account open.\n\n(sample spam)",
    2900,
  ),
  sample(
    "draft-1",
    "drafts",
    me,
    "Re: Annual billing quote (draft)",
    "Hi Khalid, thanks for confirming the seat count. The annual quote with the discount is",
    50,
  ),
  sample(
    "sent-1",
    "sent",
    me,
    "Invoice INV-4821 receipt",
    "Hi Reem, please find the receipt for invoice INV-4821 attached. Thank you!",
    300,
  ),
  sample(
    "archive-1",
    "archive",
    person("Noura Al-Thani"),
    "Welcome to Weblabs Studio",
    "Thanks for the onboarding call. Our workspace is ready and the team has joined.",
    7000,
  ),
  sample(
    "trash-1",
    "trash",
    { name: "Weekly Digest", email: "digest@newsletter.io" },
    "This week's top stories",
    "Ten links you might have missed this week.",
    9000,
  ),
];

// Newest first, like a mail client. Every incoming mail is an email conversation (as in Chatwoot), so the Inbox holds
// the same mails as the Support Email conversations and the Support Email channel count.
const inbox = [...fromConversations].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

export const allMails: Mail[] = [...inbox, ...extraMails];

type MailBoxState = {
  box: MailBox;
  moved: Record<string, Mail["folder"]>;
  starred: Record<string, boolean>;
  drawer: boolean;
};

let state: MailBoxState = {
  box: "inbox",
  drawer: false,
  moved: {},
  starred: Object.fromEntries([allMails[0]?.id, allMails[2]?.id].filter(Boolean).map((id) => [id, true])),
};

const listeners = new Set<() => void>();
function emit(next: MailBoxState) {
  state = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => state;

export function useMailBox(): MailBoxState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setMailBox(box: MailBox): void {
  emit({ ...state, box });
}

// The side drawer with all boxes, opened and closed by clicking the box title.
export function toggleBoxDrawer(): void {
  emit({ ...state, drawer: !state.drawer });
}

export function toggleStar(id: string): void {
  emit({ ...state, starred: { ...state.starred, [id]: !state.starred[id] } });
}

// Report spam -> "spam"; Not spam -> "inbox".
export function moveMail(id: string, folder: Mail["folder"]): void {
  emit({ ...state, moved: { ...state.moved, [id]: folder } });
}

export function folderOf(mail: Mail, s: MailBoxState = state): Mail["folder"] {
  return s.moved[mail.id] ?? mail.folder;
}

export function mailsIn(box: MailBox, s: MailBoxState): Mail[] {
  return allMails.filter((mail) => {
    const folder = folderOf(mail, s);
    const live = folder !== "spam" && folder !== "trash";
    if (box === "all") return live;
    if (box === "starred") return live && Boolean(s.starred[mail.id]);
    if (box === "priority") return live && mail.isPriority;
    return folder === box;
  });
}

// The mails of the open box. A message that leaves it (Report spam / Not spam) hands the view to the next one.
// F159: `keep` narrows the box further (the Mine / Unassigned / All tab on the Support Email page).
export function useBoxMails(keep?: (mail: Mail) => boolean): Mail[] {
  const s = useMailBox();
  const box = mailsIn(s.box, s);
  const list = keep ? box.filter(keep) : box;
  const [mail, setMail] = useMail();

  useEffect(() => {
    if (mail.selected !== null && !list.some((item) => item.id === mail.selected)) {
      setMail({ selected: list[0]?.id ?? null });
    }
  }, [list, mail.selected, setMail]);

  return list;
}
