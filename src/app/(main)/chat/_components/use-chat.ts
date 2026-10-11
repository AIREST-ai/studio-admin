import { create } from "zustand";

import { type Conversation, conversations } from "./data";

type Config = {
  selected: Conversation["id"] | null;
};

type ChatStore = {
  chat: Config;
  setChat: (chat: Config) => void;
};

const useChatStore = create<ChatStore>((set) => ({
  chat: {
    selected: conversations[0].id,
  },
  setChat: (chat) => set({ chat }),
}));

export function useChat() {
  const chat = useChatStore((state) => state.chat);
  const setChat = useChatStore((state) => state.setChat);

  return [chat, setChat] as const;
}

// F145: when a tag filter hides the open conversation, open the first one of the filtered list.
export function keepSelectionIn(ids: Conversation["id"][]) {
  const { chat, setChat } = useChatStore.getState();
  if (ids.length > 0 && (chat.selected === null || !ids.includes(chat.selected))) {
    setChat({ ...chat, selected: ids[0] });
  }
}
