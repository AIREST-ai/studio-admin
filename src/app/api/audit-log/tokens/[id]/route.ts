import { NextResponse } from "next/server";

import { listReadTokens, RetracedError, revokeReadToken } from "@/lib/audit/retraced";
import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";
import { ownNames } from "@/lib/own-names";

// F-22: revoke a read token. The path carries the token's id ("enterprise:" + its first 7 characters), never the
// token itself, so the token is not written in the request line the audit log records. The audit log server deletes
// it (DELETE …/enterprisetoken/{token}); from then on a read with it is refused (401). Logged as audit_log.token_revoke.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error: ownNames(error) }, { status, headers });

type Context = { params: Promise<{ id: string }> };
type Found = { token: string; display_name: string } | undefined;

async function findToken(id: string): Promise<Found> {
  const prefix = /^enterprise:([0-9a-f]{7})$/i.exec(decodeURIComponent(id))?.[1];
  if (!prefix) return undefined;
  const matches = (await listReadTokens()).filter((t) => t.token.startsWith(prefix));
  return matches.length === 1 ? matches[0] : undefined;
}

const idFromUrl = (request: Request) => decodeURIComponent(new URL(request.url).pathname.split("/").at(-1) ?? "");

function describeRevoke(context: AuditContext<Found>): AuditChange[] {
  const id = context.params.id ? decodeURIComponent(context.params.id) : "read-token";
  const name = context.before?.display_name ?? id;
  return [
    {
      action: "audit_log.token_revoke",
      crud: "d",
      summary: `revoked the read token "${name}"`,
      target: { id, name, type: "read_token" },
      before: context.before ? { name: context.before.display_name } : undefined,
    },
  ];
}

export const DELETE = withAudit<Found, Context>(
  {
    area: "audit_log_token",
    snapshot: async (request) => findToken(idFromUrl(request)).catch(() => undefined),
    describe: describeRevoke,
  },
  async (_request, context) => {
    const { id } = await context.params;
    try {
      const found = await findToken(id);
      if (!found) return fail(404, "There is no read token with this id (it may be revoked already)");
      if (!(await revokeReadToken(found.token))) return fail(404, "The read token was revoked already");
      return NextResponse.json({ revoked: decodeURIComponent(id) }, { headers });
    } catch (error) {
      return error instanceof RetracedError
        ? fail(error.status, error.message)
        : fail(500, (error as Error).message || "error");
    }
  },
);
