"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useChatwootLink } from "@/app/(main)/dashboard/_components/chatwoot-link/link-context";
import { loadPreviewSection } from "@/lib/cw/persistence/client";
import { useViewer } from "@/lib/cw/view-as";

import { AssistantWelcome } from "./_components/assistant-welcome";
import { landingFor } from "./entry-routing";

export function StartRouter() {
  const router = useRouter();
  const viewer = useViewer();
  const link = useChatwootLink();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    const isNew = new URLSearchParams(window.location.search).get("first") === "1";
    const open = (savedSummary: boolean, hasInboxes = false) => {
      if (!active) return;
      const target = landingFor({ role: viewer.role, savedSummary, hasInboxes, isNew });
      if (target === "/dashboard/start") setReady(true);
      else router.replace(target);
    };
    if (viewer.role === "agent") open(false);
    else if (isNew) open(false);
    else if (link.state.mode === "linked" && !link.state.disabled) {
      fetch("/api/cw/inboxes", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Inbox state unavailable");
          const body = (await response.json()) as { payload?: unknown[] };
          if (!Array.isArray(body.payload)) throw new Error("Inbox state invalid");
          open(false, body.payload.length > 0);
        })
        .catch(() => {
          if (!active) return;
          setError("تعذر التحقق من القنوات المرتبطة؛ يمكنك متابعة اختيار القناة أو فتح الملخص يدويًا.");
          open(false);
        });
    } else {
      loadPreviewSection("summaryCards")
        .then((section) => open(section.rev > 0))
        .catch(() => {
          if (!active) return;
          setError("تعذرت قراءة الملخص المحفوظ؛ يمكنك متابعة اختيار القناة أو فتح الملخص يدويًا.");
          open(false);
        });
    }
    return () => {
      active = false;
    };
  }, [router, viewer.role, link.state.mode, link.state.disabled]);

  if (!ready) return <p role="status">جارٍ فتح مساحة العمل…</p>;
  return <AssistantWelcome notice={error} />;
}
