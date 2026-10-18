// T-225 browser side of the General Settings save: talks to /api/account-general-settings (see that route). Every
// failure throws with the server's reason so the page shows "not saved" instead of pretending it worked.
import * as React from "react";

import { fetchLinkedGeneralSettings, saveLinkedGeneralSettings } from "@/lib/chatwoot/settings-adapter";
import { linkedSession } from "@/lib/cw/persistence/client";

const ENDPOINT = "/api/account-general-settings";

export interface SavedGeneralSettings {
  name: string;
  language: string;
  savedAt: string;
}

async function reason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return `${response.status} ${body?.error ?? response.statusText}`;
}

/** `null` when nothing was saved yet. */
export async function loadGeneralSettings(): Promise<SavedGeneralSettings | null> {
  if (linkedSession()) {
    return fetchLinkedGeneralSettings();
  }
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(`load failed: ${await reason(response)}`);
  return ((await response.json()) as { settings: SavedGeneralSettings | null }).settings;
}

export async function saveGeneralSettings(name: string, language: string): Promise<SavedGeneralSettings> {
  if (linkedSession()) {
    return saveLinkedGeneralSettings(name, language);
  }
  const response = await fetch(ENDPOINT, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, language }),
  });
  if (!response.ok) throw new Error(`save failed: ${await reason(response)}`);
  return ((await response.json()) as { settings: SavedGeneralSettings }).settings;
}

// F-9 (sim3 step 3.4b: after General Settings saved "zzs Weblabs Studio", the Add Inbox wizard still said "integrate
// with Weblabs Studio"): the account name as saved in General Settings, for the pages that write it in their text.
// The sample name shows until the saved one is read (and stays when nothing was saved or the read fails).
export const SAMPLE_ACCOUNT_NAME = "Weblabs Studio";

export function useAccountName(): string {
  const [name, setName] = React.useState(SAMPLE_ACCOUNT_NAME);
  React.useEffect(() => {
    let alive = true;
    loadGeneralSettings().then(
      (saved) => {
        if (alive && saved?.name?.trim()) setName(saved.name.trim());
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  return name;
}
