"use client";
// F-6B (sim2 problem 3, Fahad 129.2 and 77.5): the reply box's "/" list reads the live canned responses that
// Settings > Canned Responses saves (src/lib/cw/store.ts, saved on the preview server), not the copy made when
// cw-data.ts first loaded, so a canned response added there shows up at once and after a reload.
import { useCwShared } from "@/lib/cw/store";

export interface ReplyCanned {
  shortCode: string;
  content: string;
}

/** The live canned responses; the reply box draws again when they change. */
export const useLiveCannedResponses = (): ReplyCanned[] => useCwShared((state) => state.cannedResponses);

/**
 * Chatwoot's search for "/" + text (Api::V1::Accounts::CannedResponsesController#canned_responses with ?search=, and
 * CannedResponse.order_by_search): a response matches when its short code or its content contains the text, ignoring
 * case; short codes that start with the text come first, then short codes that contain it, then content matches.
 * https://github.com/chatwoot/chatwoot/blob/develop/app/controllers/api/v1/accounts/canned_responses_controller.rb
 * https://github.com/chatwoot/chatwoot/blob/develop/app/models/canned_response.rb
 */
export function searchCanned<T extends ReplyCanned>(list: T[], query: string): T[] {
  const text = query.toLowerCase();
  const score = (item: T) => {
    const code = item.shortCode.toLowerCase();
    if (code.startsWith(text)) return 1;
    if (code.includes(text)) return 0.5;
    if (item.content.toLowerCase().includes(text)) return 0.2;
    return 0;
  };
  return list
    .map((item, index) => ({ item, index, rank: score(item) }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((row) => row.item);
}
