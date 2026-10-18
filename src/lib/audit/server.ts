// V-22: vault-first API key for the audit-log backend (Retraced).
// The publisher client stays in retraced.ts. This file only resolves the key.
// Never log or return the secret to a browser.

import { readVaultSecret } from "@/lib/system-vault";

import { readFile } from "node:fs/promises";

export const AUDIT_KEY_FILE =
  process.env.RETRACED_API_KEY_FILE ?? "/Users/ali/lobehub-hub/retraced/preview-api-key.txt";

export const AUDIT_VAULT_NAMES = ["retraced_api_key", "RETRACED_API_KEY", "audit_api_key"] as const;

/**
 * Reads the Retraced API key from the system vault first, then RETRACED_API_KEY,
 * then the current key file (fallback). Returns null when none is configured.
 */
export async function readAuditApiKey(): Promise<string | null> {
  const vault = readVaultSecret(AUDIT_VAULT_NAMES);
  if (vault) return vault;
  const fromEnv = process.env.RETRACED_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const fromFile = (await readFile(AUDIT_KEY_FILE, "utf8")).trim();
    return fromFile || null;
  } catch {
    return null;
  }
}
