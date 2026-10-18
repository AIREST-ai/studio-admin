"use client";
// M129-B: the lists the simulator's fields choose from that live outside the code (the folders saved in
// Conversations, the approved message templates, the saved flows). The editor fills them once it has loaded them;
// the text form and the inspector read them from here instead of copying them.
import * as React from "react";

import { sendableTemplates } from "@/lib/cw/data";

export interface SimOptions {
  folders: string[];
  templates: string[];
  /** F-3: each approved template's text, so the step can fill its {{n}} from the contact (template-vars.ts). */
  templateBodies: Record<string, string>;
  flows: { id: string; name: string }[];
  currentFlowId: string;
}

export const defaultSimOptions: SimOptions = {
  folders: [],
  templates: sendableTemplates.map((t) => t.name),
  templateBodies: Object.fromEntries(sendableTemplates.map((t) => [t.name, t.body])),
  flows: [],
  currentFlowId: "",
};

export const SimOptionsContext = React.createContext<SimOptions>(defaultSimOptions);

export const useSimOptions = () => React.useContext(SimOptionsContext);
