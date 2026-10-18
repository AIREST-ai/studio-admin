// T-139: the dry run. For each made-up conversation it says which path of the flow Chatwoot would run if the flow's
// event happened now, using the rules exactly as they would be approved and the same SQL reading that the tests
// check against Postgres (chatwoot.ts evaluate). It only reads: nothing is sent and no conversation changes.
import type { EventKey, Rule } from "./catalog";
import { evaluate, type IdDirectory, type SampleMessage, toChatwootRule } from "./chatwoot";
import { applyPath, type CompiledPath, type CompileResult } from "./compile";
import type { DrySample } from "./samples";

export interface DryRunResult {
  sample: DrySample;
  /** The message that "just arrived" for Message Created (the conversation's last one). */
  message?: SampleMessage;
  matched: CompiledPath[];
}

export function ruleForPath(path: CompiledPath, name: string, description: string): Rule {
  const base: Rule = {
    id: 0,
    name,
    description,
    active: true,
    createdOn: "",
    runType: path.runType,
    event: path.event,
    conditions: [],
    actions: [],
  };
  return applyPath(base, path, name, description);
}

export function dryRun(
  result: CompileResult,
  samples: DrySample[],
  ids: IdDirectory,
  meta: { name: string; description: string },
): DryRunResult[] {
  const paths = result.paths.filter((path) => !path.blocked && path.actions.length);
  return samples.map((sample) => {
    const event: EventKey | undefined = paths[0]?.event;
    const message = event === "message_created" ? sample.messages[sample.messages.length - 1] : undefined;
    const matched = paths.filter((path) => {
      const rule = toChatwootRule(ruleForPath(path, meta.name, meta.description), ids);
      return evaluate(rule.conditions, sample, rule.event_name, message);
    });
    return { sample, message, matched };
  });
}
