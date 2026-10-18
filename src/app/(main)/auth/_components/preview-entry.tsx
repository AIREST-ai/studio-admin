"use client";
// F-6A (task item 5): the parts of the login and register pages that tell the truth about this preview: the Live demo
// button (a demo account, said so), the notice after Log out, and the line under the forms.

import { useRouter, useSearchParams } from "next/navigation";

import { FlaskConical, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { enterPreview } from "@/lib/preview-signin/client";
import { DEMO_ACCOUNT, NO_REAL_ACCOUNT } from "@/lib/preview-signin/shared";

const DEMO_LINE = `Demo account: ${DEMO_ACCOUNT.name} (${DEMO_ACCOUNT.role}) of the sample workspace ${DEMO_ACCOUNT.workspace}. Sample data only.`;

export function LiveDemoButton() {
  const router = useRouter();
  return (
    <div className="grid gap-1.5">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        data-live-demo
        onClick={() => {
          enterPreview("demo");
          toast.success("Live demo: you are using the demo account", {
            description: `${DEMO_LINE} ${NO_REAL_ACCOUNT}.`,
          });
          router.push("/dashboard/default");
        }}
      >
        <FlaskConical /> Open the live demo (demo account)
      </Button>
      <p className="text-center text-muted-foreground text-xs">{DEMO_LINE}</p>
    </div>
  );
}

/** Shown on the login page after Log out (?signedOut=1). */
export function SignedOutNotice() {
  const signedOut = useSearchParams().get("signedOut") === "1";
  if (!signedOut) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm" data-signed-out>
      <LogOut className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p>
        You are logged out of this preview. It had no real session to end: the preview has no accounts, so nothing else
        changed.
      </p>
    </div>
  );
}

export function PreviewFormNote({ kind }: { kind: "login" | "register" }) {
  return (
    <p className="text-center text-muted-foreground text-xs" data-preview-note>
      {kind === "login"
        ? "Preview: no account is checked. Any email and password of 6 or more characters open the demo workspace, and nothing you type is kept."
        : `${NO_REAL_ACCOUNT}. Nothing you type is sent or kept; you enter the demo workspace.`}
    </p>
  );
}
