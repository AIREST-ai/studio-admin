import { redirect } from "next/navigation";

// T-234 (item 88): the editor moved with Automation to /dashboard/automation/flow/<id>; old links land there with
// their id and query.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { id } = await params;
  const query = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([key, value]) => [value].flat().map((v) => [key, v])),
  ).toString();
  redirect(`/dashboard/automation/flow/${encodeURIComponent(id)}${query ? `?${query}` : ""}`);
}
