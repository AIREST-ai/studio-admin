// T-139: the Automation list and the visual editor save the same "automation" section of the preview save
// (src/lib/cw/persistence/file-store.ts): every rule the list and the form edit, and every flow the editor draws.
// Saving is always "on top of the revision I loaded": if another tab saved first the server answers 409 and nothing
// is overwritten. Nothing here talks to Chatwoot or to customers.
import { loadLinkedAutomation, saveLinkedAutomation } from "@/lib/chatwoot/settings-adapter";
import { linkedSession, loadPreviewSection, SectionConflict, savePreviewSection } from "@/lib/cw/persistence/client";

import type { AutomationItem } from "./model";
import { initialRules } from "./sample-rules";

export const AUTOMATION_SECTION = "automation";

export interface LoadedAutomation {
  rev: number;
  savedAt: string | null;
  items: AutomationItem[];
  /** true while nothing was ever saved: the items are the sample rules, not the user's. */
  sample: boolean;
}

export async function loadAutomation(): Promise<LoadedAutomation> {
  if (linkedSession()) {
    return loadLinkedAutomation();
  }
  const saved = await loadPreviewSection<AutomationItem>(AUTOMATION_SECTION);
  if (saved.items) return { rev: saved.rev, savedAt: saved.savedAt, items: saved.items, sample: false };
  // Never saved: show the sample. It is written only when the user changes something, and never over saved rules
  // (a save on revision 0 is refused once anything was saved).
  return {
    rev: 0,
    savedAt: null,
    items: initialRules.map((rule): AutomationItem => ({ kind: "rule", rule: structuredClone(rule) })),
    sample: true,
  };
}

export async function saveAutomation(items: AutomationItem[], baseRev: number) {
  if (linkedSession()) {
    return saveLinkedAutomation(items, baseRev);
  }
  return savePreviewSection(AUTOMATION_SECTION, items, baseRev);
}

export { SectionConflict };

export function today() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
