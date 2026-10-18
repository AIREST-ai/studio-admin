"use client";
// F-3 item 6: under "Send an approved message template", one row per {{n}} of the chosen template: a contact field
// (with its fallback) or a fixed text, as in a WhatsApp campaign (campaign-composer.tsx). See ./template-vars.ts.
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { useSimOptions } from "./sim-options";
import {
  FIELD_OPTIONS,
  missingVariables,
  type TemplateAction,
  type VariableSource,
  variableKeys,
} from "./template-vars";

export function TemplateVariablesFields({
  action,
  onChange,
}: {
  action: TemplateAction;
  onChange: (action: TemplateAction) => void;
}) {
  const { templateBodies } = useSimOptions();
  const body = templateBodies[action.values[0] ?? ""];
  if (!body) return null;
  const keys = variableKeys(body);
  const missing = missingVariables(body, action.variables);
  return (
    <div className="grid gap-2" data-testid="template-variables">
      <p className="rounded-md bg-muted/50 p-2 text-muted-foreground text-xs" dir="auto">
        {body}
      </p>
      {keys.length ? (
        <>
          <Label>Variables, from the contact</Label>
          {keys.map((key) => {
            const source: VariableSource = action.variables?.[key] ?? { kind: "field", field: "", fallback: "" };
            const setSource = (next: VariableSource) =>
              onChange({ ...action, variables: { ...action.variables, [key]: next } });
            return (
              <div key={key} className="grid grid-cols-[3rem_1fr] items-center gap-2" data-variable={key}>
                <Badge variant="outline" className="justify-center font-mono">{`{{${key}}}`}</Badge>
                <NativeSelect
                  className="w-full"
                  aria-label={`Value of {{${key}}}`}
                  aria-invalid={missing.includes(key)}
                  value={source.kind === "field" ? source.field : "__text"}
                  onChange={(e) =>
                    setSource(
                      e.target.value === "__text"
                        ? { kind: "text", value: "" }
                        : {
                            kind: "field",
                            field: e.target.value,
                            fallback: source.kind === "field" ? source.fallback : "",
                          },
                    )
                  }
                >
                  <option value="" disabled>
                    Choose a contact field
                  </option>
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      Contact: {f.label}
                    </option>
                  ))}
                  <option value="__text">Same text for everyone</option>
                </NativeSelect>
                <Input
                  className="col-start-2"
                  aria-label={source.kind === "field" ? `Fallback for {{${key}}}` : `Text for {{${key}}}`}
                  placeholder={source.kind === "field" ? "Fallback when the contact has none" : "Text"}
                  dir="auto"
                  value={source.kind === "field" ? source.fallback : source.value}
                  onChange={(e) =>
                    setSource(
                      source.kind === "field"
                        ? { ...source, fallback: e.target.value }
                        : { kind: "text", value: e.target.value },
                    )
                  }
                />
              </div>
            );
          })}
          {missing.length ? (
            <p className="text-destructive text-xs">
              Choose a contact field or a text for {missing.map((key) => `{{${key}}}`).join(", ")}: WhatsApp refuses a
              template with a missing parameter (error 132000).
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
