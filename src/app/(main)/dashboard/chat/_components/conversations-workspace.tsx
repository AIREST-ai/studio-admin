"use client";

// Chatwoot conversations area inside the Studio dashboard (F159): one card holding the conversation list, the open
// conversation and the contact panel. Every sidebar view under "Conversations" renders this with its own view.
import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Inbox, Mail, MessagesSquare } from "lucide-react";

import { ChatEmailView } from "@/app/(main)/chat/_components/chat-email-view";
import { setTagFilter, useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import { brown } from "@/app/(main)/chat/_components/chat-thread-extras";
import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { enableLinkedStoreAdapter, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
import { currentViewer } from "@/lib/cw/view-as";

import { ContactPanel } from "./contact-panel";
import { ConversationList } from "./conversation-list";
import { ConversationPane } from "./conversation-pane";
import { type AssigneeTab, baseConversations } from "./cw-data";
import { CwDialogs, openDialog } from "./cw-dialogs";
import { useConversationList, type ViewSpec } from "./cw-filter";
import { cw, useCwStore, useFolderPersistence } from "./cw-store";
import { ViewNotFound } from "./view-not-found";

// Tab the list had before Participating switched it to All (put back when another view opens).
let tabBeforeParticipating: AssigneeTab | null = null;

function useMinWidth(px: number) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [px]);
  return matches;
}

function EmptyPane() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <MessagesSquare className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">Please select a conversation from left pane</p>
      {/* Chatwoot's command bar opens with ⌘ K here (cw-dialogs.tsx); ⌘ / opens the keyboard shortcuts dialog. */}
      <div className="flex flex-col gap-1 text-muted-foreground text-xs">
        <span>
          <Kbd>⌘</Kbd> <Kbd>K</Kbd> to open command menu
        </span>
        <button type="button" className="hover:text-foreground" onClick={() => openDialog({ type: "shortcuts" })}>
          <Kbd>⌘</Kbd> <Kbd>/</Kbd> to view keyboard shortcuts
        </button>
      </div>
    </div>
  );
}

// U-2 (item 159, Condition 7): Always render the full Studio PreviewConversationsWorkspace UI in both preview and
// linked modes. When linked mode is active and the Chatwoot gateway reports an error, show an honest error banner.
export function ConversationsWorkspace({ view }: { view: ViewSpec }) {
  const linkedStatus = useLinkedAdapterStatus();
  return (
    <div className="flex h-full flex-col gap-2">
      {linkedStatus.active && linkedStatus.error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs"
        >
          <span>Linked Chatwoot connection error: {linkedStatus.error}</span>
          <Button size="sm" variant="outline" onClick={() => void enableLinkedStoreAdapter()}>
            Retry
          </Button>
        </div>
      ) : null}
      <PreviewConversationsWorkspace view={view} />
    </div>
  );
}

function PreviewConversationsWorkspace({ view }: { view: ViewSpec }) {
  const router = useRouter();
  const [chat, setChat] = useChat();
  const { filter, tags } = useChatTags();
  const folders = useCwStore((s) => s.folders);
  const focusId = useCwStore((s) => s.focusId);
  const deleted = useCwStore((s) => s.deleted);
  const assigneeTab = useCwStore((s) => s.assigneeTab);
  const list = useConversationList(view);
  const wide = useMinWidth(1440);
  const twoPane = useMinWidth(1024);
  // Item 72 (Fahad 13:51:32): the contact panel stays closed until its button is pressed, at every width.
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const isEmailInbox = view.kind === "inbox" && view.id === "email";
  // The Email channel opens on its conversations like every Chatwoot inbox; Studio's Email UI (brown, F146) is one
  // click away in the heading.
  const [mailView, setMailView] = useState(false);
  const viewKey = `${view.kind}:${"id" in view ? view.id : ""}`;
  const labelSeen = useRef(false);
  // Set when ?conversation= opened a conversation in this pass, so the list check below does not replace it.
  const openedFromQuery = useRef(false);
  // Set when Participating opens, until its first conversation is picked (see below).
  const pickJoined = useRef(false);

  // Label views drive the Studio tag filter (brown); every other view clears it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the view changes
  useEffect(() => {
    labelSeen.current = false;
    setTagFilter(view.kind === "label" ? view.id : null);
  }, [viewKey]);

  // Clearing the label with the Studio filter bar's X goes back to All Conversations.
  useEffect(() => {
    if (view.kind !== "label") return;
    if (filter === view.id) labelSeen.current = true;
    else if (filter === null && labelSeen.current) router.push("/dashboard/chat");
  }, [filter, view, router]);

  // "Open in new tab" from a card menu: /dashboard/chat?conversation=<id>. The conversation opens even when the
  // current filters hide it (like Chatwoot's conversation URL). F159: the list also moves to the status and the
  // Mine / Unassigned / All tab that hold it, so its row is listed and highlighted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read the query once on mount
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("conversation"));
    if (id && baseConversations.some((c) => c.id === id)) {
      const { meta, statusFilter } = useCwStore.getState();
      const m = meta[id];
      if (m) {
        const status = m.status === "closed" ? "resolved" : m.status;
        if (statusFilter !== "all" && statusFilter !== status) cw.setStatusFilter(status);
        const me = currentViewer().id;
        cw.setAssigneeTab(m.assigneeId === me ? "me" : m.assigneeId === null ? "unassigned" : "all");
      }
      cw.focus(id);
      setChat({ selected: id });
      openedFromQuery.current = true;
    }
  }, []);

  // F159: Participating opens on the All tab, because its Mine tab lists exactly the Mine conversations of All
  // Conversations (an assignee always takes part), and on the newest conversation you joined without being its
  // assignee (#12, Khalid's lead, which you answered). So it no longer opens the same conversation as All
  // Conversations. Another view puts the earlier tab back.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the view changes
  useEffect(() => {
    if (view.kind === "participating") {
      if (openedFromQuery.current) return;
      const current = useCwStore.getState().assigneeTab;
      if (current !== "all") {
        tabBeforeParticipating = current;
        cw.setAssigneeTab("all");
      }
      pickJoined.current = true;
    } else if (tabBeforeParticipating) {
      cw.setAssigneeTab(tabBeforeParticipating);
      tabBeforeParticipating = null;
    }
  }, [viewKey]);

  // Cmd or Ctrl + "/" opens Chatwoot's keyboard shortcuts dialog.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Slash" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openDialog({ type: "shortcuts" });
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // A conversation opened from Previous Conversations or the older/newer chat links stays open outside the list.
  const focused =
    focusId !== null && chat.selected === focusId && !deleted.includes(focusId)
      ? baseConversations.find((c) => c.id === focusId)
      : undefined;
  const rowIds = list.rows.map((c) => c.id);
  // Keep the open conversation inside the current list (Chatwoot moves to the next one).
  // biome-ignore lint/correctness/useExhaustiveDependencies: depends on the visible ids only
  useEffect(() => {
    // Participating on opening: its own first conversation (see above), even over one opened outside the list.
    if (pickJoined.current && view.kind === "participating") {
      // Wait for the list of the All tab (the first pass still has the earlier tab's rows).
      if (assigneeTab !== "all") return;
      pickJoined.current = false;
      const { meta } = useCwStore.getState();
      const joined = list.rows.find((c) => meta[c.id]?.assigneeId !== currentViewer().id) ?? list.rows[0];
      if (joined) {
        setChat({ selected: joined.id });
        return;
      }
    }
    if (focused) return;
    // Same pass as the ?conversation= effect above: its values here are from before it, so leave its pick alone.
    if (openedFromQuery.current) {
      openedFromQuery.current = false;
      return;
    }
    if (rowIds.length > 0 && (chat.selected === null || !rowIds.includes(chat.selected))) {
      setChat({ selected: rowIds[0] });
    }
  }, [rowIds.join(","), focused?.id, assigneeTab]);

  // F159: a saved folder that is gone (deleted, or saved before a reload) goes back to All Conversations (Chatwoot
  // returns to the conversations home after deleting the open folder) instead of an empty page titled "Folder".
  // Ids that cannot be a folder at all get the "Folder not found" page (folders/[id]/page.tsx renders view-not-found.tsx).
  // T-124: a folder link opened directly or reloaded waits for the saved folders (cw-store, T-109) before deciding.
  const foldersLoading = useFolderPersistence((s) => s.status === "loading");
  const folderUnknown = view.kind === "folder" && !folders.some((f) => f.id === view.id);
  const folderMissing = folderUnknown && !foldersLoading;
  useEffect(() => {
    if (folderMissing) router.replace("/dashboard/chat");
  }, [folderMissing, router]);

  const active =
    list.rows.find((c) => c.id === chat.selected) ?? focused ?? (list.rows.length > 0 ? list.rows[0] : undefined);
  const togglePanel = () => (wide ? setPanelOpen((v) => !v) : setSheetOpen((v) => !v));

  if (folderUnknown) return null;
  // F159: an unknown label id gets the same "not found" page as an unknown folder, team or inbox. Checked here on the
  // client, because labels created with "Add tag…" exist only in this session's state.
  if (view.kind === "label" && !tags.some((t) => t.id === view.id)) return <ViewNotFound kind="label" />;

  return (
    // T-99: the page fills the screen below the header and the card takes the height left, so the page itself never
    // scrolls (it did at 1024 px and on phones). 5rem on phones = the shell's padding (2rem) and its Inbox button row
    // (3rem, section-subnav.tsx); 3rem from md = the padding only.
    <div className="flex h-[calc(100svh-var(--dashboard-header-height)-5rem)] flex-col gap-4 md:h-[calc(100svh-var(--dashboard-header-height)-3rem)]">
      {/* T-134 (T-99, 17-a): no page title or description above the conversations (Fahad: a repeat of the sidebar
          and header). The view's own buttons stay, right-aligned, only when there is one. */}
      {isEmailInbox && (
        <div className="flex items-center justify-end gap-2">
          {isEmailInbox && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={mailView ? "mail" : "list"}
              onValueChange={(value) => value && setMailView(value === "mail")}
              className={brown.line}
            >
              <ToggleGroupItem value="mail" aria-label="Mail view">
                <Mail /> Mail view
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Conversations">
                <Inbox /> Conversations
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {/* T-100: no "New conversation" button here: it opened the same empty dialog as Quick Create at the top of
              the Inbox bar (T-62, Fahad: one entry, not two). The contact panel's New message (prefilled) stays. */}
          {/* T-258: no Notifications bell here: it was a plain link to My Inbox, the same page as the header bell
              (which has the count and the list). Chatwoot's list header has no bell either (judge 02:00). */}
          {/* T-99: no Settings gear here: it was the same link as Settings in the sidebar (Fahad: not right above the
              conversations; respond.io keeps Settings in the main rail only). */}
        </div>
      )}

      <Card className="min-h-[24rem] flex-1 gap-0 overflow-hidden p-0">
        {isEmailInbox && mailView ? (
          // F159: the Studio look of the Email UI: same list header, count pills and Mine / Unassigned / All tabs as
          // the other channel pages, neutral lines, no brown frame (the brown mark stays on the Mail view toggle).
          <ChatEmailView look="studio" />
        ) : (
          <div
            className={cn(
              "grid h-full min-h-0 grid-cols-1 *:min-h-0 *:min-w-0",
              wide && panelOpen ? "lg:grid-cols-[21rem_minmax(0,1fr)_20rem]" : "lg:grid-cols-[21rem_minmax(0,1fr)]",
            )}
          >
            <ConversationList
              view={view}
              onOpen={() => setShowThread(true)}
              className={cn("lg:border-e", !twoPane && showThread && "hidden")}
            />
            {active ? (
              <ConversationPane
                conversation={active}
                showBackButton={!twoPane}
                onBack={() => setShowThread(false)}
                panelOpen={wide ? panelOpen : sheetOpen}
                onTogglePanel={togglePanel}
                className={cn(!twoPane && !showThread && "hidden")}
              />
            ) : (
              <div className={cn(!twoPane && !showThread && "hidden")}>
                <EmptyPane />
              </div>
            )}
            {wide && panelOpen && active && (
              <div className="border-s">
                <ContactPanel conversation={active} onClose={() => setPanelOpen(false)} />
              </div>
            )}
          </div>
        )}
      </Card>

      {!wide && active && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-[22rem] p-0 sm:max-w-[22rem]" showCloseButton={false}>
            <SheetTitle className="sr-only">Contact</SheetTitle>
            <SheetDescription className="sr-only">Contact details and conversation actions</SheetDescription>
            <ContactPanel conversation={active} onClose={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <CwDialogs />
    </div>
  );
}
