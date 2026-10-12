import type { Metadata } from "next";

import { ConversationsWorkspace } from "../../_components/conversations-workspace";
import { initialFolders } from "../../_components/cw-data";
import { ViewNotFound } from "../../_components/view-not-found";

// Folders (Chatwoot custom views) live in local state, so a folder saved in this session also opens here. Saved
// folders get ids like "f-mg3k2x" (cw-store addFolder); any other unknown id is not a folder and gets the
// "Folder not found" state, like an unknown team or inbox. A saved folder that no longer exists goes back to
// All Conversations (workspace).
const SAVED_FOLDER_ID = /^f-[a-z0-9]+$/;

function isPossibleFolder(id: string): boolean {
  return initialFolders.some((folder) => folder.id === id) || SAVED_FOLDER_ID.test(id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isPossibleFolder(id)) return { title: "Folder not found" };
  return { title: initialFolders.find((folder) => folder.id === id)?.name ?? "Folder" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isPossibleFolder(id)) return <ViewNotFound kind="folder" />;
  return <ConversationsWorkspace view={{ kind: "folder", id }} />;
}
