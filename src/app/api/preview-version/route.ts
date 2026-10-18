import { NextResponse } from "next/server";

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

async function latest(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  const times = await Promise.all(
    entries.map(async (entry) => {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) return latest(location);
      if (!entry.isFile()) return 0;
      return (await stat(location)).mtimeMs;
    }),
  );
  return Math.max(0, ...times);
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = ["http://192.168.1.15:8798"];
  const headers: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin" };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  const version = await latest(path.join(process.cwd(), "src"));
  return NextResponse.json({ version, source: "mac-studio" }, { headers });
}
