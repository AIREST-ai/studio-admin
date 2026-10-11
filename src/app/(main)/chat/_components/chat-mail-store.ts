"use client";

import { useEffect, useSyncExternalStore } from "react";

import { type Mail, mails } from "@/app/(main)/mail/_components/data";
import { useMail } from "@/app/(main)/mail/_components/use-mail";

// F147 (Fahad: «سبام او غيرها … من القياسي»): mail boxes per RFC 6154 special-use mailboxes (+ RFC 8457 \Important):
// Inbox, Priority (\Important), Drafts, Sent, Archive, Trash, Spam (\Junk), Starred (\Flagged), All mail (\All).
// Local state only: moves (Report spam / Not spam) and stars reset on page reload.

export type MailBox = "inbox" | "priority" | "drafts" | "sent" | "archive" | "trash" | "spam" | "starred" | "all";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const me = { name: "Arham Khan", email: "hello@arhamkhnz.com" };

function sample(id: string, folder: Mail["folder"], from: Mail["from"], subject: string, body: string, minutes: number): Mail {
  const isSpam = folder === "spam";
  return { id: `f147-${id}`, accountId: 1, from, to: [me], subject, body, receivedAt: ago(minutes), folder, isRead: !isSpam, isPinned: false, isPriority: false, labels: [] };
}

// Extra sample mails so every box has something to show (the original sample mails are all in the inbox).
const extraMails: Mail[] = [
  sample("spam-1", "spam", { name: "Lottery Center", email: "winner@prize-claim.biz" }, "You have WON $1,000,000!!!", "Congratulations! Send your bank details today to claim your prize.\n\n(sample spam)", 35),
  sample("spam-2", "spam", { name: "Security Team", email: "alert@secure-verify-login.co" }, "Your account will be suspended – verify now", "We noticed unusual activity. Click the link and enter your password within 24 hours.\n\n(sample spam)", 190),
  sample("spam-3", "spam", { name: "Best Deals", email: "offers@deals4u.shop" }, "Luxury watches 90% OFF – today only", "Limited stock! Buy now, pay later. Unsubscribe never.\n\n(sample spam)", 1500),
  sample("spam-4", "spam", { name: "Bank Support", email: "support@bank-update.info" }, "Urgent: confirm your card number", "Reply with your card number and PIN to keep your account open.\n\n(sample spam)", 2900),
  sample("draft-1", "drafts", me, "Re: Project Update (draft)", "Thanks for the update. I'll review the timeline and get back to you by", 50),
  sample("sent-1", "sent", me, "Invoice #1042", "Hi, please find the invoice for October attached. Thank you!", 300),
  sample("archive-1", "archive", { name: "Weblabs Studio", email: "contact@weblabs.studio" }, "Welcome to Weblabs Studio", "Your workspace is ready. Here are a few tips to get started.", 7000),
  sample("trash-1", "trash", { name: "Weekly Digest", email: "digest@newsletter.io" }, "This week's top stories", "Ten links you might have missed this week.", 9000),
];

export const allMails: Mail[] = [...mails, ...extraMails];

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
  starred: Object.fromEntries([mails[0]?.id, mails[2]?.id].filter(Boolean).map((id) => [id, true])),
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
export function useBoxMails(): Mail[] {
  const s = useMailBox();
  const list = mailsIn(s.box, s);
  const [mail, setMail] = useMail();

  useEffect(() => {
    if (mail.selected !== null && !list.some((item) => item.id === mail.selected)) {
      setMail({ selected: list[0]?.id ?? null });
    }
  }, [list, mail.selected, setMail]);

  return list;
}
