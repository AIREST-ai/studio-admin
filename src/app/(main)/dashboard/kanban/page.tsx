import type { Metadata } from "next";

import { initialBoard } from "./_components/data";
import { Kanban } from "./_components/kanban";

export const metadata: Metadata = {
  title: "Dodge board",
  description: "Customer problems a reply left open, tracked from the dodge until they are solved.",
  alternates: {
    canonical: "/dashboard/kanban",
  },
};

export default function Page() {
  return (
    <div data-content-padding="false">
      <Kanban initialBoard={initialBoard} />
    </div>
  );
}
