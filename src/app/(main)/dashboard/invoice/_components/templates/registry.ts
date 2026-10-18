import type { ComponentType } from "react";

import BoldHeader from "./layouts/bold-header";
import Bordered from "./layouts/bordered";
import Classic from "./layouts/classic";
import Column from "./layouts/column";
import Compact from "./layouts/compact";
import Corner from "./layouts/corner";
import LeftRail from "./layouts/left-rail";
import Letterhead from "./layouts/letterhead";
import Minimal from "./layouts/minimal";
import Modern from "./layouts/modern";
import Sidebar from "./layouts/sidebar";
import Statement from "./layouts/statement";
import TwoTone from "./layouts/two-tone";
import type { TemplateProps } from "./template-frame";

/**
 * The 13 Invoify invoice templates, with the ids, names and descriptions of Invoify's registry.ts (3859b3c).
 * Imported directly rather than through `load: () => import(...)`: they are small and the preview and the print copy
 * both need the chosen one at once.
 */
export type TemplateEntry = {
  id: number;
  name: string;
  description: string;
  component: ComponentType<TemplateProps>;
};

export const TEMPLATES: TemplateEntry[] = [
  { id: 1, name: "Classic", description: "Logo left, large invoice title right", component: Classic },
  { id: 2, name: "Modern", description: "Stacked header over a full-width accent rule", component: Modern },
  { id: 3, name: "Sidebar", description: "Full-height accent rail carries the details", component: Sidebar },
  { id: 4, name: "Bold Header", description: "Full-bleed colour band across the top", component: BoldHeader },
  { id: 5, name: "Minimal", description: "No rules, fills or logo — whitespace does the work", component: Minimal },
  { id: 6, name: "Letterhead", description: "Centred masthead, formal and symmetrical", component: Letterhead },
  { id: 7, name: "Compact", description: "Tight receipt-style sheet for short invoices", component: Compact },
  { id: 8, name: "Two-Tone", description: "Soft tinted bands behind header and totals", component: TwoTone },
  { id: 9, name: "Bordered", description: "Ruled frame throughout, official-form feel", component: Bordered },
  { id: 10, name: "Left Rail", description: "Thin accent stripe, editorial spacing", component: LeftRail },
  { id: 11, name: "Statement", description: "Summary strip of key figures up front", component: Statement },
  { id: 12, name: "Corner", description: "Amount due stamped in the top corner", component: Corner },
  { id: 13, name: "Column", description: "Metadata column beside the items, spec-sheet style", component: Column },
];

export function getTemplateEntry(id: number): TemplateEntry | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
