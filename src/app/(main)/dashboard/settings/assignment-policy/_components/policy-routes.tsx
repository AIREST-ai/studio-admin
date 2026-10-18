"use client";
// F161 settings-a: /assignment/[id] and /capacity/[id] read the policy from the shared policy stores, so a policy
// created in this session opens too ("new" opens the create form).
import { AssignmentPolicyForm } from "./assignment-policy-form";
import { CapacityPolicyForm } from "./capacity-policy-form";
import {
  useAssignmentPolicies,
  useAssignmentPoliciesLoaded,
  useCapacityPolicies,
  useCapacityPoliciesLoaded,
} from "./policies-store";
import { POLICY_HOME, PolicyBreadcrumb } from "./policy-ui";

function NotFound({ kind }: { kind: "assignment" | "capacity" }) {
  return (
    <div className="flex flex-col gap-4">
      <PolicyBreadcrumb
        items={[
          { label: "Agent Assignment", href: POLICY_HOME },
          {
            label: kind === "assignment" ? "Assignment policy" : "Agent capacity",
            href: `${POLICY_HOME}/${kind}`,
          },
          { label: "Not found" },
        ]}
      />
      <p className="text-muted-foreground text-sm">This policy does not exist or was deleted.</p>
    </div>
  );
}

export function AssignmentPolicyRoute({ id, inboxId }: { id: string; inboxId?: number }) {
  const policies = useAssignmentPolicies();
  // F-6A: wait for the saved policies, as capacity does (T-232), so a form never opens on the sample and saves over it.
  const loaded = useAssignmentPoliciesLoaded();
  if (!loaded) return <p className="text-muted-foreground text-sm">Loading policy…</p>;
  if (id === "new") return <AssignmentPolicyForm linkInboxId={inboxId} />;
  const policy = policies.find((p) => String(p.id) === id);
  if (!policy) return <NotFound kind="assignment" />;
  return <AssignmentPolicyForm key={policy.id} policy={policy} linkInboxId={inboxId} />;
}

export function CapacityPolicyRoute({ id }: { id: string }) {
  const policies = useCapacityPolicies();
  // T-232: wait for the saved policies, so the form never opens on the unsaved defaults and saves over them.
  const loaded = useCapacityPoliciesLoaded();
  if (!loaded) return <p className="text-muted-foreground text-sm">Loading policy…</p>;
  if (id === "new") return <CapacityPolicyForm />;
  const policy = policies.find((p) => String(p.id) === id);
  if (!policy) return <NotFound kind="capacity" />;
  return <CapacityPolicyForm key={policy.id} policy={policy} />;
}
