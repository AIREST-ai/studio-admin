// V-22: unified system-vault lookup for studio-admin backend keys.
// Order: systemd credentials, /etc/airest-secrets, /etc/airest-inbox, then the caller's fallback path.
// Never log or return secret values.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const SYSTEM_VAULT_DIRS = [
  "/run/credentials/studio-admin.service",
  "/etc/airest-secrets",
  "/etc/airest-inbox",
] as const;

/** Vault directories in priority order, with systemd CREDENTIALS_DIRECTORY first when set. */
export function vaultDirectories(): string[] {
  const cred = process.env.CREDENTIALS_DIRECTORY?.trim();
  const dirs = cred ? [cred, ...SYSTEM_VAULT_DIRS] : [...SYSTEM_VAULT_DIRS];
  return [...new Set(dirs)];
}

/**
 * First readable non-empty vault file matching `names`, else `fallback`.
 * Unreadable dirs/files (isolation, permissions) are skipped, never thrown.
 */
export function resolveVaultFilePath(names: readonly string[], fallback: string): string {
  for (const dir of vaultDirectories()) {
    for (const name of names) {
      if (!name) continue;
      const candidate = path.join(dir, name);
      try {
        if (!existsSync(candidate)) continue;
        const val = readFileSync(candidate, "utf8").trim();
        if (val) return candidate;
      } catch {
        // absent or unreadable: try the next candidate
      }
    }
  }
  return fallback;
}

/** First non-empty vault secret text, else null. Never logs the value. */
export function readVaultSecret(names: readonly string[]): string | null {
  const found = resolveVaultFilePath(names, "");
  if (!found) return null;
  try {
    const val = readFileSync(found, "utf8").trim();
    return val || null;
  } catch {
    return null;
  }
}
