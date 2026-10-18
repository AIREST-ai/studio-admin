"use client";
// F-22 (Fahad 15 Oct: "I mean the whole system … I want my own system"): read tokens of the audit log, one per
// customer or team, made and revoked by the audit log server itself (GET/POST /api/audit-log/tokens,
// DELETE /api/audit-log/tokens/<id>). A token reads this workspace's log through GET /api/audit-log/read; the card
// says plainly what it can and cannot do. Every create and revoke is written in the log (audit_log.token_*).
import * as React from "react";

import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { copyText } from "../../_components/copy-text";

type Kind = "customer" | "team";
interface ReadToken {
  id: string;
  token: string;
  name: string;
  kind: Kind | null;
}

const masked = (token: string) => `${"•".repeat(12)}${token.slice(-4)}`;

function RevokeButton({ token, onRevoked }: { token: ReadToken; onRevoked: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  async function revoke() {
    setBusy(true);
    try {
      const response = await fetch(`/api/audit-log/tokens/${encodeURIComponent(token.id)}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { revoked?: string; error?: string } | null;
      if (!response.ok || !body?.revoked)
        throw new Error(body?.error ?? `the preview server answered ${response.status}`);
      toast.success(`Revoked the token for “${token.name}”`, { description: "Reads with it are refused from now on." });
      setOpen(false);
      onRevoked();
    } catch (reason) {
      toast.error("Not revoked", { description: (reason as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="audit-token-revoke">
          Revoke
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4">
        <span className="text-sm leading-snug">
          Revoke the token for <span className="font-medium">{token.name}</span>? Anything that reads the log with it
          stops working at once. This cannot be undone; make a new token instead.
        </span>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void revoke()}
            data-testid="audit-token-revoke-confirm"
          >
            {busy ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReadTokens() {
  const [tokens, setTokens] = React.useState<ReadToken[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<Kind>("customer");
  const [creating, setCreating] = React.useState(false);
  const [shown, setShown] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/audit-log/tokens", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { tokens?: ReadToken[]; error?: string } | null;
      if (!response.ok || !body?.tokens)
        throw new Error(body?.error ?? `the preview server answered ${response.status}`);
      setTokens(body.tokens);
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/audit-log/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, kind }),
      });
      const body = (await response.json().catch(() => null)) as { token?: ReadToken; error?: string } | null;
      if (response.status !== 201 || !body?.token)
        throw new Error(body?.error ?? `the preview server answered ${response.status}`);
      toast.success(`Created a read token for “${body.token.name}”`, { description: "Copy it from the list below." });
      setName("");
      setShown(body.token.id);
      await load();
    } catch (reason) {
      toast.error("Not created", { description: (reason as Error).message });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="gap-0 pb-0" data-testid="audit-read-tokens">
      <CardHeader className="border-b pb-4 has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle className="flex items-center gap-2 text-xl leading-none">
          <KeyRound className="size-5 text-muted-foreground" /> Read tokens
        </CardTitle>
        <CardDescription className="leading-snug">
          Give a customer or team their own token to read this log from their tools, without opening this page.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto self-center md:col-start-2 md:row-span-2 md:row-start-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Refresh read tokens"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <ul
          className="mx-5 mt-4 flex list-disc flex-col gap-1 ps-4 text-muted-foreground text-sm"
          data-testid="audit-token-honesty"
        >
          <li>Read only: a token can list and search the events. It cannot add, change or delete anything.</li>
          <li>
            It reads the whole activity log of this workspace. The log keeps one group for the workspace, so a token
            cannot be limited to one customer's or team's own events.
          </li>
          <li className="break-words">
            How to use it: <code className="font-mono text-xs">GET /api/audit-log/read</code> on this preview server,
            with the header <code className="font-mono text-xs">Authorization: Bearer &lt;token&gt;</code>. It takes the
            same filters as this page (q, section, action, actor, crud, from, to, page, size, sort).
          </li>
          <li>Every read made with a token is written in this log under the token's name.</li>
          <li>
            Revoke stops a token at once. The preview has no sign-in, so anyone who can open this page can see and copy
            the tokens.
          </li>
        </ul>
        <form
          className="mx-5 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === "team" ? "Team name, e.g. Finance" : "Customer name, e.g. Acme Corp"}
            maxLength={80}
            aria-label="Customer or team name"
            className="h-8 w-full sm:w-72"
            data-testid="audit-token-name"
          />
          <fieldset className="m-0 flex items-center gap-1 border-0 p-0" aria-label="Token for">
            {(["customer", "team"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={kind === value ? "default" : "outline"}
                size="sm"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
                data-testid={`audit-token-kind-${value}`}
              >
                {value === "customer" ? "Customer" : "Team"}
              </Button>
            ))}
          </fieldset>
          <Button type="submit" size="sm" disabled={!name.trim() || creating} data-testid="audit-token-create">
            <KeyRound /> {creating ? "Creating…" : "Create token"}
          </Button>
        </form>
        {error ? (
          <p role="alert" className="mx-5 text-destructive text-sm">
            The read tokens could not be read: {error}
          </p>
        ) : null}
        <Table className="table-fixed **:data-[slot='table-cell']:px-5 **:data-[slot='table-head']:px-5">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%] py-3 font-normal">Name</TableHead>
              <TableHead className="w-24 py-3 font-normal">For</TableHead>
              <TableHead className="py-3 font-normal">Token</TableHead>
              <TableHead className="w-28 py-3 font-normal">
                <span className="sr-only">Revoke</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens?.length ? (
              tokens.map((token) => (
                <TableRow key={token.id} data-testid="audit-token-row" data-name={token.name}>
                  <TableCell className="py-3 whitespace-normal break-words font-medium">{token.name}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="font-normal">
                      {token.kind === "team" ? "Team" : token.kind === "customer" ? "Customer" : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 whitespace-normal">
                    <div className="flex min-w-0 items-center gap-1">
                      <code
                        className="min-w-0 flex-1 break-all font-mono text-xs"
                        data-testid="audit-token-value"
                        data-shown={shown === token.id ? "1" : "0"}
                      >
                        {shown === token.id ? token.token : masked(token.token)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={shown === token.id ? "Hide token" : "Show token"}
                        onClick={() => setShown((id) => (id === token.id ? null : token.id))}
                        data-testid="audit-token-show"
                      >
                        {shown === token.id ? <EyeOff /> : <Eye />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Copy token"
                        onClick={() => void copyText(token.token, `Copied the token for “${token.name}”`)}
                        data-testid="audit-token-copy"
                      >
                        <Copy />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <RevokeButton token={token} onRevoked={() => void load()} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                  {tokens ? "No read tokens yet." : loading ? "Reading the read tokens…" : "—"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
