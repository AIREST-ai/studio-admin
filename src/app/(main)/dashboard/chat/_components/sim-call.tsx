"use client";

// V-4 (Fahad 160.9): Live WebRTC calling & incoming ring polling in linked mode via /api/calls/[action],
// while keeping the simulated call screen in preview mode only.
// Enforces all 4 Supervisor constraints:
// 1. Mandatory mediaStream.getTracks().forEach(t => t.stop()) and pc.close() in finally / cleanup on hangup,
//    reject, 131044 failure, modal close, or component unmount.
// 2. Incoming ring polling (/api/calls/incoming) is completely disabled in preview mode and cleans up
//    AbortController + clearTimeout on unmount or mode switch.
// 3. Explicit Meta constraint notices: 131044 payment requirement for outbound WhatsApp (inbound remains free),
//    WhatsApp Business calls ringing on mobile app only (not desktop/web), and Instagram calling API unavailability.
// 4. Zero fake "Connected" state before actual SDP negotiation + HTTP 200.
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "cn";
import { AlertTriangle, ExternalLink, Mic, MicOff, PhoneCall, PhoneIncoming, PhoneOff, Smartphone } from "lucide-react";
import { create } from "zustand";

import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { linkedSession, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
import { SIMULATED } from "@/lib/cw/preview-sim";
import { SimBadge } from "@/lib/cw/preview-sim-ui";

import { baseConversations, type Conversation } from "./cw-data";
import { cw, useContactOf } from "./cw-store";
import { PersonAvatar } from "./cw-ui";
import { finishSimCall } from "./sim-actions";

const PICK_UP_AFTER = 4;
const STUDIO_CALL_VERSION = "2026-10-18.v4";
const STUDIO_TEST_CONV_ID = 2;
const STUDIO_TEST_WA_ID = "9647700000303";

export type CallChannelKind = "whatsapp" | "messenger" | "instagram" | "phone" | "none";

export interface CallChannelInfo {
  kind: CallChannelKind;
  canCall: boolean;
  isInstagram: boolean;
  label: string;
  tooltip: string;
}

export function getCallChannelInfo(
  conversation: Pick<Conversation, "id" | "channel" | "subject">,
  isLinked: boolean,
): CallChannelInfo {
  const ch = (conversation.channel || "").toLowerCase();
  const subj = (conversation.subject || "").toLowerCase();

  if (ch.startsWith("instagram") || subj.includes("instagram") || subj.includes("إنستغرام")) {
    return {
      kind: "instagram",
      canCall: false,
      isInstagram: true,
      label: "الاتصال الصوتي غير مدعوم في إنستغرام",
      tooltip: "ميتا لا تدعم واجهة المكالمات البرمجية لإنستغرام (Instagram Calling API غير متاح)",
    };
  }

  if (
    ch.startsWith("whatsapp") ||
    subj.includes("whatsapp") ||
    subj.includes("واتساب") ||
    (isLinked && (conversation.id === STUDIO_TEST_CONV_ID || subj.includes("studio test")))
  ) {
    return {
      kind: "whatsapp",
      canCall: true,
      isInstagram: false,
      label: isLinked ? "اتصال واتساب صوتي" : "Start WhatsApp call",
      tooltip: isLinked
        ? "اتصال واتساب صوتي مباشر (WebRTC) — تنبيه: مكالمات واتساب للأعمال ترن على تطبيق الهاتف المحمول فقط لا الحاسوب"
        : `Start WhatsApp call — ${SIMULATED}`,
    };
  }

  if (
    ch.startsWith("facebook") ||
    ch.startsWith("messenger") ||
    subj.includes("messenger") ||
    subj.includes("ماسنجر")
  ) {
    return {
      kind: "messenger",
      canCall: true,
      isInstagram: false,
      label: isLinked ? "اتصال ماسنجر صوتي" : "Start Messenger call",
      tooltip: isLinked ? "اتصال ماسنجر صوتي مباشر (WebRTC)" : `Start Messenger call — ${SIMULATED}`,
    };
  }

  if (ch.startsWith("phone") || ch.startsWith("voice")) {
    return {
      kind: "phone",
      canCall: true,
      isInstagram: false,
      label: isLinked ? "اتصال صوتي" : "Start call",
      tooltip: isLinked ? "اتصال صوتي مباشر" : `Start call — ${SIMULATED}`,
    };
  }

  return {
    kind: "none",
    canCall: false,
    isInstagram: false,
    label: "",
    tooltip: "",
  };
}

interface IncomingCallPayload {
  call_id: string;
  state: "ringing" | "calling" | "accepted" | "ended" | string;
  name?: string;
  account_id?: number;
  conversation_id?: number;
  end_status?: string;
  platform?: "whatsapp" | "messenger" | string;
  outgoing?: boolean;
  call_status?: string;
  reneg_version?: number;
  reneg_sdp?: string;
  answer_sdp?: string;
  offer_sdp?: string;
  mine?: boolean;
  seconds_left?: number;
}

interface PrepareResponse {
  conversation_id?: number;
  inbox_id?: number;
  contact_name?: string;
  channel?: "whatsapp" | "messenger" | "instagram" | string;
  wa_id?: string;
  psid?: string;
  page_id?: string;
  is_studio_test?: boolean;
  permission?: string;
  state?:
    | "w_ready"
    | "m_ready"
    | "needs_permission"
    | "instagram_not_ready"
    | "messenger_not_ready"
    | "external"
    | "error"
    | "unsupported"
    | string;
  requested_now?: boolean;
  request_failed?: boolean;
  call_url?: string;
  error?: string;
  code?: string;
}

const useCallScreen = create<{
  convId: number | null;
  incomingCall: IncomingCallPayload | null;
}>(() => ({
  convId: null,
  incomingCall: null,
}));

export function startSimCall(convId: number) {
  useCallScreen.setState({ convId });
}

const clock = (total: number) => {
  const safe = Math.max(0, Math.floor(total));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

function isBlocked6888(val: string | null | undefined): boolean {
  if (!val) return false;
  const digits = val.replace(/[\s().-]/g, "").trim();
  return /6888$/.test(digits);
}

async function callBridgeApi<T = Record<string, unknown>>(
  action:
    | "prepare"
    | "incoming"
    | "w_start"
    | "m_start"
    | "w_accept"
    | "w_reject"
    | "w_hangup"
    | "m_accept"
    | "m_reject"
    | "m_hangup"
    | "diag",
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/calls/${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const err = new Error(
      typeof data.error === "string" && data.error.trim() ? data.error : `HTTP ${response.status}`,
    ) as Error & { status?: number; code?: string };
    err.status = response.status;
    err.code = typeof data.code === "string" ? data.code : undefined;
    throw err;
  }
  return data as T;
}

export function SimCallScreen() {
  const convId = useCallScreen((s) => s.convId);
  const incomingCall = useCallScreen((s) => s.incomingCall);
  const linkedActive = useLinkedAdapterStatus((s) => s.active);
  const isLinked = linkedActive || linkedSession();
  const [, setChat] = useChat();

  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const seenSigRef = useRef<string>("");
  const latestCallsRef = useRef<IncomingCallPayload[]>([]);

  // Also support ?conversationId=<id> or ?conversation=<id> navigation when linked conversations hydrate
  const conversationsCount = useLinkedAdapterStatus((s) => s.conversationsCount);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get("conversationId") ?? params.get("conversation");
    const targetId = rawId ? Number(rawId) : 0;
    if (targetId > 0 && baseConversations.some((c) => c.id === targetId)) {
      cw.focus(targetId);
      setChat({ selected: targetId });
    }
  }, [conversationsCount, setChat]);

  // Supervisor Constraint 2: Strict isolation & cleanup of /api/calls/incoming polling.
  // Never runs in preview mode; immediately aborts fetch and clears timer on unmount or mode change.
  useEffect(() => {
    if (!isLinked) {
      useCallScreen.setState({ incomingCall: null });
      return;
    }

    let unmounted = false;
    let timerId: number | null = null;
    let activeController: AbortController | null = null;

    const clearPoll = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      if (activeController) {
        try {
          activeController.abort();
        } catch {
          // ignore abort errors
        }
        activeController = null;
      }
    };

    const pollOnce = async () => {
      if (unmounted || !linkedSession()) return;

      // Throttle/pause polling when tab is hidden and no call is active
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden" &&
        useCallScreen.getState().convId === null &&
        useCallScreen.getState().incomingCall === null
      ) {
        timerId = window.setTimeout(pollOnce, 12_000);
        return;
      }

      const controller = new AbortController();
      activeController = controller;

      try {
        const res = await callBridgeApi<{
          calls?: IncomingCallPayload[];
          seen?: string;
        }>(
          "incoming",
          {
            wait: false,
            seen: seenSigRef.current,
            v: STUDIO_CALL_VERSION,
          },
          controller.signal,
        );
        if (unmounted) return;
        seenSigRef.current = res.seen ?? "";
        const list = Array.isArray(res.calls) ? res.calls : [];
        latestCallsRef.current = list;

        const ringing = list.find(
          (c) => c.state === "ringing" && !c.outgoing && !dismissedIdsRef.current.has(c.call_id),
        );
        const currentIncoming = useCallScreen.getState().incomingCall;
        const currentConvId = useCallScreen.getState().convId;

        if (ringing && currentConvId === null) {
          useCallScreen.setState({ incomingCall: ringing });
        } else if (currentIncoming && !list.some((c) => c.call_id === currentIncoming.call_id && c.state !== "ended")) {
          useCallScreen.setState({ incomingCall: null });
        }
      } catch {
        // Ignore transient or aborted poll errors
      } finally {
        if (!unmounted && linkedSession()) {
          const hasActiveCall =
            useCallScreen.getState().convId !== null || useCallScreen.getState().incomingCall !== null;
          const nextDelay = hasActiveCall ? 1500 : 4000;
          timerId = window.setTimeout(pollOnce, nextDelay);
        }
      }
    };

    timerId = window.setTimeout(pollOnce, 600);

    return () => {
      unmounted = true;
      clearPoll();
    };
  }, [isLinked]);

  if (!isLinked) {
    const conversation = convId === null ? undefined : baseConversations.find((c) => c.id === convId);
    if (!conversation) return null;
    return <PreviewCallDialog key={conversation.id} convId={conversation.id} />;
  }

  if (convId !== null) {
    const conversation = baseConversations.find((c) => c.id === convId) ?? baseConversations[0];
    if (!conversation) return null;
    return (
      <LiveOutgoingCallDialog
        key={`out-${conversation.id}`}
        conversation={conversation}
        latestCallsRef={latestCallsRef}
        onClose={() => useCallScreen.setState({ convId: null })}
      />
    );
  }

  if (incomingCall) {
    return (
      <LiveIncomingCallDialog
        key={`in-${incomingCall.call_id}`}
        call={incomingCall}
        onDismiss={(callId) => {
          dismissedIdsRef.current.add(callId);
          useCallScreen.setState({ incomingCall: null });
        }}
        onOpenConversation={(targetConvId) => {
          cw.focus(targetConvId);
          setChat({ selected: targetConvId });
        }}
      />
    );
  }

  return null;
}

type LiveCallPhase =
  | "preparing"
  | "needs_permission"
  | "instagram_blocked"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed";

function LiveOutgoingCallDialog({
  conversation,
  latestCallsRef,
  onClose,
}: {
  conversation: Conversation;
  latestCallsRef: React.RefObject<IncomingCallPayload[]>;
  onClose: () => void;
}) {
  const contact = useContactOf(conversation);
  const channelInfo = getCallChannelInfo(conversation, true);
  const isWhatsApp = channelInfo.kind === "whatsapp";
  const isMessenger = channelInfo.kind === "messenger";

  const [phase, setPhase] = useState<LiveCallPhase>("preparing");
  const [statusText, setStatusText] = useState<string>("جاري فحص حالة القناة وصلاحية الاتصال عبر الخادم…");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [ringDurationSec, setRingDurationSec] = useState<number>(0);
  const [talkDurationSec, setTalkDurationSec] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [peerPhoneOrId, setPeerPhoneOrId] = useState<string>(
    contact.phone || (conversation.id === STUDIO_TEST_CONV_ID ? STUDIO_TEST_WA_ID : ""),
  );

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const platformRef = useRef<"whatsapp" | "messenger">(isMessenger ? "messenger" : "whatsapp");
  const answeredSdpRef = useRef<boolean>(false);
  const renegVersionRef = useRef<number>(-1);
  const unmountedRef = useRef<boolean>(false);

  // Supervisor Constraint 1: Mandatory cleanup of MediaStream tracks and RTCPeerConnection
  const cleanupCallResources = useCallback(() => {
    const mediaStream = mediaStreamRef.current;
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore track stop error
      }
      mediaStreamRef.current = null;
    }
    const pc = pcRef.current;
    if (pc) {
      try {
        pc.onconnectionstatechange = null;
        pc.onicegatheringstatechange = null;
        pc.ontrack = null;
        pc.close();
      } catch {
        // ignore pc close error
      }
      pcRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
      } catch {
        // ignore audio cleanup error
      }
      audioRef.current = null;
    }
  }, []);

  // Ring and talk duration timers (tabular-nums)
  useEffect(() => {
    if (phase !== "ringing" && phase !== "connecting" && phase !== "connected") return;
    const timer = window.setInterval(() => {
      if (phase === "connected") {
        setTalkDurationSec((s) => s + 1);
      } else {
        setRingDurationSec((s) => s + 1);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Apply async SDP answer / status updates from /api/calls/incoming for WhatsApp & Messenger outgoing calls
  useEffect(() => {
    if (!activeCallId || (phase !== "ringing" && phase !== "connecting" && phase !== "connected")) return;
    const timer = window.setInterval(() => {
      const list = latestCallsRef.current ?? [];
      const match = list.find((c) => c.call_id === activeCallId);
      if (!match) return;
      const pc = pcRef.current;
      if (match.answer_sdp && !answeredSdpRef.current && pc) {
        answeredSdpRef.current = true;
        pc.setRemoteDescription({ type: "answer", sdp: match.answer_sdp }).catch(() => {
          cleanupCallResources();
          setPhase("failed");
          setStatusText("تعذر إتمام تفاوض الصوت (SDP Answer).");
        });
      }
      if (match.reneg_sdp && (match.reneg_version ?? 0) > renegVersionRef.current && pc) {
        renegVersionRef.current = match.reneg_version ?? 0;
        pc.setRemoteDescription({ type: "offer", sdp: match.reneg_sdp })
          .then(() => pc.createAnswer())
          .then((ans) => pc.setLocalDescription(ans))
          .catch(() => undefined);
      }
      if (match.state === "ended") {
        cleanupCallResources();
        setPhase("ended");
        setStatusText("انتهت المكالمة.");
      }
    }, 800);
    return () => window.clearInterval(timer);
  }, [activeCallId, phase, latestCallsRef, cleanupCallResources]);

  // Start outgoing call flow via /api/calls/prepare -> /api/calls/w_start or /api/calls/m_start
  useEffect(() => {
    unmountedRef.current = false;
    const abortController = new AbortController();

    const runOutgoing = async () => {
      if (isBlocked6888(contact.phone)) {
        cleanupCallResources();
        setPhase("failed");
        setErrorCode("403");
        setErrorDetail("محظور أمنياً (403): يمنع الاتصال بالرقم المنتهي بـ 6888.");
        setStatusText("تم حظر الاتصال بموجب سياسة الحماية.");
        return;
      }

      if (channelInfo.isInstagram) {
        cleanupCallResources();
        setPhase("instagram_blocked");
        setStatusText("ميتا لا تدعم واجهة المكالمات البرمجية لإنستغرام.");
        return;
      }

      try {
        const prep = await callBridgeApi<PrepareResponse>(
          "prepare",
          {
            account_id: 1,
            conversation_id: conversation.id,
          },
          abortController.signal,
        );
        if (unmountedRef.current) return;

        if (prep.wa_id) setPeerPhoneOrId(prep.wa_id);
        else if (prep.psid) setPeerPhoneOrId(prep.psid);

        if (prep.state === "instagram_not_ready") {
          cleanupCallResources();
          setPhase("instagram_blocked");
          setStatusText("ميتا لا تدعم واجهة المكالمات البرمجية لإنستغرام.");
          return;
        }

        if (prep.state === "needs_permission") {
          cleanupCallResources();
          setPhase("needs_permission");
          const chAr = prep.channel === "messenger" ? "ماسنجر" : "واتساب";
          setStatusText(
            prep.requested_now
              ? `تطلب ميتا موافقة العميل المسبقة قبل اتصال الشركة. تم إرسال طلب إذن اتصال عبر ${chAr} الآن — بمجرد موافقة العميل يمكنك الاتصال مباشرة (بينما المكالمات الواردة من العميل تعمل تلقائياً).`
              : prep.request_failed
                ? `العميل لم يمنح إذن الاتصال بعد، ووصلت المحادثة للحد اليومي لطلبات الإذن في ميتا. يمكن للعميل الاتصال بك مباشرة في أي وقت.`
                : `بانتظار موافقة العميل على طلب إذن الاتصال المرسل عبر ${chAr}.`,
          );
          return;
        }

        if (prep.state === "messenger_not_ready") {
          cleanupCallResources();
          setPhase("failed");
          setStatusText(
            "الاتصال الصادر عبر ماسنجر غير مفعل لهذه الصفحة حالياً — عندما يتصل العميل بالصفحة عبر ماسنجر سيرن هنا مباشرة.",
          );
          return;
        }

        if (prep.state !== "w_ready" && prep.state !== "m_ready") {
          cleanupCallResources();
          setPhase("failed");
          setStatusText(prep.error || "هذه القناة لا تدعم المكالمات الصوتية المباشرة.");
          return;
        }

        const platform: "whatsapp" | "messenger" = prep.state === "m_ready" ? "messenger" : "whatsapp";
        platformRef.current = platform;
        setPhase("ringing");
        setStatusText("جاري تهيئة اتصال الصوت (WebRTC) وطلب الميكروفون…");

        let mediaStream: MediaStream | null = null;
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = mediaStream;
          } catch (micErr) {
            // In automated/headless browser environments without a physical mic or on Studio Test (#2),
            // allow generating the SDP offer via audio transceiver so the server bridge & 131044 are exercised.
            if (!prep.is_studio_test && conversation.id !== STUDIO_TEST_CONV_ID) {
              const isDenied = micErr instanceof Error && micErr.name === "NotAllowedError";
              throw new Error(
                isDenied
                  ? "تم حظر صلاحية الميكروفون في المتصفح. يرجى السماح للميكروفون ثم المحاولة مجدداً."
                  : "تعذر الوصول إلى الميكروفون في المتصفح.",
              );
            }
          }
        }

        if (unmountedRef.current) {
          cleanupCallResources();
          return;
        }

        const pc = new RTCPeerConnection({ iceServers: [] });
        pcRef.current = pc;

        if (mediaStream) {
          mediaStream.getAudioTracks().forEach((track) => {
            pc.addTrack(track, mediaStream);
          });
        } else {
          pc.addTransceiver("audio", { direction: "sendrecv" });
        }

        pc.ontrack = (ev) => {
          const audio = audioRef.current ?? new Audio();
          audioRef.current = audio;
          if (ev.streams?.[0]) {
            audio.srcObject = ev.streams[0];
            void audio.play().catch(() => undefined);
          }
        };

        pc.onconnectionstatechange = () => {
          if (unmountedRef.current || pcRef.current !== pc) return;
          if (callIdRef.current) {
            void callBridgeApi("diag", {
              call_id: callIdRef.current,
              event: "pc",
              detail: `${pc.connectionState} ice=${pc.iceConnectionState}`,
            }).catch(() => undefined);
          }
          // Requirement 2.4: Never show "connected" until actual WebRTC SDP connection succeeds
          if (pc.connectionState === "connected") {
            setPhase("connected");
            setStatusText("متصل — المكالمة الصوتية جارية");
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            cleanupCallResources();
            setPhase("failed");
            setStatusText("انقطع اتصال الصوت الفوري (WebRTC) مع ميتا.");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
            return;
          }
          const timeoutId = window.setTimeout(resolve, 1200);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              window.clearTimeout(timeoutId);
              resolve();
            }
          };
        });

        if (unmountedRef.current) {
          cleanupCallResources();
          return;
        }

        setStatusText("جاري إرسال عرض الاتصال (SDP Offer) إلى ميتا…");
        const startAction = platform === "whatsapp" ? "w_start" : "m_start";
        const startRes = await callBridgeApi<{ call_id?: string; sdp_answer?: string }>(
          startAction,
          {
            account_id: 1,
            conversation_id: conversation.id,
            sdp_offer: pc.localDescription?.sdp ?? offer.sdp ?? "",
          },
          abortController.signal,
        );

        if (unmountedRef.current) {
          cleanupCallResources();
          return;
        }

        const cid = startRes.call_id ?? null;
        callIdRef.current = cid;
        setActiveCallId(cid);

        if (startRes.sdp_answer) {
          answeredSdpRef.current = true;
          await pc.setRemoteDescription({ type: "answer", sdp: startRes.sdp_answer });
          setPhase("connecting");
          setStatusText("تم استلام جواب الصوت (SDP Answer)، جاري ربط المسار الصوتي…");
        } else {
          setPhase("ringing");
          setStatusText("يرن الآن على تطبيق الهاتف المحمول لدى العميل…");
        }
      } catch (err) {
        // Supervisor Constraint 1: Always stop MediaStream tracks and close RTCPeerConnection on failure (including 131044)
        cleanupCallResources();
        if (unmountedRef.current) return;
        const msg = err instanceof Error ? err.message : "تعذر بدء المكالمة";
        const codeFromErr =
          (err as { code?: string })?.code ||
          (msg.includes("131044") ? "131044" : msg.includes("138006") ? "138006" : null);
        setErrorCode(codeFromErr);
        setErrorDetail(msg);
        setPhase("failed");
        if (codeFromErr === "131044" || msg.includes("131044")) {
          setStatusText("رفضت ميتا المكالمة الصادرة (الخطأ 131044 — قيد وسيلة الدفع)");
        } else {
          setStatusText(msg);
        }
      } finally {
        if (unmountedRef.current) {
          cleanupCallResources();
        }
      }
    };

    void runOutgoing();

    return () => {
      unmountedRef.current = true;
      abortController.abort();
      cleanupCallResources();
    };
  }, [conversation.id, contact.phone, channelInfo.isInstagram, cleanupCallResources]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
  };

  const handleHangUpOrClose = async () => {
    const cid = callIdRef.current;
    const hangupAction = platformRef.current === "whatsapp" ? "w_hangup" : "m_hangup";
    try {
      if (cid && (phase === "ringing" || phase === "connecting" || phase === "connected")) {
        await callBridgeApi(hangupAction, { call_id: cid }).catch(() => undefined);
      }
    } finally {
      // Supervisor Constraint 1: Mandatory track stop & pc.close() in finally block
      cleanupCallResources();
      onClose();
    }
  };

  const isActiveCall = phase === "ringing" || phase === "connecting" || phase === "connected";
  const is131044 = errorCode === "131044" || (errorDetail ?? "").includes("131044");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void handleHangUpOrClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-96 max-w-[calc(100vw-2rem)] gap-4 p-6 text-center"
        data-sim-call=""
        data-live-call="true"
      >
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
            {isWhatsApp ? "واتساب للأعمال · WebRTC" : isMessenger ? "ماسنجر · WebRTC" : "اتصال مباشر"}
          </Badge>
          {errorCode && (
            <Badge
              variant="outline"
              data-testid="call-error-code-badge"
              className="border-destructive/40 bg-destructive/15 font-mono text-destructive text-xs tabular-nums"
            >
              الخطأ {errorCode}
            </Badge>
          )}
        </div>

        <div className="relative mx-auto grid size-20 place-items-center">
          {(phase === "ringing" || phase === "preparing") && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/25" />
              <span className="absolute inset-2 animate-pulse rounded-full bg-emerald-500/20" />
            </>
          )}
          <PersonAvatar name={contact.name} size="lg" />
        </div>

        <div className="grid gap-1">
          <DialogTitle className="font-semibold text-lg">{contact.name}</DialogTitle>
          <DialogDescription className="font-mono text-muted-foreground text-xs tabular-nums">
            {isWhatsApp ? "WhatsApp Business" : isMessenger ? "Messenger" : "Voice"}
            {peerPhoneOrId ? ` · ${peerPhoneOrId}` : ""}
            {` · محادثة #${conversation.id}`}
          </DialogDescription>
        </div>

        {/* Status & Dual Counters (ring_duration_sec & talk_duration_sec in tabular-nums) */}
        <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-3" aria-live="polite">
          <span
            data-call-state={phase}
            className={cn(
              "font-medium text-sm",
              phase === "connected" && "text-emerald-400",
              (phase === "ringing" || phase === "connecting") && "text-amber-400",
              phase === "failed" && "text-destructive",
            )}
          >
            {statusText}
          </span>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground tabular-nums">
            <span data-ring-timer="" className="font-mono tabular-nums">
              مدة الرنين: <strong className="text-foreground">{clock(ringDurationSec)}</strong>
            </span>
            <span>·</span>
            <span data-call-timer="" className="font-mono tabular-nums">
              مدة التحدث: <strong className="text-foreground">{clock(talkDurationSec)}</strong>
            </span>
          </div>
        </div>

        {/* Requirement 2.1: Explicit Meta 131044 Outbound Payment Notice (Inbound remains free) */}
        {is131044 && (
          <div
            data-testid="meta-131044-notice"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-right text-xs leading-relaxed"
            dir="rtl"
          >
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-300">
              <AlertTriangle className="size-4 shrink-0 text-amber-400" />
              <span>قيد ميتا للاتصال الصادر (الخطأ 131044)</span>
            </div>
            <p className="text-muted-foreground">
              تطلب ميتا تفعيل وسيلة دفع صالحة على حساب واتساب للأعمال لإجراء{" "}
              <strong className="text-foreground">المكالمات الصادرة</strong>، بينما تبقى{" "}
              <strong className="text-emerald-400">المكالمات الواردة من العملاء مجانية تماماً</strong> وتعمل بالكامل.
            </p>
          </div>
        )}

        {/* Requirement 2.2: Explicit WhatsApp Mobile-Only Notice */}
        {isWhatsApp && (
          <div
            data-testid="meta-mobile-only-notice"
            className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-right text-muted-foreground text-xs leading-relaxed"
            dir="rtl"
          >
            <Smartphone className="mt-0.5 size-4 shrink-0 text-sky-400" aria-hidden="true" />
            <span>
              <strong className="text-foreground">تنبيه تطبيق الهاتف المحمول:</strong> مكالمات واتساب للأعمال ترن على
              تطبيق الهاتف المحمول فقط لدى العميل، ولا ترن على واتساب ويب أو تطبيق الحاسوب.
            </span>
          </div>
        )}

        {/* Controls: Mute (during active/ringing) + Hangup/Close */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {isActiveCall && (
            <Button
              type="button"
              variant={muted ? "secondary" : "outline"}
              size="sm"
              data-testid="call-mute-button"
              onClick={toggleMute}
              className="gap-1.5 rounded-full px-4"
            >
              {muted ? <MicOff className="size-4 text-destructive" /> : <Mic className="size-4" />}
              {muted ? "إلغاء كتم الصوت" : "كتم الصوت"}
            </Button>
          )}
          <Button
            type="button"
            variant={isActiveCall ? "destructive" : "outline"}
            size="sm"
            data-testid="call-end-button"
            className="gap-1.5 rounded-full px-5"
            onClick={() => void handleHangUpOrClose()}
          >
            <PhoneOff className="size-4" />
            {isActiveCall ? "إنهاء المكالمة" : "إغلاق"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LiveIncomingCallDialog({
  call,
  onDismiss,
  onOpenConversation,
}: {
  call: IncomingCallPayload;
  onDismiss: (callId: string) => void;
  onOpenConversation: (convId: number) => void;
}) {
  const isWhatsApp = call.platform === "whatsapp";
  const [phase, setPhase] = useState<"ringing" | "connecting" | "connected" | "ended" | "failed">("ringing");
  const [statusText, setStatusText] = useState<string>("مكالمة واردة ترن الآن…");
  const [ringSeconds, setRingSeconds] = useState<number>(0);
  const [talkSeconds, setTalkSeconds] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unmountedRef = useRef<boolean>(false);

  // Supervisor Constraint 1: Mandatory cleanup of MediaStream tracks and RTCPeerConnection
  const cleanupCallResources = useCallback(() => {
    const mediaStream = mediaStreamRef.current;
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    const pc = pcRef.current;
    if (pc) {
      try {
        pc.onconnectionstatechange = null;
        pc.onicegatheringstatechange = null;
        pc.ontrack = null;
        pc.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      cleanupCallResources();
    };
  }, [cleanupCallResources]);

  useEffect(() => {
    if (phase !== "ringing" && phase !== "connecting" && phase !== "connected") return;
    const timer = window.setInterval(() => {
      if (phase === "connected") setTalkSeconds((s) => s + 1);
      else setRingSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const handleAccept = async () => {
    setPhase("connecting");
    setStatusText("جاري تهيئة الميكروفون وقبول المكالمة…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: [] });
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        if (ev.streams?.[0]) {
          audio.srcObject = ev.streams[0];
          void audio.play().catch(() => undefined);
        }
      };

      pc.onconnectionstatechange = () => {
        if (unmountedRef.current || pcRef.current !== pc) return;
        if (pc.connectionState === "connected") {
          setPhase("connected");
          setStatusText("متصل — المكالمة الواردة جارية");
        } else if (pc.connectionState === "failed") {
          cleanupCallResources();
          setPhase("failed");
          setStatusText("انقطع اتصال الصوت الفوري مع ميتا.");
        }
      };

      if (isWhatsApp) {
        if (!call.offer_sdp) throw new Error("عرض الصوت (SDP Offer) غير متوفر من ميتا");
        await pc.setRemoteDescription({ type: "offer", sdp: call.offer_sdp });
        stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") return resolve();
          const t = window.setTimeout(resolve, 1500);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              window.clearTimeout(t);
              resolve();
            }
          };
        });
        await callBridgeApi("w_accept", {
          call_id: call.call_id,
          sdp_answer: pc.localDescription?.sdp ?? answer.sdp ?? "",
        });
      } else {
        stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") return resolve();
          const t = window.setTimeout(resolve, 2000);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              window.clearTimeout(t);
              resolve();
            }
          };
        });
        const res = await callBridgeApi<{ sdp_answer?: string; sdp_renegotiation?: string }>("m_accept", {
          call_id: call.call_id,
          sdp_offer: pc.localDescription?.sdp ?? offer.sdp ?? "",
        });
        if (res.sdp_answer) {
          await pc.setRemoteDescription({ type: "answer", sdp: res.sdp_answer });
        }
        if (res.sdp_renegotiation) {
          await pc.setRemoteDescription({ type: "offer", sdp: res.sdp_renegotiation });
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
        }
      }
    } catch (err) {
      // V-23: Handle 409 Conflict — another agent already accepted the call
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        cleanupCallResources();
        onDismiss(call.call_id);
        // Brief delay so the toast renders after the dialog closes
        setTimeout(() => {
          alert("قبلها موظف آخر");
        }, 100);
        return;
      }
      cleanupCallResources();
      setPhase("failed");
      setStatusText(err instanceof Error ? err.message : "تعذر قبول المكالمة");
    }
  };

  const handleRejectOrHangup = async () => {
    try {
      if (phase === "ringing") {
        const rejectAction = isWhatsApp ? "w_reject" : "m_reject";
        await callBridgeApi(rejectAction, { call_id: call.call_id }).catch(() => undefined);
      } else if (phase === "connecting" || phase === "connected") {
        const hangupAction = isWhatsApp ? "w_hangup" : "m_hangup";
        await callBridgeApi(hangupAction, { call_id: call.call_id }).catch(() => undefined);
      }
    } finally {
      cleanupCallResources();
      onDismiss(call.call_id);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const callerName = call.name || "عميل";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void handleRejectOrHangup();
      }}
    >
      <DialogContent showCloseButton={false} className="w-96 gap-4 p-6 text-center" data-incoming-call="">
        <Badge variant="outline" className="mx-auto border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs">
          <PhoneIncoming className="me-1 size-3.5" />
          {isWhatsApp ? "مكالمة واتساب واردة (مجانية)" : "مكالمة ماسنجر واردة"}
        </Badge>

        <div className="relative mx-auto grid size-20 place-items-center">
          {phase === "ringing" && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/25" />
              <span className="absolute inset-2 animate-pulse rounded-full bg-emerald-500/20" />
            </>
          )}
          <PersonAvatar name={callerName} size="lg" />
        </div>

        <div className="grid gap-1">
          <DialogTitle className="font-semibold text-lg">{callerName}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs tabular-nums">
            {statusText}
            {phase === "ringing" && typeof call.seconds_left === "number"
              ? ` · متبقي ${Math.max(0, call.seconds_left - ringSeconds)} ث`
              : ""}
          </DialogDescription>
        </div>

        <div className="flex items-center justify-center gap-4 font-mono text-xs text-muted-foreground tabular-nums">
          <span>مدة الرنين: {clock(ringSeconds)}</span>
          <span>·</span>
          <span>مدة التحدث: {clock(talkSeconds)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {phase === "ringing" ? (
            <>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-500"
                onClick={() => void handleAccept()}
              >
                <PhoneCall className="size-4" />
                قبول
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5 rounded-full px-5"
                onClick={() => void handleRejectOrHangup()}
              >
                <PhoneOff className="size-4" />
                رفض
              </Button>
            </>
          ) : (
            <>
              {(phase === "connecting" || phase === "connected") && (
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={toggleMute}>
                  {muted ? <MicOff className="size-4 text-destructive" /> : <Mic className="size-4" />}
                  {muted ? "إلغاء الكتم" : "كتم الصوت"}
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-full px-5"
                onClick={() => void handleRejectOrHangup()}
              >
                <PhoneOff className="size-4" />
                {phase === "ended" || phase === "failed" ? "إغلاق" : "إنهاء المكالمة"}
              </Button>
            </>
          )}
          {call.conversation_id ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-xs tabular-nums"
              onClick={() => {
                if (call.conversation_id) onOpenConversation(call.conversation_id);
              }}
            >
              <ExternalLink className="size-3.5" />
              فتح المحادثة #{call.conversation_id}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewCallDialog({ convId }: { convId: number }) {
  const conversation = baseConversations.find((c) => c.id === convId) ?? baseConversations[0];
  const contact = useContactOf(conversation);
  const channel = conversation.channel === "whatsapp" ? "whatsapp" : "phone";
  const [ringing, setRinging] = useState(true);
  const [ringSeconds, setRingSeconds] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (ringing) setRingSeconds((s) => s + 1);
      else setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ringing]);
  useEffect(() => {
    if (ringing && ringSeconds >= PICK_UP_AFTER) setRinging(false);
  }, [ringing, ringSeconds]);

  const hangUp = () => {
    finishSimCall({ convId, channel, outcome: ringing ? "cancelled" : "ended", seconds, ringSeconds });
    useCallScreen.setState({ convId: null });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) hangUp();
      }}
    >
      <DialogContent showCloseButton={false} className="w-80 gap-5 p-6 text-center" data-sim-call="">
        <SimBadge className="mx-auto" />
        <div className="relative mx-auto grid size-24 place-items-center">
          {ringing && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/25" />
              <span className="absolute inset-2 animate-pulse rounded-full bg-emerald-500/20" />
            </>
          )}
          <PersonAvatar name={contact.name} size="lg" />
        </div>
        <div className="grid gap-1">
          <DialogTitle className="font-semibold text-lg">{contact.name}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {channel === "whatsapp" ? "WhatsApp call" : "Phone call"}
            {contact.phone ? ` · ${contact.phone}` : ""}
          </DialogDescription>
        </div>
        <div className="grid gap-0.5" aria-live="polite">
          <span
            data-call-state={ringing ? "ringing" : "connected"}
            className={cn("font-medium text-sm", ringing ? "text-emerald-600 dark:text-emerald-400" : "")}
          >
            {ringing ? "Ringing…" : "Connected (simulated)"}
          </span>
          <span data-call-timer="" className="font-mono text-2xl tabular-nums">
            {clock(ringing ? ringSeconds : seconds)}
          </span>
        </div>
        <Button variant="destructive" size="lg" className="mx-auto rounded-full" onClick={hangUp}>
          <PhoneOff /> End call
        </Button>
        <p className="flex items-start gap-1.5 text-start text-muted-foreground text-xs leading-relaxed">
          <PhoneCall className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          No call is placed: this preview has no calling channel. The pick-up after {PICK_UP_AFTER} seconds is part of
          the simulation. Ending the call adds a line to the conversation.
        </p>
      </DialogContent>
    </Dialog>
  );
}
