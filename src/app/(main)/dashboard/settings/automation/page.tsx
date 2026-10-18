import { redirect } from "next/navigation";

// T-234 (item 88): Automation moved out of Settings to /dashboard/automation; old links land there with their query.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const query = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([key, value]) => [value].flat().map((v) => [key, v])),
  ).toString();
  redirect(`/dashboard/automation${query ? `?${query}` : ""}`);
}
